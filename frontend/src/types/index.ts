export interface ParameterSchema {
  type: 'int' | 'float' | 'bool' | 'string' | 'enum' | 'color';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  options?: string[];
}

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
  snapshots?: string;
  inspection?: string;
}

export interface Parameter {
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface Specification {
  question: string;
  answer: string;
}

export interface ClarificationOption {
  question: string;
  key: string;
  options: string[];
  default: string;
}

export interface ClarificationAnswer {
  question: string;
  answer: string;
}

export interface WorkflowStep {
  id: string;
  icon: string;
  label: string;
  detail: string;
  status?: 'pending' | 'running' | 'done' | 'error';
  timestamp?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  specifications?: Specification[];
  reasoning?: string;
  provider?: string;
  error?: string;
  clarification?: ClarificationOption[];
  clarificationAnswers?: ClarificationAnswer[];
  teeProof?: TEEProof;
  zeroG?: ZeroGMetadata;
  steps?: WorkflowStep[];
  bestEffort?: boolean;
  images?: string[];
  sessionId?: string;
  editMode?: boolean;
  warning?: string;
  inspection?: InspectionData;
  snapshots?: Record<string, string>;
  dimViews?: Record<string, string>;
  visionVerified?: boolean;
  visionFeedback?: string;
  timestamp?: number;
  rootHashes?: RootHashData;
}

/** Reasoning depth accepted by a model (OpenAI-compatible `reasoning_effort`). */
export type ReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'none'
  | 'adaptive';

export interface Provider {
  id: string;
  name: string;
  desc: string;
}

/** Provider record as returned by GET /api/providers. */
export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  hasKey: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
  isZeroG?: boolean;
  /** Present only when the model exposes a graded reasoning scale. */
  reasoningEfforts?: ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
}

export interface TEEProof {
  providerAddress: string;
  chatId: string;
  /** Real EIP-191 signature bytes (0x + 130 hex) when the provider's signature endpoint responded; absent = verified but receipt unavailable */
  signature?: string;
  /** Address recovered from the signature — compare against the provider's on-chain TEE signer */
  teeSignerAddress?: string;
  /** The model id that served the request */
  model?: string;
  timestamp: number;
  verified: boolean;
}

export interface ZeroGMetadata {
  model: string;
  requestId: string;
  providerAddress: string;
  /** true only when the TEE signature was cryptographically verified independently */
  teeVerified?: boolean;
  /** verified = crypto-verified · unverified = router claim or unverifiable run · failed = signature INVALID · not-verifiable = no TEE service */
  teeStatus?: 'verified' | 'unverified' | 'failed' | 'not-verifiable';
  /** how the status was determined: independent cryptographic check vs Router-reported flag */
  teeSource?: 'independent' | 'router-only';
  teeDetail?: string;
  /** chat id from the ZG-Res-Key header — the handle for re-verification */
  chatId?: string;
  /** captured TEE signature receipt — makes the verification independently checkable */
  teeReceipt?: {
    signature: string;
    recoveredSigner?: string;
    signedTextSha256: string;
    /** 'plain' = raw text signed (comparable) · 'digest-pair' = current 0G format "<req-hash>:<res-hash>" */
    signedTextFormat: 'plain' | 'digest-pair';
    /** true = plain text matched · false = plain text DIFFERED (untrusted) · undefined = digest-pair, not comparable */
    contentMatched?: boolean;
    model?: string;
    /** provider proxy endpoint — lets anyone re-fetch the signature for independent verification */
    providerEndpoint?: string;
  };
  billing: {
    inputCost: string;
    outputCost: string;
    totalCost: string;
  };
  tokens: {
    prompt: number;
    completion: number;
    reasoning: number;
    total: number;
  };
}

export interface GenerationResult {
  code: string;
  parameters: Record<string, ParameterSchema>;
  description: string;
  tags: string[];
  teeProof?: TEEProof;
}

export interface InspectionData {
  shape_type?: string;
  face_count?: number;
  edge_count?: number;
  vertex_count?: number;
  volume?: number;
  surface_area?: number;
  has_volume?: boolean;
  is_valid?: boolean;
  is_solid?: boolean;
  is_closed?: boolean | null;
  bounding_box?: {
    size?: number[];
    min?: number[];
    max?: number[];
    center?: number[];
  };
  center_of_mass?: number[];
  warnings?: string[];
  errors?: string[];
  all_clear?: boolean;
  visionChecking?: boolean;
  visionVerified?: boolean;
  visionFeedback?: string;
}

/** One check inside an on-demand TEE re-verification (see TeeVerifyResponse) */
export interface TeeVerifyStep {
  key: 'refetch' | 'recover' | 'integrity' | 'onchain';
  label: string;
  /** true = passed · false = FAILED · null = could not run */
  pass: boolean | null;
  detail?: string;
}

/** Response of POST /api/tee/verify — a fresh, independent re-verification */
export interface TeeVerifyResponse {
  status: 'verified' | 'unverified' | 'failed' | 'not-verifiable';
  detail?: string;
  receipt: ZeroGMetadata['teeReceipt'] | null;
  steps: TeeVerifyStep[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  parameters?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface SavedModel {
  id: string;
  name: string;
  root_hash_stl?: string;
  root_hash_step?: string;
  root_hash_glb?: string;
  root_hash_snapshots?: string;
  root_hash_inspection?: string;
  parameters?: Record<string, number>;
  inspection?: InspectionData;
  bounding_box?: { size?: number[] };
  created_at: string;
}
