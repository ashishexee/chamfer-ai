-- VibeCAD Supabase Migration v5
-- Saved model storage for encrypted 0G roots.
-- Keeps inspection JSONB for fast revisit, removes only root_hash_inspection.

ALTER TABLE IF EXISTS saved_models
  DROP COLUMN IF EXISTS root_hash_inspection,
  DROP COLUMN IF EXISTS root_hash_snapshots,
  DROP COLUMN IF EXISTS root_hash_snapshot;

ALTER TABLE IF EXISTS saved_models
  ADD COLUMN IF NOT EXISTS root_hash_code TEXT,
  ADD COLUMN IF NOT EXISTS root_hash_stl TEXT,
  ADD COLUMN IF NOT EXISTS root_hash_step TEXT,
  ADD COLUMN IF NOT EXISTS root_hash_glb TEXT,
  ADD COLUMN IF NOT EXISTS parameters JSONB,
  ADD COLUMN IF NOT EXISTS inspection JSONB,
  ADD COLUMN IF NOT EXISTS bounding_box JSONB,
  ADD COLUMN IF NOT EXISTS message_order INT,
  ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS upload_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE saved_models
SET upload_status = 'complete'
WHERE upload_status IS NULL;

ALTER TABLE IF EXISTS saved_models
  ALTER COLUMN chat_session_id SET NOT NULL,
  ALTER COLUMN message_order SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_models_upload_status_check'
  ) THEN
    ALTER TABLE saved_models
      ADD CONSTRAINT saved_models_upload_status_check
      CHECK (upload_status IN ('pending', 'complete', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_models_chat_session_id_message_order_key'
  ) THEN
    ALTER TABLE saved_models
      ADD CONSTRAINT saved_models_chat_session_id_message_order_key
      UNIQUE (chat_session_id, message_order);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_saved_models_session;
CREATE INDEX IF NOT EXISTS idx_saved_models_session
  ON saved_models(chat_session_id, message_order DESC);
