import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import type { Parameter } from '../types';
import { canRestoreIteration, planRewind } from '../lib/iterations';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: WebSocket },
});

// ─── Profiles ─────────────────────────────────────────────────

export async function upsertProfile(walletAddress: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ wallet_address: walletAddress }, { onConflict: 'wallet_address' });

  if (error) {
    console.error('[DB] upsertProfile error:', error.message);
  }
  return !error;
}

// ─── Chat Sessions + Messages ─────────────────────────────────

/**
 * A UI message as sent by the client. Everything except `role`/`content` is
 * optional, and unknown fields are persisted verbatim in `metadata` so a
 * reload restores the exact live interface (reasoning, steps, 0G metadata,
 * TEE proof, snapshots, dim views, inspection, images, timestamps).
 */
export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  specifications?: { question: string; answer: string }[];
  provider?: string;
  messageOrder?: number;
  [key: string]: unknown;
}

export interface SavedSessionResult {
  sessionId: string;
  latestMessageOrder: number | null;
  latestMessageId: string | null;
}

/** Fields owned by dedicated columns or re-derived from model rows. */
const DERIVED_MESSAGE_FIELDS = new Set([
  'rootHashes',
  'iterations',
  'txSeqs',
  'messageOrder',
  'role',
  'content',
  'specifications',
  'provider',
]);

function messageMetadata(message: ChatMessageData): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message)) {
    if (DERIVED_MESSAGE_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    metadata[key] = value;
  }
  return metadata;
}

/** Shape consumed by the replace_chat_messages RPC. */
function messageForRpc(message: ChatMessageData) {
  return {
    ...messageMetadata(message),
    role: message.role,
    content: message.content || '',
    specifications: message.specifications ?? null,
    provider: message.provider || null,
  };
}

async function ownsSession(sessionId: string, walletAddress: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_wallet', walletAddress)
    .maybeSingle();

  if (error) {
    console.error('[DB] ownsSession error:', error.message);
    return false;
  }
  return !!data;
}

async function insertMessages(sessionId: string, messages: ChatMessageData[]) {
  const rows = messages.map((m, i) => ({
    session_id: sessionId,
    role: m.role,
    content: m.content || '',
    message_order: i,
    specifications: m.specifications ?? null,
    provider: m.provider || null,
    metadata: messageMetadata(m),
  }));

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(rows)
    .select('id, message_order, role');

  if (error) {
    console.error('[DB] insertMessages error:', error.message, '|', error.code, '|', error.details);
    throw new Error(`insertMessages failed: ${error.message}`);
  }

  // The model created by this turn belongs to the last assistant message.
  let latestMessageOrder: number | null = null;
  let latestMessageId: string | null = null;
  for (const row of data ?? []) {
    if (
      row.role === 'assistant' &&
      (latestMessageOrder === null || row.message_order > latestMessageOrder)
    ) {
      latestMessageOrder = row.message_order;
      latestMessageId = row.id;
    }
  }

  console.log(`[DB] inserted ${rows.length} messages`);
  return { count: rows.length, latestMessageOrder, latestMessageId };
}

export async function saveChatSession(
  walletAddress: string,
  messages: ChatMessageData[],
  parameters?: Parameter[],
  sessionId?: string,
): Promise<SavedSessionResult | null> {
  const title = messages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Creation';

  if (sessionId) {
    // Never touch a session owned by another wallet.
    if (!(await ownsSession(sessionId, walletAddress))) {
      console.error('[DB] saveChatSession rejected: session not owned', sessionId);
      return null;
    }

    // One transaction: upsert rows by order, delete the tail. Preserves
    // message ids so saved_models.message_id anchors stay valid.
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('replace_chat_messages', {
      p_session_id: sessionId,
      p_user_wallet: walletAddress,
      p_messages: messages.map(messageForRpc),
    });

    if (rpcErr) {
      console.error('[DB] replace_chat_messages error:', rpcErr.message);
      throw new Error(`replace_chat_messages failed: ${rpcErr.message}`);
    }

    const result = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    const { error: updateErr } = await supabase
      .from('chat_sessions')
      .update({
        // Deliberately do NOT rewrite `title` here: the user may have renamed
        // the chat, and every auto-save should preserve that name.
        parameters: parameters || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_wallet', walletAddress);

    if (updateErr) {
      console.error('[DB] saveChatSession session update error:', updateErr.message);
    }

    return {
      sessionId,
      latestMessageOrder: (result?.latest_message_order ?? null) as number | null,
      latestMessageId: (result?.latest_message_id ?? null) as string | null,
    };
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_wallet: walletAddress,
      title,
      parameters: parameters || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[DB] saveChatSession error:', error.message);
    return null;
  }
  const inserted = await insertMessages(data.id, messages);
  return {
    sessionId: data.id,
    latestMessageOrder: inserted.latestMessageOrder,
    latestMessageId: inserted.latestMessageId,
  };
}

/** Rename a chat. Ownership is enforced by the wallet predicate. */
export async function renameChatSession(
  sessionId: string,
  walletAddress: string,
  title: string,
) {
  const clean = title.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!clean) return null;

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ title: clean })
    .eq('id', sessionId)
    .eq('user_wallet', walletAddress)
    .select('id, title')
    .maybeSingle();

  if (error) {
    console.error('[DB] renameChatSession error:', error.message);
    return null;
  }
  return data;
}

export async function getChatSessions(walletAddress: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_wallet', walletAddress)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[DB] getChatSessions error:', error.message);
    return [];
  }
  return (data || []).map(s => ({ ...s, message_count: undefined as number | undefined }));
}

function hydrateMessage(row: Record<string, any>): ChatMessageData {
  const metadata = (row.metadata || null) as Record<string, any> | null;

  if (metadata) {
    return {
      ...metadata,
      role: row.role,
      content: row.content ?? '',
      specifications: row.specifications ?? metadata.specifications,
      provider: row.provider ?? metadata.provider,
      messageOrder: row.message_order,
    } as ChatMessageData;
  }

  // Legacy rows (pre-v7) were collapsed before storage. Re-expand them so old
  // chats still read correctly.
  return {
    role: row.role,
    content: row.content ?? '',
    specifications: row.specifications ?? undefined,
    provider: row.provider ?? undefined,
    messageOrder: row.message_order,
    // v6 dropped this column, but pre-v6 rows may still carry it.
    ...(row.dim_views ? { dimViews: row.dim_views } : {}),
  } as ChatMessageData;
}

/**
 * Expand a legacy collapsed row into the old 3-message shape
 * (prompt → specifications → assistant). New rows hydrate 1:1.
 */
function expandLegacyRow(row: Record<string, any>): ChatMessageData[] {
  if (row.metadata) return [hydrateMessage(row)];

  const provider = row.provider || undefined;
  const specifications = row.specifications || undefined;

  if (provider || specifications) {
    const expanded: ChatMessageData[] = [
      { role: 'user', content: row.content, messageOrder: row.message_order },
    ];

    if (specifications?.length) {
      expanded.push({
        role: 'user',
        content: specifications.map((s: { answer: string }) => s.answer).join('\n'),
        specifications,
        messageOrder: row.message_order,
      });
    }

    expanded.push({
      role: 'assistant',
      content: provider ? `Generated with ${provider}` : 'Generated model',
      provider,
      messageOrder: row.message_order,
      // Pre-v6 rows may still carry dim views in their own column.
      ...(row.dim_views ? { dimViews: row.dim_views } : {}),
    });

    return expanded;
  }

  return [hydrateMessage(row)];
}

export async function getChatSession(sessionId: string, walletAddress: string) {
  const { data: session, error: sessionErr } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_wallet', walletAddress)
    .single();

  if (sessionErr) {
    console.error('[DB] getChatSession error:', sessionErr.message);
    return null;
  }

  const { data: messages, error: msgsErr } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('message_order', { ascending: true });

  if (msgsErr) {
    // Never return a fake empty transcript: a later save would overwrite the
    // real rows with it.
    console.error('[DB] getMessages error:', msgsErr.message);
    throw new Error(`getMessages failed: ${msgsErr.message}`);
  }

  return {
    session,
    messages: (messages || []).flatMap(expandLegacyRow),
  };
}

// ─── Model versions (append-only) ─────────────────────────────
//
// Each stored iteration is its own row. `version` is monotonic per chat and is
// assigned by a Postgres trigger; `message_order` records the turn that
// spawned it; `message_id` anchors it to the assistant message so a rewind can
// resolve the real trim point even after a re-save.

export type ModelSource = 'generate' | 'param_tweak' | 'restored';

export interface ModelVersionInput {
  name: string;
  chatSessionId: string;
  messageOrder: number;
  messageId?: string | null;
  source?: ModelSource;
  restoredFrom?: string | null;
  parameters?: unknown;
  inspection?: Record<string, unknown> | null;
  boundingBox?: { size?: number[] } | null;
  snapshots?: Record<string, string> | null;
  dimViews?: Record<string, string> | null;
}

export interface ModelVersionCompleteInput extends ModelVersionInput {
  rootHashCode: string;
  rootHashStl?: string;
  rootHashStep?: string;
  rootHashGlb?: string;
  rootHashDimViews?: string;
  txSeqs?: Record<string, number> | null;
}

export interface PartialArtifacts {
  rootHashes?: { code?: string; stl?: string; step?: string; glb?: string; dimViews?: string };
  txSeqs?: Record<string, number> | null;
}

function modelVersionRow(walletAddress: string, model: ModelVersionInput) {
  const row: Record<string, unknown> = {
    user_wallet: walletAddress,
    name: model.name,
    chat_session_id: model.chatSessionId,
    message_order: model.messageOrder,
    source: model.source || 'generate',
    restored_from: model.restoredFrom || null,
    parameters: model.parameters ?? null,
    inspection: model.inspection ?? null,
    bounding_box: model.boundingBox ?? null,
    snapshots: model.snapshots ?? null,
    dim_views: model.dimViews ?? null,
    updated_at: new Date().toISOString(),
  };

  // Only overwrite the anchor when the caller explicitly supplied one.
  if (model.messageId !== undefined) row.message_id = model.messageId;

  return row;
}

async function findAssistantMessageId(
  sessionId: string,
  messageOrder: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('session_id', sessionId)
    .eq('message_order', messageOrder)
    .eq('role', 'assistant')
    .maybeSingle();

  if (error) {
    console.error('[DB] findAssistantMessageId error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Insert a `pending` version row. Returns its identity (version included). */
export async function createModelVersion(
  walletAddress: string,
  model: ModelVersionInput,
) {
  if (!(await ownsSession(model.chatSessionId, walletAddress))) {
    console.error('[DB] createModelVersion rejected: session not owned');
    return null;
  }

  // Trust a client-supplied anchor only if it belongs to this session.
  let messageId: string | null = null;
  if (model.messageId) {
    const { data: anchored } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('id', model.messageId)
      .eq('session_id', model.chatSessionId)
      .maybeSingle();
    if (anchored) messageId = anchored.id;
  }
  if (!messageId) {
    messageId = await findAssistantMessageId(model.chatSessionId, model.messageOrder);
  }

  const { data, error } = await supabase
    .from('saved_models')
    .insert({
      ...modelVersionRow(walletAddress, model),
      message_id: messageId,
      upload_status: 'pending',
      upload_error: null,
    })
    .select('id, name, version, message_order, message_id, created_at, upload_status')
    .single();

  if (error) {
    console.error('[DB] createModelVersion error:', error.message, '|', error.code);
    return null;
  }
  return data;
}

export async function completeModelVersion(
  walletAddress: string,
  modelId: string,
  model: ModelVersionCompleteInput,
) {
  const { data, error } = await supabase
    .from('saved_models')
    .update({
      ...modelVersionRow(walletAddress, model),
      root_hash_code: model.rootHashCode,
      root_hash_stl: model.rootHashStl || null,
      root_hash_step: model.rootHashStep || null,
      root_hash_glb: model.rootHashGlb || null,
      root_hash_dim_views: model.rootHashDimViews || null,
      tx_seqs: model.txSeqs ?? null,
      upload_status: 'complete',
      upload_error: null,
    })
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .select('id, name, version, message_order, message_id, created_at, upload_status')
    .single();

  if (error) {
    console.error('[DB] completeModelVersion error:', error.message);
    return null;
  }
  return data;
}

export async function failModelVersion(
  walletAddress: string,
  modelId: string,
  errorMessage: string,
  partial?: PartialArtifacts,
) {
  // Never downgrade a previously completed version to failed.
  const { data: existing } = await supabase
    .from('saved_models')
    .select('id, upload_status, root_hash_code')
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .maybeSingle();

  if (!existing) return null;

  const partialPayload: Record<string, unknown> = {};
  // Never overwrite a previously completed version's hashes with partial data.
  if (!existing.root_hash_code && partial?.rootHashes) {
    partialPayload.root_hash_code = partial.rootHashes.code ?? null;
    partialPayload.root_hash_stl = partial.rootHashes.stl ?? null;
    partialPayload.root_hash_step = partial.rootHashes.step ?? null;
    partialPayload.root_hash_glb = partial.rootHashes.glb ?? null;
    partialPayload.root_hash_dim_views = partial.rootHashes.dimViews ?? null;
  }
  if (!existing.root_hash_code && partial?.txSeqs) {
    partialPayload.tx_seqs = partial.txSeqs;
  }

  const { data, error } = await supabase
    .from('saved_models')
    .update({
      ...partialPayload,
      upload_status: existing.root_hash_code ? existing.upload_status : 'failed',
      upload_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .select('id, name, version, message_order, upload_status')
    .maybeSingle();

  if (error) {
    console.error('[DB] failModelVersion error:', error.message);
    return null;
  }
  return data;
}

const ITERATION_COLUMNS = [
  'id',
  'name',
  'version',
  'message_order',
  'message_id',
  'source',
  'restored_from',
  'root_hash_code',
  'root_hash_stl',
  'root_hash_step',
  'root_hash_glb',
  'root_hash_dim_views',
  'snapshots',
  'dim_views',
  'tx_seqs',
  'parameters',
  'inspection',
  'bounding_box',
  'upload_status',
  'upload_error',
  'created_at',
  'updated_at',
].join(', ');

export async function listSessionIterations(
  sessionId: string,
  walletAddress: string,
  limit = 500,
) {
  const { data, error } = await supabase
    .from('saved_models')
    .select(ITERATION_COLUMNS)
    .eq('chat_session_id', sessionId)
    .eq('user_wallet', walletAddress)
    .order('version', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[DB] listSessionIterations error:', error.message);
    throw new Error(`listSessionIterations failed: ${error.message}`);
  }
  return data || [];
}

export async function getModelVersion(modelId: string, walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .select('*')
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .single();

  if (error) {
    console.error('[DB] getModelVersion error:', error.message);
    return null;
  }
  return data;
}

export async function getLatestModelForSession(sessionId: string, walletAddress: string) {
  // Prefer the newest COMPLETE version so a failed/pending upload never hides
  // the last good model.
  const { data: complete, error: completeErr } = await supabase
    .from('saved_models')
    .select('*')
    .eq('chat_session_id', sessionId)
    .eq('user_wallet', walletAddress)
    .eq('upload_status', 'complete')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (completeErr) {
    console.error('[DB] getLatestModelForSession error:', completeErr.message);
    return null;
  }
  if (complete) return complete;

  const { data: newest, error: newestErr } = await supabase
    .from('saved_models')
    .select('*')
    .eq('chat_session_id', sessionId)
    .eq('user_wallet', walletAddress)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (newestErr) {
    console.error('[DB] getLatestModelForSession fallback error:', newestErr.message);
    return null;
  }
  return newest;
}

export interface RewindResult {
  error?:
    | 'not_found'
    | 'not_restorable'
    | 'unanchored'
    | 'anchor_missing'
    | 'delete_failed';
  detail?: string;
  target?: Record<string, any>;
}

/**
 * Full rewind. The database function re-verifies ownership, resolves the trim
 * point from the anchored message, and deletes newer versions + later messages
 * in one transaction under the same advisory lock the version trigger uses.
 */
export async function rewindToVersion(
  sessionId: string,
  walletAddress: string,
  targetVersion: number,
): Promise<RewindResult> {
  const { data: target, error: targetErr } = await supabase
    .from('saved_models')
    .select('*')
    .eq('chat_session_id', sessionId)
    .eq('user_wallet', walletAddress)
    .eq('version', targetVersion)
    .maybeSingle();

  if (targetErr) {
    console.error('[DB] rewindToVersion lookup error:', targetErr.message);
    return { error: 'not_found', detail: targetErr.message };
  }
  if (!target) return { error: 'not_found' };
  if (!canRestoreIteration(target)) return { error: 'not_restorable' };
  if (!target.message_id) return { error: 'unanchored' };

  // Observability: log the intended blast radius before deleting anything.
  try {
    const rows = await listSessionIterations(sessionId, walletAddress);
    console.log('[DB] rewind plan:', planRewind(rows as any, target as any));
  } catch {
    // Non-fatal — the RPC below is authoritative.
  }

  const { data, error: rpcErr } = await supabase.rpc('rewind_model_version', {
    p_session_id: sessionId,
    p_user_wallet: walletAddress,
    p_version: targetVersion,
  });

  if (rpcErr) {
    const message = rpcErr.message || '';
    console.error('[DB] rewind_model_version error:', message);

    if (message.includes('version_not_found')) return { error: 'not_found', detail: message };
    if (message.includes('not_restorable')) return { error: 'not_restorable', detail: message };
    if (message.includes('unanchored_version')) return { error: 'unanchored', detail: message };
    if (message.includes('anchor_missing')) return { error: 'anchor_missing', detail: message };
    return { error: 'delete_failed', detail: message };
  }

  return { target: data as Record<string, any> };
}

export async function getSavedModels(walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .select(ITERATION_COLUMNS)
    .eq('user_wallet', walletAddress)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[DB] getSavedModels error:', error.message);
    throw new Error(`getSavedModels failed: ${error.message}`);
  }
  return data || [];
}

export async function getSavedModel(modelId: string, walletAddress: string) {
  return getModelVersion(modelId, walletAddress);
}

export async function deleteSavedModel(modelId: string, walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .delete()
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .select('id');

  if (error) {
    console.error('[DB] deleteSavedModel error:', error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Legacy `/api/models/save` entry point. Creates a new version and completes
 * it immediately when root hashes are supplied.
 */
export async function saveModelMetadata(
  walletAddress: string,
  model: {
    name: string;
    chatSessionId: string;
    messageOrder: number;
    messageId?: string | null;
    rootHashCode?: string;
    rootHashStl?: string;
    rootHashStep?: string;
    rootHashGlb?: string;
    rootHashDimViews?: string;
    parameters?: unknown;
    inspection?: Record<string, unknown>;
    boundingBox?: { size?: number[] };
    snapshots?: Record<string, string>;
    dimViews?: Record<string, string>;
    txSeqs?: Record<string, number>;
    source?: ModelSource;
  },
) {
  const created = await createModelVersion(walletAddress, {
    name: model.name,
    chatSessionId: model.chatSessionId,
    messageOrder: model.messageOrder,
    messageId: model.messageId,
    source: model.source,
    parameters: model.parameters,
    inspection: model.inspection,
    boundingBox: model.boundingBox,
    snapshots: model.snapshots,
    dimViews: model.dimViews,
  });

  if (!created) return null;
  if (!model.rootHashCode) return created;

  return completeModelVersion(walletAddress, created.id, {
    name: model.name,
    chatSessionId: model.chatSessionId,
    messageOrder: model.messageOrder,
    messageId: model.messageId,
    source: model.source,
    parameters: model.parameters,
    inspection: model.inspection,
    boundingBox: model.boundingBox,
    snapshots: model.snapshots,
    dimViews: model.dimViews,
    rootHashCode: model.rootHashCode,
    rootHashStl: model.rootHashStl,
    rootHashStep: model.rootHashStep,
    rootHashGlb: model.rootHashGlb,
    rootHashDimViews: model.rootHashDimViews,
    txSeqs: model.txSeqs,
  });
}
