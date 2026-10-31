import { useCallback, useEffect } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import type { ModelIteration } from "@/types";
import { API_URL, CHAT_ENDPOINTS, MODEL_ENDPOINTS } from "@/lib/constants";
import {
  attachIterationsToMessages,
  normalizeParameters,
  parameterDefaults,
} from "@/lib/iterations";

/**
 * Handles chat session CRUD — save, load, list, and auth verification.
 * A load restores the FULL interface: every message keeps its reasoning,
 * workflow steps, 0G/TEE metadata, snapshots, dim views and images, and every
 * stored iteration is attached to the turn that produced it.
 */
export function useChatSessions(store: AppStore) {
  const {
    auth,
    authHeaders,
    messages,
    setMessages,
    chatSessionId,
    chatSessionIdRef,
    setChatSessionId,
    setChatMountKey,
    chatSessions,
    setChatSessions,
    setLatestMessageOrder,
    setCurrentCode,
    setParameters,
    setParamValues,
    setSnapshots,
    setDimViews,
    setStlUrl,
    setStlObjectUrl,
    setStlBase64,
    setStepBase64,
    setGlbBase64,
    setRootHashes,
    setTxSeqs,
    setRootHashesLoading,
    setUploadProgress,
    setInspection,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
    setIterations,
    setIterationsLoading,
    setActiveIterationId,
    setPreviewIteration,
    setPreviewStlUrl,
    setPreviewLoadingId,
    setRewindTarget,
    setIterationError,
    setSessionLoading,
    isGenerating,
    stlObjectUrl,
  } = store;

  const saveCurrentSession = useCallback(() => {
    if (!auth.isConnected || messages.length === 0) return;
    // Persist the full message payload (minus derived model pointers, which the
    // server strips) so switching chats never loses reasoning or metadata.
    const allMsgs = messages.map((m) => ({ ...m }));
    fetch(`${API_URL}${CHAT_ENDPOINTS.SAVE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        sessionId: chatSessionId,
        messages: allMsgs,
        parameters: store.parameters,
      }),
    }).catch(() => {});
  }, [messages, chatSessionId, store.parameters, auth.isConnected, authHeaders]);

  const handleLoadSession = useCallback(
    async (sessionId: string) => {
      if (isGenerating) return;
      if (chatSessionId === sessionId) return;
      if (messages.length > 0 && chatSessionId && auth.isConnected) {
        saveCurrentSession();
      }
      setSessionLoading(true);
      try {
        const res = await fetch(`${API_URL}${CHAT_ENDPOINTS.HISTORY(sessionId)}`, {
          headers: { Authorization: `Bearer ${auth.address || ""}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const { session } = data;
        if (!session) return;

        // ── Reset transient state before hydrating ──
        setChatSessionId(session.id);
        // Sync the upload guard immediately: any in-flight upload from the
        // previous chat must stop writing as soon as this render commits.
        chatSessionIdRef.current = session.id;
        // Remount message components for the new chat (fresh collapse/TEE state).
        setChatMountKey((k) => k + 1);
        setCurrentCode("");
        setLatestMessageOrder(null);
        setHasUnsavedParamIteration(false);
        setModelStorageStatus(null);
        setSnapshots({});
        setDimViews({});
        setStlUrl(null);
        if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
        setStlObjectUrl(null);
        setStlBase64(undefined);
        setStepBase64(undefined);
        setGlbBase64(undefined);
        setRootHashes(null);
        setTxSeqs(null);
        setRootHashesLoading(false);
        // An upload abandoned mid-flight must not paint its per-file rows into
        // the chat we just opened.
        setUploadProgress(null);
        setActiveIterationId(null);
        setIterationError(null);
        setRewindTarget(null);
        setPreviewIteration(null);
        setPreviewStlUrl(null);
        setPreviewLoadingId(null);

        // ── Warm up the iteration history ──
        setIterationsLoading(true);
        let iterations = (session.iterations || []) as ModelIteration[];
        if (!Array.isArray(session.iterations)) {
          try {
            const iterRes = await fetch(
              `${API_URL}${MODEL_ENDPOINTS.SESSION_ITERATIONS(session.id)}`,
              { headers: { Authorization: `Bearer ${auth.address || ""}` } },
            );
            if (iterRes.ok) {
              const iterData = await iterRes.json();
              iterations = (iterData.iterations || []) as ModelIteration[];
            }
          } catch {
            iterations = [];
          }
        }
        setIterations(iterations);
        setIterationsLoading(false);

        // Full-fidelity messages + versions attached to their turn.
        setMessages(attachIterationsToMessages(session.messages || [], iterations));

        const sessionParams = normalizeParameters(session.parameters);
        setParameters(sessionParams);
        setParamValues(parameterDefaults(sessionParams));

        // ── Restore the working model (newest complete version) ──
        try {
          const modelRes = await fetch(
            `${API_URL}${MODEL_ENDPOINTS.LATEST_FOR_SESSION(session.id)}`,
            { headers: { Authorization: `Bearer ${auth.address || ""}` } },
          );
          if (modelRes.ok) {
            const modelData = await modelRes.json();
            const model = modelData.model;
            setLatestMessageOrder(
              typeof model.messageOrder === "number" ? model.messageOrder : null,
            );
            setCurrentCode(model.code || "");
            setStlBase64(model.stlBase64);
            setStepBase64(model.stepBase64);
            setGlbBase64(model.glbBase64);
            if (model.dimViews && Object.keys(model.dimViews).length > 0) {
              setDimViews(model.dimViews);
            }
            if (model.snapshots && Object.keys(model.snapshots).length > 0) {
              setSnapshots(model.snapshots);
            }
            if (model.rootHashes) {
              setRootHashes(model.rootHashes);
              setTxSeqs(model.txSeqs ?? null);
              setRootHashesLoading(false);
            }
            if (model.id) setActiveIterationId(model.id);

            // Stamp the matching assistant bubble with the active hashes so the
            // 0G proof card is visible before any user interaction.
            if (model.messageOrder !== undefined) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.role === "assistant" && m.messageOrder === model.messageOrder
                    ? {
                        ...m,
                        rootHashes: m.rootHashes ?? model.rootHashes,
                        dimViews:
                          m.dimViews ??
                          (model.dimViews && Object.keys(model.dimViews).length > 0
                            ? model.dimViews
                            : undefined),
                      }
                    : m,
                ),
              );
            }

            const modelParams = normalizeParameters(model.parameters);
            if (Object.keys(modelParams).length > 0) {
              setParameters(modelParams);
              setParamValues(parameterDefaults(modelParams));
            }
            if (model.inspection) setInspection(model.inspection);

            if (model.stlBase64) {
              const bytes = Uint8Array.from(atob(model.stlBase64), (c) =>
                c.charCodeAt(0),
              );
              const blob = new Blob([bytes], { type: "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
              setStlObjectUrl(url);
              setStlUrl(url);
            }
          }
        } catch (err) {
          console.error("[0G] latest model restore failed:", err);
        }
      } catch (err) {
        console.error("[LOAD] error:", err);
      } finally {
        setSessionLoading(false);
      }
    },
    [
      isGenerating,
      chatSessionId,
      messages,
      auth.isConnected,
      auth.address,
      saveCurrentSession,
      setParamValues,
      stlObjectUrl,
      setSessionLoading,
    ],
  );

  // Fetch session list on auth
  useEffect(() => {
    if (!auth.isConnected || !auth.address) return;
    fetch(`${API_URL}${CHAT_ENDPOINTS.SESSIONS}`, {
      headers: { Authorization: `Bearer ${auth.address}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setChatSessions(d.sessions || []);
      })
      .catch(() => {});
  }, [auth.isConnected, auth.address]);

  // Verify auth on connect
  useEffect(() => {
    if (!auth.isConnected || !auth.address) return;
    fetch(`${API_URL}/api/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.address}`,
      },
    }).catch(() => {});
  }, [auth.isConnected, auth.address]);

  /** Rename a chat optimistically; revert if the server rejects it. */
  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      const clean = title.trim().replace(/\s+/g, " ").slice(0, 120);
      if (!clean) return;

      const previous = chatSessions;
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, title: clean } : session,
        ),
      );

      try {
        const res = await fetch(
          `${API_URL}${CHAT_ENDPOINTS.RENAME(sessionId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ title: clean }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Rename failed (${res.status})`);
        }
      } catch (err) {
        console.error("[RENAME]", err);
        setChatSessions(previous);
      }
    },
    [chatSessions, authHeaders, setChatSessions],
  );

  return { saveCurrentSession, handleLoadSession, renameSession };
}
