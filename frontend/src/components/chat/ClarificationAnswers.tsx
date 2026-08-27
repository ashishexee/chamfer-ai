import { ClipboardList } from 'lucide-react';
import type { Specification } from '@/types';

interface ClarificationAnswersProps {
  specifications: Specification[];
}

export function ClarificationAnswers({ specifications }: ClarificationAnswersProps) {
  if (!specifications || specifications.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-adam-blue/10 text-adam-blue ring-1 ring-adam-blue/15">
          <ClipboardList className="h-3 w-3" />
        </span>
        <span className="font-title text-[11px] font-bold tracking-[0.14em] text-white">SPECIFICATIONS</span>
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-adam-text-secondary ring-1 ring-white/[0.06]">
          {specifications.length} {specifications.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {specifications.map((a, i) => (
          <div key={i} className="flex gap-4 px-3.5 py-2.5">
            <span className="min-w-0 flex-1 text-[12px] leading-snug text-adam-text-secondary">{a.question}</span>
            <span className="shrink-0 max-w-[42%] text-right text-[12px] font-semibold leading-snug text-white">{a.answer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
