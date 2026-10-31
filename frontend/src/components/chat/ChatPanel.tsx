import { Fragment } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { AppStore } from "@/hooks/useAppStore";
import { ChatInput } from "@/components/chat/ChatInput";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { ClarificationMessage } from "@/components/chat/ClarificationMessage";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { EditInput } from "@/components/chat/EditInput";
import { IterationHistory } from "@/components/chat/IterationHistory";
import type { ModelIteration } from "@/types";

interface ChatPanelProps {
  store: AppStore;
  onGenerate: () => void;
  onStop: () => void;
  onClarificationSubmit: (
    answers: string,
    answerList: { question: string; answer: string }[],
  ) => void;
  onEdit: (index: number) => void;
  onEditSubmit: (editPrompt: string) => void;
  onRetry: (index: number) => void;
  onPreviewIteration: (iteration: ModelIteration) => void;
  onGoBack: (iteration: ModelIteration) => void;
  placeholder?: string;
  showAnimatedPlaceholder?: boolean;
}

/**
 * The full chat panel — message list, streaming indicator, and input dock.
 * Extracted from the ~250-line chat section of App.tsx render.
 */
export function ChatPanel({
  store,
  onGenerate,
  onStop,
  onClarificationSubmit,
  onEdit,
  onEditSubmit,
  onRetry,
  onPreviewIteration,
  onGoBack,
  placeholder = "Modify your model...",
  showAnimatedPlaceholder = false,
}: ChatPanelProps) {
  const {
    messages,
    isGenerating,
    provider,
    setProvider,
    prompt,
    setPrompt,
    isFocused,
    setIsFocused,
    reasoningEffort,
    setReasoningEffort,
    streamReasoning,
    images,
    setImages,
    providerSupportsVision,
    auth,
    editingMessageIndex,
    editOriginalPrompt,
    setEditingMessageIndex,
    rootHashes,
    txSeqs,
    rootHashesLoading,
    uploadProgress,
    activeIterationId,
    previewIteration,
    previewLoadingId,
    sessionLoading,
    iterationError,
    setIterationError,
    chatMountKey,
    chatEndRef,
    chatContainerRef,
    handleScroll,
  } = store;

  return (
    <div className="relative flex h-full min-w-0 flex-col border-r border-white/[0.06] bg-adam-bg-secondary-dark">
      {/* Message list */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4"
      >
        {messages.map((msg, i) =>
          msg.clarification ? (
            <ClarificationMessage
              key={`${chatMountKey}-${i}`}
              questions={msg.clarification}
              onSubmit={onClarificationSubmit}
              isGenerating={isGenerating}
            />
          ) : isGenerating &&
            i === messages.length - 1 &&
            msg.role === "assistant" &&
            !msg.content ? null : (
            // Chat-scoped key: per-message UI state (expanded prompt, TEE
            // modal, clarification answers) must not leak across chats, and
            // must NOT remount when the new chat's id arrives after its first
            // save (chatMountKey only changes on a real chat switch).
            <Fragment key={`${chatMountKey}-${i}`}>
              <MessageBubble
                message={msg}
                index={i}
                onEdit={onEdit}
                onRetry={onRetry}
              />
              {editingMessageIndex === i && (
                <EditInput
                  originalPrompt={editOriginalPrompt}
                  onSubmit={onEditSubmit}
                  onCancel={() => setEditingMessageIndex(null)}
                />
              )}
              {msg.role === "assistant" && (
                <IterationHistory
                  message={msg}
                  iterations={msg.iterations ?? []}
                  isNewest={i === messages.length - 1}
                  activeIterationId={activeIterationId}
                  loading={i === messages.length - 1 ? rootHashesLoading : false}
                  progress={i === messages.length - 1 ? uploadProgress : undefined}
                  fallbackHashes={
                    msg.rootHashes ?? (i === messages.length - 1 ? rootHashes : null)
                  }
                  fallbackTxSeqs={i === messages.length - 1 ? txSeqs : null}
                  previewId={previewIteration?.id ?? null}
                  previewLoadingId={previewLoadingId}
                  sessionLoading={sessionLoading}
                  onPreview={onPreviewIteration}
                  onGoBack={onGoBack}
                />
              )}
            </Fragment>
          ),
        )}
        {isGenerating && (
          <StreamingMessage
            steps={
              messages.length > 0 &&
              messages[messages.length - 1].role === "assistant"
                ? messages[messages.length - 1].steps
                : undefined
            }
            reasoning={streamReasoning}
          />
        )}

        {/* Iteration actions can fail on any turn, including while the newest
            bubble is a streaming placeholder. Sticky at the viewport bottom so
            the feedback is visible even when scrolled up. */}
        {iterationError && (
          <div className="sticky bottom-0 z-10 mx-1 flex items-start gap-1.5 rounded-lg border border-red-500/15 bg-[#241a1a]/95 px-3 py-2 text-[11px] leading-relaxed text-red-300 backdrop-blur-md">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            <span className="flex-1">{iterationError}</span>
            <button
              type="button"
              onClick={() => setIterationError(null)}
              aria-label="Dismiss error"
              className="rounded p-0.5 text-red-300/70 transition-colors hover:bg-white/[0.06] hover:text-red-200"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input dock */}
      <div className="border-t border-adam-neutral-700/40 p-3 bg-gradient-to-t from-white/[0.01] to-transparent">
        <ChatInput
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={onGenerate}
          onStop={onStop}
          isGenerating={isGenerating}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          provider={provider}
          setProvider={setProvider}
          placeholder={placeholder}
          reasoningEffort={reasoningEffort}
          setReasoningEffort={setReasoningEffort}
          images={images}
          onImagesChange={setImages}
          providerSupportsVision={providerSupportsVision}
          isConnected={auth.isConnected}
          showAnimatedPlaceholder={showAnimatedPlaceholder}
        />
      </div>
    </div>
  );
}
