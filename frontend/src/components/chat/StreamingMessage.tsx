import { motion } from 'framer-motion';
import { WorkflowTimeline } from './WorkflowTimeline';
import { NutIcon } from '@/components/hardware/NutIcon';
import { getProviderDisplayName } from '@/lib/constants';
import type { WorkflowStep } from '@/types';

interface StreamingMessageProps {
  steps?: WorkflowStep[];
  reasoning?: string;
  provider?: string;
}

/**
 * The in-flight assistant bubble. The animated status lives inside the
 * workflow timeline, so the same component carries the live and reloaded UI.
 */
export function StreamingMessage({ steps, reasoning, provider }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="flex w-full justify-start"
    >
      <div className="w-full max-w-[92%] overflow-hidden rounded-2xl rounded-bl-md bg-white/[0.035] px-3.5 py-3 ring-1 ring-white/[0.05] backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adam-blue/25 to-adam-blue/[0.08] text-adam-blue ring-1 ring-adam-blue/20">
            <NutIcon className="h-3.5 w-3.5" />
            <div className="pointer-events-none absolute inset-0 animate-pulse-glow rounded-lg bg-adam-blue/15" />
          </div>

          <span className="truncate font-title text-[11px] font-bold tracking-[0.12em] text-white">
            {provider ? getProviderDisplayName(provider).toUpperCase() : 'CHAMFER AI'}
          </span>

          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-wider text-adam-blue">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-adam-blue" />
            generating
          </span>
        </div>

        <WorkflowTimeline steps={steps} reasoning={reasoning || undefined} />
      </div>
    </motion.div>
  );
}
