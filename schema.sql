-- Schema for Autonomous AI Creator (ABTalks Hackathon, PS3)
-- Run this in your Supabase SQL Editor

-- 1. Agents table: stores persona metadata and system prompt
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Posts table: stores published posts with rationale and sources
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_posts_agent_created ON posts(agent_id, created_at DESC);

-- 3. Evaluations table: logs candidate topic scores and rejection/approval decisions per cycle
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  topic_title TEXT NOT NULL,
  topic_url TEXT NOT NULL,
  score INTEGER NOT NULL,
  sub_scores JSONB DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'approved_runner_up', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_evaluations_agent_created ON evaluations(agent_id, created_at DESC);
