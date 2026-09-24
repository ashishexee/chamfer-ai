// Adapted from Beautiful UI (beautifului.dev, MIT) — a code panel with two
// views: "Code" (line-numbered listing) and "Diff" (unified diff with
// word-level add/del highlights). Changes for this codebase: colors mapped
// to the adam palette, Python-aware syntax coloring (CadQuery code), and an
// `actions` slot in the header. The Diff view is ready but unused until
// iteration diffs are wired end-to-end.

"use client";

import { useCallback, useState, type ReactNode } from "react";

/* A single run of code within a diff row; `change` tints it as an add/del. */
export type CodePiece = { text: string; change?: "add" | "del" };
/* One row of a unified diff: old/new line numbers, its kind, and its pieces. */
export type DiffRow = {
  old: number | null;
  cur: number | null;
  type: "ctx" | "add" | "del";
  pieces: CodePiece[];
};
/* Prominent copy strings on the code block. */
export type CodeBlockLabels = { copy: string; copied: string };

/* ── adam-palette color map (replaces Beautiful UI token vars) ── */
const C = {
  ink: "#E5E5E5",
  ink2: "#ADADAD",
  ink3: "#676767",
  line: "rgba(255,255,255,0.07)",
  accentInk: "#4DBBFF",
  orange: "#F68F3C",
  green: "#34D399",
  red: "#F87171",
  greenTint: "rgba(52,211,153,0.10)",
  redTint: "rgba(248,113,113,0.10)",
};

const HATCH = `repeating-linear-gradient(45deg, ${C.red} 0, ${C.red} 1.5px, transparent 1.5px, transparent 3px)`;

/* ── Python highlighting (CadQuery) — kw blue, strings/numbers orange, calls ink ── */
const PY_KEYWORDS = new Set([
  "import", "from", "as", "def", "return", "if", "elif", "else", "for", "while",
  "in", "not", "and", "or", "None", "True", "False", "class", "with", "try",
  "except", "finally", "raise", "yield", "lambda", "pass", "break", "continue",
  "global", "nonlocal", "assert", "async", "await", "del", "is",
]);
const PY_TOKEN =
  /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b(import|from|as|def|return|if|elif|else|for|while|in|not|and|or|None|True|False|class|with|try|except|finally|raise|yield|lambda|pass|break|continue|global|nonlocal|assert|async|await|del|is)\b|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()/g;

/* ── JS/TS highlighting (the original Beautiful UI grammar) ── */
const JS_KEYWORDS = new Set(["import", "from", "export", "default", "async", "function", "const", "let", "var", "await", "return", "if", "else", "for", "while", "new", "throw", "try", "catch", "null", "true", "false", "undefined"]);
const JS_TOKEN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g;

function highlight(text: string, language: "python" | "javascript"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  const re = language === "python" ? PY_TOKEN : JS_TOKEN;
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const idx = m.index;
    const t = m[0];
    if (idx > last) nodes.push(<span key={k++}>{text.slice(last, idx)}</span>);
    let color: string;
    let weight: number | undefined;
    if (language === "python") {
      // groups: 1 string, 2 number, 3 keyword, 4 function call
      if (m[1] || m[2]) color = C.orange;
      else if (m[3]) color = C.accentInk;
      else { color = C.ink; weight = 500; }
    } else {
      if (/^["'`]/.test(t) || /^\d/.test(t)) color = C.orange;
      else if (JS_KEYWORDS.has(t)) color = C.accentInk;
      else { color = C.ink; weight = 500; }
    }
    nodes.push(<span key={k++} style={{ color, fontWeight: weight }}>{t}</span>);
    last = idx + t.length;
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>);
  return nodes;
}

function Pieces({ pieces, language }: { pieces: CodePiece[]; language: "python" | "javascript" }) {
  return (
    <>
      {pieces.map((p, i) => {
        if (p.change) {
          const add = p.change === "add";
          return (
            <span
              key={i}
              className="rounded-[3px]"
              style={{
                background: add ? C.greenTint : C.redTint,
                padding: "0 2px",
                margin: "0 -1px",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              {highlight(p.text, language)}
            </span>
          );
        }
        return <span key={i}>{highlight(p.text, language)}</span>;
      })}
    </>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-adam-text-tertiary">
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

const DEFAULT_LABELS: CodeBlockLabels = { copy: "Copy", copied: "Copied" };

export type CodeBlockProps = {
  /** Which view to render — "Code" (line-numbered listing) or "Diff". */
  variant?: string;
  /** Syntax grammar for coloring. */
  language?: "python" | "javascript";
  /** The lines shown in the Code view. */
  lines?: string[];
  /** Raw text placed on the clipboard by Copy. Defaults to `lines` joined. */
  code?: string;
  /** The unified-diff rows shown in the Diff view. */
  diff?: DiffRow[];
  /** Filename shown in the header. */
  filename?: string;
  /** Prominent copy strings. */
  labels?: Partial<CodeBlockLabels>;
  /** Called with the copied text after a successful copy. */
  onCopy?: (text: string) => void;
  /** Extra header actions (e.g. a Download button), rendered before Copy. */
  actions?: ReactNode;
};

export default function CodeBlock({
  variant = "Code",
  language = "javascript",
  lines = [],
  code,
  diff = [],
  filename = "model.py",
  labels,
  onCopy,
  actions,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isDiff = variant === "Diff";
  const text = { ...DEFAULT_LABELS, ...labels };
  const raw = code ?? lines.join("\n");

  const copy = useCallback(() => {
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      onCopy?.(raw);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [raw, onCopy]);

  const added = diff.filter((r) => r.type === "add").length;
  const removed = diff.filter((r) => r.type === "del").length;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* header — file · (diff stat | actions · copy) */}
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 text-[12px]">
        <span className="inline-flex min-w-0 items-center gap-[7px]">
          <FileIcon />
          <span className="truncate font-mono leading-none text-adam-text-primary">{filename}</span>
        </span>

        {isDiff ? (
          <span className="ml-auto inline-flex items-center gap-2 font-mono text-[11.5px] leading-none tabular-nums">
            <span className="text-emerald-400">+{added}</span>
            <span className="text-red-400">-{removed}</span>
          </span>
        ) : (
          <span className="-mr-1 ml-auto flex items-center gap-0.5">
            {actions}
            <button
              type="button"
              aria-label="Copy code"
              onClick={copy}
              className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px]
                font-medium transition-colors duration-100 hover:bg-white/[0.05]
                ${copied ? "text-emerald-400" : "text-adam-text-tertiary hover:text-adam-text-secondary"}`}
            >
              {copied ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
              {copied ? text.copied : text.copy}
            </button>
          </span>
        )}
      </div>

      {/* body — equal inset on top / left / right; lines wrap */}
      <div className="bg-black/20 py-2.5 font-mono text-[11px] leading-[1.7] text-adam-text-secondary">
        {isDiff ? (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-5 w-px" style={{ background: C.line }} />
            {diff.map((r, i) => {
              const add = r.type === "add";
              const del = r.type === "del";
              // one gutter column: removals keep the old number, additions/context show the new one
              const num = del ? r.old : r.cur;
              return (
                <div
                  key={i}
                  className="relative grid grid-cols-[20px_minmax(0,1fr)] items-start"
                  style={{ background: add ? C.greenTint : del ? C.redTint : undefined }}
                >
                  {(add || del) && (
                    <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: add ? C.green : HATCH }} />
                  )}
                  <span
                    className={`select-none text-center text-[10.5px]`}
                    style={{ color: add ? C.green : del ? C.red : C.ink3 }}
                  >
                    {num ?? ""}
                  </span>
                  <code className="break-words whitespace-pre-wrap pr-3 pl-1">
                    <Pieces pieces={r.pieces} language={language} />
                  </code>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-5 w-px" style={{ background: C.line }} />
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[20px_minmax(0,1fr)] items-start">
                <span className="select-none text-center text-[10.5px]" style={{ color: C.ink3 }}>
                  {i + 1}
                </span>
                <code className="break-words whitespace-pre-wrap pr-3 pl-1">{highlight(line, language)}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
