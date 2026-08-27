import { useState } from 'react';
import { HelpCircle, Check, Sparkles } from 'lucide-react';
import type { ClarificationOption } from '@/types';
import { cn } from '@/lib/utils';

interface ClarificationMessageProps {
  questions: ClarificationOption[];
  onSubmit: (answers: string, answerList: { question: string; answer: string }[]) => void;
  isGenerating?: boolean;
}

export function ClarificationMessage({ questions, onSubmit, isGenerating }: ClarificationMessageProps) {
  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(questions.map(q => [q.key, q.default || '']))
  );
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const selectOption = (key: string, value: string) => {
    setSelections(prev => ({ ...prev, [key]: value }));
    setCustomInputs(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const setCustom = (key: string, value: string) => {
    setCustomInputs(prev => ({ ...prev, [key]: value }));
    setSelections(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const answerList = questions.map(q => ({
      question: q.question,
      answer: selections[q.key] || '(let model decide)',
    }));
    const formatted = answerList.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
    onSubmit(formatted, answerList);
  };

  const handleAllDecide = () => {
    const answerList = questions.map(q => ({
      question: q.question,
      answer: '(let model decide)',
    }));
    const formatted = answerList.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
    onSubmit(formatted, answerList);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.015] backdrop-blur-md shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-adam-blue/10 text-adam-blue ring-1 ring-adam-blue/15">
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
        <span className="font-title text-[11px] font-bold tracking-[0.14em] text-white">SPECIFICATIONS NEEDED</span>
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-adam-text-secondary ring-1 ring-white/[0.06]">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </span>
      </div>

      <div className="space-y-3 bg-white/[0.015] px-3.5 py-3">
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
            <label className="mb-2 block text-[11.5px] font-medium leading-snug text-adam-text-primary/90">
              {q.question}
            </label>
            {q.options && q.options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt, j) => {
                  const isSelected = selections[q.key] === opt && !customInputs[q.key];
                  return (
                    <button
                      key={j}
                      onClick={() => selectOption(q.key, opt)}
                      disabled={isGenerating}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                        isSelected
                          ? 'border-adam-blue/30 bg-adam-blue text-white shadow-[0_2px_10px_rgba(0,166,255,0.18)]'
                          : 'border-white/[0.06] bg-white/[0.04] text-adam-text-secondary hover:border-white/[0.10] hover:bg-white/[0.07] hover:text-white',
                        isGenerating && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                      {opt}
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={customInputs[q.key] || ''}
                  onChange={e => setCustom(q.key, e.target.value)}
                  disabled={isGenerating}
                  placeholder="Custom"
                  className="h-7 w-24 rounded-full border border-white/[0.06] bg-[#0F1110] px-3 text-[11.5px] text-white outline-none placeholder:text-adam-text-tertiary/60 focus:border-adam-blue/30 focus:ring-2 focus:ring-adam-blue/10 transition-colors disabled:opacity-50"
                />
              </div>
            ) : (
              <input
                type="text"
                value={selections[q.key] || ''}
                onChange={e => setSelections(prev => ({ ...prev, [q.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && i === questions.length - 1 && !isGenerating) handleSubmit(); }}
                disabled={isGenerating}
                placeholder="Type your answer…"
                autoFocus={i === 0}
                className="h-8 w-full rounded-lg border border-white/[0.06] bg-[#0F1110] px-3 text-[12.5px] text-white outline-none placeholder:text-adam-text-tertiary/60 focus:border-adam-blue/30 focus:ring-2 focus:ring-adam-blue/10 transition-colors disabled:opacity-50"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-white/[0.05] bg-white/[0.015] px-3.5 py-3">
        <button
          onClick={handleAllDecide}
          disabled={isGenerating}
          className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[11.5px] font-medium text-adam-text-secondary hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-50"
        >
          Let model decide
        </button>
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-adam-blue px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-adam-blue/90 shadow-[0_4px_16px_rgba(0,166,255,0.22)] transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
