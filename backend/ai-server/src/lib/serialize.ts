import type { ModelSource } from '../services/db';

/** Serialize a `saved_models` row into the camelCase shape the client uses. */
export function toIteration(row: Record<string, any>) {
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as number,
    messageOrder: row.message_order as number,
    /** Anchor to the assistant message; null for pre-v7 versions. */
    messageId: (row.message_id || null) as string | null,
    source: (row.source || 'generate') as ModelSource,
    restoredFrom: (row.restored_from || null) as string | null,
    uploadStatus: row.upload_status as 'pending' | 'complete' | 'failed',
    uploadError: (row.upload_error || null) as string | null,
    rootHashes: {
      code: row.root_hash_code || undefined,
      stl: row.root_hash_stl || undefined,
      step: row.root_hash_step || undefined,
      glb: row.root_hash_glb || undefined,
      dimViews: row.root_hash_dim_views || undefined,
    },
    txSeqs: (row.tx_seqs || null) as Record<string, number> | null,
    snapshots: (row.snapshots || null) as Record<string, string> | null,
    dimViews: (row.dim_views || null) as Record<string, string> | null,
    parameters: row.parameters ?? null,
    inspection: row.inspection ?? null,
    boundingBox: row.bounding_box ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
