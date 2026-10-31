import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** A user prompt is "long" when it exceeds either limit. */
export const COLLAPSE_LINE_LIMIT = 8;
export const COLLAPSE_CHAR_LIMIT = 400;

export function isLongMessage(text: string | undefined | null): boolean {
  if (!text) return false;
  return (
    text.length > COLLAPSE_CHAR_LIMIT ||
    text.split("\n").length > COLLAPSE_LINE_LIMIT
  );
}

interface CollapsibleTextProps {
  text: string;
  className?: string;
  /** Gradient used for the collapse fade; callers can match their bubble. */
  fadeClassName?: string;
  /**
   * Controlled expansion. When provided, the inline text link is omitted —
   * the caller renders its own toggle (e.g. an icon in the bubble header).
   */
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * Long user prompts are clamped to ~6 lines with a fade. Short prompts render
 * unchanged. Uncontrolled usage keeps the inline "Show full message" link;
 * controlled usage leaves the toggle to the message header.
 */
export function CollapsibleText({
  text,
  className,
  fadeClassName = "from-adam-bg-secondary-dark via-adam-bg-secondary-dark/80 to-transparent",
  expanded: controlledExpanded,
  onToggle,
}: CollapsibleTextProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = typeof controlledExpanded === "boolean";
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const toggle = onToggle ?? (() => setInternalExpanded((v) => !v));
  const long = isLongMessage(text);

  if (!long) {
    return <div className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>{text}</div>;
  }

  return (
    <div>
      <div
        className={cn(
          "relative whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          !expanded && "max-h-[8.5rem] overflow-hidden",
          className,
        )}
      >
        {text}
        {!expanded && (
          <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t", fadeClassName)} />
        )}
      </div>
      {!isControlled && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md py-0.5 text-[11px] font-medium text-adam-accent transition-colors hover:text-adam-accent/80"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show full message
            </>
          )}
        </button>
      )}
    </div>
  );
}
