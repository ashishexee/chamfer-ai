/**
 * Pure helpers for model iteration history.
 *
 * Kept free of Supabase/0G imports so they can be unit-tested directly and
 * reused by the service layer.
 */

export interface IterationRowLike {
  id: string;
  chat_session_id: string;
  message_order: number;
  version: number;
  upload_status: 'pending' | 'complete' | 'failed';
  created_at?: string;
  [key: string]: unknown;
}

/** A rewind is only legal onto a fully-uploaded version. */
export function canRestoreIteration(row: Pick<IterationRowLike, 'upload_status'>): boolean {
  return row.upload_status === 'complete';
}

/**
 * Everything a rewind intends to delete, computed from the session's version
 * list. Expressed as version numbers so the intent is readable in logs.
 * The authoritative transaction is `rewind_model_version` in Postgres; this
 * plan is logged before the call so an unexpected blast radius is visible.
 */
export interface RewindPlan {
  targetVersion: number;
  targetMessageOrder: number;
  deletedVersions: number[];
  /** Messages with message_order strictly greater than this are removed. */
  trimMessagesAfter: number;
}

export function planRewind(
  rows: IterationRowLike[],
  target: IterationRowLike,
): RewindPlan {
  const deletedVersions = rows
    .filter((r) => r.version > target.version)
    .map((r) => r.version)
    .sort((a, b) => a - b);

  return {
    targetVersion: target.version,
    targetMessageOrder: target.message_order,
    deletedVersions,
    trimMessagesAfter: target.message_order,
  };
}
