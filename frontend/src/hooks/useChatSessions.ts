import { useCallback, useEffect } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import type { ParameterSchema } from "@/types";
import { API_URL, CHAT_ENDPOINTS, MODEL_ENDPOINTS } from "@/lib/constants";

/**
 * Handles chat session CRUD — save, load, list, and auth verification.
 * Extracted from the monolithic App.tsx.
 */
export function useChatSessions(
  store: AppStore,
  uploadModelTo0G: (model: any) => Promise<any>,
) {
  const {
    auth,
    authHeaders,
    messages,
    setMessages,
    chatSessionId,
    setChatSessionId,
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
    setInspection,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
    isGenerating,
    stlObjectUrl,
    setUploadProgress,
    assistantMessageIdRef,
  } = store;

  const saveCurrentSession = useCallback(() => {
    if (!auth.isConnected || messages.length === 0) return;
    const allMsgs = messages.map((m) => ({
      role: m.role,
      content: m.content,
      specifications: m.specifications,
      provider: m.provider,
    }));
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
      try {
        const res = await fetch(
          `${API_URL}${CHAT_ENDPOINTS.HISTORY(sessionId)}`,
          {
            headers: { Authorization: `Bearer ${auth.address || ""}` },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        const { session } = data;
        if (!session) return;
        setChatSessionId(session.id);
        setMessages(session.messages || []);
        setCurrentCode("");
        setLatestMessageOrder(null);
        setHasUnsavedParamIteration(false);
        setModelStorageStatus(null);
        setParameters(session.parameters || {});
        if (session.parameters && Object.keys(session.parameters).length > 0) {
          const vals: Record<string, number> = {};
          Object.entries(session.parameters as Record<string, ParameterSchema>).forEach(([name, schema]) => {
            if (typeof schema.default === "number") {
              vals[name] = schema.default;
            }
          });
          setParamValues(vals);
        }
        setSnapshots({});
        setDimViews({});
        setStlUrl(null);
        setStlBase64(undefined);
        setStepBase64(undefined);
        setGlbBase64(undefined);
        setRootHashes(null);
        setTxSeqs(null);
        setRootHashesLoading(false);

        try {
          const modelRes = await fetch(
            `${API_URL}${MODEL_ENDPOINTS.LATEST_FOR_SESSION(session.id)}`,
            {
              headers: { Authorization: `Bearer ${auth.address || ""}` },
            },
          );
          if (modelRes.ok) {
            const modelData = await modelRes.json();
            const model = modelData.model;
            setLatestMessageOrder(
              typeof model.messageOrder === "number"
                ? model.messageOrder
                : null,
            );
            setCurrentCode(model.code || "");
            setStlBase64(model.stlBase64);
            setStepBase64(model.stepBase64);
            setGlbBase64(model.glbBase64);
            if (model.rootHashes) {
              setRootHashes(model.rootHashes);
              setRootHashesLoading(false);
              setMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === "assistant") {
                    next[i] = { ...next[i], rootHashes: model.rootHashes };
                    break;
                  }
                }
                return next;
              });
            } else {
              setRootHashes(null);
              setTxSeqs(null);
            }
            if (model.parameters && Object.keys(model.parameters).length > 0) {
              setParameters(model.parameters);
              const modelVals: Record<string, number> = {};
              Object.entries(model.parameters as Record<string, ParameterSchema>).forEach(([name, schema]) => {
                if (typeof schema.default === "number") {
                  modelVals[name] = schema.default;
                }
              });
              setParamValues(modelVals);
            }
            if (model.inspection) setInspection(model.inspection);
            if (model.dimViews && Object.keys(model.dimViews).length > 0) {
              setDimViews(model.dimViews);
              setMessages((prev) => {
                const next = [...prev];
                for (let j = next.length - 1; j >= 0; j--) {
                  if (next[j].role === "assistant") {
                    next[j] = { ...next[j], dimViews: model.dimViews };
                    break;
                  }
                }
                return next;
              });
            }
            if (model.stlBase64) {
              const bytes = Uint8Array.from(atob(model.stlBase64), (c) =>
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
          }
        } catch (err) {
          console.error("[0G] latest model restore failed:", err);
        }
      } catch (err) {
        console.error("[LOAD] error:", err);
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

  return { saveCurrentSession, handleLoadSession };
}
