import { motion } from 'framer-motion';
import { WorkflowTimeline } from './WorkflowTimeline';
import type { WorkflowStep } from '@/types';

interface StreamingMessageProps {
  steps?: WorkflowStep[];
  reasoning?: string;
}

/**
 * The in-flight assistant bubble. The animated status lives inside the
 * workflow timeline, so the same component carries the live and reloaded UI.
 */
export function StreamingMessage({ steps, reasoning }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="flex w-full justify-start"
    >
      <div className="w-full max-w-[92%] overflow-hidden rounded-2xl rounded-bl-md bg-[#202020]/90 px-3.5 py-3 ring-1 ring-white/[0.055] backdrop-blur-md">
        <WorkflowTimeline steps={steps} reasoning={reasoning || undefined} />
      </div>
    </motion.div>
  );
}
