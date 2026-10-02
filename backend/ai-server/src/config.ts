/** Reasoning depth accepted by a model via the OpenAI-compatible `reasoning_effort`. */
export type ReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'none'
  | 'adaptive';

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  name: string;
  apiKey: string;
  supportsVision: boolean;
  maxTokens?: number;
  maxContextTokens?: number;
  isZeroG?: boolean;
  /** Default `reasoning_effort` sent when the client doesn't choose one. */
  reasoningEffort?: ReasoningEffort;
  /**
   * Levels this model verifiably accepts, ascending by depth. Absent means the
   * model exposes no graded scale, so the UI shows no reasoning control at all.
   * Verified against the live APIs by scripts/probe-reasoning.ts.
   */
  reasoningEfforts?: ReasoningEffort[];
}

const FIREWORKS_BASE = 'https://api.fireworks.ai/inference/v1';
const fwKey = process.env.FIREWORKS_API_KEY || '';

// Meta Model API — OpenAI SDK compatible. Base URL per Meta's docs
// (https://dev.meta.ai/docs/overview); override MUSE_BASE_URL if needed.
const MUSE_BASE = process.env.MUSE_BASE_URL || 'https://api.meta.ai/v1';
const museKey = process.env.MUSE_API_KEY || '';

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  cadServerUrl: process.env.CAD_SERVER_URL || 'http://localhost:5000',
  providers: {
    '0g': {
      baseUrl: 'https://router-api.0g.ai/v1',
      model: '0GM-1.0-35B-A3B',
      name: '0GM',
      apiKey: process.env.OG_API_KEY || '',
      supportsVision: true,
      maxTokens: 32768,
      maxContextTokens: 262144,
      isZeroG: true,
    },
    '0g-deepseek': {
      baseUrl: 'https://router-api.0g.ai/v1',
      model: 'deepseek-v4.1-flash',
      name: 'DeepSeek V4.1 Flash',
      apiKey: process.env.OG_API_KEY || '',
      supportsVision: true,
      maxTokens: 384000,
      maxContextTokens: 1000000,
      isZeroG: true,
    },

    // ── Meta Model API ──
    // Contributor tier: prompts may be used to improve Meta's products.
    // Levels are the set the API itself reports (its 400 for an invalid value
    // enumerates them). Meta's docs claim "max" is Standard-tier only, but this
    // endpoint accepts it — verified live, not taken from the docs.
    // Declared first among the centralized providers so it leads that group in
    // the model picker (the API returns providers in declaration order).
    'muse-spark-1p3-contributor': {
      baseUrl: MUSE_BASE,
      model: 'muse-spark-1.3-contributor',
      name: 'Muse Spark 1.3 (Contributor)',
      apiKey: museKey,
      supportsVision: true,
      maxTokens: 131072,
      maxContextTokens: 1048576,
      reasoningEfforts: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      reasoningEffort: 'max',
    },

    // ── Fireworks AI ──
    // Disabled: the Fireworks account is suspended (HTTP 412 on every call), so
    // each model below fails at request time. Uncomment this whole block once
    // the account is restored — FIREWORKS_BASE / fwKey above are kept for that.
    /*
    'deepseek-v4-flash': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      apiKey: fwKey,
      supportsVision: false,
      maxTokens: 384000,
      maxContextTokens: 1000000,
    },
    'deepseek-v4-pro': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      apiKey: fwKey,
      supportsVision: false,
      maxTokens: 384000,
      maxContextTokens: 1000000,
    },
    'deepseek-v4p1-flash': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/deepseek-v4p1-flash',
      name: 'DeepSeek V4.1 Flash',
      apiKey: fwKey,
      supportsVision: true,
      maxTokens: 384000,
      maxContextTokens: 1048576,
      reasoningEffort: 'max',
    },
    'minimax-m3': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/minimax-m3',
      name: 'MiniMax M3',
      apiKey: fwKey,
      supportsVision: true,
      maxTokens: 262144,
      maxContextTokens: 1048576,
    },
    'glm-5p1': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/glm-5p1',
      name: 'GLM 5.1',
      apiKey: fwKey,
      supportsVision: false,
      maxTokens: 32768,
      maxContextTokens: 206848,
    },
    'glm-5p2': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/glm-5p2',
      name: 'GLM 5.2',
      apiKey: fwKey,
      supportsVision: false,
      maxTokens: 131072,
      maxContextTokens: 1048576,
    },
    'glm-5p3-flash': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/glm-5p3-flash',
      name: 'GLM 5.3 Flash',
      apiKey: fwKey,
      supportsVision: true,
      maxTokens: 131072,
      maxContextTokens: 1048576,
      reasoningEffort: 'max',
    },
    'qwen3p7-plus': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/qwen3p7-plus',
      name: 'Qwen 3.7 Plus',
      apiKey: fwKey,
      supportsVision: true,
      maxTokens: 65536,
      maxContextTokens: 1000000,
    },
    'kimi-k2p6': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/kimi-k2p6',
      name: 'Kimi K2.6',
      apiKey: fwKey,
      supportsVision: true,
      maxTokens: 32768,
      maxContextTokens: 262144,
    },
    */
    'groq': {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'qwen/qwen3-32b',
      name: 'Qwen3-32B',
      apiKey: process.env.GROQ_API_KEY || '',
      supportsVision: false,
      maxTokens: 32768,
      maxContextTokens: 131072,
    },
    'groq-vision': {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout',
      apiKey: process.env.GROQ_API_KEY || '',
      supportsVision: true,
      maxTokens: 16384,
      maxContextTokens: 131072,
    },
  } as Record<string, ProviderConfig>,
};
