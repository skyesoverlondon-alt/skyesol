-- Reference migration: v5 -> v6
-- Purpose: align Skyesol on a single shared database contract for Identity members, role grants,
-- and intake records. Use the same database that powers the main Skyesol site.

CREATE TABLE IF NOT EXISTS sol_identity_members (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  identity_user_id TEXT UNIQUE,
  full_name TEXT,
  primary_role TEXT NOT NULL DEFAULT 'player',
  roles TEXT[] NOT NULL DEFAULT ARRAY['player']::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'netlify_identity',
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sol_identity_members_role_idx
  ON sol_identity_members(primary_role, updated_at DESC);

CREATE TABLE IF NOT EXISTS sol_identity_role_grants (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES sol_identity_members(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  grant_source TEXT NOT NULL DEFAULT 'netlify_identity',
  granted_by TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (member_id, role)
);

CREATE INDEX IF NOT EXISTS sol_identity_role_grants_role_idx
  ON sol_identity_role_grants(role, revoked_at, created_at DESC);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lane TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  ip TEXT,
  user_agent TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS intake_submissions_lane_created_idx
  ON intake_submissions(lane, created_at DESC);