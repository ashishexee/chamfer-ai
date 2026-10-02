import type { Provider } from '@/types';

export const API_URL = import.meta.env.VITE_API_URL || '';

// ── Chat persistence ──
export const CHAT_ENDPOINTS = {
  SAVE: '/api/chat/save',
  SESSIONS: '/api/chat/sessions',
  HISTORY: (sessionId: string) => `/api/chat/history/${sessionId}`,
} as const;

// ── Model storage (0G) ──
export const MODEL_ENDPOINTS = {
  UPLOAD_0G: '/api/models/upload-to-0g',
  LATEST_FOR_SESSION: (sessionId: string) => `/api/models/session/${sessionId}/latest`,
} as const;

export const PROVIDERS: Provider[] = [
  { id: '0g', name: '0GM-1.0-35B-A3B', desc: 'TEE · 262K ctx · Vision · In-house' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast & cheap · 1M ctx' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: 'Pro reasoning · 1M ctx' },
  { id: 'deepseek-v4p1-flash', name: 'DeepSeek V4.1 Flash', desc: 'Vision · 1M ctx · Max reasoning' },
  { id: 'kimi-k2p6', name: 'Kimi K2.6', desc: 'Vision · 262K ctx · High Quality' },
  { id: 'qwen3p7-plus', name: 'Qwen 3.7 Plus', desc: 'Vision · 262K ctx' },
  { id: 'minimax-m3', name: 'MiniMax M3', desc: 'Vision · 512K ctx' },
  { id: 'glm-5p1', name: 'GLM 5.1', desc: '202K ctx' },
  { id: 'glm-5p2', name: 'GLM 5.2', desc: 'Opus-level · 1M ctx' },
  { id: 'glm-5p3-flash', name: 'GLM 5.3 Flash', desc: 'Vision · 1M ctx · Max reasoning' },
  { id: 'muse-spark-1p3-contributor', name: 'Muse Spark 1.3 (Contributor)', desc: 'Agentic coding · 1M ctx · Vision · X-High reasoning' },
  { id: 'groq', name: 'Qwen3-32B', desc: 'Fast · 6K TPM limit · Text only' },
  { id: 'groq-vision', name: 'Llama 4 Scout', desc: 'Vision · 6K TPM limit' },
];

export function getProviderDisplayName(id: string): string {
  return PROVIDERS.find(p => p.id === id)?.name ?? id;
}

export const PLACEHOLDER_PROMPTS = [
  'make me a gear with 12 teeth',
  'design a mounting bracket',
  'create a spring coil',
  'build a phone stand',
  'make a pipe connector',
  'design a gear knob',
  'create a box with rounded edges',
  'make a mechanical pulley',
];

export const PARAM_PHASES = [
  { at: 0, label: 'rebuilding geometry' },
  { at: 40, label: 'applying parameters' },
  { at: 75, label: 'generating mesh' },
  { at: 100, label: 'complete' },
];

export type ViewPresetId =
  | 'iso'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

export interface ViewPreset {
  id: ViewPresetId;
  label: string;
  position: [number, number, number];
}

export const VIEW_PRESETS: ViewPreset[] = [
  { id: 'iso',   label: 'Iso',   position: [80, 80, 80] },
  { id: 'top',   label: 'Top',   position: [0, 120, 0.001] },
  { id: 'bottom',label: 'Bot',   position: [0, -120, 0.001] },
  { id: 'front', label: 'Front', position: [0, 0, 120] },
  { id: 'back',  label: 'Back',  position: [0, 0, -120] },
  { id: 'left',  label: 'Left',  position: [-120, 0, 0.001] },
  { id: 'right', label: 'Right', position: [120, 0, 0.001] },
];
