-- VibeCAD Supabase Migration v4
-- Run this in Supabase SQL Editor.
-- Removes code persistence from chat tables. Code will be stored externally later.

ALTER TABLE IF EXISTS chat_messages
  DROP COLUMN IF EXISTS code;

ALTER TABLE IF EXISTS chat_sessions
  DROP COLUMN IF EXISTS current_code;
