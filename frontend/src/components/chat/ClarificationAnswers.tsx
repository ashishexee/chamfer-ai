import type { ClarificationAnswer } from '@/types';

interface ClarificationAnswersProps {
  answers: ClarificationAnswer[];
}

export function ClarificationAnswers({ answers }: ClarificationAnswersProps) {
  if (!answers || answers.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-adam-neutral-700/40 bg-adam-bg-dark/50 overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-adam-neutral-700/30 bg-adam-neutral-800/40">
        <span className="text-[9px] font-semibold text-adam-text-tertiary uppercase tracking-wider">Specifications</span>
      </div>
      <div className="divide-y divide-adam-neutral-700/30">
        {answers.map((a, i) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 gap-3">
            <span className="text-[10px] text-adam-text-tertiary flex-1">{a.question}</span>
            <span className="text-[11px] text-adam-text-primary font-medium">{a.answer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
