import type { Specification } from '@/types';

interface ClarificationAnswersProps {
  specifications: Specification[];
}

export function ClarificationAnswers({ specifications }: ClarificationAnswersProps) {
  if (!specifications || specifications.length === 0) return null;

  return (
    <div className="rounded-lg border border-adam-neutral-700/25 bg-adam-bg-dark/30 overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-adam-neutral-700/20 bg-white/[0.015]">
        <span className="text-[9px] font-semibold text-adam-text-tertiary/70 uppercase tracking-wider">Specifications</span>
      </div>
      <div className="divide-y divide-adam-neutral-700/15">
        {specifications.map((a, i) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 gap-3">
            <span className="text-[10px] text-adam-text-tertiary/80 flex-1">{a.question}</span>
            <span className="text-[11px] text-adam-text-primary/90 font-medium">{a.answer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
