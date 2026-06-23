import { motion } from 'framer-motion';
import { WorkflowTimeline } from './WorkflowTimeline';
import { NutIcon } from '@/components/hardware/NutIcon';
import type { WorkflowStep } from '@/types';

interface StreamingMessageProps {
  steps?: WorkflowStep[];
  reasoning?: string;
}

export function StreamingMessage({ steps, reasoning }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="group relative rounded-xl border border-adam-blue/15 bg-gradient-to-br from-adam-blue/[0.05] via-adam-background-1/30 to-transparent overflow-hidden"
    >
      {/* Animated shimmer top border */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-adam-blue/60 to-transparent animate-shimmer" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        {/* Pulsing avatar */}
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adam-blue/25 to-adam-blue/[0.08] text-adam-blue ring-1 ring-adam-blue/20">
          <NutIcon className="h-3.5 w-3.5" />
          <div className="absolute inset-0 rounded-lg bg-adam-blue/15 animate-pulse-glow pointer-events-none" />
        </div>

        {/* Name + status */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-adam-text-primary">Chamfer AI</span>
          <span className="text-[10px] text-adam-blue font-medium uppercase tracking-wider">thinking</span>
        </div>

        {/* Typing dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-adam-blue rounded-full"
              style={{
                animation: 'typing-dot 1.2s infinite ease-in-out',
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Workflow timeline — skeleton shown immediately, live steps replace as they arrive */}
      <div className="px-3.5 pb-3.5">
        <WorkflowTimeline steps={steps} reasoning={reasoning || undefined} />
      </div>
    </motion.div>
  );
}
