import { useMemo, useState } from "react";
import { AlertTriangle, Eye, History, Loader2 } from "lucide-react";
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
  /** Session hydration still in flight — show an artifact skeleton. */
  sessionLoading?: boolean;
  onPreview: (iteration: ModelIteration) => void;
  onGoBack: (iteration: ModelIteration) => void;
}

const SOURCE_META: Record<ModelSource, string> = {
  generate: "Generated",
  param_tweak: "Param tweak",
  restored: "Restored",
};

// Per-button reveal, label BEFORE the icon: the label grows left while the
// icon stays under the cursor. No shared group hover, so the neighbouring
// action never expands and steals the click.
const VERSION_ACTION_LABEL =
  "max-w-0 overflow-hidden whitespace-nowrap text-right text-[10px] font-medium opacity-0 transition-[margin,max-width,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/version-action:mr-1.5 group-hover/version-action:max-w-[64px] group-hover/version-action:opacity-100 group-focus/version-action:mr-1.5 group-focus/version-action:max-w-[64px] group-focus/version-action:opacity-100";

/** Relative for recent versions, a short date once it is a week old. */
function versionTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000) {
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

function fullTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

/**
 * Inline iteration history for one assistant turn.
 *
 * A version is a quiet row: version, date, and the two actions that matter.
 * Stored artifacts live underneath; provenance and status only appear when
 * they are actionable (uploading / failed), never as decorative pills.
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
  sessionLoading,
  onPreview,
  onGoBack,
}: IterationHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // No stored version yet (upload still running, or legacy message).
  if (iterations.length === 0) {
    if (sessionLoading && isNewest) {
      return (
        <div className="mr-auto w-full max-w-[92%]">
          <RootHashes hashes={null} loading className="mt-0" />
        </div>
      );
    }
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
          className="mt-0"
        />
      </div>
    );
  }

  const selected =
    iterations.find((it) => it.id === selectedId) ??
    iterations.find((it) => it.id === activeIterationId) ??
    iterations[0];

  const isCurrent = !!activeIterationId && selected.id === activeIterationId;
  const isRestorable = selected.uploadStatus === "complete";
  // Legacy versions have no message anchor; refusing beats guessing an index.
  const isAnchored = !!selected.messageId;
  const canGoBack = isRestorable && isAnchored && !isCurrent;
  const sourceLabel = SOURCE_META[selected.source] ?? "Generated";
  const previewLoading = previewLoadingId === selected.id;
  const isPreviewing = previewId === selected.id;
  const isUploading = selected.id === activeIterationId && loading;
  const hasProgress =
    isUploading && !!progress && Object.keys(progress).length > 0;

  const artifactCount = useMemo(
    () => Object.values(selected.rootHashes || {}).filter(Boolean).length,
    [selected.rootHashes],
  );
  const showArtifacts = artifactCount > 0 || hasProgress;

  // A pending row that is not actively uploading is a dead upload: say so
  // plainly instead of leaving the user guessing why the actions are disabled.
  const storageMessage =
    selected.uploadStatus === "failed"
      ? "Artifact storage failed"
      : selected.uploadStatus === "pending" && !isUploading && artifactCount === 0
        ? "Artifacts weren't stored"
        : null;

  return (
    <div className="mr-auto w-full max-w-[92%]">
      <div className="relative overflow-hidden rounded-xl bg-[#202020]/90 ring-1 ring-white/[0.05] backdrop-blur-md">
        {/* Version navigation, only when there is more than one version. */}
        {iterations.length > 1 && (
          <div
            aria-label="Stored versions"
            className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.04] px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {iterations.map((it) => {
              const isSelected = it.id === selected.id;
              const isActive = it.id === activeIterationId;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  title={`v${it.version} · ${SOURCE_META[it.source] ?? it.source} · ${versionTime(it.createdAt)}`}
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-[10.5px] tabular-nums transition-colors",
                    isSelected
                      ? "bg-white/[0.06] text-adam-text-primary"
                      : "text-adam-text-tertiary hover:bg-white/[0.04] hover:text-adam-text-secondary",
                    !isSelected && it.uploadStatus === "failed" && "text-red-400/80",
                  )}
                >
                  v{it.version}
                  {isActive && <span className="h-1 w-1 rounded-full bg-adam-accent/80" />}
                </button>
              );
            })}
          </div>
        )}

        <div className={cn("bg-white/[0.015]", showArtifacts && "border-b border-white/[0.04]")}>
          {/* One quiet row: version · date · actions. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
            <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-adam-text-primary/85">
              v{selected.version}
            </span>

          <span
            className="text-[10.5px] text-adam-text-tertiary/75"
            title={fullTime(selected.createdAt)}
          >
            {versionTime(selected.createdAt)}
          </span>

          {selected.source !== "generate" && (
            <span className="text-[10px] text-adam-text-tertiary/55">
              · {sourceLabel}
            </span>
          )}

          {isUploading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-adam-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              Storing artifacts…
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onPreview(selected)}
              disabled={!isRestorable || previewLoading}
              aria-label="Preview this version"
              title={!isRestorable ? "No stored artifacts to preview" : undefined}
              className={cn(
                "group/version-action flex h-6 items-center rounded-md px-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                isPreviewing
                  ? "bg-adam-accent/[0.08] text-adam-accent"
                  : "text-adam-text-tertiary hover:bg-white/[0.05] hover:text-adam-text-primary",
              )}
            >
              <span className={VERSION_ACTION_LABEL}>
                {isPreviewing ? "Previewing" : "Preview"}
              </span>
              {previewLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onGoBack(selected)}
              disabled={!canGoBack}
              aria-label={isCurrent ? "This version is active" : "Rollback to this version"}
              title={
                canGoBack
                  ? undefined
                  : isCurrent
                    ? "This version is already active"
                    : !isRestorable
                      ? "No stored artifacts"
                      : !isAnchored
                        ? "Legacy version — cannot be rewound safely"
                        : undefined
              }
              className="group/version-action flex h-6 items-center rounded-md px-1.5 text-adam-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-adam-text-primary disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className={VERSION_ACTION_LABEL}>Rollback</span>
              <History className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {storageMessage && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 pb-2 text-[10px]",
              selected.uploadStatus === "failed"
                ? "text-red-300/75"
                : "text-adam-accent/70",
            )}
            title={selected.uploadError || undefined}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{storageMessage}</span>
          </div>
        )}
        </div>

        {showArtifacts && (
          <RootHashes
            hashes={selected.rootHashes}
            txSeqs={selected.txSeqs ?? undefined}
            loading={isUploading}
            progress={isUploading ? progress : undefined}
            className="mt-0 bg-transparent ring-0"
          />
        )}
      </div>
    </div>
  );
}
