-- VibeCAD Supabase Schema — Chat + append-only model history
-- FRESH DATABASE ONLY: this file drops chat tables and recreates them.
-- For an existing project, run docs/supabase_migration_v7.sql instead.

-- === Drop old tables (fresh-only) ===
DROP TABLE IF EXISTS saved_models CASCADE;
DROP TABLE IF EXISTS session_version_counters CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

-- === Profiles ===
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === Chat Sessions (metadata only) ===
CREATE TABLE chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet TEXT NOT NULL REFERENCES profiles(wallet_address),
  title TEXT,
  parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === Chat Messages (one row per UI message, stable per turn index) ===
-- `metadata` carries the rest of the Message payload (reasoning, workflow
-- steps, 0G/TEE metadata, snapshots, dim views, inspection, images, time) so
-- reopening a chat reproduces the live interface exactly.
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_order INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  specifications JSONB,
  provider TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, message_order)
);

-- === Saved Models — append-only version history ===
-- `version` is monotonic per chat and never reused; `message_order` is
-- provenance; `message_id` anchors the version to the assistant message so a
-- rewind can resolve the real trim point even after re-saves.
CREATE TABLE IF NOT EXISTS saved_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet TEXT NOT NULL REFERENCES profiles(wallet_address),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_order INT NOT NULL,
  version INT NOT NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'generate'
    CHECK (source IN ('generate', 'param_tweak', 'restored')),
  restored_from UUID REFERENCES saved_models(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  root_hash_code TEXT,
  root_hash_stl TEXT,
  root_hash_step TEXT,
  root_hash_glb TEXT,
  root_hash_dim_views TEXT,
  snapshots JSONB,
  dim_views JSONB,
  tx_seqs JSONB,
  parameters JSONB,
  inspection JSONB,
  bounding_box JSONB,
  upload_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'complete', 'failed')),
  upload_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_session_id, version)
);

-- === Monotonic version counter (never reused after a rewind) ===
CREATE TABLE IF NOT EXISTS session_version_counters (
  chat_session_id UUID PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  next_version INT NOT NULL DEFAULT 1
);

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

-- === Transactional transcript replace ===
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

-- === Atomic, message-anchored rewind ===
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

-- === Indexes ===
CREATE INDEX IF NOT EXISTS idx_chat_sessions_wallet ON chat_sessions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, message_order);
CREATE INDEX IF NOT EXISTS idx_saved_models_wallet ON saved_models(user_wallet);
CREATE INDEX IF NOT EXISTS idx_saved_models_session_version ON saved_models(chat_session_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_saved_models_session_turn ON saved_models(chat_session_id, message_order);

-- === RLS ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_version_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_version_counters FROM anon, authenticated;
