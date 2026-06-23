-- VibeCAD Supabase Schema — Simplified Chat Persistence
-- Run this in Supabase SQL Editor (safe re-run)

DROP TABLE IF EXISTS chat_messages CASCADE;

CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_order INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  specifications JSONB,    -- [{question, answer}] for user clarification responses
  provider TEXT,           -- AI provider name (assistant messages)
  dim_views JSONB,         -- { top: "base64...", front: "...", side: "..." }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, message_order);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
