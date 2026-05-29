-- G2 System — Migrazione Supabase
-- Esegui questo script una volta nel SQL Editor del dashboard Supabase
-- Dashboard → SQL Editor → New query → Incolla → Run

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS player_class  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS artifacts_json TEXT DEFAULT '[]';
