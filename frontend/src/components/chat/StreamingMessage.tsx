import { motion } from 'framer-motion';
import { WorkflowTimeline } from './WorkflowTimeline';
import { PixelLoader } from './PixelLoader';
import { NutIcon } from '@/components/hardware/NutIcon';
import { getProviderDisplayName } from '@/lib/constants';
import type { WorkflowStep } from '@/types';

interface StreamingMessageProps {
  steps?: WorkflowStep[];
  reasoning?: string;
  provider?: string;
}

export function StreamingMessage({ steps, reasoning, provider }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="group relative rounded-xl p-[1px] bg-white/[0.08] overflow-hidden shadow-lg"
    >
      {/* Rotating conic gradient border beam */}
      <div
        className="absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_35%,#00A6FF_50%,transparent_65%)] pointer-events-none"
        style={{
          animation: 'spin 4s linear infinite',
        }}
      />

      {/* Inner Content Card Mask */}
      <div className="relative rounded-[11px] bg-[#191A1A] bg-gradient-to-br from-adam-blue/[0.04] via-adam-bg-secondary-dark/30 to-transparent w-full h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
          {/* Pulsing avatar */}
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adam-blue/25 to-adam-blue/[0.08] text-adam-blue ring-1 ring-adam-blue/20">
            <NutIcon className="h-3.5 w-3.5" />
            <div className="absolute inset-0 rounded-lg bg-adam-blue/15 animate-pulse-glow pointer-events-none" />
          </div>

          {/* Name + status */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span className="font-title font-bold text-adam-text-primary tracking-wide">
              {provider ? getProviderDisplayName(provider) : 'Chamfer AI'}
            </span>
          </div>

          {/* Pixel-grid loader, bare — no label or timer */}
          <PixelLoader />
        </div>

        {/* Workflow timeline — skeleton shown immediately, live steps replace as they arrive */}
        <div className="px-3.5 pb-3.5">
          <WorkflowTimeline steps={steps} reasoning={reasoning || undefined} />
        </div>
      </div>
    </motion.div>
  );
}
