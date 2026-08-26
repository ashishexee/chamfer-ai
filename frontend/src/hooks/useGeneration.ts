import { useCallback, useEffect } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import { API_URL, getProviderDisplayName } from "@/lib/constants";
import { seedPipeline, STEP_RANK } from "@/lib/pipelineSteps";
import type {
  Message,
  ClarificationOption,
  WorkflowStep,
  Specification,
  InspectionData,
  ParameterSchema,
} from "@/types";

/**
 * Handles the entire generation pipeline — SSE streaming, clarification,
 * edit, retry, and new-task reset. This was ~480 lines in the original App.tsx.
 */
export function useGeneration(
  store: AppStore,
  helpers: {
    uploadModelTo0G: (model: any) => Promise<any>;
    saveCurrentSession: () => void;
    resetParams: () => void;
  },
) {
  const {
    auth,
    authHeaders,
    prompt,
    setPrompt,
    images,
    setImages,
    messages,
    setMessages,
    isGenerating,
    setIsGenerating,
    provider,
    streamReasoning,
    setStreamReasoning,
    reasoningEnabled,
    sessionId,
    setSessionId,
    chatSessionId,
    setChatSessionId,
    setLatestMessageOrder,
    setCurrentCode,
    setParameters,
    setParamValues,
    setStlUrl,
    setStlObjectUrl,
    setStlBase64,
    setStepBase64,
    setGlbBase64,
    setSnapshots,
    setDimViews,
    setInspection,
    setExportFilename,
    setHasUnsavedParamIteration,
    setModelStorageStatus,
    setEditingMessageIndex,
    editOriginalPrompt,
    setEditOriginalPrompt,
    stlObjectUrl,
    sidebarManuallyToggled,
    setSidebarOpen,
    reasoningBufferRef,
    reasoningRafRef,
    assistantMessageIdRef,
    setRootHashes,
    setTxSeqs,
    setRootHashesLoading,
    setUploadProgress,
  } = store;

  const { uploadModelTo0G, saveCurrentSession, resetParams } = helpers;

  // Check if current provider supports vision
  useEffect(() => {
    fetch(`${API_URL}/api/providers`)
      .then((r) => r.json())
      .then((data) => {
        const p = (data.providers || []).find((p: any) => p.id === provider);
        store.setProviderSupportsVision(p?.supportsVision || false);
      })
      .catch(() => store.setProviderSupportsVision(false));
  }, [provider]);

  // Clear images if provider changed to non-vision
  useEffect(() => {
    if (!store.providerSupportsVision && images.length > 0) {
      setImages([]);
    }
  }, [store.providerSupportsVision]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
    };
  }, [stlObjectUrl]);

  const handleGenerate = useCallback(
    async (
      answers?: string,
      overridePrompt?: string,
      answerList?: Specification[],
      editMode?: boolean,
    ) => {
      const activePrompt = overridePrompt ?? prompt;
      if ((!activePrompt.trim() && images.length === 0) || isGenerating) return;
      if (!auth.isConnected) {
        setPrompt("");
        return;
      }

      const isClarificationContinue = !!overridePrompt;
      const userMsg: Message = {
        role: "user",
        content: activePrompt,
        images: images.length > 0 ? [...images] : undefined,
        timestamp: Date.now(),
      };
      const answerMsg: Message | null =
        answers && answerList
          ? {
              role: "user",
              content: answers,
              specifications: answerList,
              timestamp: Date.now(),
            }
          : null;
      if (!isClarificationContinue && !editMode) {
        setMessages((prev) => [...prev, userMsg]);
      }

      if (!editMode) {
        setPrompt("");
      }
      setIsGenerating(true);
      setStreamReasoning("");
      setSnapshots({});
      setDimViews({});
      setInspection(null);
      setEditingMessageIndex(null);
      reasoningBufferRef.current = "";
      if (reasoningRafRef.current) {
        cancelAnimationFrame(reasoningRafRef.current);
        reasoningRafRef.current = null;
      }

      // Declared outside the try so the catch path can attach the timeline to its error message.
      let liveSteps: WorkflowStep[] = seedPipeline({ clarifyDone: !!answers });

      try {
        const res = await fetch(`${API_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            prompt: userMsg.content,
            provider,
            history: messages,
            answers,
            reasoning: reasoningEnabled,
            images: userMsg.images,
            sessionId: editMode ? sessionId : undefined,
            editMode: editMode || false,
            enableVision: userMsg.images && userMsg.images.length > 0,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "",
          finalData: any = null,
          currentEvent = "";
        let clarifyQuestions: ClarificationOption[] | null = null;
        let liveInspection: InspectionData | null = null;
        let liveSnapshots: Record<string, string> = {};
        let liveDimViews: Record<string, string> = {};
        let visionFeedback: string | null = null;
        let visionVerified = false;
        let streamWarning: string | undefined;
        // Seed the canonical pipeline so the timeline is stable from frame 1:
        // pending steps stay hidden until their turn, revealed ones never vanish.
        // When answering clarification questions, step 1 starts pre-completed so
        // the checklist flows continuously across the two-request round-trip.
        liveSteps = seedPipeline({ clarifyDone: !!answers });
        assistantMessageIdRef.current = null;

        // Add a placeholder assistant message that will accumulate steps during generation
        setMessages((prev) => {
          assistantMessageIdRef.current = prev.length;
          return [
            ...prev,
            {
              role: "assistant",
              content: "",
              provider,
              steps: liveSteps,
              editMode: editMode || false,
              timestamp: Date.now(),
            },
          ];
        });

        const updateSteps = (steps: WorkflowStep[]) => {
          liveSteps = steps;
          if (assistantMessageIdRef.current !== null) {
            setMessages((prev) => {
              const next = [...prev];
              if (next[assistantMessageIdRef.current!]) {
                next[assistantMessageIdRef.current!] = {
                  ...next[assistantMessageIdRef.current!],
                  steps,
                };
              }
              return next;
            });
          }
        };

        // Minimum on-screen time per step: the backend emits step(running) and
        // stepDone() back-to-back for fast stages, so without this gate several
        // checkmarks would pop in fully done within one network flush. A step
        // that arrives already-done first reveals as running, then flips after
        // the minimum elapses. Purely visual — real work is never delayed.
        const MIN_STEP_MS = 450;
        const revealedAt = new Map<string, number>();
        const flipTimers = new Map<string, ReturnType<typeof setTimeout>>();

        const markRevealed = (id: string) => {
          revealedAt.set(id, Date.now());
        };

        const applyDone = (id: string, detail?: string) => {
          const idx = liveSteps.findIndex((s) => s.id === id);
          if (idx < 0) return;
          const updated = [...liveSteps];
          updated[idx] = {
            ...updated[idx],
            status: "done" as const,
            detail: detail || updated[idx].detail,
          };
          updateSteps(updated);
        };

        const scheduleDone = (id: string, detail?: string) => {
          const elapsed = Date.now() - (revealedAt.get(id) ?? Date.now());
          const wait = Math.max(0, MIN_STEP_MS - elapsed);
          if (wait === 0) {
            applyDone(id, detail);
            return;
          }
          flipTimers.set(
            id,
            setTimeout(() => {
              flipTimers.delete(id);
              applyDone(id, detail);
            }, wait),
          );
        };

        const flushFlips = () => {
          for (const t of flipTimers.values()) clearTimeout(t);
          if (flipTimers.size > 0) {
            const ids = new Set(flipTimers.keys());
            const updated = liveSteps.map((s) =>
              ids.has(s.id) ? { ...s, status: "done" as const } : s,
            );
            updateSteps(updated);
          }
          flipTimers.clear();
          revealedAt.clear();
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === "reasoning") {
                  reasoningBufferRef.current += data.chunk || "";
                  if (!reasoningRafRef.current) {
                    reasoningRafRef.current = requestAnimationFrame(() => {
                      setStreamReasoning(reasoningBufferRef.current);
                      reasoningRafRef.current = null;
                    });
                  }
                } else if (currentEvent === "clarify") {
                  clarifyQuestions = data.questions;
                } else if (currentEvent === "inspection") {
                  liveInspection = data.inspection;
                  setInspection(data.inspection);
                } else if (currentEvent === "snapshots") {
                  liveSnapshots = { ...liveSnapshots, ...data.snapshots };
                  setSnapshots((prev) => ({ ...prev, ...data.snapshots }));
                } else if (currentEvent === "dim-views") {
                  liveDimViews = { ...liveDimViews, ...data.dimViews };
                  setDimViews((prev) => ({ ...prev, ...data.dimViews }));
                } else if (currentEvent === "vision-check") {
                  setInspection((prev) =>
                    prev ? ({ ...prev, visionChecking: true } as any) : prev,
                  );
                } else if (currentEvent === "vision-result") {
                  visionFeedback = data.feedback;
                  visionVerified = !data.needsFix;
                  setInspection((prev) =>
                    prev
                      ? ({
                          ...prev,
                          visionChecking: false,
                          visionVerified: !data.needsFix,
                          visionFeedback: data.feedback,
                        } as any)
                      : prev,
                  );
                } else if (currentEvent === "step") {
                  const existingIndex = liveSteps.findIndex(
                    (s) => s.id === data.id,
                  );
                  if (existingIndex >= 0) {
                    const nextStatus = data.status || liveSteps[existingIndex].status;
                    if (nextStatus === "done") {
                      // Respect the minimum on-screen time before flipping to done
                      scheduleDone(data.id, data.detail);
                    } else {
                      const updated = [...liveSteps];
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        status: nextStatus,
                        detail: data.detail ?? updated[existingIndex].detail,
                        label: data.label || updated[existingIndex].label,
                        icon: data.icon || updated[existingIndex].icon,
                        timestamp: Date.now(),
                      };
                      updateSteps(updated);
                    }
                  } else {
                    const newStep: WorkflowStep = {
                      id: data.id,
                      icon: data.icon || "code",
                      label: data.label || data.id,
                      detail: data.detail || "",
                      status: data.status || "running",
                      timestamp: Date.now(),
                    };
                    markRevealed(newStep.id);
                    // A step that arrives already-done (fast stages emit
                    // running+done in one flush) reveals as running first.
                    const insertStatus =
                      newStep.status === "done" ? "running" : newStep.status;
                    const rank =
                      STEP_RANK[newStep.id] ?? Number.MAX_SAFE_INTEGER;
                    let insertAt = liveSteps.length;
                    for (let i = 0; i < liveSteps.length; i++) {
                      if (
                        (STEP_RANK[liveSteps[i].id] ?? Number.MAX_SAFE_INTEGER) >
                        rank
                      ) {
                        insertAt = i;
                        break;
                      }
                    }
                    const next = [...liveSteps];
                    next.splice(insertAt, 0, {
                      ...newStep,
                      status: insertStatus as WorkflowStep["status"],
                    });
                    updateSteps(next);
                    if (newStep.status === "done") {
                      scheduleDone(newStep.id, newStep.detail);
                    }
                  }
                } else if (currentEvent === "validation-warning") {
                  if (data.inspection) {
                    liveInspection = data.inspection;
                    setInspection(data.inspection);
                  }
                  if (data.message) {
                    streamWarning = data.message;
                  }
                } else if (currentEvent === "done") {
                  finalData = data;
                  // Apply any visually-gated flips now so the final message is
                  // consistent with the completed run.
                  flushFlips();
                  if (data.inspection) setInspection(data.inspection);
                  if (data.snapshots) setSnapshots(data.snapshots);
                  if (data.visionVerified) visionVerified = true;
                  if (data.sessionId) setSessionId(data.sessionId);
                  const remainingRunning = liveSteps.filter(
                    (s) => s.status === "running",
                  );
                  if (remainingRunning.length > 0) {
                    const updated = liveSteps.map((s) =>
                      s.status === "running"
                        ? {
                            ...s,
                            status: "done" as const,
                            detail: s.detail || "Complete",
                          }
                        : s,
                    );
                    updateSteps(updated);
                  }
                  // Prune steps whose turn never came (tee-verify on non-0G
                  // providers, vision without images) — they were never shown,
                  // so removing them lets the counter settle at N/N.
                  const revealed = liveSteps.filter(
                    (s) => s.status !== "pending",
                  );
                  if (revealed.length !== liveSteps.length) {
                    updateSteps(revealed);
                  }
                } else if (currentEvent === "error") {
                  flushFlips();
                  throw new Error(data.error);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes("JSON")) throw e;
              }
              currentEvent = "";
            }
          }
        }

        // Handle clarification
        if (clarifyQuestions && clarifyQuestions.length > 0 && !finalData) {
          setMessages((prev) => {
            const next = [...prev];
            if (
              assistantMessageIdRef.current !== null &&
              next[assistantMessageIdRef.current]
            ) {
              next[assistantMessageIdRef.current] = {
                role: "assistant",
                content: "",
                clarification: clarifyQuestions!,
                // Keep the frozen checklist on the clarification card — the
                // timeline is part of the conversation history, not disposable.
                steps: liveSteps,
              };
            } else {
              next.push({
                role: "assistant",
                content: "",
                clarification: clarifyQuestions!,
              });
            }
            return next;
          });
          setIsGenerating(false);
          setStreamReasoning("");
          reasoningBufferRef.current = "";
          if (reasoningRafRef.current) {
            cancelAnimationFrame(reasoningRafRef.current);
            reasoningRafRef.current = null;
          }
          return;
        }

        // Handle success
        if (finalData) {
          const assistantMsg: Message = {
            role: "assistant",
            content: finalData.bestEffort
              ? `Generated (best effort) - ${finalData.warning || "model had issues"}`
              : finalData.visionVerified
                ? `Generated with ${getProviderDisplayName(finalData.provider || provider)} (vision-verified)`
                : `Generated with ${getProviderDisplayName(finalData.provider || provider)}`,
            provider: finalData.provider,
            dimViews:
              Object.keys(liveDimViews).length > 0
                ? liveDimViews
                : finalData.dimViews || {},
            visionVerified: finalData.visionVerified,
            visionFeedback: visionFeedback || undefined,
            teeProof: finalData.teeProof,
            zeroG: finalData.zeroG,
            warning:
              streamWarning ||
              (finalData.zeroG?.teeStatus === "failed"
                ? "TEE signature verification failed — this response should be treated as untrusted."
                : undefined),
            sessionId: finalData.sessionId,
            editMode: editMode || false,
            steps: liveSteps,
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev];
            if (
              assistantMessageIdRef.current !== null &&
              next[assistantMessageIdRef.current]
            ) {
              next[assistantMessageIdRef.current] = assistantMsg;
            } else {
              next.push(assistantMsg);
            }
            return next;
          });
          if (finalData.code) setCurrentCode(finalData.code);
          if (finalData.parameters) {
            setParameters(finalData.parameters);
            const vals: Record<string, number> = {};
            Object.entries(finalData.parameters as Record<string, ParameterSchema>).forEach(([name, schema]) => {
              if (typeof schema.default === "number") {
                vals[name] = schema.default;
              }
            });
            setParamValues(vals);
          }
          setStlBase64(finalData.stlBase64);
          setStepBase64(finalData.stepBase64);
          setGlbBase64(finalData.glbBase64);
          setHasUnsavedParamIteration(false);
          if (finalData.stlBase64 && finalData.hasStl) {
            const bytes = Uint8Array.from(atob(finalData.stlBase64), (c) =>
              c.charCodeAt(0),
            );
            const blob = new Blob([bytes], {
              type: "application/octet-stream",
            });
            const url = URL.createObjectURL(blob);
            if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
            setStlObjectUrl(url);
            setStlUrl(url);
          }
          if (finalData.inspection) setInspection(finalData.inspection);
          if (finalData.snapshots) setSnapshots(finalData.snapshots);
          setDimViews(
            Object.keys(liveDimViews).length > 0
              ? liveDimViews
              : finalData.dimViews || {},
          );

          // Auto-save chat session
          if (auth.isConnected) {
            try {
              const saveSourceMessages = isClarificationContinue
                ? [...messages, ...(answerMsg ? [answerMsg] : []), assistantMsg]
                : [...messages, userMsg, assistantMsg];
              const allMessages = saveSourceMessages.map((m) => ({
                role: m.role,
                content: m.content,
                specifications: m.specifications,
                provider: m.provider,
              }));
              const saveRes = await fetch(`${API_URL}/api/chat/save`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...authHeaders(),
                },
                body: JSON.stringify({
                  sessionId: chatSessionId,
                  messages: allMessages,
                  parameters: finalData.parameters,
                }),
              });
              if (saveRes.ok) {
                const saveData = await saveRes.json();
                const savedSessionId = saveData.sessionId || chatSessionId;
                const savedMessageOrder =
                  typeof saveData.latestMessageOrder === "number"
                    ? saveData.latestMessageOrder
                    : null;

                if (saveData.sessionId) setChatSessionId(saveData.sessionId);
                setLatestMessageOrder(savedMessageOrder);

                if (
                  savedSessionId &&
                  savedMessageOrder !== null &&
                  finalData.code
                ) {
                  setModelStorageStatus("Starting 0G upload...");
                  uploadModelTo0G({
                    sessionId: savedSessionId,
                    messageOrder: savedMessageOrder,
                    name: `Iteration ${savedMessageOrder + 1}`,
                    code: finalData.code,
                    stlBase64: finalData.stlBase64,
                    stepBase64: finalData.stepBase64,
                    glbBase64: finalData.glbBase64,
                    dimViews:
                      Object.keys(liveDimViews).length > 0
                        ? liveDimViews
                        : finalData.dimViews || {},
                    parameters: finalData.parameters,
                    inspection: finalData.inspection,
                    boundingBox: finalData.inspection?.bounding_box,
                  })
                    .then((uploadResult) => {
                      setModelStorageStatus("0G storage complete");
                      if (uploadResult?.rootHashes) {
                        setMessages((prev) => {
                          const next = [...prev];
                          if (
                            assistantMessageIdRef.current !== null &&
                            next[assistantMessageIdRef.current]
                          ) {
                            next[assistantMessageIdRef.current] = {
                              ...next[assistantMessageIdRef.current],
                              rootHashes: uploadResult.rootHashes,
                            };
                          }
                          return next;
                        });
                      }
                    })
                    .catch((err) =>
                      setModelStorageStatus(
                        err instanceof Error ? err.message : String(err),
                      ),
                    );
                }
              }
            } catch {}
          }
        }
      } catch (e: any) {
        const errorMsg = e.message?.includes("Failed to fetch")
          ? "Cannot connect to server. Make sure ai-server and cad-server are running."
          : e.message;
        const errorMsgObj: Message = {
          role: "assistant",
          content: `Error: ${errorMsg}`,
          error: errorMsg,
          // Keep the timeline visible on errors — the failed step shows red and
          // everything after it never started, so it was never revealed.
          steps: liveSteps,
          timestamp: Date.now(),
        };
        setMessages((prev) => {
          const next = [...prev];
          if (
            assistantMessageIdRef.current !== null &&
            next[assistantMessageIdRef.current]
          ) {
            next[assistantMessageIdRef.current] = errorMsgObj;
          } else {
            next.push(errorMsgObj);
          }
          return next;
        });
      } finally {
        setIsGenerating(false);
        setStreamReasoning("");
        reasoningBufferRef.current = "";
        if (reasoningRafRef.current) {
          cancelAnimationFrame(reasoningRafRef.current);
          reasoningRafRef.current = null;
        }
      }
    },
    [
      prompt,
      images,
      isGenerating,
      provider,
      messages,
      stlObjectUrl,
      reasoningEnabled,
      sessionId,
      setParamValues,
      auth.isConnected,
      authHeaders,
      chatSessionId,
      uploadModelTo0G,
    ],
  );

  const handleClarificationSubmit = useCallback(
    (answers: string, answerList: { question: string; answer: string }[]) => {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMsg) return;
      setMessages((prev) => [
        ...prev.filter((m) => !m.clarification),
        {
          role: "user",
          content: answers,
          clarificationAnswers: answerList,
          timestamp: Date.now(),
        },
      ]);
      handleGenerate(answers, lastUserMsg.content, answerList);
    },
    [handleGenerate, messages],
  );

  const handleEdit = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (msg.role !== "assistant") return;
      let prevUserMsg: Message | null = null;
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          prevUserMsg = messages[i];
          break;
        }
      }
      setEditingMessageIndex(index);
      setEditOriginalPrompt(prevUserMsg?.content || "previous design");
    },
    [messages],
  );

  const handleEditSubmit = useCallback(
    (editPrompt: string) => {
      setEditingMessageIndex(null);
      handleGenerate(undefined, editPrompt, undefined, true);
    },
    [handleGenerate],
  );

  const handleRetry = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (msg.role !== "assistant") return;
      let prevUserMsg: Message | null = null;
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          prevUserMsg = messages[i];
          break;
        }
      }
      if (prevUserMsg) {
        handleGenerate(undefined, prevUserMsg.content);
      }
    },
    [messages, handleGenerate],
  );

  const handleNewTask = useCallback(() => {
    if (messages.length > 0 && chatSessionId && auth.isConnected) {
      saveCurrentSession();
    }
    setMessages([]);
    setParameters({});
    setCurrentCode("");
    setStlUrl(null);
    setStlBase64(undefined);
    setStepBase64(undefined);
    setGlbBase64(undefined);
    if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
    setStlObjectUrl(null);
    setPrompt("");
    setImages([]);
    setStreamReasoning("");
    setExportFilename("model");
    setSnapshots({});
    setDimViews({});
    setInspection(null);
    setSessionId(undefined);
    setEditingMessageIndex(null);
    setChatSessionId(null);
    setLatestMessageOrder(null);
    setHasUnsavedParamIteration(false);
    setModelStorageStatus(null);
    setRootHashes(null);
    setTxSeqs(null);
    setRootHashesLoading(false);
    resetParams();
    sidebarManuallyToggled.current = false;
    setSidebarOpen(true);
  }, [
    messages,
    chatSessionId,
    auth.isConnected,
    stlObjectUrl,
    saveCurrentSession,
    resetParams,
  ]);

  return {
    handleGenerate,
    handleClarificationSubmit,
    handleEdit,
    handleEditSubmit,
    handleRetry,
    handleNewTask,
  };
}
