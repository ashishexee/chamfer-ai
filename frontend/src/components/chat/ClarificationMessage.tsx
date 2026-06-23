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
    <div className="rounded-xl border border-adam-blue/15 bg-gradient-to-br from-adam-blue/[0.04] via-[#1a1a1a]/40 to-transparent p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-adam-blue/15 text-adam-blue ring-1 ring-adam-blue/15">
          <HelpCircle className="h-3 w-3" />
        </div>
        <span className="text-[11px] font-semibold text-adam-text-primary">Chamfer AI needs more details</span>
      </div>

      <div className="space-y-3 mb-3">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="text-[10px] text-adam-text-secondary mb-1.5 block font-medium">
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
                        'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1',
                        isSelected
                          ? 'bg-adam-blue text-white border border-adam-blue/80 shadow-[0_2px_6px_rgba(0,166,255,0.18)]'
                          : 'bg-adam-neutral-800/40 text-adam-text-secondary border border-adam-neutral-700/30 hover:bg-adam-neutral-700/40 hover:text-adam-text-primary hover:border-adam-neutral-600/40',
                        isGenerating && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      {opt}
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={customInputs[q.key] || ''}
                  onChange={e => setCustom(q.key, e.target.value)}
                  disabled={isGenerating}
                  className="w-20 border border-adam-neutral-700/30 rounded-md px-2 py-1 text-[11px] bg-adam-bg-dark/40 text-adam-text-primary outline-none focus:border-adam-blue/50 focus:ring-1 focus:ring-adam-blue/10 placeholder:text-adam-text-tertiary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            ) : (
              <input
                type="text"
                value={selections[q.key] || ''}
                onChange={e => setSelections(prev => ({ ...prev, [q.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && i === questions.length - 1 && !isGenerating) handleSubmit(); }}
                disabled={isGenerating}
                placeholder="Type your answer..."
                autoFocus={i === 0}
                className="w-full border border-adam-neutral-700/30 rounded-md px-2.5 py-1.5 text-xs bg-adam-bg-dark/40 text-adam-text-primary outline-none focus:border-adam-blue/50 focus:ring-1 focus:ring-adam-blue/10 placeholder:text-adam-text-tertiary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAllDecide}
          disabled={isGenerating}
          className="flex-1 rounded-lg border border-adam-neutral-700/40 px-3 py-1.5 text-[11px] text-adam-text-secondary hover:bg-adam-neutral-800/50 hover:text-adam-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Let model decide all
        </button>
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex-1 rounded-lg bg-adam-blue px-3 py-1.5 text-[11px] text-white hover:bg-adam-blue/90 font-medium transition-all shadow-[0_2px_8px_rgba(0,166,255,0.2)] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3 w-3" />
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
