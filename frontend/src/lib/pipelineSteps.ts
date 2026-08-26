import type { WorkflowStep } from '@/types';

/**
 * Canonical generation pipeline — the single source of truth for workflow step
 * order, labels and icons.
 *
 * The backend emits single-step SSE deltas keyed by `id` (no list, no ordering
 * guarantee); this module gives them a stable order and the UI a seed state.
 * The timeline only renders steps whose turn has come (running/done/error) —
 * conditional steps that never run (tee-verify on non-0G providers, vision
 * without images, repair without retries) simply stay `pending` and are
 * therefore never shown.
 */
export const PIPELINE_STEPS: Array<{
  id: string;
  icon: string;
  label: string;
  detail: string;
}> = [
  { id: 'clarify',    icon: 'help-circle',   label: 'Checking specifications',   detail: 'Analyzing if your request needs more details' },
  { id: 'analyze',    icon: 'search',        label: 'Analyzing request',         detail: 'Identifying geometry type and parameters' },
  { id: 'generate',   icon: 'code',          label: 'Writing CadQuery code',     detail: 'Drafting parametric CadQuery script' },
  { id: 'tee-verify', icon: 'shield-check',  label: 'Verifying TEE signature',   detail: 'Checking the response against the on-chain TEE identity' },
  { id: 'syntax',     icon: 'shield-check',  label: 'Checking syntax',           detail: 'Validating Python syntax' },
  { id: 'execute',    icon: 'cpu',           label: 'Executing CadQuery',        detail: 'Building the model in the sandbox' },
  { id: 'inspect',    icon: 'ruler',         label: 'Inspecting geometry',       detail: 'Checking volume, validity and dimensions' },
  { id: 'snapshots',  icon: 'camera',        label: 'Rendering snapshots',       detail: 'Capturing orthographic views' },
  { id: 'dimviews',   icon: 'camera',        label: 'Drawing dimensional views', detail: 'Annotating dimensions' },
  { id: 'vision',     icon: 'eye',           label: 'Visual inspection',         detail: 'Model reviews the render for issues' },
  { id: 'deliver',    icon: 'package-check', label: 'Preparing deliverables',    detail: 'Packaging STEP, STL and GLB for download' },
];

/** Canonical rank for every known step id (including retry-only ones). Unknown ids sort last. */
export const STEP_RANK: Record<string, number> = {
  ...Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.id, i])),
  repair: 10.5, // retry-loop step — slots between vision and deliver
};

/**
 * Seed the full pipeline for a new request. `clarifyDone` pre-completes step 1 —
 * used when the user just answered clarification questions, so the checklist flows
 * continuously across the two-request round-trip instead of restarting.
 */
export function seedPipeline({ clarifyDone = false }: { clarifyDone?: boolean } = {}): WorkflowStep[] {
  return PIPELINE_STEPS.map((s, i) => ({
    id: s.id,
    icon: s.icon,
    label: i === 0 && clarifyDone ? 'Clarification received' : s.label,
    detail: i === 0 && clarifyDone ? 'Using your answers to refine the prompt' : s.detail,
    status: i === 0 ? ('done' as const) : ('pending' as const),
    timestamp: Date.now(),
  }));
}
