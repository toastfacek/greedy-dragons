-- Greedy Dragons schema
-- Run this in the Supabase SQL editor to set up your database

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  gold_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions table (audit trail)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  gold_amount INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for leaderboard query (fast top-N)
CREATE INDEX idx_players_gold ON players(gold_count DESC);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Public read access to players (for leaderboard)
CREATE POLICY "Anyone can view the leaderboard"
  ON players FOR SELECT
  USING (true);

-- Only server can insert/update players (via service role key)
-- No public insert/update/delete policies = client can't modify

-- Transactions are server-only (no public policies)

-- Atomic gold increment function (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_gold(p_player_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE players
  SET gold_count = gold_count + p_amount,
      updated_at = now()
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
