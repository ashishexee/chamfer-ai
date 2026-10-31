import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  History,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { Message, ModelIteration, ModelSource, RootHashData, TxSeqData } from "@/types";
import { pickActiveIteration } from "@/lib/iterations";
import { RootHashes, type UploadProgress } from "@/components/chat/RootHashes";
import { cn } from "@/lib/utils";

interface IterationHistoryProps {
  message: Message;
  iterations: ModelIteration[];
  /** Newest message in the transcript — hosts the live upload progress. */
  isNewest: boolean;
  activeIterationId: string | null;
  loading: boolean;
  progress?: UploadProgress | null;
  fallbackHashes?: RootHashData | null;
  fallbackTxSeqs?: TxSeqData | null;
  previewId: string | null;
  previewLoadingId: string | null;
  onPreview: (iteration: ModelIteration) => void;
  onGoBack: (iteration: ModelIteration) => void;
}

const SOURCE_META: Record<ModelSource, { label: string; icon: typeof Sparkles }> = {
  generate: { label: "Generated", icon: Sparkles },
  param_tweak: { label: "Param tweak", icon: Wrench },
  restored: { label: "Restored", icon: History },
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function VersionThumbnails({ dimViews }: { dimViews?: Record<string, string> | null }) {
  const views = useMemo(
    () =>
      Object.entries(dimViews || {})
        .filter(([, svg]) => svg && !svg.includes("error"))
        .slice(0, 3),
    [dimViews],
  );

  if (views.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {views.map(([view, svg]) => (
        <div
          key={view}
          className="overflow-hidden rounded-lg border border-white/[0.05] bg-adam-bg-dark/40"
        >
          <div
            className="flex h-[62px] items-center justify-center p-1"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="bg-adam-bg-dark/60 py-0.5 text-center text-[9px] uppercase tracking-wider text-adam-text-tertiary/80">
            {view}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Inline iteration history for one assistant turn.
 *
 * - Every stored version is a chip; selecting one shows its 0G proof and a
 *   compact dimension-view preview.
 * - Preview loads the version into the main viewport without touching the
 *   working model.
 * - Go back rewinds history (destructive, confirmed by the parent dialog).
 */
export function IterationHistory({
  message,
  iterations,
  isNewest,
  activeIterationId,
  loading,
  progress,
  fallbackHashes,
  fallbackTxSeqs,
  previewId,
  previewLoadingId,
  onPreview,
  onGoBack,
}: IterationHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // No stored version yet (upload still running, or legacy message).
  if (iterations.length === 0) {
    const hashes = fallbackHashes ?? message.rootHashes ?? null;
    const hasLiveData = loading || !!progress || (isNewest && !!hashes);
    if (!hasLiveData && !hashes) return null;

    return (
      <div className="mr-auto w-full max-w-[92%]">
        <RootHashes
          hashes={hashes}
          txSeqs={fallbackTxSeqs}
          loading={loading}
          progress={progress}
          defaultExpanded={isNewest}
          className="mt-0"
        />
      </div>
    );
  }

  const active = pickActiveIteration(iterations);
  const selected =
    iterations.find((it) => it.id === selectedId) ??
    iterations.find((it) => it.id === activeIterationId) ??
    iterations[0];

  const isCurrent = !!activeIterationId && selected.id === activeIterationId;
  const isRestorable = selected.uploadStatus === "complete";
  // Legacy versions have no message anchor; refusing beats guessing an index.
  const isAnchored = !!selected.messageId;
  const canGoBack = isRestorable && isAnchored && !isCurrent;
  const source = SOURCE_META[selected.source] || SOURCE_META.generate;
  const SourceIcon = source.icon;
  const previewLoading = previewLoadingId === selected.id;
  const isPreviewing = previewId === selected.id;

  return (
    <div className="mt-0.5 mr-auto w-full max-w-[92%]">
      <div className="overflow-hidden rounded-2xl bg-[#1E2329]/90 ring-1 ring-white/[0.055] backdrop-blur-md">
        {/* Version chips */}
        {iterations.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.04] px-2.5 py-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-adam-text-tertiary/70">
              Versions
            </span>
            {iterations.map((it) => {
              const isSelected = it.id === selected.id;
              const isActive = it.id === activeIterationId;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  title={`v${it.version} · ${SOURCE_META[it.source]?.label ?? it.source} · ${timeAgo(it.createdAt)}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors",
                    isSelected
                      ? "bg-adam-blue/15 text-adam-blue ring-1 ring-adam-blue/30"
                      : "text-adam-text-tertiary hover:bg-white/[0.05] hover:text-adam-text-secondary",
                    it.uploadStatus === "failed" && "text-red-400/80",
                  )}
                >
                  v{it.version}
                  {isActive && <span className="h-1 w-1 rounded-full bg-emerald-400" />}
                </button>
              );
            })}
            <span className="ml-auto font-mono text-[10.5px] tabular-nums text-adam-text-tertiary/60">
              {iterations.length} total
            </span>
          </div>
        )}

        {/* Selected version meta */}
        <div className="flex items-center gap-2 px-3 py-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1",
              isCurrent
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/15"
                : "bg-white/[0.04] text-adam-text-tertiary ring-white/[0.06]",
            )}
          >
            {isCurrent ? <Check className="h-2.5 w-2.5" /> : <SourceIcon className="h-2.5 w-2.5" />}
            v{selected.version}
            {isCurrent ? " · current" : ""}
          </span>
          <span className="text-[11px] text-adam-text-tertiary">
            {source.label}
            {selected.createdAt ? ` · ${timeAgo(selected.createdAt)}` : ""}
          </span>
          {selected.uploadStatus === "failed" && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-red-400/90">
              <AlertTriangle className="h-2.5 w-2.5" />
              upload failed
            </span>
          )}
          {selected.uploadStatus === "pending" && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 text-[10.5px]",
                selected.id === activeIterationId && loading
                  ? "text-adam-blue"
                  : "text-amber-300/90",
              )}
            >
              {selected.id === activeIterationId && loading ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  uploading
                </>
              ) : (
                <>
                  <AlertTriangle className="h-2.5 w-2.5" />
                  incomplete — no 0G data
                </>
              )}
            </span>
          )}
        </div>

        {/* 0G proof for the selected version */}
        <div className="px-1 pb-1">
          <RootHashes
            hashes={selected.rootHashes}
            txSeqs={selected.txSeqs ?? undefined}
            // Only a live upload shows progress; stale pending rows have no
            // artifacts and must not spin "Fetching proofs" forever.
            loading={selected.id === activeIterationId ? loading : false}
            progress={selected.id === activeIterationId ? progress : undefined}
            defaultExpanded={isNewest || iterations.length > 1}
          />
        </div>

        <VersionThumbnails dimViews={selected.dimViews} />

        {/* Actions */}
        <div className="grid grid-cols-2 gap-1.5 border-t border-white/[0.04] px-2.5 py-2">
          <button
            type="button"
            onClick={() => onPreview(selected)}
            disabled={!isRestorable || previewLoading}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium transition-colors",
              isPreviewing
                ? "bg-adam-blue/15 text-adam-blue ring-1 ring-adam-blue/25"
                : "bg-white/[0.035] text-adam-text-secondary hover:bg-white/[0.07] hover:text-white",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            title="Render this version in the main viewport without changing the working model"
          >
            {previewLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {isPreviewing ? "Previewing" : "Preview"}
          </button>

          <button
            type="button"
            onClick={() => onGoBack(selected)}
            disabled={!canGoBack}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium transition-colors",
              "bg-white/[0.035] text-adam-text-secondary hover:bg-amber-400/10 hover:text-amber-300",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            title={
              isCurrent
                ? "This version is already active"
                : !isRestorable
                  ? "This version has no stored artifacts"
                  : !isAnchored
                    ? "Legacy version — not anchored to a chat message, so it cannot be rewound safely"
                    : "Rewind the chat to this iteration (removes newer versions and later messages)"
            }
          >
            <History className="h-3 w-3" />
            {isCurrent ? "Current" : "Go back"}
          </button>
        </div>
      </div>
    </div>
  );
}
