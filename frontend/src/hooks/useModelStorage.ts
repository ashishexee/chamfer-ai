import { useCallback } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import { API_URL, MODEL_ENDPOINTS } from "@/lib/constants";
import type { ParameterSchema, InspectionData } from "@/types";

/**
 * Handles 0G decentralized storage uploads and iteration storage.
 * Extracted from the monolithic App.tsx.
 */
export function useModelStorage(store: AppStore) {
  const {
    authHeaders,
    chatSessionId,
    latestMessageOrder,
    currentCode,
    stlBase64,
    stepBase64,
    glbBase64,
    dimViews,
    parameters,
    inspection,
    setRootHashesLoading,
    setRootHashes,
    setTxSeqs,
    setUploadProgress,
    setIsStoringIteration,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
    setMessages,
    assistantMessageIdRef,
  } = store;

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
      parameters?: Record<string, ParameterSchema>;
      inspection?: InspectionData | null;
      boundingBox?: { size?: number[] };
    }) => {
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
          parameters: model.parameters,
          inspection: model.inspection,
          boundingBox: model.boundingBox,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(
          `[0G] Frontend: upload failed — ${data.error || res.status}`,
        );
        setRootHashesLoading(false);
        setUploadProgress(null);
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
                setUploadProgress((prev) => ({
                  ...prev,
                  [data.file]: {
                    status: data.status,
                    rootHash: data.rootHash,
                    txSeq: data.txSeq,
                  },
                }));
              } else if (data.type === "done") {
                finalData = data;
                if (data.rootHashes) {
                  setRootHashes(data.rootHashes);
                  if (data.txSeqs) setTxSeqs(data.txSeqs);
                }
              } else if (data.type === "error") {
                setRootHashesLoading(false);
                setUploadProgress(null);
                throw new Error(data.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) throw e;
            }
          }
        }
      }

      setRootHashesLoading(false);
      setUploadProgress(null);
      return finalData;
    },
    [authHeaders, setRootHashesLoading, setRootHashes, setTxSeqs, setUploadProgress],
  );

  const storeCurrentIteration = useCallback(async () => {
    if (!chatSessionId || latestMessageOrder === null || !currentCode) return;
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
        parameters,
        inspection,
        boundingBox: inspection?.bounding_box,
      });
      setHasUnsavedParamIteration(false);
      setModelStorageStatus("0G storage complete");
    } catch (err) {
      setModelStorageStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoringIteration(false);
    }
  }, [
    chatSessionId,
    latestMessageOrder,
    currentCode,
    stlBase64,
    stepBase64,
    glbBase64,
    dimViews,
    parameters,
    inspection,
    uploadModelTo0G,
    setIsStoringIteration,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
  ]);

  return { uploadModelTo0G, storeCurrentIteration };
}
