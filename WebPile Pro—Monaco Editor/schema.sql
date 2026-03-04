-- WebPile Pro Enterprise (Neon) — schema.sql
-- Run this in your Neon SQL Editor (or psql) BEFORE deploying the Netlify site.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Organizations
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,

  -- Enterprise auth controls
  email_verified boolean NOT NULL DEFAULT false,
  token_version integer NOT NULL DEFAULT 0, -- increments to revoke all sessions
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  password_changed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Schema upgrades (safe to re-run on existing DBs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;


-- Memberships (RBAC)
CREATE TABLE IF NOT EXISTS memberships (
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_org_updated ON projects(org_id, updated_at DESC);

-- Project files
CREATE TABLE IF NOT EXISTS project_files (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  language text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- Snapshots (store a full project JSON blob for audit-friendly restore points)
CREATE TABLE IF NOT EXISTS snapshots (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  label text,
  project_json jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_created ON snapshots(project_id, created_at DESC);

-- Audit logs (immutable trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(org_id, created_at DESC);

-- Helpful view: members
CREATE OR REPLACE VIEW v_org_members AS
SELECT
  o.id as org_id,
  o.name as org_name,
  u.id as user_id,
  u.email,
  m.role,
  m.created_at as joined_at
FROM orgs o
JOIN memberships m ON m.org_id = o.id
JOIN users u ON u.id = m.user_id;


-- Email verification tokens (for "verify your email" links)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_email_verify_user_expires ON email_verification_tokens(user_id, expires_at DESC);

-- Password reset tokens (short-lived)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_pw_reset_user_expires ON password_reset_tokens(user_id, expires_at DESC);

-- Email outbox (integration point: SES/SendGrid/Postmark/etc.)
-- In dev mode you can read tokens/links by querying this table in Neon.
CREATE TABLE IF NOT EXISTS email_outbox (
  id bigserial PRIMARY KEY,
  to_email citext NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created ON email_outbox(status, created_at DESC);

-- Distributed rate limiting (Postgres-backed)
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated ON rate_limits(updated_at DESC);



-- Membership active flag (SCIM deprovision uses this)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- OIDC configs per org (SSO)
CREATE TABLE IF NOT EXISTS oidc_configs (
  org_id uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  issuer_url text NOT NULL,
  client_id text NOT NULL,
  client_secret_enc text NOT NULL,
  redirect_uri text NOT NULL,
  scopes text NOT NULL DEFAULT 'openid email profile',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- OIDC transient state (PKCE + CSRF protection)
CREATE TABLE IF NOT EXISTS oidc_states (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oidc_states_org_expires ON oidc_states(org_id, expires_at DESC);

-- SCIM tokens (store only hashed tokens)
CREATE TABLE IF NOT EXISTS scim_tokens (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'default',
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_org ON scim_tokens(org_id);



-- Index for active memberships (SCIM + auth context loads)
CREATE INDEX IF NOT EXISTS idx_memberships_org_active ON memberships(org_id, active);


-- Users updated_at (for ETags)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Memberships updated_at (for ETags)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- OIDC state nonce (binds id_token to auth request)
ALTER TABLE oidc_states ADD COLUMN IF NOT EXISTS nonce text;

-- JWKS cache (persisted) for OIDC signature verification
CREATE TABLE IF NOT EXISTS jwks_cache (
  jwks_uri text PRIMARY KEY,
  jwks_json jsonb NOT NULL,
  etag text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_error_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS idx_jwks_cache_expires ON jwks_cache(expires_at DESC);

-- SCIM Groups (per org)
CREATE TABLE IF NOT EXISTS scim_groups (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scim_groups_org ON scim_groups(org_id);

CREATE TABLE IF NOT EXISTS scim_group_members (
  group_id uuid NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scim_group_members_user ON scim_group_members(user_id);


-- Multi-email storage for full RFC7644 bracket filtering on emails[...]
CREATE TABLE IF NOT EXISTS user_emails (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value text NOT NULL,
  type text NOT NULL DEFAULT 'work',
  primary_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, value)
);
CREATE INDEX IF NOT EXISTS idx_user_emails_user ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_value ON user_emails(value);
CREATE INDEX IF NOT EXISTS idx_user_emails_type ON user_emails(type);

-- Enforce at most one primary email per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_emails_one_primary ON user_emails(user_id)
WHERE primary_email = true;


-- SAML configs per org (minimal SSO)
CREATE TABLE IF NOT EXISTS saml_configs (
  org_id uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  idp_entity_id text NOT NULL,
  idp_sso_url text NOT NULL,
  sp_entity_id text NOT NULL,
  acs_url text NOT NULL,
  audience text NOT NULL,
  x509_cert_pem text NOT NULL,
  want_response_signed boolean NOT NULL DEFAULT true,
  want_assertion_signed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Map IdP SessionIndex/NameID to local sessions (SLO + evidence)
CREATE TABLE IF NOT EXISTS saml_sessions (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_id text NOT NULL,
  session_index text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_saml_sessions_org_user ON saml_sessions(org_id, user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_saml_sessions_lookup ON saml_sessions(org_id, name_id, session_index);


-- SIEM outbox (durable delivery)
CREATE TABLE IF NOT EXISTS siem_outbox (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'audit',
  payload_json jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_siem_outbox_due ON siem_outbox(delivered_at, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_siem_outbox_org ON siem_outbox(org_id, created_at DESC);


-- SIEM delivery config per org
CREATE TABLE IF NOT EXISTS org_siem_configs (
  org_id uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  auth_header text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Minimal metrics counters (for SLO mapping)
CREATE TABLE IF NOT EXISTS metrics_counters (
  k text PRIMARY KEY,
  v bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---- RLS (Row-Level Security) optional
-- App sets: SELECT set_config('app.org_id', '<uuid>', true);
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

