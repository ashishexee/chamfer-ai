import { useCallback, useEffect, useRef } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import { API_URL, MODEL_ENDPOINTS } from "@/lib/constants";
import type { ParameterSchema, InspectionData } from "@/types";

/**
 * Handles 0G decentralized storage uploads and iteration storage.
 *
 * Uploads outlive the generation call by seconds. Every state write is scoped
 * to the chat the upload started in, so switching chats mid-upload can never
 * paint the old chat's progress/hashes/iterations into the new one.
 */
export function useModelStorage(
  store: AppStore,
  refreshIterations?: (sessionId?: string | null) => Promise<unknown>,
) {
  const {
    authHeaders,
    chatSessionId,
    chatSessionIdRef,
    latestMessageOrder,
    currentCode,
    stlBase64,
    stepBase64,
    glbBase64,
    dimViews,
    snapshots,
    parameters,
    inspection,
    setRootHashesLoading,
    setRootHashes,
    setTxSeqs,
    setUploadProgress,
    setIsStoringIteration,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
    setActiveIterationId,
    setMessages,
    assistantMessageIdRef,
    beginUpload,
    endUpload,
  } = store;

  // Guard against out-of-order upload completions: only the newest version may
  // own the global proof card / active marker.
  const latestVersionRef = useRef(0);
  useEffect(() => {
    latestVersionRef.current = 0;
  }, [chatSessionId]);

  const uploadModelTo0G = useCallback(
    async (model: {
      sessionId: string;
      messageOrder: number;
      name: string;
      code: string;
      stlBase64?: string;
      stepBase64?: string;
      glbBase64?: string;
      dimViews?: Record<string, string>;
      snapshots?: Record<string, string>;
      parameters?: Record<string, ParameterSchema>;
      inspection?: InspectionData | null;
      boundingBox?: { size?: number[] };
      /** Where this iteration came from — drives the history badge. */
      source?: "generate" | "param_tweak" | "restored";
      restoredFrom?: string | null;
    }) => {
      const sidAtStart = model.sessionId;
      // The upload starts in the session that is active right now; the ref may
      // lag a just-created session id by one render.
      chatSessionIdRef.current = sidAtStart;
      const isCurrent = () => chatSessionIdRef.current === sidAtStart;

      beginUpload(sidAtStart);
      try {
        setRootHashesLoading(true);
        setRootHashes(null);
        setTxSeqs(null);
        setUploadProgress({});

        const res = await fetch(`${API_URL}${MODEL_ENDPOINTS.UPLOAD_0G}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            chatSessionId: model.sessionId,
            messageOrder: model.messageOrder,
            name: model.name,
            code: model.code,
            stlBase64: model.stlBase64,
            stepBase64: model.stepBase64,
            glbBase64: model.glbBase64,
            dimViews: model.dimViews,
            snapshots: model.snapshots,
            parameters: model.parameters,
            inspection: model.inspection,
            boundingBox: model.boundingBox,
            source: model.source || "generate",
            restoredFrom: model.restoredFrom ?? null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error(
            `[0G] Frontend: upload failed — ${data.error || res.status}`,
          );
          if (isCurrent()) {
            setRootHashesLoading(false);
            setUploadProgress(null);
          }
          throw new Error(
            data.error || `0G upload request failed: ${res.status}`,
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let finalData: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "progress") {
                  if (isCurrent()) {
                    setUploadProgress((prev) => ({
                      ...prev,
                      [data.file]: {
                        status: data.status,
                        rootHash: data.rootHash,
                        txSeq: data.txSeq,
                      },
                    }));
                  }
                } else if (data.type === "version") {
                  // The row (and its version number) exists before uploads start.
                  if (
                    isCurrent() &&
                    data.modelId &&
                    typeof data.version === "number" &&
                    data.version >= latestVersionRef.current
                  ) {
                    latestVersionRef.current = data.version;
                    setActiveIterationId(data.modelId);
                  }
                } else if (data.type === "done") {
                  finalData = data;
                  const isNewest =
                    typeof data.version !== "number" ||
                    data.version >= latestVersionRef.current;
                  if (isCurrent() && isNewest) {
                    if (typeof data.version === "number") {
                      latestVersionRef.current = data.version;
                    }
                    if (data.rootHashes) {
                      setRootHashes(data.rootHashes);
                      if (data.txSeqs) setTxSeqs(data.txSeqs);
                    }
                    if (data.modelId) setActiveIterationId(data.modelId);
                  }
                } else if (data.type === "error") {
                  if (isCurrent()) {
                    setRootHashesLoading(false);
                    setUploadProgress(null);
                  }
                  void refreshIterations?.(model.sessionId);
                  throw new Error(data.error);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes("JSON")) throw e;
              }
            }
          }
        }

        if (isCurrent()) {
          setRootHashesLoading(false);
          setUploadProgress(null);
        }
        // Refresh the history list for the chat that owns the upload. The
        // refresher itself refuses to paint a chat the user has left.
        void refreshIterations?.(model.sessionId);
        return finalData;
      } finally {
        endUpload(sidAtStart);
      }
    },
    [
      authHeaders,
      chatSessionIdRef,
      refreshIterations,
      beginUpload,
      endUpload,
      setActiveIterationId,
      setRootHashesLoading,
      setRootHashes,
      setTxSeqs,
      setUploadProgress,
    ],
  );

  const storeCurrentIteration = useCallback(async () => {
    if (!chatSessionId || latestMessageOrder === null || !currentCode) return;
    const sidAtStart = chatSessionId;
    const isCurrent = () => chatSessionIdRef.current === sidAtStart;

    setIsStoringIteration(true);
    setModelStorageStatus("Starting 0G upload...");
    try {
      await uploadModelTo0G({
        sessionId: chatSessionId,
        messageOrder: latestMessageOrder,
        name: `Iteration ${latestMessageOrder + 1}`,
        code: currentCode,
        stlBase64,
        stepBase64,
        glbBase64,
        dimViews,
        snapshots,
        parameters,
        inspection,
        boundingBox: inspection?.bounding_box,
        source: "param_tweak",
      });
      if (isCurrent()) {
        setHasUnsavedParamIteration(false);
        setModelStorageStatus("0G storage complete");
      }
    } catch (err) {
      if (isCurrent()) {
        setModelStorageStatus(err instanceof Error ? err.message : String(err));
      }
      void refreshIterations?.(chatSessionId);
    } finally {
      setIsStoringIteration(false);
    }
  }, [
    chatSessionId,
    chatSessionIdRef,
    latestMessageOrder,
    currentCode,
    stlBase64,
    stepBase64,
    glbBase64,
    dimViews,
    snapshots,
    parameters,
    inspection,
    uploadModelTo0G,
    refreshIterations,
    setIsStoringIteration,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
  ]);

  return { uploadModelTo0G, storeCurrentIteration };
}
