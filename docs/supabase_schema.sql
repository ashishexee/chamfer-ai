-- VibeCAD Supabase Schema — Chat System (Two Tables)
-- Run this in Supabase SQL Editor.
-- WARNING: Drops existing chat_sessions table and data.

-- === Drop old tables ===
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

-- === Chat Messages (one row per turn) ===
-- Only stores what the user needs to see on revisit:
-- prompt (content) / specifications / provider / dim_views
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_order INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  specifications JSONB,
  provider TEXT,
  dim_views JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === Saved Models (0G root hashes stored here) ===
CREATE TABLE IF NOT EXISTS saved_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet TEXT NOT NULL REFERENCES profiles(wallet_address),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_order INT NOT NULL,
  name TEXT NOT NULL,
  root_hash_code TEXT,
  root_hash_stl TEXT,
  root_hash_step TEXT,
  root_hash_glb TEXT,
  parameters JSONB,
  inspection JSONB,
  bounding_box JSONB,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'complete', 'failed')),
  upload_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_session_id, message_order)
);

-- === Indexes ===
CREATE INDEX IF NOT EXISTS idx_chat_sessions_wallet ON chat_sessions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, message_order);
CREATE INDEX IF NOT EXISTS idx_saved_models_wallet ON saved_models(user_wallet);
CREATE INDEX IF NOT EXISTS idx_saved_models_session ON saved_models(chat_session_id, message_order DESC);

-- === RLS ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_models ENABLE ROW LEVEL SECURITY;
