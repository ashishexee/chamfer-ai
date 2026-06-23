export interface Parameter {
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface GenerateResult {
  code: string;
  rawResponse: string;
  reasoning: string;
}

export interface CadServerResponse {
  success: boolean;
  error?: string;
  parameters?: Parameter[];
  has_stl?: boolean;
  has_step?: boolean;
  has_glb?: boolean;
  stl_base64?: string;
  step_base64?: string;
  glb_base64?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  provider?: string;
}

export interface SavedModel {
  id: string;
  name: string;
  root_hash_code?: string;
  root_hash_stl?: string;
  root_hash_step?: string;
  root_hash_glb?: string;
  parameters?: Parameter[];
  inspection?: Record<string, unknown>;
  bounding_box?: { size?: number[] };
  chat_session_id?: string;
  message_order?: number;
  upload_status?: 'pending' | 'complete' | 'failed';
  upload_error?: string;
  created_at: string;
  updated_at?: string;
}
