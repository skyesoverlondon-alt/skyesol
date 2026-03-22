CREATE TABLE IF NOT EXISTS platform_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text,
  auth_subject text UNIQUE,
  is_super_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'customer',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS plan_subscriptions (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  seats integer NOT NULL DEFAULT 1,
  quotas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  plan_code text NOT NULL DEFAULT 'starter',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS database_instances (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  plan_code text NOT NULL DEFAULT 'starter',
  db_name text NOT NULL UNIQUE,
  db_user text NOT NULL UNIQUE,
  password_ciphertext text NOT NULL,
  status text NOT NULL DEFAULT 'creating',
  branch_of_instance_id uuid REFERENCES database_instances(id) ON DELETE SET NULL,
  public_hostname text NOT NULL,
  public_port integer NOT NULL DEFAULT 5432,
  public_ssl_mode text NOT NULL DEFAULT 'require',
  last_rotation_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS project_api_keys (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  org_id uuid REFERENCES orgs(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  instance_id uuid REFERENCES database_instances(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  requested_by text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  worker_id text,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_instance_id ON jobs(instance_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id_created_at ON jobs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  object_key text,
  status text NOT NULL DEFAULT 'queued',
  size_bytes bigint,
  sha256 text,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_backups_instance_id ON backups(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_org_id_created_at ON backups(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS restores (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
  backup_id uuid NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_restores_instance_id ON restores(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restores_org_id_created_at ON restores(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  instance_id uuid REFERENCES database_instances(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'count',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org_id_created_at ON usage_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_instance_id_created_at ON usage_events(instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  actor text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_id_created_at ON audit_events(org_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_database_instances ON database_instances;
CREATE TRIGGER trg_touch_database_instances
BEFORE UPDATE ON database_instances
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_plan_subscriptions ON plan_subscriptions;
CREATE TRIGGER trg_touch_plan_subscriptions
BEFORE UPDATE ON plan_subscriptions
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();


ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual';
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS provider_customer_ref text;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_ref text;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'month';
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE plan_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS signup_applications (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  org_name text NOT NULL,
  project_name text,
  desired_plan_code text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'pending',
  signup_token text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_user_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  activated_org_id uuid REFERENCES orgs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_signup_applications_email_created_at ON signup_applications(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_applications_status_created_at ON signup_applications(status, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_customers (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  billing_email text NOT NULL,
  legal_name text,
  status text NOT NULL DEFAULT 'active',
  address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES plan_subscriptions(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'usd',
  subtotal_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  description text,
  due_at timestamptz,
  paid_at timestamptz,
  line_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_id_created_at ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status_created_at ON invoices(status, created_at DESC);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  signup_application_id uuid REFERENCES signup_applications(id) ON DELETE SET NULL,
  requested_plan_code text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  provider text NOT NULL DEFAULT 'manual',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  session_token text NOT NULL UNIQUE,
  success_url text,
  cancel_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org_id_created_at ON checkout_sessions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_signup_created_at ON checkout_sessions(signup_application_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_touch_billing_customers ON billing_customers;
CREATE TRIGGER trg_touch_billing_customers
BEFORE UPDATE ON billing_customers
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_invoices ON invoices;
CREATE TRIGGER trg_touch_invoices
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();
