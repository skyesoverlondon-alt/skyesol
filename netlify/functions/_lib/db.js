import "./defaults.js";  // pre-populate process.env with non-secret defaults
import { neon } from "@netlify/neon";

/**
 * Netlify DB (Neon Postgres) helper.
 *
 * IMPORTANT (Neon serverless driver, 2025+):
 * - `neon()` returns a tagged-template query function.
 * - For dynamic SQL strings + $1 placeholders, use `sql.query(text, params)`.
 *   (Calling the template function like sql("SELECT ...") can break on newer driver versions.)
 *
 * Prefer `NEON_DATABASE_URL` for Skyesol's primary database contract.
 * `DATABASE_URL` and `NETLIFY_DATABASE_URL` remain supported as fallbacks.
 */

let _sql = null;
let _schemaPromise = null;

export function resolveDbUrl() {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || "";
}

export function hasConfiguredDb() {
  return !!resolveDbUrl();
}

function getSql() {
  if (_sql) return _sql;

  const connectionString = resolveDbUrl();
  if (!connectionString) {
    const err = new Error("Database not configured. Set NEON_DATABASE_URL for the shared Skyesol database.");
    err.code = "DB_NOT_CONFIGURED";
    err.status = 500;
    err.hint = "Netlify UI → Environment variables → add NEON_DATABASE_URL. DATABASE_URL and NETLIFY_DATABASE_URL are accepted as fallbacks.";
    throw err;
  }

  if (!process.env.NETLIFY_DATABASE_URL) {
    process.env.NETLIFY_DATABASE_URL = connectionString;
  }

  _sql = neon();
  return _sql;
}

async function ensureSchema() {
  if (_schemaPromise) return _schemaPromise;

  _schemaPromise = (async () => {
    const sql = getSql();
    const statements = [
      `create table if not exists customers (
        id bigserial primary key,
        email text not null unique,
        plan_name text not null default 'starter',
        monthly_cap_cents integer not null default 2000,
        is_active boolean not null default true,
        stripe_customer_id text,
        stripe_subscription_id text,
        stripe_status text,
        stripe_current_period_end timestamptz,
        auto_topup_enabled boolean not null default false,
        auto_topup_amount_cents integer,
        auto_topup_threshold_cents integer,
        created_at timestamptz not null default now()
      );`,
      `create table if not exists api_keys (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        key_hash text not null unique,
        key_last4 text not null,
        label text,
        monthly_cap_cents integer,
        rpm_limit integer,
        rpd_limit integer,
        created_at timestamptz not null default now(),
        revoked_at timestamptz
      );`,
      `create index if not exists api_keys_customer_id_idx on api_keys(customer_id);`,
      `create table if not exists monthly_usage (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        spent_cents integer not null default 0,
        extra_cents integer not null default 0,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,
      `create table if not exists monthly_key_usage (
        api_key_id bigint not null references api_keys(id) on delete cascade,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        spent_cents integer not null default 0,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        calls integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (api_key_id, month)
      );`,
      `create index if not exists monthly_key_usage_customer_month_idx on monthly_key_usage(customer_id, month);`,
      `alter table monthly_key_usage add column if not exists calls integer not null default 0;`,
      `create table if not exists usage_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        provider text not null,
        model text not null,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cost_cents integer not null default 0,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists usage_events_customer_month_idx on usage_events(customer_id, created_at desc);`,
      `create index if not exists usage_events_key_idx on usage_events(api_key_id, created_at desc);`,
      `create table if not exists audit_events (
        id bigserial primary key,
        actor text not null,
        action text not null,
        target text,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists audit_events_created_idx on audit_events(created_at desc);`,
      `create table if not exists rate_limit_windows (
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        window_start timestamptz not null,
        count integer not null default 0,
        primary key (customer_id, api_key_id, window_start)
      );`,
      `create index if not exists rate_limit_windows_window_idx on rate_limit_windows(window_start desc);`,      `alter table api_keys add column if not exists last_seen_at timestamptz;`,
      `alter table api_keys add column if not exists last_seen_install_id text;`,
      `alter table usage_events add column if not exists install_id text;`,
      `alter table usage_events add column if not exists ip_hash text;`,
      `alter table usage_events add column if not exists ua text;`,
      `create index if not exists usage_events_install_idx on usage_events(install_id);`,
      `create table if not exists alerts_sent (
        customer_id bigint not null,
        api_key_id bigint not null default 0,
        month text not null,
        alert_type text not null,
        created_at timestamptz not null default now(),
        primary key (customer_id, api_key_id, month, alert_type)
      );`,
    
      // --- Device binding / seats ---
      `alter table customers add column if not exists max_devices_per_key integer;`,
      `alter table customers add column if not exists require_install_id boolean not null default false;`,
      `alter table customers add column if not exists allowed_providers text[];`,
      `alter table customers add column if not exists allowed_models jsonb;`,
      `alter table customers add column if not exists stripe_current_period_end timestamptz;`,

      `alter table api_keys add column if not exists max_devices integer;`,
      `alter table api_keys add column if not exists require_install_id boolean;`,
      `alter table api_keys add column if not exists allowed_providers text[];`,
      `alter table api_keys add column if not exists allowed_models jsonb;`,

      `create table if not exists key_devices (
        api_key_id bigint not null references api_keys(id) on delete cascade,
        customer_id bigint not null references customers(id) on delete cascade,
        install_id text not null,
        device_label text,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz,
        last_seen_ua text,
        revoked_at timestamptz,
        revoked_by text,
        primary key (api_key_id, install_id)
      );`,
      `create index if not exists key_devices_customer_idx on key_devices(customer_id);`,
      `create index if not exists key_devices_last_seen_idx on key_devices(last_seen_at desc);`,

      // --- Invoice snapshots + topups ---
      `create table if not exists monthly_invoices (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        snapshot jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,
      `create table if not exists topup_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        amount_cents integer not null,
        source text not null default 'manual',
        stripe_session_id text,
        status text not null default 'applied',
        created_at timestamptz not null default now()
      );`,
      `create index if not exists topup_events_customer_month_idx on topup_events(customer_id, month);`,

      `create table if not exists async_jobs (
        id uuid primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        provider text not null,
        model text not null,
        request jsonb not null default '{}'::jsonb,
        status text not null default 'queued',
        created_at timestamptz not null default now(),
        started_at timestamptz,
        completed_at timestamptz,
        heartbeat_at timestamptz,
        output_text text,
        error text,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb
      );`,
      `create index if not exists async_jobs_customer_created_idx on async_jobs(customer_id, created_at desc);`,
      `create index if not exists async_jobs_status_idx on async_jobs(status, created_at desc);`,
    
      `create table if not exists gateway_events (
        id bigserial primary key,
        request_id text,
        level text not null default 'info',
        kind text not null,
        function_name text not null,
        method text,
        path text,
        origin text,
        referer text,
        user_agent text,
        ip text,
        app_id text,
        build_id text,
        customer_id bigint,
        api_key_id bigint,
        provider text,
        model text,
        http_status integer,
        duration_ms integer,
        error_code text,
        error_message text,
        error_stack text,
        upstream_status integer,
        upstream_body text,
        extra jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists gateway_events_created_idx on gateway_events(created_at desc);`,
      `create index if not exists gateway_events_request_idx on gateway_events(request_id);`,
      `create index if not exists gateway_events_level_idx on gateway_events(level, created_at desc);`,
      `create index if not exists gateway_events_fn_idx on gateway_events(function_name, created_at desc);`,
      `create index if not exists gateway_events_app_idx on gateway_events(app_id, created_at desc);`,

      // --- KaixuPush (Deploy Push) enterprise tables ---
      `alter table api_keys add column if not exists role text not null default 'deployer';`,
      `alter table api_keys add column if not exists encrypted_key text;`,
      `create index if not exists api_keys_role_idx on api_keys(role);`,
      `create table if not exists customer_netlify_tokens (
        customer_id bigint primary key references customers(id) on delete cascade,
        token_enc text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists push_projects (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        project_id text not null,
        name text not null,
        netlify_site_id text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (customer_id, project_id)
      );`,
      `create index if not exists push_projects_customer_idx on push_projects(customer_id, created_at desc);`,
      `create table if not exists push_pushes (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        project_row_id bigint not null references push_projects(id) on delete cascade,
        push_id text not null unique,
        branch text not null,
        title text,
        deploy_id text not null,
        state text not null,
        required_digests text[] not null default '{}'::text[],
        uploaded_digests text[] not null default '{}'::text[],
        file_manifest jsonb not null default '{}'::jsonb,
        url text,
        error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table push_pushes add column if not exists file_manifest jsonb not null default '{}'::jsonb;`,
      `create index if not exists push_pushes_customer_idx on push_pushes(customer_id, created_at desc);`,
      `create table if not exists push_jobs (
        id bigserial primary key,
        push_row_id bigint not null references push_pushes(id) on delete cascade,
        sha1 char(40) not null,
        deploy_path text not null,
        parts integer not null,
        received_parts integer[] not null default '{}'::int[],
        part_bytes jsonb not null default '{}'::jsonb,
        bytes_staged bigint not null default 0,
        status text not null default 'uploading',
        error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (push_row_id, sha1)
      );`,
      `create index if not exists push_jobs_push_idx on push_jobs(push_row_id, updated_at desc);`,
      `alter table push_jobs add column if not exists bytes_staged bigint not null default 0;`,
      `alter table push_jobs add column if not exists part_bytes jsonb not null default '{}'::jsonb;`,
      `alter table push_jobs add column if not exists attempts integer not null default 0;`,
      `alter table push_jobs add column if not exists next_attempt_at timestamptz;`,
      `alter table push_jobs add column if not exists last_error text;`,
      `alter table push_jobs add column if not exists last_error_at timestamptz;`,

      `create table if not exists push_rate_windows (
        customer_id bigint not null references customers(id) on delete cascade,
        bucket_type text not null,
        bucket_start timestamptz not null,
        count integer not null default 0,
        primary key(customer_id, bucket_type, bucket_start)
      );`,
      `create index if not exists push_rate_windows_bucket_idx on push_rate_windows(bucket_type, bucket_start desc);`,
      `create table if not exists push_files (
        id bigserial primary key,
        push_row_id bigint not null references push_pushes(id) on delete cascade,
        deploy_path text not null,
        sha1 char(40) not null,
        bytes bigint not null default 0,
        mode text not null default 'direct',
        created_at timestamptz not null default now()
      );`,
      `create index if not exists push_files_push_idx on push_files(push_row_id);`,
      `create table if not exists push_usage_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        push_row_id bigint references push_pushes(id) on delete set null,
        event_type text not null,
        bytes bigint not null default 0,
        pricing_version integer not null default 1,
        cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists push_usage_customer_idx on push_usage_events(customer_id, created_at desc);`,
      `create table if not exists push_pricing_versions (
        version integer primary key,
        effective_from date not null default current_date,
        currency text not null default 'USD',
        base_month_cents integer not null default 0,
        per_deploy_cents integer not null default 0,
        per_gb_cents integer not null default 0,
        created_at timestamptz not null default now()
      );`,
      `insert into push_pricing_versions(version, base_month_cents, per_deploy_cents, per_gb_cents)
       values (1, 0, 10, 25) on conflict (version) do nothing;`,
      `create table if not exists customer_push_billing (
        customer_id bigint primary key references customers(id) on delete cascade,
        pricing_version integer not null references push_pricing_versions(version),
        monthly_cap_cents integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists push_invoices (
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        pricing_version integer not null references push_pricing_versions(version),
        total_cents integer not null,
        breakdown jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (customer_id, month)
      );`,

      // ------------------------------
      // GitHub Push Gateway (optional)
      // ------------------------------
      `create table if not exists customer_github_tokens (
        customer_id bigint primary key references customers(id) on delete cascade,
        token_enc text not null,
        token_type text not null default 'oauth',
        scopes text[] not null default '{}'::text[],
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists gh_push_jobs (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        job_id text not null unique,
        owner text not null,
        repo text not null,
        branch text not null default 'main',
        commit_message text not null default 'Kaixu GitHub Push',
        parts integer not null default 0,
        received_parts integer[] not null default '{}'::int[],
        part_bytes jsonb not null default '{}'::jsonb,
        bytes_staged bigint not null default 0,
        status text not null default 'uploading',
        attempts integer not null default 0,
        next_attempt_at timestamptz,
        last_error text,
        last_error_at timestamptz,
        result_commit_sha text,
        result_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists gh_push_jobs_customer_idx on gh_push_jobs(customer_id, updated_at desc);`,
      `create index if not exists gh_push_jobs_next_attempt_idx on gh_push_jobs(next_attempt_at) where status in ('retry_wait','error_transient');`,
      `create table if not exists gh_push_events (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        api_key_id bigint not null references api_keys(id) on delete cascade,
        job_row_id bigint not null references gh_push_jobs(id) on delete cascade,
        event_type text not null,
        bytes bigint not null default 0,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists gh_push_events_job_idx on gh_push_events(job_row_id, created_at desc);`,


      `create table if not exists voice_numbers (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        phone_number text not null unique,
        provider text not null default 'twilio',
        twilio_sid text,
        is_active boolean not null default true,
        default_llm_provider text not null default 'openai',
        default_llm_model text not null default 'gpt-4.1-mini',
        voice_name text not null default 'alloy',
        locale text not null default 'en-US',
        timezone text not null default 'America/Phoenix',
        playbook jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists voice_numbers_customer_idx on voice_numbers(customer_id);`,

      `create table if not exists voice_calls (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        voice_number_id bigint references voice_numbers(id) on delete set null,
        provider text not null default 'twilio',
        provider_call_sid text not null,
        from_number text,
        to_number text,
        status text not null default 'initiated',
        direction text not null default 'inbound',
        started_at timestamptz not null default now(),
        ended_at timestamptz,
        duration_seconds integer,
        est_cost_cents integer not null default 0,
        bill_cost_cents integer not null default 0,
        meta jsonb not null default '{}'::jsonb
      );`,
      `create unique index if not exists voice_calls_provider_sid_uq on voice_calls(provider, provider_call_sid);`,
      `create index if not exists voice_calls_customer_idx on voice_calls(customer_id, started_at desc);`,

      `create table if not exists voice_call_messages (
        id bigserial primary key,
        call_id bigint not null references voice_calls(id) on delete cascade,
        role text not null, -- user|assistant|system|tool
        content text not null,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists voice_call_messages_call_idx on voice_call_messages(call_id, id);`,

      `create table if not exists voice_usage_monthly (
        id bigserial primary key,
        customer_id bigint not null references customers(id) on delete cascade,
        month text not null,
        minutes numeric not null default 0,
        est_cost_cents integer not null default 0,
        bill_cost_cents integer not null default 0,
        calls integer not null default 0,
        created_at timestamptz not null default now(),
        unique(customer_id, month)
      );`,
      `create index if not exists voice_usage_monthly_customer_idx on voice_usage_monthly(customer_id, month);`,

      // --- Shared Skyesol Identity source of truth ---
      `create table if not exists sol_identity_members (
        id bigserial primary key,
        email text not null unique,
        identity_user_id text unique,
        full_name text,
        primary_role text not null default 'player',
        roles text[] not null default array['player']::text[],
        status text not null default 'active',
        source text not null default 'netlify_identity',
        customer_id bigint references customers(id) on delete set null,
        profile jsonb not null default '{}'::jsonb,
        last_login_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists sol_identity_members_role_idx on sol_identity_members(primary_role, updated_at desc);`,
      `create table if not exists sol_identity_role_grants (
        id bigserial primary key,
        member_id bigint not null references sol_identity_members(id) on delete cascade,
        role text not null,
        grant_source text not null default 'netlify_identity',
        granted_by text,
        meta jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        revoked_at timestamptz,
        unique (member_id, role)
      );`,
      `create index if not exists sol_identity_role_grants_role_idx on sol_identity_role_grants(role, revoked_at, created_at desc);`,
      `create table if not exists intake_submissions (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        lane text not null,
        name text,
        email text,
        phone text,
        company text,
        role text,
        ip text,
        user_agent text,
        payload jsonb not null
      );`,
      `create index if not exists intake_submissions_lane_created_idx on intake_submissions(lane, created_at desc);`,

      `create table if not exists platform_state_docs (
        app_id text primary key,
        title text not null default '',
        state jsonb not null default '{}'::jsonb,
        summary jsonb not null default '{}'::jsonb,
        visibility text not null default 'admin',
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists platform_state_docs_updated_idx on platform_state_docs(updated_at desc);`,

      `create table if not exists skymail_shared_desk (
        item_id text primary key,
        subject text not null default '',
        email text not null default '',
        owner text not null default '',
        queue text not null default '',
        priority text not null default '',
        status text not null default '',
        waiting text not null default '',
        last_touch date,
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_shared_desk add column if not exists updated_by text;`,
      `create index if not exists skymail_shared_desk_status_idx on skymail_shared_desk(status, updated_at desc);`,
      `create index if not exists skymail_shared_desk_queue_idx on skymail_shared_desk(queue, updated_at desc);`,
      `create table if not exists skymail_follow_ups (
        item_id text primary key,
        lead_name text not null default '',
        email text not null default '',
        stage text not null default '',
        health text not null default '',
        owner text not null default '',
        next_touch date,
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_follow_ups add column if not exists updated_by text;`,
      `create index if not exists skymail_follow_ups_next_touch_idx on skymail_follow_ups(next_touch, updated_at desc);`,
      `create index if not exists skymail_follow_ups_stage_idx on skymail_follow_ups(stage, updated_at desc);`,
      `create table if not exists skymail_intake_records (
        item_id text primary key,
        client_name text not null default '',
        email text not null default '',
        stage text not null default '',
        due_on date,
        estimated_value numeric not null default 0,
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_intake_records add column if not exists updated_by text;`,
      `create index if not exists skymail_intake_records_stage_idx on skymail_intake_records(stage, updated_at desc);`,
      `create index if not exists skymail_intake_records_due_idx on skymail_intake_records(due_on, updated_at desc);`,
      `create table if not exists skymail_contacts (
        item_id text primary key,
        email text not null default '',
        company text not null default '',
        segment text not null default '',
        owner text not null default '',
        score integer not null default 0,
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_contacts add column if not exists updated_by text;`,
      `create index if not exists skymail_contacts_segment_idx on skymail_contacts(segment, updated_at desc);`,
      `create index if not exists skymail_contacts_score_idx on skymail_contacts(score desc, updated_at desc);`,
      `create table if not exists skymail_reply_templates (
        item_id text primary key,
        title text not null default '',
        category text not null default '',
        subject text not null default '',
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_reply_templates add column if not exists updated_by text;`,
      `create index if not exists skymail_reply_templates_category_idx on skymail_reply_templates(category, updated_at desc);`,
      `create table if not exists skymail_recovery_log (
        item_id text primary key,
        email text not null default '',
        severity text not null default '',
        action text not null default '',
        est_value numeric not null default 0,
        payload jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `alter table skymail_recovery_log add column if not exists updated_by text;`,
      `create index if not exists skymail_recovery_log_severity_idx on skymail_recovery_log(severity, updated_at desc);`,
      `create table if not exists skymail_suite_meta (
        suite_key text primary key,
        analytics jsonb not null default '{}'::jsonb,
        meta jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,

      `create table if not exists platform_ops_status (
        app_id text primary key,
        health_status text not null default 'unreviewed',
        onboarding_stage text not null default 'untracked',
        lifecycle_status text not null default 'active',
        owner text,
        notes text,
        flags jsonb not null default '{}'::jsonb,
        updated_by text,
        last_checked_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists platform_ops_status_health_idx on platform_ops_status(health_status, updated_at desc);`,
      `create index if not exists platform_ops_status_onboarding_idx on platform_ops_status(onboarding_stage, updated_at desc);`,

      `create table if not exists cohort_command_configs (
        config_key text primary key,
        cohort jsonb not null default '{}'::jsonb,
        letters jsonb not null default '{}'::jsonb,
        instructor jsonb not null default '{}'::jsonb,
        wiring jsonb not null default '{}'::jsonb,
        generated_preview_id text not null default '',
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists cohort_command_students (
        student_id text primary key,
        name text not null default '',
        email text not null default '',
        org text not null default '',
        track text not null default '',
        seat text not null default '',
        status text not null default 'pending',
        notes text not null default '',
        created_at_label text not null default '',
        attendance jsonb not null default '{}'::jsonb,
        profile jsonb not null default '{}'::jsonb,
        workbook jsonb not null default '{}'::jsonb,
        demo jsonb not null default '{}'::jsonb,
        self_score jsonb not null default '{}'::jsonb,
        founder_score jsonb not null default '{}'::jsonb,
        updated_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create index if not exists cohort_command_students_status_idx on cohort_command_students(status, updated_at desc);`,
      `create index if not exists cohort_command_students_email_idx on cohort_command_students(email, updated_at desc);`,

];

    for (const s of statements) {
      await sql.query(s);
    }
  })();

  return _schemaPromise;
}

/**
 * Query helper compatible with the previous `pg`-ish interface:
 * - returns { rows, rowCount }
 * - supports $1, $2 placeholders + params array via sql.query(...)
 */
export async function q(text, params = []) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(text, params);
  return { rows: rows || [], rowCount: Array.isArray(rows) ? rows.length : 0 };
}