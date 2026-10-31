import { NutIcon } from "@/components/hardware/NutIcon";
import { Sidebar } from "@/components/layout/Sidebar";
import { PreviewPanel } from "@/components/layout/PreviewPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { InspectPanel } from "@/components/cad/InspectPanel";
import { ChatInput } from "@/components/chat/ChatInput";
import { LampContainer } from "@/components/ui/lamp";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

// Hooks
import { useAppStore } from "@/hooks/useAppStore";
import { useModelStorage } from "@/hooks/useModelStorage";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useGeneration } from "@/hooks/useGeneration";
import { useIterations } from "@/hooks/useIterations";
import { usePanelLayout } from "@/hooks/usePanelLayout";
import { RewindConfirmDialog } from "@/components/chat/RewindConfirmDialog";

// Landing-page example prompts — one click fills the composer
const SUGGESTIONS = [
  "Design a mounting bracket",
  "Create a spur gear",
  "Model a flanged bushing",
  "Make an enclosure lid",
];

export default function App() {
  // ── Central state store ──
  const store = useAppStore();

  // ── Sub-hooks ──
  // Iterations must exist before model storage so uploads can refresh history.
  const {
    refreshIterations,
    previewVersion,
    exitPreview,
    requestRewind,
    cancelRewind,
    confirmRewind,
  } = useIterations(store);
  const { uploadModelTo0G, storeCurrentIteration } = useModelStorage(
    store,
    refreshIterations,
  );
  const { saveCurrentSession, handleLoadSession, renameSession } =
    useChatSessions(store);
  const {
    handleGenerate,
    handleStop,
    handleClarificationSubmit,
    handleEdit,
    handleEditSubmit,
    handleRetry,
    handleNewTask,
  } = useGeneration(store, {
    uploadModelTo0G,
    saveCurrentSession,
    resetParams: store.resetParams,
  });
  const {
    collapsed,
    setCollapsed,
    panelAnimating,
    rotatingKey,
    chatPanelRef,
    previewPanelRef,
    rightPanelRef,
    togglePanel,
    hasModel,
  } = usePanelLayout(store);

  // ── Render ──
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        isOpen={store.sidebarOpen}
        onNewTask={handleNewTask}
        onToggleSidebar={() => {
          store.sidebarManuallyToggled.current = true;
          store.setSidebarOpen(!store.sidebarOpen);
        }}
        walletAddress={store.auth.address}
        isConnected={store.auth.isConnected}
        isAuthLoading={store.auth.isLoading}
        onConnect={() => store.auth.connect()}
        onDisconnect={() => store.auth.disconnect()}
        sessions={store.chatSessions}
        activeSessionId={store.chatSessionId}
        onSelectSession={handleLoadSession}
        onRenameSession={renameSession}
      />

      <div className="relative flex-1 overflow-auto bg-adam-bg-dark">
        <div
          className={`h-full bg-adam-bg-dark transition-all duration-300 ease-in-out ${store.sidebarOpen ? "p-6" : "p-0"}`}
        >
          <div
            className={`h-full bg-adam-bg-secondary-dark transition-all duration-300 ease-in-out overflow-hidden flex relative ${store.sidebarOpen ? "rounded-xl" : "rounded-none"}`}
          >
            {!hasModel ? (
              /* ── Landing page ── */
              <LampContainer className="flex-1 min-h-0">
                <div className="flex flex-col items-center justify-center flex-1 w-full min-h-0 px-4">
                  <h1 className="mb-6 text-center text-2xl font-semibold text-adam-text-primary md:text-3xl px-4 select-none">
                    What <span className="text-adam-accent">Chamfer AI</span> can do for you
                  </h1>
                  <div className="w-full max-w-3xl">
                    <ChatInput
                      hero
                      prompt={store.prompt}
                      setPrompt={store.setPrompt}
                      onSubmit={() => handleGenerate()}
                      onStop={handleStop}
                      isGenerating={store.isGenerating}
                      isFocused={store.isFocused}
                      setIsFocused={store.setIsFocused}
                      provider={store.provider}
                      setProvider={store.setProvider}
                      placeholder="Start building with Chamfer AI..."
                      reasoningEffort={store.reasoningEffort}
                      setReasoningEffort={store.setReasoningEffort}
                      showAnimatedPlaceholder
                      images={store.images}
                      onImagesChange={store.setImages}
                      providerSupportsVision={store.providerSupportsVision}
                      isConnected={store.auth.isConnected}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 px-4">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => store.setPrompt(s)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-adam-text-secondary transition-colors duration-150 hover:border-adam-accent/30 hover:bg-adam-accent/[0.06] hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </LampContainer>
            ) : (
              /* ── Editor layout (3 panels) ── */
              <ResizablePanelGroup
                orientation="horizontal"
                className={cn(
                  "h-full w-full",
                  panelAnimating && "panel-animated",
                )}
              >
                {/* Chat panel */}
                <ResizablePanel
                  panelRef={chatPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={27}
                  maxSize={400}
                  defaultSize={30}
                  onResize={(size) => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5)
                      setCollapsed((c) =>
                        c.chat ? c : { ...c, chat: true },
                      );
                  }}
                  className="bg-adam-bg-secondary-dark"
                >
                  <ChatPanel
                    store={store}
                    onGenerate={() => handleGenerate()}
                    onStop={handleStop}
                    onClarificationSubmit={handleClarificationSubmit}
                    onEdit={handleEdit}
                    onEditSubmit={handleEditSubmit}
                    onRetry={handleRetry}
                    onPreviewIteration={previewVersion}
                    onGoBack={requestRewind}
                  />
                </ResizablePanel>

                <ResizableHandle>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel("chat", chatPanelRef);
                    }}
                    title={collapsed.chat ? "Show chat" : "Hide chat"}
                    className="absolute top-1/2 left-full -translate-y-1/2 h-9 w-9 glass-hud rounded-lg flex items-center justify-center text-adam-text-secondary hover:text-adam-accent hover:bg-adam-accent/15 transition-colors pointer-events-auto cursor-pointer outline-none"
                  >
                    <NutIcon
                      className="h-5 w-5"
                      spinning={rotatingKey === "chat"}
                    />
                  </button>
                </ResizableHandle>

                {/* Preview panel */}
                <ResizablePanel
                  panelRef={previewPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={30}
                  defaultSize={45}
                  onResize={(size) => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5)
                      setCollapsed((c) =>
                        c.preview ? c : { ...c, preview: true },
                      );
                  }}
                >
                  <PreviewPanel
                    stlUrl={store.stlUrl}
                    paramUpdateKey={store.paramUpdateKey}
                    isParamUpdating={store.isParamUpdating}
                    isCollapsed={collapsed.preview}
                    isModelLoading={store.sessionLoading}
                    previewStlUrl={store.previewStlUrl}
                    previewLabel={
                      store.previewIteration
                        ? `Previewing v${store.previewIteration.version}`
                        : null
                    }
                    previewLoading={!!store.previewLoadingId}
                    previewCanGoBack={
                      !!store.previewIteration &&
                      store.previewIteration.id !== store.activeIterationId &&
                      !!store.previewIteration.messageId
                    }
                    onExitPreview={exitPreview}
                    onGoBack={() => {
                      if (store.previewIteration) requestRewind(store.previewIteration);
                    }}
                  />
                </ResizablePanel>

                <ResizableHandle>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel("right", rightPanelRef);
                    }}
                    title={collapsed.right ? "Show inspect" : "Hide inspect"}
                    className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 h-9 w-9 glass-hud rounded-lg flex items-center justify-center text-adam-text-secondary hover:text-adam-accent hover:bg-adam-accent/15 transition-colors pointer-events-auto cursor-pointer outline-none"
                  >
                    <NutIcon
                      className="h-5 w-5"
                      spinning={rotatingKey === "right"}
                    />
                  </button>
                </ResizableHandle>

                {/* Right panel (inspect) */}
                <ResizablePanel
                  panelRef={rightPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={300}
                  defaultSize={26}
                  maxSize={400}
                  onResize={(size) => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5)
                      setCollapsed((c) =>
                        c.right ? c : { ...c, right: true },
                      );
                  }}
                  className="bg-adam-bg-secondary-dark"
                >
                  <InspectPanel
                    store={store}
                    onStoreIteration={storeCurrentIteration}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        </div>
      </div>

      <RewindConfirmDialog
        target={store.rewindTarget}
        iterations={store.iterations}
        messages={store.messages}
        busy={store.rewinding}
        error={store.iterationError}
        onCancel={cancelRewind}
        onConfirm={confirmRewind}
      />
    </div>
  );
}
