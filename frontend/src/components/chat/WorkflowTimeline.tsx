import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, HelpCircle, Code, Cpu, Ruler, Camera, Eye,
  PackageCheck, Check, ChevronDown, Brain, type LucideIcon,
} from 'lucide-react';
import type { WorkflowStep } from '@/types';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  'help-circle': HelpCircle,
  code: Code,
  cpu: Cpu,
  ruler: Ruler,
  camera: Camera,
  eye: Eye,
  'package-check': PackageCheck,
};

const SKELETON_STEPS: WorkflowStep[] = [
  { id: 'analyze', icon: 'search', label: 'Analyzing request', detail: 'Identifying geometry type and parameters', status: 'running', timestamp: 0 },
  { id: 'clarify', icon: 'help-circle', label: 'Specifications', detail: 'Clarification options were offered', status: 'pending', timestamp: 0 },
  { id: 'generate', icon: 'code', label: 'Writing CadQuery code', detail: 'Drafting parametric Python script', status: 'pending', timestamp: 0 },
  { id: 'execute', icon: 'cpu', label: 'Executing CadQuery', detail: 'Sandbox run completed', status: 'pending', timestamp: 0 },
  { id: 'inspect', icon: 'ruler', label: 'Inspecting geometry', detail: 'Geometry validation passed', status: 'pending', timestamp: 0 },
  { id: 'dimviews', icon: 'camera', label: 'Drawing dimensional views', detail: 'Orthographic projections rendered', status: 'pending', timestamp: 0 },
  { id: 'vision', icon: 'eye', label: 'Visual inspection', detail: 'Render matches the request', status: 'pending', timestamp: 0 },
  { id: 'deliver', icon: 'package-check', label: 'Preparing deliverables', detail: 'Files packaged and ready', status: 'pending', timestamp: 0 },
];

interface WorkflowTimelineProps {
  steps?: WorkflowStep[];
  reasoning?: string;
  provider?: string;
}

export function WorkflowTimeline({ steps, reasoning, provider }: WorkflowTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    ...Object.fromEntries((steps || []).map(s => [s.id, s.status === 'done' || s.status === 'running' || s.status === 'error'])),
  });
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  const displaySteps = steps && steps.length > 0 ? steps : SKELETON_STEPS;

  const doneCount = displaySteps.filter(s => s.status === 'done').length;
  const syntheticReasoning = displaySteps
    .filter(s => s.detail && s.status === 'done')
    .map(s => `${s.label}: ${s.detail}`)
    .join('\n\n');
  const hasRealReasoning = reasoning && reasoning.trim().length > 0;

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
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">Workflow</span>
          </div>
          <span className="text-[10px] text-adam-text-tertiary tabular-nums">
            {doneCount}/{displaySteps.length}
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

            const StepWrapper = isNew ? motion.div : 'div';
            const wrapperProps = isNew
              ? {
                  initial: { opacity: 0, x: -4 },
                  animate: { opacity: 1, x: 0 },
                  transition: { duration: 0.15 },
                }
              : {};

            const isExpanded = expanded[step.id];

            return (
              <StepWrapper
                key={step.id}
                {...(wrapperProps as any)}
                className="relative"
              >
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.025] transition-colors group/step"
                >
                  {/* Icon badge */}
                  <div className={cn(
                    'relative shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all',
                    isDone
                      ? 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/10'
                      : isError
                      ? 'bg-red-500/12 text-red-400 ring-1 ring-red-500/10'
                      : isRunning
                      ? 'bg-adam-blue/15 text-adam-blue ring-1 ring-adam-blue/15'
                      : 'bg-adam-neutral-800/60 text-adam-text-tertiary'
                  )}>
                    {isDone ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      <Icon className="h-3 w-3" />
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
              </StepWrapper>
            );
          })}
        </div>
      </div>

      {/* Reasoning section */}
      {(hasRealReasoning || syntheticReasoning) && (
        <div className="border-t border-adam-neutral-700/20 px-3 py-2">
          <button
            onClick={() => setReasoningOpen(prev => !prev)}
            className="w-full flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary transition-colors"
          >
            <Brain className="h-3 w-3" />
            <span className="flex-1 text-left">{hasRealReasoning ? 'Model reasoning' : 'Thinking summary'}</span>
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
                <div className="mt-1.5 text-[10px] text-adam-text-tertiary/70 bg-adam-bg-dark/40 rounded-lg p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed ring-1 ring-adam-neutral-700/15">
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
