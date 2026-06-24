import { useState, useRef, useCallback } from "react";
import type {
  Parameter,
  ParameterSchema,
  Message,
  InspectionData,
  ClarificationOption,
  WorkflowStep,
  SessionListItem,
  Specification,
} from "@/types";
import type { RootHashData, TxSeqData } from "@/components/chat/RootHashes";
import { API_URL, CHAT_ENDPOINTS, MODEL_ENDPOINTS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useParamUpdate } from "@/hooks/useParamUpdate";

/**
 * Central state store for the entire app.
 * Every piece of state that was previously scattered across App.tsx lives here.
 * Sub-hooks receive the store object so they can read/write without prop drilling.
 */
export function useAppStore() {
  const auth = useAuth();

  const authHeaders = useCallback((): Record<string, string> => {
    return auth.isConnected
      ? { Authorization: `Bearer ${auth.getAuthHeader()}` }
      : {};
  }, [auth.isConnected, auth.getAuthHeader]);

  // ── Chat state ──
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [_provider, _setProvider] = useState("0g");
  // Wrap setProvider to log every state change
  const setProvider = useCallback((val: string | ((prev: string) => string)) => {
    const next = typeof val === 'function' ? val(_provider) : val;
    console.log('[useAppStore] setProvider called', { from: _provider, to: next });
    _setProvider(val);
  }, [_provider]);
  const provider = _provider;
  const [streamReasoning, setStreamReasoning] = useState("");
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [providerSupportsVision, setProviderSupportsVision] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // ── Session state ──
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<SessionListItem[]>([]);
  const [latestMessageOrder, setLatestMessageOrder] = useState<number | null>(
    null,
  );

  // ── Edit state ──
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(
    null,
  );
  const [editOriginalPrompt, setEditOriginalPrompt] = useState("");

  // ── Model state ──
  const [currentCode, setCurrentCode] = useState("");
  const [parameters, setParameters] = useState<Record<string, ParameterSchema>>(
    {},
  );
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [stlObjectUrl, setStlObjectUrl] = useState<string | null>(null);
  const [stepBase64, setStepBase64] = useState<string | undefined>(undefined);
  const [stlBase64, setStlBase64] = useState<string | undefined>(undefined);
  const [glbBase64, setGlbBase64] = useState<string | undefined>(undefined);
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [dimViews, setDimViews] = useState<Record<string, string>>({});
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [exportFilename, setExportFilename] = useState("model");

  // ── 0G storage state ──
  const [hasUnsavedParamIteration, setHasUnsavedParamIteration] =
    useState(false);
  const [isStoringIteration, setIsStoringIteration] = useState(false);
  const [modelStorageStatus, setModelStorageStatus] = useState<string | null>(
    null,
  );
  const [rootHashes, setRootHashes] = useState<RootHashData | null>(null);
  const [rootHashesLoading, setRootHashesLoading] = useState(false);
  const [txSeqs, setTxSeqs] = useState<TxSeqData | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<
    string,
    { status: string; rootHash?: string; txSeq?: number }
  > | null>(null);

  // ── Panel UI state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarManuallyToggled = useRef(false);
  const [inspectExpanded, setInspectExpanded] = useState(false);
  const [snapshotsExpanded, setSnapshotsExpanded] = useState(true);
  const [parametersExpanded, setParametersExpanded] = useState(true);
  const [exportExpanded, setExportExpanded] = useState(true);
  const [codeExpanded, setCodeExpanded] = useState(true);

  // ── Streaming refs ──
  const reasoningBufferRef = useRef("");
  const reasoningRafRef = useRef<number | null>(null);
  const assistantMessageIdRef = useRef<number | null>(null);

  // ── Hooks ──
  const { chatEndRef, chatContainerRef, handleScroll } = useAutoScroll([
    messages,
    streamReasoning,
  ]);

  const {
    paramValues,
    setParamValues,
    isParamUpdating,
    paramUpdateKey,
    paramError,
    handleParamChange,
    resetParams,
  } = useParamUpdate({
    currentCode,
    stlObjectUrl,
    onStlUpdate: setStlUrl,
    onStepUpdate: setStepBase64,
    onGlbBase64Update: setGlbBase64,
    onStlBase64Update: setStlBase64,
    onRevokeUrl: URL.revokeObjectURL,
    onParametersUpdate: setParameters,
    onSnapshotsUpdate: setSnapshots,
    onDimViewsUpdate: setDimViews,
    onInspectionUpdate: setInspection,
    onUpdateComplete: (data) => {
      if (data.stlBase64) setStlBase64(data.stlBase64);
      if (data.stepBase64) setStepBase64(data.stepBase64);
      if (data.glbBase64) setGlbBase64(data.glbBase64);
      setHasUnsavedParamIteration(true);
      setModelStorageStatus(null);
    },
    getAuthHeaders: authHeaders,
  });

  return {
    // Auth
    auth,
    authHeaders,

    // Chat
    prompt,
    setPrompt,
    images,
    setImages,
    messages,
    setMessages,
    isGenerating,
    setIsGenerating,
    provider,
    setProvider,
    streamReasoning,
    setStreamReasoning,
    reasoningEnabled,
    setReasoningEnabled,
    providerSupportsVision,
    setProviderSupportsVision,
    isFocused,
    setIsFocused,

    // Session
    sessionId,
    setSessionId,
    chatSessionId,
    setChatSessionId,
    chatSessions,
    setChatSessions,
    latestMessageOrder,
    setLatestMessageOrder,

    // Edit
    editingMessageIndex,
    setEditingMessageIndex,
    editOriginalPrompt,
    setEditOriginalPrompt,

    // Model
    currentCode,
    setCurrentCode,
    parameters,
    setParameters,
    stlUrl,
    setStlUrl,
    stlObjectUrl,
    setStlObjectUrl,
    stepBase64,
    setStepBase64,
    stlBase64,
    setStlBase64,
    glbBase64,
    setGlbBase64,
    snapshots,
    setSnapshots,
    dimViews,
    setDimViews,
    inspection,
    setInspection,
    exportFilename,
    setExportFilename,

    // 0G storage
    hasUnsavedParamIteration,
    setHasUnsavedParamIteration,
    isStoringIteration,
    setIsStoringIteration,
    modelStorageStatus,
    setModelStorageStatus,
    rootHashes,
    setRootHashes,
    rootHashesLoading,
    setRootHashesLoading,
    txSeqs,
    setTxSeqs,
    uploadProgress,
    setUploadProgress,

    // Panel UI
    sidebarOpen,
    setSidebarOpen,
    sidebarManuallyToggled,
    inspectExpanded,
    setInspectExpanded,
    snapshotsExpanded,
    setSnapshotsExpanded,
    parametersExpanded,
    setParametersExpanded,
    exportExpanded,
    setExportExpanded,
    codeExpanded,
    setCodeExpanded,

    // Streaming refs
    reasoningBufferRef,
    reasoningRafRef,
    assistantMessageIdRef,

    // Auto-scroll
    chatEndRef,
    chatContainerRef,
    handleScroll,

    // Param update (from useParamUpdate)
    paramValues,
    setParamValues,
    isParamUpdating,
    paramUpdateKey,
    paramError,
    handleParamChange,
    resetParams,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
