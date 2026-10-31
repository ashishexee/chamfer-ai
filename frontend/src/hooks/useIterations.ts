import { useCallback, useEffect, useRef } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import { API_URL, CHAT_ENDPOINTS, MODEL_ENDPOINTS } from "@/lib/constants";
import { base64ToObjectUrl } from "@/lib/objectUrl";
import {
  attachIterationsToMessages,
  normalizeParameters,
  parameterDefaults,
} from "@/lib/iterations";
import type { IterationContents, Message, ModelIteration } from "@/types";

/**
 * Iteration history: load every stored version for a chat, preview one in the
 * main viewport without touching the working model, and rewind (destructively)
 * to a previous version.
 */
export function useIterations(store: AppStore) {
  const {
    authHeaders,
    chatSessionId,
    chatSessionIdRef,
    isGenerating,
    isParamUpdating,
    isSessionUploading,
    paramUpdateKey,
    stlObjectUrl,
    setMessages,
    setIterations,
    setIterationsLoading,
    setActiveIterationId,
    setPreviewIteration,
    setPreviewStlUrl,
    setPreviewLoadingId,
    setRewindTarget,
    setRewinding,
    setIterationError,
    setCurrentCode,
    setParameters,
    setParamValues,
    setStlUrl,
    setStlObjectUrl,
    setStlBase64,
    setStepBase64,
    setGlbBase64,
    setDimViews,
    setSnapshots,
    setInspection,
    setRootHashes,
    setTxSeqs,
    setLatestMessageOrder,
    setUploadProgress,
    setRootHashesLoading,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
  } = store;

  const previewUrlRef = useRef<string | null>(null);
  // Ignore stale preview responses (rapid version switching).
  const previewRequestRef = useRef(0);

  /** Replace the working model state with a stored version's contents. */
  const applyContents = useCallback(
    (model: IterationContents) => {
      setCurrentCode(model.code || "");

      if (model.stlBase64) {
        const url = base64ToObjectUrl(model.stlBase64);
        if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
        setStlObjectUrl(url);
        setStlUrl(url);
      } else {
        if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
        setStlObjectUrl(null);
        setStlUrl(null);
      }

      setStlBase64(model.stlBase64);
      setStepBase64(model.stepBase64);
      setGlbBase64(model.glbBase64);
      setDimViews(model.dimViews || {});
      setSnapshots(model.snapshots || {});
      setInspection(model.inspection || null);

      const parameters = normalizeParameters(model.parameters);
      setParameters(parameters);
      setParamValues(parameterDefaults(parameters));

      setRootHashes(model.rootHashes);
      setTxSeqs(model.txSeqs ?? null);
      setRootHashesLoading(false);
      setUploadProgress(null);
      setLatestMessageOrder(model.messageOrder);
      setActiveIterationId(model.id);
      setHasUnsavedParamIteration(false);
    },
    [
      stlObjectUrl,
      setCurrentCode,
      setStlObjectUrl,
      setStlUrl,
      setStlBase64,
      setStepBase64,
      setGlbBase64,
      setDimViews,
      setSnapshots,
      setInspection,
      setParameters,
      setParamValues,
      setRootHashes,
      setTxSeqs,
      setRootHashesLoading,
      setUploadProgress,
      setLatestMessageOrder,
      setActiveIterationId,
      setHasUnsavedParamIteration,
    ],
  );

  const exitPreview = useCallback(() => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewStlUrl(null);
    setPreviewIteration(null);
    setPreviewLoadingId(null);
  }, [setPreviewStlUrl, setPreviewIteration, setPreviewLoadingId]);

  /** Fetch every stored version for a chat and attach them to messages. */
  const refreshIterations = useCallback(
    async (sessionId?: string | null) => {
      const sid = sessionId ?? chatSessionId;
      if (!sid) {
        setIterations([]);
        return [] as ModelIteration[];
      }

      // A background upload may finish after the user switched chats — never
      // paint its versions into the chat now on screen.
      if (sid !== chatSessionIdRef.current) {
        return [] as ModelIteration[];
      }

      setIterationsLoading(true);
      setIterationError(null);

      try {
        const res = await fetch(`${API_URL}${MODEL_ENDPOINTS.SESSION_ITERATIONS(sid)}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Failed to load iterations (${res.status})`);
        }

        const list = (data.iterations || []) as ModelIteration[];
        setIterations(list);
        setMessages((prev) => attachIterationsToMessages(prev, list));
        return list;
      } catch (e) {
        setIterationError(e instanceof Error ? e.message : String(e));
        return [] as ModelIteration[];
      } finally {
        setIterationsLoading(false);
      }
    },
    [
      chatSessionId,
      chatSessionIdRef,
      authHeaders,
      setIterations,
      setIterationsLoading,
      setIterationError,
      setMessages,
    ],
  );

  /** Load a version into the viewport as a preview (working state untouched). */
  const previewVersion = useCallback(
    async (iteration: ModelIteration) => {
      if (isGenerating) {
        setIterationError("Wait for the current generation to finish before previewing.");
        return;
      }
      if (iteration.uploadStatus !== "complete") {
        setIterationError("This iteration has no stored artifacts to preview.");
        return;
      }

      const requestId = ++previewRequestRef.current;
      setIterationError(null);
      setPreviewLoadingId(iteration.id);

      try {
        const res = await fetch(
          `${API_URL}${MODEL_ENDPOINTS.ITERATION_CONTENTS(iteration.id)}`,
          { headers: authHeaders() },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Failed to load version (${res.status})`);
        }
        // A newer preview (or an exit) superseded this request.
        if (requestId !== previewRequestRef.current) return;

        const contents = data.model as IterationContents;

        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = contents.stlBase64 ? base64ToObjectUrl(contents.stlBase64) : null;
        previewUrlRef.current = url;

        setPreviewStlUrl(url);
        setPreviewIteration({ ...iteration, ...contents });
      } catch (e) {
        if (requestId === previewRequestRef.current) {
          setIterationError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (requestId === previewRequestRef.current) {
          setPreviewLoadingId(null);
        }
      }
    },
    [
      isGenerating,
      authHeaders,
      setIterationError,
      setPreviewLoadingId,
      setPreviewStlUrl,
      setPreviewIteration,
    ],
  );

  const requestRewind = useCallback(
    (iteration: ModelIteration) => {
      // Never rewrite history while a generation or an upload is in flight.
      if (isGenerating) {
        setIterationError("Wait for the current generation to finish before going back.");
        return;
      }
      // Only THIS chat's upload blocks a rewind; an abandoned upload in a chat
      // the user left must not freeze actions here.
      if (isSessionUploading(store.chatSessionId)) {
        setIterationError("Wait for the current 0G upload to finish before going back.");
        return;
      }
      if (iteration.uploadStatus !== "complete") {
        setIterationError("This iteration has no stored artifacts and cannot be restored.");
        return;
      }
      if (!iteration.messageId) {
        setIterationError(
          "This legacy version is not anchored to a chat message, so it cannot be rewound safely. Store a new iteration first.",
        );
        return;
      }
      if (iteration.id === store.activeIterationId) {
        setIterationError("This version is already active.");
        return;
      }
      setIterationError(null);
      setRewindTarget(iteration);
    },
    [
      isGenerating,
      isSessionUploading,
      store.chatSessionId,
      store.activeIterationId,
      setIterationError,
      setRewindTarget,
    ],
  );

  const cancelRewind = useCallback(() => {
    setRewindTarget(null);
  }, [setRewindTarget]);

  /**
   * Destructive rewind: the server deletes newer versions and later messages,
   * then returns the restored contents and the trimmed transcript.
   */
  const confirmRewind = useCallback(async () => {
    const target = store.rewindTarget;
    if (!target) return;

    setRewinding(true);
    setIterationError(null);

    try {
      const res = await fetch(
        `${API_URL}${MODEL_ENDPOINTS.REWIND_ITERATION(target.id)}`,
        { method: "POST", headers: authHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Rewind failed (${res.status})`);
      }

      const model = data.model as IterationContents;
      const list = (data.iterations || []) as ModelIteration[];

      // The rewind committed server-side. The transcript may be returned with
      // the response or need a re-read; never replace it with a fake empty list.
      let trimmed: Message[] | null = Array.isArray(data.messages)
        ? (data.messages as Message[])
        : null;

      if (!trimmed) {
        const sid = store.chatSessionId;
        if (sid) {
          try {
            const historyRes = await fetch(`${API_URL}${CHAT_ENDPOINTS.HISTORY(sid)}`, {
              headers: authHeaders(),
            });
            const historyData = await historyRes.json().catch(() => ({}));
            if (historyRes.ok && Array.isArray(historyData.session?.messages)) {
              trimmed = historyData.session.messages as Message[];
            }
          } catch {
            trimmed = null;
          }
        }
      }

      applyContents(model);
      setIterations(list);
      if (trimmed) {
        setMessages(attachIterationsToMessages(trimmed, list));
      } else {
        setIterationError(
          "History was rewound, but the trimmed transcript could not be reloaded. Reopen this chat.",
        );
      }
      setRewindTarget(null);
      setModelStorageStatus(`Restored version ${model.version}`);
      setHasUnsavedParamIteration(false);
      exitPreview();
    } catch (e) {
      setIterationError(e instanceof Error ? e.message : String(e));
    } finally {
      setRewinding(false);
    }
  }, [
    store.rewindTarget,
    store.chatSessionId,
    authHeaders,
    applyContents,
    setIterations,
    setMessages,
    setRewindTarget,
    setModelStorageStatus,
    setHasUnsavedParamIteration,
    exitPreview,
    setRewinding,
    setIterationError,
  ]);

  // A preview belongs to the chat/model currently open — never leak it across.
  useEffect(() => {
    exitPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionId]);

  useEffect(() => {
    if (isGenerating) {
      exitPreview();
      // A "wait for generation" message from the previous run is stale now.
      setIterationError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  // A slider change re-renders the working model; stop showing the preview so
  // the user sees the parameter update they just made.
  useEffect(() => {
    if (isParamUpdating) exitPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParamUpdating]);

  // A slider update can complete while a preview is loading (the click landed
  // mid-request). The counter increments on completion, so surface the new
  // working model instead of leaving the stale preview on screen.
  useEffect(() => {
    exitPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramUpdateKey]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  return {
    applyContents,
    refreshIterations,
    previewVersion,
    exitPreview,
    requestRewind,
    cancelRewind,
    confirmRewind,
  };
}
