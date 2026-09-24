import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ClarificationOption } from '@/types';
import { cn } from '@/lib/utils';

interface ClarificationMessageProps {
  questions: ClarificationOption[];
  onSubmit: (answers: string, answerList: { question: string; answer: string }[]) => void;
  isGenerating?: boolean;
}

/* Rolling odometer digits — each changing character rolls up or down
 * (adapted from Beautiful UI's approval-card). Numeric strings only. */
const ROLL_MS = 400;

function RollingDigits({ value }: { value: string }) {
  const prevRef = useRef(value);
  const [oldVal, setOldVal] = useState(value);
  const [newVal, setNewVal] = useState(value);
  const [rolling, setRolling] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [dir, setDir] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (prevRef.current === value) return;
    const from = prevRef.current;
    prevRef.current = value;
    const fromN = parseInt(from, 10);
    const toN = parseInt(value, 10);
    setDir(Number.isFinite(fromN) && Number.isFinite(toN) && toN < fromN ? 'down' : 'up');
    setOldVal(from);
    setNewVal(value);
    setRolling(true);
    setShifted(false);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShifted(true));
    });
    const done = setTimeout(() => {
      setRolling(false);
      setOldVal(value);
      setShifted(false);
    }, ROLL_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [value]);

  const chars = rolling ? newVal : oldVal;

  return (
    <>
      {Array.from({ length: chars.length }, (_, i) => {
        const o = oldVal[i] ?? '';
        const n = chars[i] ?? '';
        if (!rolling || o === n) {
          return <span key={`${i}-${n}`}>{n}</span>;
        }
        const top = dir === 'down' ? n : o;
        const bottom = dir === 'down' ? o : n;
        const restY = dir === 'down' ? '0' : '-1em';
        const startY = dir === 'down' ? '-1em' : '0';
        return (
          <span
            key={`${i}-${o}-${n}-${dir}`}
            style={{ display: 'inline-block', position: 'relative', overflow: 'hidden', height: '1em', lineHeight: '1em', verticalAlign: '-0.05em' }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translateY(${shifted ? restY : startY})`,
              }}
            >
              <span style={{ height: '1em', lineHeight: '1em' }}>{top}</span>
              <span style={{ height: '1em', lineHeight: '1em' }}>{bottom}</span>
            </span>
          </span>
        );
      })}
    </>
  );
}

/**
 * Approval Card (human-in-the-loop) — one question at a time with a
 * vertically sliding stack (card height animates to fit), an odometer
 * step counter, and pill footer actions. Adapted from Beautiful UI's
 * approval-card to the clarification contract: defaults, per-question
 * custom answers, and the "let model decide" submission.
 */
export function ClarificationMessage({ questions, onSubmit, isGenerating }: ClarificationMessageProps) {
  // answers: selected option index per question; custom: free-text override
  const initialAnswers = () => {
    const map: Record<number, number[]> = {};
    questions.forEach((q, i) => {
      const idx = q.options.indexOf(q.default);
      if (q.default && idx >= 0) map[i] = [idx];
    });
    return map;
  };
  const [answers, setAnswers] = useState<Record<number, number[]>>(initialAnswers);
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [qi, setQi] = useState(0);
  const [sent, setSent] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measured = useRef(false);
  const [viewportH, setViewportH] = useState<number | undefined>(undefined);
  const [trackY, setTrackY] = useState(0);
  const [animate, setAnimate] = useState(false);
  // Mount only the active question until the first measurement so the card
  // opens at its real height instead of flashing to the full stack.
  const [ready, setReady] = useState(false);

  const last = qi === questions.length - 1;
  const selected = answers[qi] ?? [];
  const hasAnswer = selected.length > 0 || Boolean(custom[qi]?.trim());
  const answeredCount = questions.filter(
    (q, i) => (answers[i]?.length ?? 0) > 0 || Boolean(custom[i]?.trim()),
  ).length;

  const sync = (withAnim: boolean) => {
    const item = questionRefs.current[qi];
    if (!item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setViewportH(item.offsetHeight);
    setTrackY(item.offsetTop);
    setAnimate(withAnim && !reduce);
  };

  useLayoutEffect(() => {
    const withAnim = measured.current;
    measured.current = true;
    sync(withAnim);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, answers, custom, sent]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  if (questions.length === 0) return null;

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setQi(Math.min(Math.max(next, 0), questions.length - 1));
  };

  const handleSubmit = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const answerList = questions.map((q, i) => {
      const picked = answers[i] ?? [];
      const answer = custom[i]?.trim() || (picked.length > 0 ? q.options[picked[0]] : '(let model decide)');
      return { question: q.question, answer };
    });
    const formatted = answerList.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
    onSubmit(formatted, answerList);
    setSent(true);
  };

  const handleAllDecide = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const answerList = questions.map((q) => ({
      question: q.question,
      answer: '(let model decide)',
    }));
    const formatted = answerList.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
    onSubmit(formatted, answerList);
    setSent(true);
  };

  const advance = () => {
    if (last) handleSubmit();
    else goTo(qi + 1);
  };

  const toggle = (index: number) => {
    setAnswers((current) => {
      const next = [index];
      return { ...current, [qi]: next };
    });
    setCustom((current) => ({ ...current, [qi]: '' }));
    // single-choice auto-advances (except on the last question — generating
    // costs money, so it waits for an explicit Generate)
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (!last) {
      advanceTimer.current = setTimeout(() => {
        setQi((current) => Math.min(questions.length - 1, current + 1));
      }, 480);
    }
  };

  const sentPill = (
    <div
      className="flex w-full items-center gap-3 py-1"
      style={{ animation: 'pop-in 260ms cubic-bezier(0.23,1,0.32,1) both' }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 py-1 pl-1 pr-2.5 text-[12.5px] font-medium text-emerald-400">
        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-400 text-adam-neutral-950">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
        Answers sent
      </span>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.015] backdrop-blur-md shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
        <span className="font-title text-[11px] font-bold tracking-[0.14em] text-white">SPECIFICATIONS NEEDED</span>
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-adam-text-secondary ring-1 ring-white/[0.06]">
          {sent ? 'Sent' : `${answeredCount}/${questions.length} answered`}
        </span>
      </div>

      {sent ? (
        <div className="px-3.5 py-3">{sentPill}</div>
      ) : (
        <>
          <div className="px-3.5 py-3">
            {/* sliding viewport — height animates to the active question */}
            <div
              className="overflow-hidden"
              style={{ height: viewportH, transition: animate ? 'height 360ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined }}
              aria-live="polite"
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                  transform: `translate3d(0, ${-trackY}px, 0)`,
                  transition: animate ? 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
                  willChange: 'transform',
                }}
              >
                {questions.map((question, qIdx) => {
                  const active = qIdx === qi;
                  if (!ready && !active) return null;
                  const picked = answers[qIdx] ?? [];
                  const questionStyle: CSSProperties = {
                    opacity: active ? 1 : 0,
                    transition: animate ? 'opacity 360ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
                    pointerEvents: active ? undefined : 'none',
                  };
                  return (
                    <div
                      key={qIdx}
                      ref={(el) => { questionRefs.current[qIdx] = el; }}
                      aria-hidden={active ? undefined : true}
                      style={questionStyle}
                    >
                      <span className="block text-[13.5px] font-medium leading-snug text-adam-text-primary">
                        {question.question}
                      </span>
                      <div className="mt-2 flex flex-col gap-0.5">
                        {question.options.map((opt, i) => {
                          const on = picked.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={on}
                              tabIndex={active ? 0 : -1}
                              disabled={isGenerating}
                              onClick={() => { if (active) toggle(i); }}
                              className={cn(
                                '-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors duration-100 hover:bg-white/[0.04]',
                                !active && 'pointer-events-none',
                                isGenerating && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                                  on
                                    ? 'bg-adam-blue shadow-[0_0_8px_rgba(0,166,255,0.35)]'
                                    : 'text-transparent shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.16)]',
                                )}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-white transition-transform duration-200"
                                  style={{ transform: on ? 'scale(1)' : 'scale(0)' }}
                                />
                              </span>
                              <span
                                className={cn(
                                  'text-[13px] leading-none transition-colors duration-200',
                                  on ? 'text-white' : 'text-adam-text-secondary',
                                )}
                              >
                                {opt}
                              </span>
                            </button>
                          );
                        })}
                        {/* "Something else…" custom answer row */}
                        <label
                          className={cn(
                            '-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors duration-100 hover:bg-white/[0.04] focus-within:bg-white/[0.04]',
                            !active && 'pointer-events-none',
                            isGenerating && 'opacity-50',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                              custom[qIdx]?.trim()
                                ? 'bg-adam-blue shadow-[0_0_8px_rgba(0,166,255,0.35)]'
                                : 'text-transparent shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.16)]',
                            )}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-white transition-transform duration-200"
                              style={{ transform: custom[qIdx]?.trim() ? 'scale(1)' : 'scale(0)' }}
                            />
                          </span>
                          <input
                            value={custom[qIdx] ?? ''}
                            tabIndex={active ? 0 : -1}
                            onChange={(event) => {
                              if (!active) return;
                              setCustom((current) => ({ ...current, [qIdx]: event.target.value }));
                              setAnswers((current) => ({ ...current, [qIdx]: [] }));
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && hasAnswer && !isGenerating) {
                                event.preventDefault();
                                advance();
                              }
                            }}
                            placeholder="Something else…"
                            aria-label="Custom answer"
                            disabled={isGenerating}
                            className="min-w-0 flex-1 bg-transparent pl-1.5 text-[13px] text-white outline-none placeholder:text-adam-text-tertiary disabled:cursor-not-allowed"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* footer — odometer step counter + pill actions */}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5">
            <div className="flex items-center gap-1 text-adam-text-tertiary">
              <button
                type="button"
                aria-label="Previous question"
                disabled={qi <= 0}
                onClick={() => goTo(qi - 1)}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-adam-text-primary disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span
                className="inline-flex items-center text-[12px] font-medium tabular-nums text-adam-text-tertiary"
                style={{ letterSpacing: '-0.1px', lineHeight: 1 }}
              >
                <RollingDigits value={`${qi + 1} / ${questions.length}`} />
              </span>
              <button
                type="button"
                aria-label="Next question"
                disabled={last}
                onClick={() => goTo(qi + 1)}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-adam-text-primary disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isGenerating}
                onClick={last ? handleAllDecide : () => goTo(qi + 1)}
                title={last ? 'Submit without answering — the model picks sensible defaults' : 'Skip this question'}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium text-adam-text-tertiary transition-colors duration-150 hover:text-adam-text-primary disabled:opacity-50"
              >
                {last ? 'Let model decide' : 'Skip'}
              </button>
              <button
                type="button"
                disabled={!hasAnswer || isGenerating}
                onClick={advance}
                className={cn(
                  'rounded-full bg-adam-blue px-3 py-1 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-adam-blue/90',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                {last ? 'Generate' : 'Continue'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
