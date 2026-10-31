-- VibeCAD Supabase Migration v7
-- ─────────────────────────────────────────────────────────────
-- 1. saved_models becomes an APPEND-ONLY version history per chat.
--    The old UNIQUE(chat_session_id, message_order) made every parameter
--    tweak overwrite the previous 0G pointer.
-- 2. chat_messages gains `metadata` JSONB so a reload restores the exact live
--    UI (reasoning, workflow steps, 0G/TEE metadata, snapshots, dim views,
--    inspection, images, timestamps).
-- 3. Versions are anchored to a chat message id, and rewinds are atomic.
-- 4. Version numbers are never reused, even after a rewind.
--
-- Safe to re-run. Requires the pre-v7 saved_models / chat_messages tables.

-- ── 1. chat_messages: full-fidelity payload + stable per-order rows ──
ALTER TABLE IF EXISTS chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_session_order_key'
  ) THEN
    BEGIN
      ALTER TABLE chat_messages
        ADD CONSTRAINT chat_messages_session_order_key
        UNIQUE (session_id, message_order);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION
        'chat_messages contains duplicate (session_id, message_order) rows; deduplicate before running v7';
    END;
  END IF;
END $$;

-- ── 2. saved_models: version identity + message anchor + preview data ──
ALTER TABLE IF EXISTS saved_models
  ADD COLUMN IF NOT EXISTS version INT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'generate',
  ADD COLUMN IF NOT EXISTS restored_from UUID REFERENCES saved_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snapshots JSONB,
  ADD COLUMN IF NOT EXISTS dim_views JSONB,
  ADD COLUMN IF NOT EXISTS tx_seqs JSONB;

-- Constrain the provenance value (existing rows already default to 'generate').
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_models_source_check'
  ) THEN
    ALTER TABLE saved_models
      ADD CONSTRAINT saved_models_source_check
      CHECK (source IN ('generate', 'param_tweak', 'restored'));
  END IF;
END $$;

-- Backfill versions for pre-existing rows, oldest first per chat. Numbering
-- continues above any version already present in the partition.
WITH ranked AS (
  SELECT s.id,
         s.chat_session_id,
         COALESCE(
           (SELECT MAX(s2.version)
              FROM saved_models s2
             WHERE s2.chat_session_id = s.chat_session_id),
           0
         ) + ROW_NUMBER() OVER (
           PARTITION BY s.chat_session_id
           ORDER BY s.created_at ASC, s.id ASC
         ) AS next_version
    FROM saved_models s
   WHERE s.version IS NULL
)
UPDATE saved_models s
   SET version = r.next_version
  FROM ranked r
 WHERE s.id = r.id;

-- ── 3. Monotonic per-chat version counter (never reused after rewind) ──
CREATE TABLE IF NOT EXISTS session_version_counters (
  chat_session_id UUID PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  next_version INT NOT NULL DEFAULT 1
);

INSERT INTO session_version_counters (chat_session_id, next_version)
SELECT chat_session_id, COALESCE(MAX(version), 0) + 1
  FROM saved_models
 GROUP BY chat_session_id
ON CONFLICT (chat_session_id) DO UPDATE
  SET next_version = GREATEST(session_version_counters.next_version, EXCLUDED.next_version);

-- ── 4. Replace the turn-unique constraint with a version-unique one ──
DO $$
DECLARE
  con text;
  idx text;
BEGIN
  -- Any UNIQUE constraint over exactly (chat_session_id, message_order).
  SELECT conname
    INTO con
    FROM pg_constraint
   WHERE conrelid = 'saved_models'::regclass
     AND contype = 'u'
     AND pg_get_constraintdef(oid) LIKE '%chat_session_id%'
     AND pg_get_constraintdef(oid) LIKE '%message_order%'
   LIMIT 1;

  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE saved_models DROP CONSTRAINT %I', con);
  END IF;

  -- Standalone unique indexes (not backed by a constraint).
  FOR idx IN
    SELECT c.relname
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
     WHERE t.relname = 'saved_models'
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) LIKE '%chat_session_id%'
       AND pg_get_indexdef(i.indexrelid) LIKE '%message_order%'
  LOOP
    BEGIN
      EXECUTE format('DROP INDEX %I', idx);
    EXCEPTION
      WHEN dependent_objects_still_exist THEN NULL; -- removed with its constraint above
      WHEN undefined_object THEN NULL;               -- already gone
    END;
  END LOOP;

  -- Never proceed silently if the old uniqueness is still enforced.
  IF EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
     WHERE t.relname = 'saved_models'
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) LIKE '%chat_session_id%'
       AND pg_get_indexdef(i.indexrelid) LIKE '%message_order%'
  ) THEN
    RAISE EXCEPTION
      'saved_models still has a unique (chat_session_id, message_order) index — v7 aborted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'saved_models'::regclass
       AND conname = 'saved_models_chat_session_version_key'
  ) THEN
    ALTER TABLE saved_models
      ADD CONSTRAINT saved_models_chat_session_version_key
      UNIQUE (chat_session_id, version);
  END IF;
END $$;

ALTER TABLE saved_models
  ALTER COLUMN version SET NOT NULL;

-- ── 5. Race-safe, never-reused version assignment ──
CREATE OR REPLACE FUNCTION assign_saved_model_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.chat_session_id::text));

    INSERT INTO session_version_counters (chat_session_id, next_version)
    VALUES (NEW.chat_session_id, 1)
    ON CONFLICT (chat_session_id) DO NOTHING;

    UPDATE session_version_counters
       SET next_version = next_version + 1
     WHERE chat_session_id = NEW.chat_session_id
    RETURNING next_version - 1 INTO NEW.version;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_saved_model_version ON saved_models;
CREATE TRIGGER trg_assign_saved_model_version
  BEFORE INSERT ON saved_models
  FOR EACH ROW
  EXECUTE FUNCTION assign_saved_model_version();

-- ── 6. Transactional transcript replace (no delete-then-insert window) ──
-- NOTE: legacy rows (metadata IS NULL) keep their collapsed 3-message
-- expansion; the reader falls back to the old `dim_views` column when present.
CREATE OR REPLACE FUNCTION replace_chat_messages(
  p_session_id UUID,
  p_user_wallet TEXT,
  p_messages JSONB
)
RETURNS TABLE(latest_message_order INT, latest_message_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner TEXT;
  v_count INT;
  v_existing INT;
  v_order INT;
  v_id UUID;
BEGIN
  SELECT user_wallet
    INTO v_owner
    FROM chat_sessions
   WHERE id = p_session_id
     FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> p_user_wallet THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '42501';
  END IF;

  v_count := jsonb_array_length(p_messages);
  SELECT COUNT(*) INTO v_existing FROM chat_messages WHERE session_id = p_session_id;

  -- Legitimate saves only ever grow the transcript. A stale tab that still
  -- holds an older snapshot must reload instead of deleting newer turns.
  IF v_count < v_existing THEN
    RAISE EXCEPTION 'stale_transcript' USING ERRCODE = 'P0006';
  END IF;

  -- Never delete a turn that a stored version is anchored to.
  IF EXISTS (
    SELECT 1
      FROM saved_models sm
      JOIN chat_messages cm ON cm.id = sm.message_id
     WHERE cm.session_id = p_session_id
       AND cm.message_order >= v_count
  ) THEN
    RAISE EXCEPTION 'stale_transcript' USING ERRCODE = 'P0006';
  END IF;

  INSERT INTO chat_messages
    (session_id, message_order, role, content, specifications, provider, metadata)
  SELECT p_session_id,
         (ord - 1),
         m->>'role',
         COALESCE(m->>'content', ''),
         CASE
           WHEN jsonb_typeof(m->'specifications') = 'array' THEN m->'specifications'
           ELSE NULL
         END,
         NULLIF(m->>'provider', ''),
         m - 'role' - 'content' - 'specifications' - 'provider'
    FROM jsonb_array_elements(p_messages) WITH ORDINALITY AS t(m, ord)
  ON CONFLICT (session_id, message_order) DO UPDATE
    SET role = EXCLUDED.role,
        content = EXCLUDED.content,
        specifications = EXCLUDED.specifications,
        provider = EXCLUDED.provider,
        metadata = EXCLUDED.metadata;

  DELETE FROM chat_messages
   WHERE session_id = p_session_id
     AND message_order >= v_count;

  SELECT message_order, id
    INTO v_order, v_id
    FROM chat_messages
   WHERE session_id = p_session_id
     AND role = 'assistant'
   ORDER BY message_order DESC
   LIMIT 1;

  RETURN QUERY SELECT v_order, v_id;
END;
$$;

-- ── 8. Atomic, message-anchored rewind ──
CREATE OR REPLACE FUNCTION rewind_model_version(
  p_session_id UUID,
  p_user_wallet TEXT,
  p_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target saved_models;
  v_owner TEXT;
  v_trim INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT user_wallet
    INTO v_owner
    FROM chat_sessions
   WHERE id = p_session_id
     FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> p_user_wallet THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_target
    FROM saved_models
   WHERE chat_session_id = p_session_id
     AND user_wallet = p_user_wallet
     AND version = p_version
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_target.upload_status <> 'complete' THEN
    RAISE EXCEPTION 'not_restorable' USING ERRCODE = 'P0003';
  END IF;

  -- Legacy versions have no anchor; refusing is safer than guessing an index.
  IF v_target.message_id IS NULL THEN
    RAISE EXCEPTION 'unanchored_version' USING ERRCODE = 'P0004';
  END IF;

  SELECT message_order
    INTO v_trim
    FROM chat_messages
   WHERE id = v_target.message_id
     AND session_id = p_session_id;

  IF v_trim IS NULL THEN
    RAISE EXCEPTION 'anchor_missing' USING ERRCODE = 'P0005';
  END IF;

  DELETE FROM saved_models
   WHERE chat_session_id = p_session_id
     AND user_wallet = p_user_wallet
     AND version > p_version;

  DELETE FROM chat_messages
   WHERE session_id = p_session_id
     AND message_order > v_trim;

  -- Keep the anchor row's provenance order in sync with the current
  -- transcript (a legacy re-save may have shifted it). Future uploads use it.
  UPDATE saved_models
     SET message_order = v_trim,
         updated_at = NOW()
   WHERE id = v_target.id;
  v_target.message_order := v_trim;

  UPDATE chat_sessions
     SET parameters = v_target.parameters,
         updated_at = NOW()
   WHERE id = p_session_id;

  RETURN to_jsonb(v_target);
END;
$$;

-- ── 9. Constraints / indexes ──
CREATE INDEX IF NOT EXISTS idx_saved_models_session_version
  ON saved_models(chat_session_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_saved_models_session_turn
  ON saved_models(chat_session_id, message_order);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_order
  ON chat_messages(session_id, message_order);

-- The counter table must not be writable through PostgREST: a forged
-- next_version would reuse version numbers and break the history.
ALTER TABLE session_version_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_version_counters FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
