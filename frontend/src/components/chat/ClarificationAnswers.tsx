import type { Specification } from "@/types";

interface ClarificationAnswersProps {
  specifications: Specification[];
}

/**
 * The answered clarification questions, rendered as a quiet Q&A block rather
 * than a card with a header, icon and item count. The parent controls the
 * width/centering; this only lays out the question/answer pairs.
 */
export function ClarificationAnswers({ specifications }: ClarificationAnswersProps) {
  if (!specifications || specifications.length === 0) return null;

  return (
    <div className="space-y-3.5">
      {specifications.map((item, i) => (
        <div key={i} className="space-y-1">
          <p className="text-[11.5px] leading-relaxed text-adam-text-tertiary/80">
            {item.question}
          </p>
          <p className="text-[12.5px] leading-relaxed text-adam-text-primary/95">
            {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}
