import { AlertTriangle, History, Loader2, X } from "lucide-react";
import type { Message, ModelIteration } from "@/types";

interface RewindConfirmDialogProps {
  target: ModelIteration | null;
  iterations: ModelIteration[];
  messages: Message[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Destructive confirmation for "go back". States the exact blast radius before
 * anything is deleted: newer versions and later chat messages.
 */
export function RewindConfirmDialog({
  target,
  iterations,
  messages,
  busy,
  error,
  onCancel,
  onConfirm,
}: RewindConfirmDialogProps) {
  if (!target) return null;

  const newerVersions = iterations.filter((it) => it.version > target.version).length;

  // Count everything after the target turn, including clarification/error
  // entries that never received a messageOrder.
  const targetIndex = messages.findIndex(
    (m) => m.role === "assistant" && m.messageOrder === target.messageOrder,
  );
  const laterMessages =
    targetIndex >= 0
      ? messages.length - targetIndex - 1
      : messages.filter(
          (m) => typeof m.messageOrder === "number" && m.messageOrder > target.messageOrder,
        ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewind-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-adam-bg-secondary-dark shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/15">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="rewind-title" className="text-sm font-semibold text-adam-text-primary">
              Go back to version {target.version}?
            </h2>
            <p className="text-[11px] text-adam-text-tertiary">
              This rewrites the chat history and cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-adam-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 px-4 py-3 text-[12px] text-adam-text-secondary">
          <p>
            The model, code, parameters and files from{" "}
            <span className="font-mono text-adam-text-primary">v{target.version}</span> will be
            restored as the working state.
          </p>
          <ul className="space-y-1 rounded-lg bg-white/[0.025] px-3 py-2 text-[11.5px] ring-1 ring-white/[0.05]">
            <li className="flex items-center justify-between gap-2">
              <span>Newer versions deleted</span>
              <span className="font-mono tabular-nums text-amber-300">{newerVersions}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Later messages removed</span>
              <span className="font-mono tabular-nums text-amber-300">{laterMessages}</span>
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-adam-text-tertiary">
            The 0G blobs themselves stay on-chain, but their pointers are removed from this chat.
          </p>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-300 ring-1 ring-red-500/15">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-adam-text-secondary transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 py-1.5 text-[12px] font-semibold text-amber-300 ring-1 ring-amber-400/20 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
            {busy ? "Rewinding…" : `Go back to v${target.version}`}
          </button>
        </div>
      </div>
    </div>
  );
}
