import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, HelpCircle, Code, Cpu, Ruler, Camera, Eye,
  PackageCheck, ShieldCheck, Check, ChevronDown, Brain, type LucideIcon,
} from 'lucide-react';
import type { WorkflowStep } from '@/types';
import { STEP_RANK } from '@/lib/pipelineSteps';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  'help-circle': HelpCircle,
  code: Code,
  cpu: Cpu,
  ruler: Ruler,
  camera: Camera,
  eye: Eye,
  wrench: Ruler,
  'package-check': PackageCheck,
  'shield-check': ShieldCheck,
};

interface WorkflowTimelineProps {
  steps?: WorkflowStep[];
  reasoning?: string;
  provider?: string;
}

export function WorkflowTimeline({ steps, reasoning }: WorkflowTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  // Canonical order (safety net against out-of-order SSE arrival), then reveal
  // filter: pending steps are hidden until their turn comes — and once a step
  // is revealed (running/done/error) it never disappears.
  const allSteps = steps ?? [];
  const displaySteps = [...allSteps]
    .sort((a, b) => (STEP_RANK[a.id] ?? 9999) - (STEP_RANK[b.id] ?? 9999))
    .filter(s => s.status !== 'pending');

  // Counter counts only REVEALED stages (done / revealed): it starts at 0/1,
  // grows as steps take their turn, and settles at exactly N/N — it never
  // includes stages that never ran and therefore never shrinks at the end.
  const doneCount = allSteps.filter(s => s.status === 'done').length;
  const revealedCount = allSteps.filter(s => s.status !== 'pending').length;

  if (allSteps.length === 0) return null;

  const syntheticReasoning = allSteps
    .filter(s => s.detail && s.status === 'done')
    .map(s => `${s.label}: ${s.detail}`)
    .join('\n\n');
  const hasRealReasoning = reasoning && reasoning.trim().length > 0;
  const isWorking = displaySteps.some(s => s.status === 'running');

  return (
    <div className="rounded-xl border border-adam-neutral-700/30 bg-[#161616]/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-adam-neutral-700/20 bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {displaySteps.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    'h-0.5 w-3 rounded-full transition-colors duration-300',
                    s.status === 'done' ? 'bg-emerald-400/60' :
                    s.status === 'error' ? 'bg-red-400/60' :
                    s.status === 'running' ? 'bg-adam-blue/60' : 'bg-adam-neutral-700/40'
                  )}
                />
              ))}
            </div>
            <span className="font-title font-bold text-adam-text-tertiary uppercase tracking-widest">Workflow</span>
          </div>
          <span className="text-[10px] text-adam-text-tertiary tabular-nums">
            {doneCount}/{revealedCount}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="relative px-2.5 py-2">
        {/* Vertical guide line */}
        <div className="absolute left-[1.125rem] top-4 bottom-4 w-px bg-gradient-to-b from-adam-neutral-700/30 via-adam-neutral-700/20 to-adam-neutral-700/10" />

        <div className="space-y-0.5">
          {displaySteps.map((step) => {
            const Icon = ICONS[step.icon] || Code;
            const isDone = step.status === 'done';
            const isError = step.status === 'error';
            const isRunning = step.status === 'running';
            const isNew = !seenRef.current.has(step.id);

            if (isNew) {
              seenRef.current.add(step.id);
            }

            // Running steps auto-expand (their detail is the live action); done
            // ones collapse unless the user toggled them explicitly.
            const isExpanded = expanded[step.id] ?? isRunning;

            return (
              <motion.div
                key={step.id}
                initial={isNew ? { opacity: 0, x: -4 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.025] transition-colors group/step"
                >
                  {/* Icon badge — ring spinner while running, solid badge when settled */}
                  <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                    {isRunning && (
                      <svg
                        viewBox="0 0 20 20"
                        className="absolute inset-0 h-full w-full"
                        style={{ animation: 'spin 1.1s linear infinite' }}
                      >
                        <circle cx="10" cy="10" r="8.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                        <circle
                          cx="10" cy="10" r="8.5" fill="none"
                          stroke="#00A6FF" strokeWidth="2" strokeLinecap="round"
                          strokeDasharray="15 38.4"
                        />
                      </svg>
                    )}
                    {isDone ? (
                      <span
                        className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-400/90 text-adam-neutral-950"
                        style={{ animation: 'pop-in 300ms cubic-bezier(0.23,1,0.32,1) both' }}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                    ) : isError ? (
                      <span
                        className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-400/90 text-adam-neutral-950"
                        style={{ animation: 'pop-in 300ms cubic-bezier(0.23,1,0.32,1) both' }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </span>
                    ) : (
                      <Icon className={cn('h-3 w-3', isRunning ? 'text-adam-blue' : 'text-adam-text-tertiary')} />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 text-left min-w-0">
                    <span className={cn(
                      'text-[12px] transition-colors',
                      isRunning ? 'text-adam-blue font-medium' :
                      isDone ? 'text-adam-text-secondary' :
                      isError ? 'text-red-400/90' :
                      'text-adam-text-tertiary'
                    )}>
                      {step.label}
                    </span>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isRunning && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-adam-blue/10 text-adam-blue font-medium tabular-nums">
                        Running
                      </span>
                    )}
                    {isDone && (
                      <Check className="h-3 w-3 text-emerald-400/50" strokeWidth={2.5} />
                    )}
                    {isError && (
                      <span className="text-[9px] text-red-400/80 font-medium">Error</span>
                    )}
                    <ChevronDown className={cn(
                      'h-3 w-3 text-adam-text-tertiary/50 transition-transform duration-200',
                      isExpanded ? 'rotate-180' : ''
                    )} />
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isExpanded && step.detail && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pl-8 pr-2 pb-1.5 pt-0.5">
                        <div className="flex items-start gap-1.5">
                          <Brain className="h-2.5 w-2.5 text-adam-text-tertiary/40 mt-0.5 shrink-0" />
                          <div className="text-[11px] text-adam-text-tertiary/80 leading-relaxed">
                            {step.detail}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reasoning section */}
      {(hasRealReasoning || syntheticReasoning) && (
        <div className="border-t border-adam-neutral-700/20 px-3 py-2">
          <button
            onClick={() => setReasoningOpen(prev => !prev)}
            className="w-full flex items-center gap-1.5 font-title font-bold text-adam-text-secondary hover:text-adam-text-primary transition-colors uppercase tracking-wider"
          >
            <Brain className="h-3 w-3" />
            <span
              className="flex-1 text-left"
              style={isWorking ? {
                backgroundImage: 'linear-gradient(90deg, #676767 35%, #E5E5E5 50%, #676767 65%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                animation: 'shimmer-text 1.4s linear infinite',
              } : undefined}
            >
              {hasRealReasoning ? 'Model reasoning' : 'Thinking summary'}
            </span>
            <ChevronDown className={cn(
              'h-3 w-3 transition-transform duration-200',
              reasoningOpen ? 'rotate-180' : ''
            )} />
          </button>
          <AnimatePresence initial={false}>
            {reasoningOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-1.5 text-[10px] text-adam-text-secondary/80 bg-adam-bg-dark/40 rounded-lg p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed ring-1 ring-adam-neutral-700/15">
                  {hasRealReasoning ? reasoning : syntheticReasoning}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
