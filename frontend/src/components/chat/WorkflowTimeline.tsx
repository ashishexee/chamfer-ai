import { useState } from 'react';
import {
  Search, HelpCircle, Code, Cpu, Ruler, Camera, Eye, Wrench,
  PackageCheck, Check, Loader2, AlertCircle, ChevronDown, Brain,
  type LucideIcon,
} from 'lucide-react';
import type { WorkflowStep } from '@/types';

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  'help-circle': HelpCircle,
  code: Code,
  cpu: Cpu,
  ruler: Ruler,
  camera: Camera,
  eye: Eye,
  wrench: Wrench,
  'package-check': PackageCheck,
};

interface WorkflowTimelineProps {
  steps: WorkflowStep[];
  reasoning?: string;
}

export function WorkflowTimeline({ steps, reasoning }: WorkflowTimelineProps) {
  // Auto-expand all steps that are done or running so the user sees the thinking
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    ...Object.fromEntries(steps.map(s => [s.id, s.status === 'done' || s.status === 'running' || s.status === 'error'])),
  });

  if (!steps || steps.length === 0) return null;

  // Build a synthetic thinking summary from step details if no model reasoning
  const syntheticReasoning = steps
    .filter(s => s.detail && s.status === 'done')
    .map(s => `${s.label}: ${s.detail}`)
    .join('\n\n');
  const hasRealReasoning = reasoning && reasoning.trim().length > 0;

  return (
    <div className="mt-2 rounded-xl border border-adam-neutral-700/40 bg-[#1a1a1a]/80 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-adam-neutral-700/30 bg-[#1e1e1e]/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">Workflow</span>
          <span className="text-[10px] text-adam-text-tertiary">
            {steps.filter(s => s.status === 'done').length}/{steps.length} steps
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="relative px-3 py-2">
        {/* Subtle vertical guide only */}
        <div className="absolute left-[1.375rem] top-3 bottom-3 w-px bg-adam-neutral-700/30" />

        <div className="space-y-1">
          {steps.map((step) => {
            const Icon = ICONS[step.icon] || Code;
            const isExpanded = expanded[step.id];
            const isDone = step.status === 'done';
            const isError = step.status === 'error';
            const isRunning = step.status === 'running';

            return (
              <div key={step.id} className="relative">
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Icon */}
                  <div className={`relative shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${
                    isDone
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : isError
                      ? 'bg-red-500/15 text-red-400'
                      : isRunning
                      ? 'bg-adam-blue/15 text-adam-blue'
                      : 'bg-adam-neutral-800 text-adam-text-tertiary'
                  }`}>
                    {isDone ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : isError ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : isRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 text-left">
                    <span className={`text-[12px] ${isRunning ? 'text-adam-blue font-medium' : 'text-adam-text-secondary'}`}>
                      {step.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    {isRunning && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-adam-blue/10 text-adam-blue font-medium">
                        Running
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[9px] text-emerald-400 font-medium">Done</span>
                    )}
                    {isError && (
                      <span className="text-[9px] text-red-400 font-medium">Error</span>
                    )}
                    <ChevronDown className={`h-3 w-3 text-adam-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded detail — styled as "thinking" */}
                {isExpanded && step.detail && (
                  <div className="pl-8 pr-2 pb-1.5">
                    <div className="flex items-start gap-1.5">
                      <Brain className="h-2.5 w-2.5 text-adam-text-tertiary/60 mt-0.5 shrink-0" />
                      <div className="text-[11px] text-adam-text-tertiary leading-relaxed">
                        {step.detail}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thinking section — show real reasoning or synthetic summary */}
      <div className="border-t border-adam-neutral-700/30 px-3 py-2">
        <details open>
          <summary className="text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary cursor-pointer flex items-center gap-1.5 transition-colors">
            <Brain className="h-3 w-3" />
            {hasRealReasoning ? 'Model reasoning' : 'Thinking summary'}
          </summary>
          <div className="mt-1.5 text-[10px] text-adam-text-tertiary bg-adam-bg-dark rounded-lg p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
            {hasRealReasoning ? reasoning : syntheticReasoning || 'No reasoning available for this model.'}
          </div>
        </details>
      </div>
    </div>
  );
}
