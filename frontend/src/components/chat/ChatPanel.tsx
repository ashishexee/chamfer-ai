import { Fragment } from "react";
import type { AppStore } from "@/hooks/useAppStore";
import { ChatInput } from "@/components/chat/ChatInput";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { ClarificationMessage } from "@/components/chat/ClarificationMessage";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { EditInput } from "@/components/chat/EditInput";
import { RootHashes } from "@/components/chat/RootHashes";

interface ChatPanelProps {
  store: AppStore;
  onGenerate: () => void;
  onClarificationSubmit: (
    answers: string,
    answerList: { question: string; answer: string }[],
  ) => void;
  onEdit: (index: number) => void;
  onEditSubmit: (editPrompt: string) => void;
  onRetry: (index: number) => void;
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
  onClarificationSubmit,
  onEdit,
  onEditSubmit,
  onRetry,
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
    chatEndRef,
    chatContainerRef,
    handleScroll,
  } = store;

  return (
    <div className="relative flex h-full min-w-0 flex-col border-r border-adam-neutral-700/40 bg-adam-bg-secondary-dark">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-adam-neutral-700/40 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isGenerating ? "bg-adam-blue animate-pulse" : "bg-adam-neutral-600"}`}
          />
          <span className="text-sm font-semibold text-adam-text-primary">
            Chat
          </span>
        </div>
        <span className="text-[10px] text-adam-text-tertiary/70 tabular-nums">
          {messages.filter((m) => !m.clarification).length} messages
        </span>
      </div>

      {/* Message list */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
      >
        {messages.map((msg, i) =>
          msg.clarification ? (
            <ClarificationMessage
              key={i}
              questions={msg.clarification}
              onSubmit={onClarificationSubmit}
              isGenerating={isGenerating}
            />
          ) : isGenerating &&
            i === messages.length - 1 &&
            msg.role === "assistant" &&
            !msg.content ? null : (
            <Fragment key={i}>
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
                <RootHashes
                  hashes={
                    msg.rootHashes ||
                    (i === messages.length - 1 ? rootHashes : null)
                  }
                  txSeqs={i === messages.length - 1 ? txSeqs : undefined}
                  loading={
                    i === messages.length - 1 ? rootHashesLoading : false
                  }
                  progress={
                    i === messages.length - 1 ? uploadProgress : undefined
                  }
                  defaultExpanded={i === messages.length - 1}
                />
              )}
            </Fragment>
          ),
        )}
        {isGenerating && (
          <StreamingMessage
            provider={provider}
            steps={
              messages.length > 0 &&
              messages[messages.length - 1].role === "assistant"
                ? messages[messages.length - 1].steps
                : undefined
            }
            reasoning={streamReasoning}
          />
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input dock */}
      <div className="border-t border-adam-neutral-700/40 p-3 bg-gradient-to-t from-white/[0.01] to-transparent">
        <ChatInput
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={onGenerate}
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
