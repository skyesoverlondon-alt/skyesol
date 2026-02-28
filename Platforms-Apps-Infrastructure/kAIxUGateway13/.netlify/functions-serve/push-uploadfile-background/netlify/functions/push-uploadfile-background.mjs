
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/push-uploadfile-background.js
import { getStore } from "@netlify/blobs";

// netlify/functions/_lib/db.js
import { neon } from "@netlify/neon";
var _sql = null;
var _schemaPromise = null;
function getSql() {
  if (_sql) return _sql;
  const hasDbUrl = !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
  if (!hasDbUrl) {
    const err = new Error("Database not configured (missing NETLIFY_DATABASE_URL). Attach Netlify DB (Neon) to this site.");
    err.code = "DB_NOT_CONFIGURED";
    err.status = 500;
    err.hint = "Netlify UI \u2192 Extensions \u2192 Neon \u2192 Add database (or run: npx netlify db init).";
    throw err;
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
      `create index if not exists rate_limit_windows_window_idx on rate_limit_windows(window_start desc);`,
      `alter table api_keys add column if not exists last_seen_at timestamptz;`,
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
      // Forward-compatible patching: if gateway_events existed from an older build,
      // it may be missing columns used by monitor inserts.
      `alter table gateway_events add column if not exists request_id text;`,
      `alter table gateway_events add column if not exists level text not null default 'info';`,
      `alter table gateway_events add column if not exists kind text not null default 'event';`,
      `alter table gateway_events add column if not exists function_name text not null default 'unknown';`,
      `alter table gateway_events add column if not exists method text;`,
      `alter table gateway_events add column if not exists path text;`,
      `alter table gateway_events add column if not exists origin text;`,
      `alter table gateway_events add column if not exists referer text;`,
      `alter table gateway_events add column if not exists user_agent text;`,
      `alter table gateway_events add column if not exists ip text;`,
      `alter table gateway_events add column if not exists app_id text;`,
      `alter table gateway_events add column if not exists build_id text;`,
      `alter table gateway_events add column if not exists customer_id bigint;`,
      `alter table gateway_events add column if not exists api_key_id bigint;`,
      `alter table gateway_events add column if not exists provider text;`,
      `alter table gateway_events add column if not exists model text;`,
      `alter table gateway_events add column if not exists http_status integer;`,
      `alter table gateway_events add column if not exists duration_ms integer;`,
      `alter table gateway_events add column if not exists error_code text;`,
      `alter table gateway_events add column if not exists error_message text;`,
      `alter table gateway_events add column if not exists error_stack text;`,
      `alter table gateway_events add column if not exists upstream_status integer;`,
      `alter table gateway_events add column if not exists upstream_body text;`,
      `alter table gateway_events add column if not exists extra jsonb not null default '{}'::jsonb;`,
      `alter table gateway_events add column if not exists created_at timestamptz not null default now();`,
      `create index if not exists gateway_events_created_idx on gateway_events(created_at desc);`,
      `create index if not exists gateway_events_request_idx on gateway_events(request_id);`,
      `create index if not exists gateway_events_level_idx on gateway_events(level, created_at desc);`,
      `create index if not exists gateway_events_fn_idx on gateway_events(function_name, created_at desc);`,
      `create index if not exists gateway_events_app_idx on gateway_events(app_id, created_at desc);`,
      // --- KaixuPush (Deploy Push) enterprise tables ---
      `alter table api_keys add column if not exists role text not null default 'deployer';`,
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
      `create index if not exists voice_usage_monthly_customer_idx on voice_usage_monthly(customer_id, month);`
    ];
    for (const s of statements) {
      await sql.query(s);
    }
  })();
  return _schemaPromise;
}
async function q(text, params = []) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(text, params);
  return { rows: rows || [], rowCount: Array.isArray(rows) ? rows.length : 0 };
}

// netlify/functions/_lib/http.js
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}
function monthKeyUTC(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 7);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// netlify/functions/_lib/crypto.js
import crypto from "crypto";
function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}
function unbase64url(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
  return Buffer.from(s + pad, "base64");
}
function encKey() {
  const raw = (process.env.DB_ENCRYPTION_KEY || process.env.JWT_SECRET || "").toString();
  if (!raw) {
    throw configError(
      "Missing DB_ENCRYPTION_KEY (or JWT_SECRET fallback)",
      "Set DB_ENCRYPTION_KEY (recommended) or at minimum JWT_SECRET in Netlify env vars."
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}
function decryptSecret(enc) {
  const s = String(enc || "");
  if (!s.startsWith("v1:")) return null;
  const parts = s.split(":");
  if (parts.length !== 4) return null;
  const [, ivB, tagB, ctB] = parts;
  const key = encKey();
  const iv = unbase64url(ivB);
  const tag = unbase64url(tagB);
  const ct = unbase64url(ctB);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function hmacSha256Hex(secret, input) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}
function keyHashHex(input) {
  const pepper = process.env.KEY_PEPPER;
  if (pepper) return hmacSha256Hex(pepper, input);
  return sha256Hex(input);
}
function legacyKeyHashHex(input) {
  return sha256Hex(input);
}

// netlify/functions/_lib/authz.js
function baseSelect() {
  return `select k.id as api_key_id, k.customer_id, k.key_last4, k.label, k.role,
                 k.monthly_cap_cents as key_cap_cents, k.rpm_limit, k.rpd_limit,
                 k.max_devices, k.require_install_id, k.allowed_providers, k.allowed_models,
                 c.monthly_cap_cents as customer_cap_cents, c.is_active,
                 c.max_devices_per_key as customer_max_devices_per_key, c.require_install_id as customer_require_install_id,
                 c.allowed_providers as customer_allowed_providers, c.allowed_models as customer_allowed_models,
                 c.plan_name as customer_plan_name, c.email as customer_email
          from api_keys k
          join customers c on c.id = k.customer_id`;
}
async function lookupKey(plainKey) {
  const preferred = keyHashHex(plainKey);
  let keyRes = await q(
    `${baseSelect()}
     where k.key_hash=$1 and k.revoked_at is null
     limit 1`,
    [preferred]
  );
  if (keyRes.rowCount) return keyRes.rows[0];
  if (process.env.KEY_PEPPER) {
    const legacy = legacyKeyHashHex(plainKey);
    keyRes = await q(
      `${baseSelect()}
       where k.key_hash=$1 and k.revoked_at is null
       limit 1`,
      [legacy]
    );
    if (!keyRes.rowCount) return null;
    const row = keyRes.rows[0];
    try {
      await q(
        `update api_keys set key_hash=$1
         where id=$2 and key_hash=$3`,
        [preferred, row.api_key_id, legacy]
      );
    } catch {
    }
    return row;
  }
  return null;
}
var ROLE_ORDER = ["viewer", "deployer", "admin", "owner"];
function roleAtLeast(actual, required) {
  const a = ROLE_ORDER.indexOf((actual || "deployer").toLowerCase());
  const r = ROLE_ORDER.indexOf((required || "deployer").toLowerCase());
  return a >= r && a !== -1 && r !== -1;
}
function requireKeyRole(keyRow, requiredRole) {
  const actual = (keyRow?.role || "deployer").toLowerCase();
  if (!roleAtLeast(actual, requiredRole)) {
    const err = new Error("Forbidden");
    err.status = 403;
    err.code = "FORBIDDEN";
    err.hint = `Requires role '${requiredRole}', but key role is '${actual}'.`;
    throw err;
  }
}

// netlify/functions/_lib/pushPathNormalize.js
function normalizePath(input) {
  let p = String(input || "").trim();
  p = p.replace(/\\/g, "/");
  if (p.includes("#") || p.includes("?")) {
    const err = new Error("File paths must not include '#' or '?'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  if (!p.startsWith("/")) p = "/" + p;
  p = "/" + p.slice(1).replace(/\/{2,}/g, "/");
  if (/[\x00-\x1F\x7F]/.test(p)) {
    const err = new Error("File path contains control characters");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  if (p.length > 1 && p.endsWith("/")) {
    const err = new Error("File path must not end with '/'");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  const segs = p.split("/");
  for (const seg of segs) {
    if (seg === ".." || seg === ".") {
      const err = new Error("File path must not include '.' or '..' segments");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
    if (/[<>:"|*]/.test(seg)) {
      const err = new Error("File path contains invalid characters");
      err.code = "BAD_PATH";
      err.status = 400;
      throw err;
    }
  }
  if (p.length > 1024) {
    const err = new Error("File path too long");
    err.code = "BAD_PATH";
    err.status = 400;
    throw err;
  }
  return p;
}

// netlify/functions/_lib/pushPath.js
function encodeURIComponentSafePath(pathWithLeadingSlash) {
  const p = normalizePath(pathWithLeadingSlash);
  const parts = p.slice(1).split("/").map((seg) => encodeURIComponent(seg));
  return parts.join("/");
}

// netlify/functions/_lib/audit.js
async function audit(actor, action, target = null, meta = {}) {
  try {
    await q(
      `insert into audit_events(actor, action, target, meta) values ($1,$2,$3,$4::jsonb)`,
      [actor, action, target, JSON.stringify(meta || {})]
    );
  } catch (e) {
    console.warn("audit failed:", e?.message || e);
  }
}

// netlify/functions/_lib/netlifyTokens.js
async function getNetlifyTokenForCustomer(customer_id) {
  const res = await q(`select token_enc from customer_netlify_tokens where customer_id=$1`, [customer_id]);
  if (res.rows.length) {
    const dec = decryptSecret(res.rows[0].token_enc);
    if (dec) return dec;
  }
  return (process.env.NETLIFY_AUTH_TOKEN || "").trim() || null;
}

// netlify/functions/_lib/pushCaps.js
function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}
async function getPushPricing(customer_id) {
  let pv = await q(
    `select b.pricing_version, b.monthly_cap_cents,
            p.base_month_cents, p.per_deploy_cents, p.per_gb_cents, p.currency
     from customer_push_billing b
     join push_pricing_versions p on p.version = b.pricing_version
     where b.customer_id=$1
     limit 1`,
    [customer_id]
  );
  if (!pv.rowCount) {
    pv = await q(
      `select 1 as pricing_version, 0 as monthly_cap_cents,
              base_month_cents, per_deploy_cents, per_gb_cents, currency
       from push_pricing_versions where version=1 limit 1`,
      []
    );
  }
  return pv.rowCount ? pv.rows[0] : null;
}
async function getPushUsage(customer_id, range) {
  const usage = await q(
    `select
        count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
        count(*) filter (where event_type='deploy_init')::int as deploys_init,
        coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
     from push_usage_events
     where customer_id=$1 and created_at >= $2 and created_at < $3`,
    [customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  return usage.rows[0] || { deploys_ready: 0, deploys_init: 0, bytes_uploaded: 0 };
}
async function getStagedBytes(customer_id, range) {
  const res = await q(
    `select coalesce(sum(j.bytes_staged),0)::bigint as bytes_staged
     from push_jobs j
     join push_pushes p on p.id=j.push_row_id
     where p.customer_id=$1
       and p.created_at >= $2 and p.created_at < $3
       and j.status in ('uploading','queued','assembling')`,
    [customer_id, range.start.toISOString(), range.end.toISOString()]
  );
  return Number(res.rows[0]?.bytes_staged || 0);
}
async function enforcePushCap({ customer_id, month, extra_deploys = 0, extra_bytes = 0 }) {
  const range = monthRangeUTC(month);
  if (!range) {
    const err = new Error("Invalid month (YYYY-MM)");
    err.code = "BAD_MONTH";
    err.status = 400;
    throw err;
  }
  const cfg = await getPushPricing(customer_id);
  if (!cfg) return { ok: true, cfg: null };
  const cap = Number(cfg.monthly_cap_cents || 0);
  if (!cap || cap <= 0) return { ok: true, cfg };
  const usage = await getPushUsage(customer_id, range);
  const staged = await getStagedBytes(customer_id, range);
  const deploys_init = Number(usage.deploys_init || 0);
  const deploys_ready = Number(usage.deploys_ready || 0);
  const deploys_reserved = Math.max(0, deploys_init - deploys_ready);
  const deploys_used = deploys_ready + deploys_reserved + Number(extra_deploys || 0);
  const bytes_total = Number(usage.bytes_uploaded || 0) + Number(staged || 0) + Number(extra_bytes || 0);
  const gb = bytes_total / 1073741824;
  const base = Number(cfg.base_month_cents || 0);
  const deployCost = Number(cfg.per_deploy_cents || 0) * deploys_used;
  const gbCost = Math.round(Number(cfg.per_gb_cents || 0) * gb);
  const total = base + deployCost + gbCost;
  if (total > cap) {
    const err = new Error("Push monthly cap reached");
    err.code = "PUSH_CAP_REACHED";
    err.status = 402;
    err.payload = {
      code: "PUSH_CAP_REACHED",
      month,
      pricing_version: cfg.pricing_version,
      monthly_cap_cents: cap,
      projected_total_cents: total,
      current: {
        deploys_init,
        deploys_ready,
        deploys_reserved,
        bytes_uploaded: Number(usage.bytes_uploaded || 0),
        bytes_staged: Number(staged || 0)
      },
      proposed: {
        extra_deploys: Number(extra_deploys || 0),
        extra_bytes: Number(extra_bytes || 0)
      }
    };
    throw err;
  }
  return {
    ok: true,
    cfg,
    month,
    projected_total_cents: total,
    monthly_cap_cents: cap,
    current: {
      deploys_init,
      deploys_ready,
      deploys_reserved,
      bytes_uploaded: Number(usage.bytes_uploaded || 0),
      bytes_staged: Number(staged || 0)
    }
  };
}

// netlify/functions/push-uploadfile-background.js
var API = "https://api.netlify.com/api/v1";
function intEnv(name, dflt) {
  const n = parseInt(String(process.env[name] ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}
function retryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
function jitter(ms) {
  return ms + Math.floor(Math.random() * 200);
}
function parseRetryAfterMs(res) {
  const ra = res.headers.get("retry-after");
  if (!ra) return 0;
  const sec = parseInt(ra, 10);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(6e4, sec * 1e3);
  return 0;
}
function chunkStore() {
  return getStore({ name: "kaixu_push_chunks", consistency: "strong" });
}
async function putDeployFileStream({ deploy_id, deploy_path, bodyStream, netlify_token }) {
  const encoded = encodeURIComponentSafePath(deploy_path);
  const url = `${API}/deploys/${encodeURIComponent(deploy_id)}/files/${encoded}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${netlify_token}`,
      "content-type": "application/octet-stream"
    },
    body: bodyStream,
    duplex: "half"
  });
  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text().catch(() => "");
  return { ok: false, status: res.status, retryAfterMs: parseRetryAfterMs(res), detail: text };
}
var push_uploadfile_background_default = async (req) => {
  try {
    const secret = process.env.JOB_WORKER_SECRET;
    if (!secret) {
      try {
        await q(
          `insert into gateway_events(level, function_name, message, meta)
           values ('warn',$1,$2,'{}'::jsonb)`,
          ["push-uploadfile-background", "JOB_WORKER_SECRET not set; background worker refused"]
        );
      } catch {
      }
      return new Response("", { status: 202 });
    }
    const got = req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "";
    if (got !== secret) return new Response("", { status: 202 });
    if (req.method !== "POST") return new Response("", { status: 202 });
    const body = await req.json().catch(() => ({}));
    const pushId = (body.pushId || "").toString();
    const sha1 = (body.sha1 || "").toString().toLowerCase();
    if (!pushId || !/^[a-f0-9]{40}$/.test(sha1)) return new Response("", { status: 202 });
    let actor = "system";
    let krow = null;
    const key = getBearer(req);
    if (key) {
      const tmp = await lookupKey(key);
      if (!tmp) return new Response("", { status: 202 });
      requireKeyRole(tmp, "deployer");
      krow = tmp;
      actor = `key:${krow.key_last4}`;
    }
    const pres = await q(
      `select id, customer_id, api_key_id, deploy_id, uploaded_digests, required_digests, file_manifest
       from push_pushes where push_id=$1 limit 1`,
      [pushId]
    );
    if (!pres.rowCount) return new Response("", { status: 202 });
    const push = pres.rows[0];
    if (krow && push.customer_id !== krow.customer_id) return new Response("", { status: 202 });
    if (!krow) {
      const ak = await q(`select key_last4 from api_keys where id=$1 limit 1`, [push.api_key_id]);
      const last4 = ak.rowCount ? ak.rows[0].key_last4 : "sys";
      actor = `key:${last4}`;
    }
    if (Array.isArray(push.uploaded_digests) && push.uploaded_digests.includes(sha1)) return new Response("", { status: 202 });
    const jres = await q(
      `select id, deploy_path, parts, received_parts, part_bytes, bytes_staged, status, attempts
       from push_jobs where push_row_id=$1 and sha1=$2 limit 1`,
      [push.id, sha1]
    );
    if (!jres.rowCount) return new Response("", { status: 202 });
    const job = jres.rows[0];
    let manifest = push.file_manifest;
    if (typeof manifest === "string") {
      try {
        manifest = JSON.parse(manifest);
      } catch {
        manifest = {};
      }
    }
    if (!manifest || typeof manifest !== "object") manifest = {};
    const expected = manifest[job.deploy_path] || null;
    if (!expected) {
      await q(`update push_jobs set status='error', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`, [job.id, "Path not in manifest"]);
      return new Response("", { status: 202 });
    }
    if (expected !== sha1) {
      await q(`update push_jobs set status='error', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`, [job.id, "SHA1 does not match manifest for path"]);
      return new Response("", { status: 202 });
    }
    const required = Array.isArray(push.required_digests) ? push.required_digests : [];
    if (!required.includes(sha1)) {
      await q(`update push_jobs set status='error', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`, [job.id, "Digest not required by deploy"]);
      return new Response("", { status: 202 });
    }
    const parts = parseInt(job.parts, 10);
    const received = new Set(job.received_parts || []);
    for (let i = 0; i < parts; i++) {
      if (!received.has(i)) {
        await q(`update push_jobs set status='error', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`, [job.id, `Missing chunk part ${i}/${parts}`]);
        return new Response("", { status: 202 });
      }
    }
    const month = monthKeyUTC();
    let capInfo = null;
    try {
      capInfo = await enforcePushCap({ customer_id: push.customer_id, month, extra_deploys: 0, extra_bytes: 0 });
    } catch (e) {
      if (e?.code === "PUSH_CAP_REACHED") {
        await q(
          `update push_jobs set status='blocked_cap', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`,
          [job.id, JSON.stringify(e.payload || { error: e.message, code: e.code }).slice(0, 1200)]
        );
        return new Response("", { status: 202 });
      }
      throw e;
    }
    const maxAttempts = intEnv("PUSH_JOB_MAX_ATTEMPTS", 10);
    const currentAttempts = parseInt(job.attempts || 0, 10);
    if (currentAttempts >= maxAttempts) {
      await q(
        `update push_jobs set status='error', error=$2, last_error=$2, last_error_at=now(), updated_at=now() where id=$1`,
        [job.id, `Max attempts reached (${maxAttempts})`]
      );
      return new Response("", { status: 202 });
    }
    await q(`update push_jobs set status='assembling', error=null, attempts=attempts+1, updated_at=now() where id=$1`, [job.id]);
    const store = chunkStore();
    const deploy_path = normalizePath(job.deploy_path);
    const inlineMax = intEnv("PUSH_UPLOAD_INLINE_RETRIES", 3);
    const baseBackoff = intEnv("PUSH_JOB_RETRY_BASE_MS", 750);
    const maxBackoff = intEnv("PUSH_JOB_RETRY_MAX_MS", 3e4);
    let totalBytes = Number(job.bytes_staged || 0);
    if (!totalBytes && job.part_bytes && typeof job.part_bytes === "object") {
      totalBytes = Object.values(job.part_bytes).reduce((a, b) => a + Number(b || 0), 0);
    }
    let lastErr = null;
    for (let attempt = 1; attempt <= inlineMax; attempt++) {
      let idx = 0;
      const bodyStream = new ReadableStream({
        async pull(controller) {
          if (idx >= parts) {
            controller.close();
            return;
          }
          const key2 = `chunks/${pushId}/${sha1}/${idx}`;
          const ab = await store.get(key2, { type: "arrayBuffer" });
          if (!ab) {
            controller.error(new Error(`Missing chunk blob: ${key2}`));
            return;
          }
          controller.enqueue(new Uint8Array(ab));
          idx++;
        }
      });
      const netlify_token = await getNetlifyTokenForCustomer(push.customer_id);
      const r = await putDeployFileStream({
        deploy_id: push.deploy_id,
        deploy_path,
        bodyStream,
        netlify_token
      });
      if (r.ok) {
        await q(
          `insert into push_files(push_row_id, deploy_path, sha1, bytes, mode) values ($1,$2,$3,$4,'chunked')`,
          [push.id, deploy_path, sha1, totalBytes]
        );
        await q(
          `insert into push_usage_events(customer_id, api_key_id, push_row_id, event_type, bytes, pricing_version, cost_cents, meta)
           values ($1,$2,$3,'file_upload',$4,$6,0,$5::jsonb)`,
          [push.customer_id, push.api_key_id, push.id, totalBytes, JSON.stringify({ sha1, path: deploy_path, mode: "chunked", parts }), capInfo?.cfg?.pricing_version ?? 1]
        );
        await q(
          `update push_pushes
           set uploaded_digests = case when not (uploaded_digests @> array[$2]) then array_append(uploaded_digests, $2) else uploaded_digests end,
               updated_at = now()
           where id=$1`,
          [push.id, sha1]
        );
        try {
          for (let i = 0; i < parts; i++) {
            await store.delete(`chunks/${pushId}/${sha1}/${i}`);
          }
        } catch {
        }
        await q(`update push_jobs set status='done', error=null, last_error=null, next_attempt_at=null, bytes_staged=0, part_bytes='{}'::jsonb, updated_at=now() where id=$1`, [job.id]);
        await audit(actor, "PUSH_FILE_DONE", `push:${pushId}`, { sha1, path: deploy_path, bytes: totalBytes, mode: "chunked" });
        return new Response("", { status: 202 });
      }
      lastErr = `Netlify PUT failed (${r.status}) ${String(r.detail || "").slice(0, 300)}`;
      if (!retryableStatus(r.status) || attempt === inlineMax) {
        break;
      }
      const waitMs = r.retryAfterMs || Math.min(maxBackoff, jitter(baseBackoff * Math.pow(2, attempt - 1)));
      await sleep(waitMs);
    }
    const retryWait = Math.min(maxBackoff, jitter(baseBackoff * Math.pow(2, inlineMax)));
    const nextAt = new Date(Date.now() + retryWait).toISOString();
    const status = lastErr && lastErr.includes("Netlify PUT failed (429") || lastErr && lastErr.includes("Netlify PUT failed (50") ? "retry_wait" : "error_transient";
    await q(
      `update push_jobs
       set status=$2,
           error=$3,
           last_error=$3,
           last_error_at=now(),
           next_attempt_at=$4,
           updated_at=now()
       where id=$1`,
      [job.id, status, (lastErr || "Upload failed").slice(0, 1200), nextAt]
    );
    await audit(actor, "PUSH_FILE_RETRY_WAIT", `push:${pushId}`, { sha1, path: deploy_path, next_attempt_at: nextAt, status });
    return new Response("", { status: 202 });
  } catch (e) {
    try {
      const secret = process.env.JOB_WORKER_SECRET;
      const got = req.headers.get("x-kaixu-job-secret") || req.headers.get("x-job-worker-secret") || "";
      if (!secret || got !== secret) return new Response("", { status: 202 });
      const body = await req.json().catch(() => ({}));
      const pushId = (body.pushId || "").toString();
      const sha1 = (body.sha1 || "").toString().toLowerCase();
      if (pushId && /^[a-f0-9]{40}$/.test(sha1)) {
        const pres = await q(`select id from push_pushes where push_id=$1 limit 1`, [pushId]);
        if (pres.rowCount) {
          const job = await q(`select id from push_jobs where push_row_id=$1 and sha1=$2 limit 1`, [pres.rows[0].id, sha1]);
          if (job.rowCount) {
            await q(
              `update push_jobs set status='error_transient', error=$2, last_error=$2, last_error_at=now(), next_attempt_at=now() + interval '30 seconds', updated_at=now() where id=$1`,
              [job.rows[0].id, (e?.message || String(e)).slice(0, 1200)]
            );
          }
        }
      }
    } catch {
    }
    return new Response("", { status: 202 });
  }
};
export {
  push_uploadfile_background_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvcHVzaC11cGxvYWRmaWxlLWJhY2tncm91bmQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9kYi5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2h0dHAuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9jcnlwdG8uanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdXRoei5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL3B1c2hQYXRoTm9ybWFsaXplLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvcHVzaFBhdGguanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdWRpdC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL25ldGxpZnlUb2tlbnMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9wdXNoQ2Fwcy5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZ2V0U3RvcmUgfSBmcm9tIFwiQG5ldGxpZnkvYmxvYnNcIjtcbmltcG9ydCB7IHEgfSBmcm9tIFwiLi9fbGliL2RiLmpzXCI7XG5pbXBvcnQgeyBnZXRCZWFyZXIsIG1vbnRoS2V5VVRDLCBzbGVlcCB9IGZyb20gXCIuL19saWIvaHR0cC5qc1wiO1xuaW1wb3J0IHsgbG9va3VwS2V5LCByZXF1aXJlS2V5Um9sZSB9IGZyb20gXCIuL19saWIvYXV0aHouanNcIjtcbmltcG9ydCB7IG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwiLi9fbGliL3B1c2hQYXRoTm9ybWFsaXplLmpzXCI7XG5pbXBvcnQgeyBlbmNvZGVVUklDb21wb25lbnRTYWZlUGF0aCB9IGZyb20gXCIuL19saWIvcHVzaFBhdGguanNcIjtcbmltcG9ydCB7IGF1ZGl0IH0gZnJvbSBcIi4vX2xpYi9hdWRpdC5qc1wiO1xuaW1wb3J0IHsgZ2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIgfSBmcm9tIFwiLi9fbGliL25ldGxpZnlUb2tlbnMuanNcIjtcbmltcG9ydCB7IGVuZm9yY2VQdXNoQ2FwIH0gZnJvbSBcIi4vX2xpYi9wdXNoQ2Fwcy5qc1wiO1xuXG5jb25zdCBBUEkgPSBcImh0dHBzOi8vYXBpLm5ldGxpZnkuY29tL2FwaS92MVwiO1xuXG5mdW5jdGlvbiBpbnRFbnYobmFtZSwgZGZsdCkge1xuICBjb25zdCBuID0gcGFyc2VJbnQoU3RyaW5nKHByb2Nlc3MuZW52W25hbWVdID8/IFwiXCIpLCAxMCk7XG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUobikgJiYgbiA+PSAwID8gbiA6IGRmbHQ7XG59XG5cbmZ1bmN0aW9uIHJldHJ5YWJsZVN0YXR1cyhzdGF0dXMpIHtcbiAgcmV0dXJuIHN0YXR1cyA9PT0gNDI5IHx8IHN0YXR1cyA9PT0gNTAyIHx8IHN0YXR1cyA9PT0gNTAzIHx8IHN0YXR1cyA9PT0gNTA0O1xufVxuXG5mdW5jdGlvbiBqaXR0ZXIobXMpIHtcbiAgcmV0dXJuIG1zICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjAwKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VSZXRyeUFmdGVyTXMocmVzKSB7XG4gIGNvbnN0IHJhID0gcmVzLmhlYWRlcnMuZ2V0KFwicmV0cnktYWZ0ZXJcIik7XG4gIGlmICghcmEpIHJldHVybiAwO1xuICBjb25zdCBzZWMgPSBwYXJzZUludChyYSwgMTApO1xuICBpZiAoTnVtYmVyLmlzRmluaXRlKHNlYykgJiYgc2VjID49IDApIHJldHVybiBNYXRoLm1pbig2MDAwMCwgc2VjICogMTAwMCk7XG4gIHJldHVybiAwO1xufVxuXG5mdW5jdGlvbiBjaHVua1N0b3JlKCkge1xuICByZXR1cm4gZ2V0U3RvcmUoeyBuYW1lOiBcImthaXh1X3B1c2hfY2h1bmtzXCIsIGNvbnNpc3RlbmN5OiBcInN0cm9uZ1wiIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwdXREZXBsb3lGaWxlU3RyZWFtKHsgZGVwbG95X2lkLCBkZXBsb3lfcGF0aCwgYm9keVN0cmVhbSwgbmV0bGlmeV90b2tlbiB9KSB7XG4gIGNvbnN0IGVuY29kZWQgPSBlbmNvZGVVUklDb21wb25lbnRTYWZlUGF0aChkZXBsb3lfcGF0aCk7XG4gIGNvbnN0IHVybCA9IGAke0FQSX0vZGVwbG95cy8ke2VuY29kZVVSSUNvbXBvbmVudChkZXBsb3lfaWQpfS9maWxlcy8ke2VuY29kZWR9YDtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICBtZXRob2Q6IFwiUFVUXCIsXG4gICAgaGVhZGVyczoge1xuICAgICAgYXV0aG9yaXphdGlvbjogYEJlYXJlciAke25ldGxpZnlfdG9rZW59YCxcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCJcbiAgICB9LFxuICAgIGJvZHk6IGJvZHlTdHJlYW0sXG4gICAgZHVwbGV4OiBcImhhbGZcIlxuICB9KTtcblxuICBpZiAocmVzLm9rKSByZXR1cm4geyBvazogdHJ1ZSwgc3RhdHVzOiByZXMuc3RhdHVzIH07XG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICByZXR1cm4geyBvazogZmFsc2UsIHN0YXR1czogcmVzLnN0YXR1cywgcmV0cnlBZnRlck1zOiBwYXJzZVJldHJ5QWZ0ZXJNcyhyZXMpLCBkZXRhaWw6IHRleHQgfTtcbn1cblxuLyoqXG4gKiBCYWNrZ3JvdW5kIHdvcmtlciB0aGF0IGFzc2VtYmxlcyBzdGFnZWQgY2h1bmtzIGZyb20gTmV0bGlmeSBCbG9icyBhbmQgdXBsb2FkcyB0byBOZXRsaWZ5LlxuICpcbiAqIFY0IFJlbGlhYmlsaXR5OlxuICogLSBSZXRyaWVzIHN0cmVhbWluZyBQVVQgYnkgUkVDT05TVFJVQ1RJTkcgYSBmcmVzaCBSZWFkYWJsZVN0cmVhbSBlYWNoIGF0dGVtcHQgKG5vIHN0cmVhbSByZXBsYXkpLlxuICogLSBNYXJrcyB0cmFuc2llbnQgZmFpbHVyZXMgYXMgcmV0cnlfd2FpdCB3aXRoIG5leHRfYXR0ZW1wdF9hdCBzbyBhIHNjaGVkdWxlciBjYW4gcmVxdWV1ZS5cbiAqIC0gQWNjZXB0cyBpbnRlcm5hbCBzZWNyZXQtb25seSBpbnZvY2F0aW9uIChubyBCZWFyZXIpIGZvciBzY2hlZHVsZWQgcmVxdWV1ZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgKHJlcSkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpPQl9XT1JLRVJfU0VDUkVUO1xuICAgIGlmICghc2VjcmV0KSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBxKFxuICAgICAgICAgIGBpbnNlcnQgaW50byBnYXRld2F5X2V2ZW50cyhsZXZlbCwgZnVuY3Rpb25fbmFtZSwgbWVzc2FnZSwgbWV0YSlcbiAgICAgICAgICAgdmFsdWVzICgnd2FybicsJDEsJDIsJ3t9Jzo6anNvbmIpYCxcbiAgICAgICAgICBbXCJwdXNoLXVwbG9hZGZpbGUtYmFja2dyb3VuZFwiLCBcIkpPQl9XT1JLRVJfU0VDUkVUIG5vdCBzZXQ7IGJhY2tncm91bmQgd29ya2VyIHJlZnVzZWRcIl1cbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG4gICAgY29uc3QgZ290ID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtam9iLXNlY3JldFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LWpvYi13b3JrZXItc2VjcmV0XCIpIHx8IFwiXCIpO1xuICAgIGlmIChnb3QgIT09IHNlY3JldCkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBjb25zdCBwdXNoSWQgPSAoYm9keS5wdXNoSWQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgICBjb25zdCBzaGExID0gKGJvZHkuc2hhMSB8fCBcIlwiKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKCFwdXNoSWQgfHwgIS9eW2EtZjAtOV17NDB9JC8udGVzdChzaGExKSkgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuXG4gICAgLy8gT3B0aW9uYWw6IGlmIGEgQmVhcmVyIGtleSBpcyBwcmVzZW50LCB2YWxpZGF0ZSBpdC4gSWYgYWJzZW50LCBhbGxvdyBzZWNyZXQtb25seSBzeXN0ZW0gaW52b2NhdGlvbi5cbiAgICBsZXQgYWN0b3IgPSBcInN5c3RlbVwiO1xuICAgIGxldCBrcm93ID0gbnVsbDtcbiAgICBjb25zdCBrZXkgPSBnZXRCZWFyZXIocmVxKTtcbiAgICBpZiAoa2V5KSB7XG4gICAgICBjb25zdCB0bXAgPSBhd2FpdCBsb29rdXBLZXkoa2V5KTtcbiAgICAgIGlmICghdG1wKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgICByZXF1aXJlS2V5Um9sZSh0bXAsIFwiZGVwbG95ZXJcIik7XG4gICAgICBrcm93ID0gdG1wO1xuICAgICAgYWN0b3IgPSBga2V5OiR7a3Jvdy5rZXlfbGFzdDR9YDtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVzID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBkZXBsb3lfaWQsIHVwbG9hZGVkX2RpZ2VzdHMsIHJlcXVpcmVkX2RpZ2VzdHMsIGZpbGVfbWFuaWZlc3RcbiAgICAgICBmcm9tIHB1c2hfcHVzaGVzIHdoZXJlIHB1c2hfaWQ9JDEgbGltaXQgMWAsXG4gICAgICBbcHVzaElkXVxuICAgICk7XG4gICAgaWYgKCFwcmVzLnJvd0NvdW50KSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgY29uc3QgcHVzaCA9IHByZXMucm93c1swXTtcblxuICAgIC8vIElmIGludm9rZWQgd2l0aCBhIEJlYXJlciBrZXksIGVuZm9yY2UgdGVuYW50IG1hdGNoLlxuICAgIGlmIChrcm93ICYmIHB1c2guY3VzdG9tZXJfaWQgIT09IGtyb3cuY3VzdG9tZXJfaWQpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcblxuICAgIC8vIFJlc29sdmUgYWN0b3Iga2V5X2xhc3Q0IGlmIHN5c3RlbSBpbnZvY2F0aW9uLlxuICAgIGlmICgha3Jvdykge1xuICAgICAgY29uc3QgYWsgPSBhd2FpdCBxKGBzZWxlY3Qga2V5X2xhc3Q0IGZyb20gYXBpX2tleXMgd2hlcmUgaWQ9JDEgbGltaXQgMWAsIFtwdXNoLmFwaV9rZXlfaWRdKTtcbiAgICAgIGNvbnN0IGxhc3Q0ID0gYWsucm93Q291bnQgPyBhay5yb3dzWzBdLmtleV9sYXN0NCA6IFwic3lzXCI7XG4gICAgICBhY3RvciA9IGBrZXk6JHtsYXN0NH1gO1xuICAgIH1cblxuICAgIC8vIFNraXAgaWYgYWxyZWFkeSB1cGxvYWRlZFxuICAgIGlmIChBcnJheS5pc0FycmF5KHB1c2gudXBsb2FkZWRfZGlnZXN0cykgJiYgcHVzaC51cGxvYWRlZF9kaWdlc3RzLmluY2x1ZGVzKHNoYTEpKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICBjb25zdCBqcmVzID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgaWQsIGRlcGxveV9wYXRoLCBwYXJ0cywgcmVjZWl2ZWRfcGFydHMsIHBhcnRfYnl0ZXMsIGJ5dGVzX3N0YWdlZCwgc3RhdHVzLCBhdHRlbXB0c1xuICAgICAgIGZyb20gcHVzaF9qb2JzIHdoZXJlIHB1c2hfcm93X2lkPSQxIGFuZCBzaGExPSQyIGxpbWl0IDFgLFxuICAgICAgW3B1c2guaWQsIHNoYTFdXG4gICAgKTtcbiAgICBpZiAoIWpyZXMucm93Q291bnQpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICBjb25zdCBqb2IgPSBqcmVzLnJvd3NbMF07XG5cbiAgICAvLyBNYW5pZmVzdCBlbmZvcmNlbWVudFxuICAgIGxldCBtYW5pZmVzdCA9IHB1c2guZmlsZV9tYW5pZmVzdDtcbiAgICBpZiAodHlwZW9mIG1hbmlmZXN0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICB0cnkgeyBtYW5pZmVzdCA9IEpTT04ucGFyc2UobWFuaWZlc3QpOyB9IGNhdGNoIHsgbWFuaWZlc3QgPSB7fTsgfVxuICAgIH1cbiAgICBpZiAoIW1hbmlmZXN0IHx8IHR5cGVvZiBtYW5pZmVzdCAhPT0gXCJvYmplY3RcIikgbWFuaWZlc3QgPSB7fTtcbiAgICBjb25zdCBleHBlY3RlZCA9IG1hbmlmZXN0W2pvYi5kZXBsb3lfcGF0aF0gfHwgbnVsbDtcbiAgICBpZiAoIWV4cGVjdGVkKSB7XG4gICAgICBhd2FpdCBxKGB1cGRhdGUgcHVzaF9qb2JzIHNldCBzdGF0dXM9J2Vycm9yJywgZXJyb3I9JDIsIGxhc3RfZXJyb3I9JDIsIGxhc3RfZXJyb3JfYXQ9bm93KCksIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLCBbam9iLmlkLCBcIlBhdGggbm90IGluIG1hbmlmZXN0XCJdKTtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICB9XG4gICAgaWYgKGV4cGVjdGVkICE9PSBzaGExKSB7XG4gICAgICBhd2FpdCBxKGB1cGRhdGUgcHVzaF9qb2JzIHNldCBzdGF0dXM9J2Vycm9yJywgZXJyb3I9JDIsIGxhc3RfZXJyb3I9JDIsIGxhc3RfZXJyb3JfYXQ9bm93KCksIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLCBbam9iLmlkLCBcIlNIQTEgZG9lcyBub3QgbWF0Y2ggbWFuaWZlc3QgZm9yIHBhdGhcIl0pO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgIH1cbiAgICBjb25zdCByZXF1aXJlZCA9IEFycmF5LmlzQXJyYXkocHVzaC5yZXF1aXJlZF9kaWdlc3RzKSA/IHB1c2gucmVxdWlyZWRfZGlnZXN0cyA6IFtdO1xuICAgIGlmICghcmVxdWlyZWQuaW5jbHVkZXMoc2hhMSkpIHtcbiAgICAgIGF3YWl0IHEoYHVwZGF0ZSBwdXNoX2pvYnMgc2V0IHN0YXR1cz0nZXJyb3InLCBlcnJvcj0kMiwgbGFzdF9lcnJvcj0kMiwgbGFzdF9lcnJvcl9hdD1ub3coKSwgdXBkYXRlZF9hdD1ub3coKSB3aGVyZSBpZD0kMWAsIFtqb2IuaWQsIFwiRGlnZXN0IG5vdCByZXF1aXJlZCBieSBkZXBsb3lcIl0pO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnRzID0gcGFyc2VJbnQoam9iLnBhcnRzLCAxMCk7XG4gICAgY29uc3QgcmVjZWl2ZWQgPSBuZXcgU2V0KGpvYi5yZWNlaXZlZF9wYXJ0cyB8fCBbXSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0czsgaSsrKSB7XG4gICAgICBpZiAoIXJlY2VpdmVkLmhhcyhpKSkge1xuICAgICAgICBhd2FpdCBxKGB1cGRhdGUgcHVzaF9qb2JzIHNldCBzdGF0dXM9J2Vycm9yJywgZXJyb3I9JDIsIGxhc3RfZXJyb3I9JDIsIGxhc3RfZXJyb3JfYXQ9bm93KCksIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLCBbam9iLmlkLCBgTWlzc2luZyBjaHVuayBwYXJ0ICR7aX0vJHtwYXJ0c31gXSk7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwMiB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYXAgZW5mb3JjZW1lbnQgKGJ5dGVzIHN0YWdlZCBhcmUgYWxyZWFkeSBjb3VudGVkIGluIGVuZm9yY2VQdXNoQ2FwIHZpYSBwdXNoX2pvYnMgYnl0ZXNfc3RhZ2VkKVxuICAgIGNvbnN0IG1vbnRoID0gbW9udGhLZXlVVEMoKTtcbiAgICBsZXQgY2FwSW5mbyA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIGNhcEluZm8gPSBhd2FpdCBlbmZvcmNlUHVzaENhcCh7IGN1c3RvbWVyX2lkOiBwdXNoLmN1c3RvbWVyX2lkLCBtb250aCwgZXh0cmFfZGVwbG95czogMCwgZXh0cmFfYnl0ZXM6IDAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGU/LmNvZGUgPT09IFwiUFVTSF9DQVBfUkVBQ0hFRFwiKSB7XG4gICAgICAgIGF3YWl0IHEoYHVwZGF0ZSBwdXNoX2pvYnMgc2V0IHN0YXR1cz0nYmxvY2tlZF9jYXAnLCBlcnJvcj0kMiwgbGFzdF9lcnJvcj0kMiwgbGFzdF9lcnJvcl9hdD1ub3coKSwgdXBkYXRlZF9hdD1ub3coKSB3aGVyZSBpZD0kMWAsXG4gICAgICAgICAgW2pvYi5pZCwgSlNPTi5zdHJpbmdpZnkoZS5wYXlsb2FkIHx8IHsgZXJyb3I6IGUubWVzc2FnZSwgY29kZTogZS5jb2RlIH0pLnNsaWNlKDAsIDEyMDApXVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIC8vIE1hcmsgYXNzZW1ibGluZyBhbmQgaW5jcmVtZW50IGF0dGVtcHRzIGZvciB0aGlzIHdvcmtlciBydW5cbiAgICBjb25zdCBtYXhBdHRlbXB0cyA9IGludEVudihcIlBVU0hfSk9CX01BWF9BVFRFTVBUU1wiLCAxMCk7XG4gICAgY29uc3QgY3VycmVudEF0dGVtcHRzID0gcGFyc2VJbnQoam9iLmF0dGVtcHRzIHx8IDAsIDEwKTtcbiAgICBpZiAoY3VycmVudEF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICBhd2FpdCBxKGB1cGRhdGUgcHVzaF9qb2JzIHNldCBzdGF0dXM9J2Vycm9yJywgZXJyb3I9JDIsIGxhc3RfZXJyb3I9JDIsIGxhc3RfZXJyb3JfYXQ9bm93KCksIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLFxuICAgICAgICBbam9iLmlkLCBgTWF4IGF0dGVtcHRzIHJlYWNoZWQgKCR7bWF4QXR0ZW1wdHN9KWBdXG4gICAgICApO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgIH1cblxuICAgIGF3YWl0IHEoYHVwZGF0ZSBwdXNoX2pvYnMgc2V0IHN0YXR1cz0nYXNzZW1ibGluZycsIGVycm9yPW51bGwsIGF0dGVtcHRzPWF0dGVtcHRzKzEsIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLCBbam9iLmlkXSk7XG5cbiAgICBjb25zdCBzdG9yZSA9IGNodW5rU3RvcmUoKTtcbiAgICBjb25zdCBkZXBsb3lfcGF0aCA9IG5vcm1hbGl6ZVBhdGgoam9iLmRlcGxveV9wYXRoKTtcblxuICAgIGNvbnN0IGlubGluZU1heCA9IGludEVudihcIlBVU0hfVVBMT0FEX0lOTElORV9SRVRSSUVTXCIsIDMpO1xuICAgIGNvbnN0IGJhc2VCYWNrb2ZmID0gaW50RW52KFwiUFVTSF9KT0JfUkVUUllfQkFTRV9NU1wiLCA3NTApO1xuICAgIGNvbnN0IG1heEJhY2tvZmYgPSBpbnRFbnYoXCJQVVNIX0pPQl9SRVRSWV9NQVhfTVNcIiwgMzAwMDApO1xuXG4gICAgLy8gV2UgY2FuIHJlYnVpbGQgYSBmcmVzaCBzdHJlYW0gZWFjaCBhdHRlbXB0IGJ5IHJlLXJlYWRpbmcgY2h1bmtzLiBUaGlzIHNvbHZlcyB0aGUgXCJzdHJlYW0gcmVwbGF5XCIgcHJvYmxlbS5cbiAgICBsZXQgdG90YWxCeXRlcyA9IE51bWJlcihqb2IuYnl0ZXNfc3RhZ2VkIHx8IDApO1xuICAgIGlmICghdG90YWxCeXRlcyAmJiBqb2IucGFydF9ieXRlcyAmJiB0eXBlb2Ygam9iLnBhcnRfYnl0ZXMgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHRvdGFsQnl0ZXMgPSBPYmplY3QudmFsdWVzKGpvYi5wYXJ0X2J5dGVzKS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBOdW1iZXIoYiB8fCAwKSwgMCk7XG4gICAgfVxuXG4gICAgbGV0IGxhc3RFcnIgPSBudWxsO1xuICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IGlubGluZU1heDsgYXR0ZW1wdCsrKSB7XG4gICAgICBsZXQgaWR4ID0gMDtcbiAgICAgIGNvbnN0IGJvZHlTdHJlYW0gPSBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgICAgICBhc3luYyBwdWxsKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICBpZiAoaWR4ID49IHBhcnRzKSB7XG4gICAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGtleSA9IGBjaHVua3MvJHtwdXNoSWR9LyR7c2hhMX0vJHtpZHh9YDtcbiAgICAgICAgICBjb25zdCBhYiA9IGF3YWl0IHN0b3JlLmdldChrZXksIHsgdHlwZTogXCJhcnJheUJ1ZmZlclwiIH0pO1xuICAgICAgICAgIGlmICghYWIpIHtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuZXJyb3IobmV3IEVycm9yKGBNaXNzaW5nIGNodW5rIGJsb2I6ICR7a2V5fWApKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKG5ldyBVaW50OEFycmF5KGFiKSk7XG4gICAgICAgICAgaWR4Kys7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBuZXRsaWZ5X3Rva2VuID0gYXdhaXQgZ2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIocHVzaC5jdXN0b21lcl9pZCk7XG5cbiAgICAgIGNvbnN0IHIgPSBhd2FpdCBwdXREZXBsb3lGaWxlU3RyZWFtKHtcbiAgICAgICAgZGVwbG95X2lkOiBwdXNoLmRlcGxveV9pZCxcbiAgICAgICAgZGVwbG95X3BhdGgsXG4gICAgICAgIGJvZHlTdHJlYW0sXG4gICAgICAgIG5ldGxpZnlfdG9rZW5cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoci5vaykge1xuICAgICAgICAvLyByZWNvcmQgZmlsZSArIHVzYWdlXG4gICAgICAgIGF3YWl0IHEoXG4gICAgICAgICAgYGluc2VydCBpbnRvIHB1c2hfZmlsZXMocHVzaF9yb3dfaWQsIGRlcGxveV9wYXRoLCBzaGExLCBieXRlcywgbW9kZSkgdmFsdWVzICgkMSwkMiwkMywkNCwnY2h1bmtlZCcpYCxcbiAgICAgICAgICBbcHVzaC5pZCwgZGVwbG95X3BhdGgsIHNoYTEsIHRvdGFsQnl0ZXNdXG4gICAgICAgICk7XG4gICAgICAgIGF3YWl0IHEoXG4gICAgICAgICAgYGluc2VydCBpbnRvIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwdXNoX3Jvd19pZCwgZXZlbnRfdHlwZSwgYnl0ZXMsIHByaWNpbmdfdmVyc2lvbiwgY29zdF9jZW50cywgbWV0YSlcbiAgICAgICAgICAgdmFsdWVzICgkMSwkMiwkMywnZmlsZV91cGxvYWQnLCQ0LCQ2LDAsJDU6Ompzb25iKWAsXG4gICAgICAgICAgW3B1c2guY3VzdG9tZXJfaWQsIHB1c2guYXBpX2tleV9pZCwgcHVzaC5pZCwgdG90YWxCeXRlcywgSlNPTi5zdHJpbmdpZnkoeyBzaGExLCBwYXRoOiBkZXBsb3lfcGF0aCwgbW9kZTogXCJjaHVua2VkXCIsIHBhcnRzIH0pLCAoY2FwSW5mbz8uY2ZnPy5wcmljaW5nX3ZlcnNpb24gPz8gMSldXG4gICAgICAgICk7XG4gICAgICAgIGF3YWl0IHEoXG4gICAgICAgICAgYHVwZGF0ZSBwdXNoX3B1c2hlc1xuICAgICAgICAgICBzZXQgdXBsb2FkZWRfZGlnZXN0cyA9IGNhc2Ugd2hlbiBub3QgKHVwbG9hZGVkX2RpZ2VzdHMgQD4gYXJyYXlbJDJdKSB0aGVuIGFycmF5X2FwcGVuZCh1cGxvYWRlZF9kaWdlc3RzLCAkMikgZWxzZSB1cGxvYWRlZF9kaWdlc3RzIGVuZCxcbiAgICAgICAgICAgICAgIHVwZGF0ZWRfYXQgPSBub3coKVxuICAgICAgICAgICB3aGVyZSBpZD0kMWAsXG4gICAgICAgICAgW3B1c2guaWQsIHNoYTFdXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gY2xlYW51cCBibG9icyBiZXN0LWVmZm9ydFxuICAgICAgICB0cnkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHM7IGkrKykge1xuICAgICAgICAgICAgYXdhaXQgc3RvcmUuZGVsZXRlKGBjaHVua3MvJHtwdXNoSWR9LyR7c2hhMX0vJHtpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgIGF3YWl0IHEoYHVwZGF0ZSBwdXNoX2pvYnMgc2V0IHN0YXR1cz0nZG9uZScsIGVycm9yPW51bGwsIGxhc3RfZXJyb3I9bnVsbCwgbmV4dF9hdHRlbXB0X2F0PW51bGwsIGJ5dGVzX3N0YWdlZD0wLCBwYXJ0X2J5dGVzPSd7fSc6Ompzb25iLCB1cGRhdGVkX2F0PW5vdygpIHdoZXJlIGlkPSQxYCwgW2pvYi5pZF0pO1xuXG4gICAgICAgIGF3YWl0IGF1ZGl0KGFjdG9yLCBcIlBVU0hfRklMRV9ET05FXCIsIGBwdXNoOiR7cHVzaElkfWAsIHsgc2hhMSwgcGF0aDogZGVwbG95X3BhdGgsIGJ5dGVzOiB0b3RhbEJ5dGVzLCBtb2RlOiBcImNodW5rZWRcIiB9KTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICAgICAgfVxuXG4gICAgICBsYXN0RXJyID0gYE5ldGxpZnkgUFVUIGZhaWxlZCAoJHtyLnN0YXR1c30pICR7U3RyaW5nKHIuZGV0YWlsIHx8IFwiXCIpLnNsaWNlKDAsIDMwMCl9YDtcbiAgICAgIC8vIFJldHJ5IG9ubHkgb24gcmV0cnlhYmxlIHN0YXR1c2VzLiBNaXNzaW5nIGNodW5rcyBldGMgd29uJ3QgcmVhY2ggaGVyZS5cbiAgICAgIGlmICghcmV0cnlhYmxlU3RhdHVzKHIuc3RhdHVzKSB8fCBhdHRlbXB0ID09PSBpbmxpbmVNYXgpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEJhY2tvZmYgd2l0aCBSZXRyeS1BZnRlciBwcmVmZXJlbmNlLlxuICAgICAgY29uc3Qgd2FpdE1zID0gci5yZXRyeUFmdGVyTXMgfHwgTWF0aC5taW4obWF4QmFja29mZiwgaml0dGVyKGJhc2VCYWNrb2ZmICogTWF0aC5wb3coMiwgYXR0ZW1wdCAtIDEpKSk7XG4gICAgICBhd2FpdCBzbGVlcCh3YWl0TXMpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIHJlYWNoZWQgaGVyZTogaXQgZmFpbGVkLlxuICAgIGNvbnN0IHJldHJ5V2FpdCA9IE1hdGgubWluKG1heEJhY2tvZmYsIGppdHRlcihiYXNlQmFja29mZiAqIE1hdGgucG93KDIsIGlubGluZU1heCkpKTtcbiAgICBjb25zdCBuZXh0QXQgPSBuZXcgRGF0ZShEYXRlLm5vdygpICsgcmV0cnlXYWl0KS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gTWFyayBhcyByZXRyeWFibGUgaWYgaXQgbG9va3MgdHJhbnNpZW50OyBvdGhlcndpc2UgbWFyayBlcnJvci5cbiAgICBjb25zdCBzdGF0dXMgPSAobGFzdEVyciAmJiBsYXN0RXJyLmluY2x1ZGVzKFwiTmV0bGlmeSBQVVQgZmFpbGVkICg0MjlcIikpIHx8IChsYXN0RXJyICYmIGxhc3RFcnIuaW5jbHVkZXMoXCJOZXRsaWZ5IFBVVCBmYWlsZWQgKDUwXCIpKVxuICAgICAgPyBcInJldHJ5X3dhaXRcIlxuICAgICAgOiBcImVycm9yX3RyYW5zaWVudFwiO1xuXG4gICAgYXdhaXQgcShcbiAgICAgIGB1cGRhdGUgcHVzaF9qb2JzXG4gICAgICAgc2V0IHN0YXR1cz0kMixcbiAgICAgICAgICAgZXJyb3I9JDMsXG4gICAgICAgICAgIGxhc3RfZXJyb3I9JDMsXG4gICAgICAgICAgIGxhc3RfZXJyb3JfYXQ9bm93KCksXG4gICAgICAgICAgIG5leHRfYXR0ZW1wdF9hdD0kNCxcbiAgICAgICAgICAgdXBkYXRlZF9hdD1ub3coKVxuICAgICAgIHdoZXJlIGlkPSQxYCxcbiAgICAgIFtqb2IuaWQsIHN0YXR1cywgKGxhc3RFcnIgfHwgXCJVcGxvYWQgZmFpbGVkXCIpLnNsaWNlKDAsIDEyMDApLCBuZXh0QXRdXG4gICAgKTtcblxuICAgIGF3YWl0IGF1ZGl0KGFjdG9yLCBcIlBVU0hfRklMRV9SRVRSWV9XQUlUXCIsIGBwdXNoOiR7cHVzaElkfWAsIHsgc2hhMSwgcGF0aDogZGVwbG95X3BhdGgsIG5leHRfYXR0ZW1wdF9hdDogbmV4dEF0LCBzdGF0dXMgfSk7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjAyIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gYmVzdC1lZmZvcnQ6IHJlY29yZCBlcnJvciBzdGF0ZSBpZiBwb3NzaWJsZVxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KT0JfV09SS0VSX1NFQ1JFVDtcbiAgICAgIGNvbnN0IGdvdCA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWpvYi1zZWNyZXRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwieC1qb2Itd29ya2VyLXNlY3JldFwiKSB8fCBcIlwiKTtcbiAgICAgIGlmICghc2VjcmV0IHx8IGdvdCAhPT0gc2VjcmV0KSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG5cbiAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXEuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgICAgY29uc3QgcHVzaElkID0gKGJvZHkucHVzaElkIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gICAgICBjb25zdCBzaGExID0gKGJvZHkuc2hhMSB8fCBcIlwiKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAocHVzaElkICYmIC9eW2EtZjAtOV17NDB9JC8udGVzdChzaGExKSkge1xuICAgICAgICBjb25zdCBwcmVzID0gYXdhaXQgcShgc2VsZWN0IGlkIGZyb20gcHVzaF9wdXNoZXMgd2hlcmUgcHVzaF9pZD0kMSBsaW1pdCAxYCwgW3B1c2hJZF0pO1xuICAgICAgICBpZiAocHJlcy5yb3dDb3VudCkge1xuICAgICAgICAgIGNvbnN0IGpvYiA9IGF3YWl0IHEoYHNlbGVjdCBpZCBmcm9tIHB1c2hfam9icyB3aGVyZSBwdXNoX3Jvd19pZD0kMSBhbmQgc2hhMT0kMiBsaW1pdCAxYCwgW3ByZXMucm93c1swXS5pZCwgc2hhMV0pO1xuICAgICAgICAgIGlmIChqb2Iucm93Q291bnQpIHtcbiAgICAgICAgICAgIGF3YWl0IHEoXG4gICAgICAgICAgICAgIGB1cGRhdGUgcHVzaF9qb2JzIHNldCBzdGF0dXM9J2Vycm9yX3RyYW5zaWVudCcsIGVycm9yPSQyLCBsYXN0X2Vycm9yPSQyLCBsYXN0X2Vycm9yX2F0PW5vdygpLCBuZXh0X2F0dGVtcHRfYXQ9bm93KCkgKyBpbnRlcnZhbCAnMzAgc2Vjb25kcycsIHVwZGF0ZWRfYXQ9bm93KCkgd2hlcmUgaWQ9JDFgLFxuICAgICAgICAgICAgICBbam9iLnJvd3NbMF0uaWQsIChlPy5tZXNzYWdlIHx8IFN0cmluZyhlKSkuc2xpY2UoMCwgMTIwMCldXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2gge31cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDIgfSk7XG4gIH1cbn07XG4iLCAiaW1wb3J0IHsgbmVvbiB9IGZyb20gXCJAbmV0bGlmeS9uZW9uXCI7XG5cbi8qKlxuICogTmV0bGlmeSBEQiAoTmVvbiBQb3N0Z3JlcykgaGVscGVyLlxuICpcbiAqIElNUE9SVEFOVCAoTmVvbiBzZXJ2ZXJsZXNzIGRyaXZlciwgMjAyNSspOlxuICogLSBgbmVvbigpYCByZXR1cm5zIGEgdGFnZ2VkLXRlbXBsYXRlIHF1ZXJ5IGZ1bmN0aW9uLlxuICogLSBGb3IgZHluYW1pYyBTUUwgc3RyaW5ncyArICQxIHBsYWNlaG9sZGVycywgdXNlIGBzcWwucXVlcnkodGV4dCwgcGFyYW1zKWAuXG4gKiAgIChDYWxsaW5nIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBsaWtlIHNxbChcIlNFTEVDVCAuLi5cIikgY2FuIGJyZWFrIG9uIG5ld2VyIGRyaXZlciB2ZXJzaW9ucy4pXG4gKlxuICogTmV0bGlmeSBEQiBhdXRvbWF0aWNhbGx5IGluamVjdHMgYE5FVExJRllfREFUQUJBU0VfVVJMYCB3aGVuIHRoZSBOZW9uIGV4dGVuc2lvbiBpcyBhdHRhY2hlZC5cbiAqL1xuXG5sZXQgX3NxbCA9IG51bGw7XG5sZXQgX3NjaGVtYVByb21pc2UgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRTcWwoKSB7XG4gIGlmIChfc3FsKSByZXR1cm4gX3NxbDtcblxuICBjb25zdCBoYXNEYlVybCA9ICEhKHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCk7XG4gIGlmICghaGFzRGJVcmwpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJEYXRhYmFzZSBub3QgY29uZmlndXJlZCAobWlzc2luZyBORVRMSUZZX0RBVEFCQVNFX1VSTCkuIEF0dGFjaCBOZXRsaWZ5IERCIChOZW9uKSB0byB0aGlzIHNpdGUuXCIpO1xuICAgIGVyci5jb2RlID0gXCJEQl9OT1RfQ09ORklHVVJFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIk5ldGxpZnkgVUkgXHUyMTkyIEV4dGVuc2lvbnMgXHUyMTkyIE5lb24gXHUyMTkyIEFkZCBkYXRhYmFzZSAob3IgcnVuOiBucHggbmV0bGlmeSBkYiBpbml0KS5cIjtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBfc3FsID0gbmVvbigpOyAvLyBhdXRvLXVzZXMgcHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgb24gTmV0bGlmeVxuICByZXR1cm4gX3NxbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlU2NoZW1hKCkge1xuICBpZiAoX3NjaGVtYVByb21pc2UpIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcblxuICBfc2NoZW1hUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGVtYWlsIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwbGFuX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdzdGFydGVyJyxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDIwMDAsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgc3RyaXBlX2N1c3RvbWVyX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdWJzY3JpcHRpb25faWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N0YXR1cyB0ZXh0LFxuICAgICAgICBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6LFxuICAgICAgICBhdXRvX3RvcHVwX2VuYWJsZWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlLFxuICAgICAgICBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBhdXRvX3RvcHVwX3RocmVzaG9sZF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhcGlfa2V5cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAga2V5X2hhc2ggdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGtleV9sYXN0NCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBsYWJlbCB0ZXh0LFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBycG1fbGltaXQgaW50ZWdlcixcbiAgICAgICAgcnBkX2xpbWl0IGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0elxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX2N1c3RvbWVyX2lkX2lkeCBvbiBhcGlfa2V5cyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X3VzYWdlIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGV4dHJhX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZSAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2VfY3VzdG9tZXJfbW9udGhfaWR4IG9uIG1vbnRobHlfa2V5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBtb250aGx5X2tleV91c2FnZSBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2tleV9pZHggb24gdXNhZ2VfZXZlbnRzKGFwaV9rZXlfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGFjdG9yIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFjdGlvbiB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0YXJnZXQgdGV4dCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHNfY3JlYXRlZF9pZHggb24gYXVkaXRfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgd2luZG93X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzX3dpbmRvd19pZHggb24gcmF0ZV9saW1pdF93aW5kb3dzKHdpbmRvd19zdGFydCBkZXNjKTtgLCAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGluc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXBfaGFzaCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1YSB0ZXh0O2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2luc3RhbGxfaWR4IG9uIHVzYWdlX2V2ZW50cyhpbnN0YWxsX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFsZXJ0c19zZW50IChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFsZXJ0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICAgKTtgLFxuICAgIFxuICAgICAgLy8gLS0tIERldmljZSBiaW5kaW5nIC8gc2VhdHMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlc19wZXJfa2V5IGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2U7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMga2V5X2RldmljZXMgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgaW5zdGFsbF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBkZXZpY2VfbGFiZWwgdGV4dCxcbiAgICAgICAgZmlyc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3Rfc2Vlbl91YSB0ZXh0LFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXZva2VkX2J5IHRleHQsXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2N1c3RvbWVyX2lkeCBvbiBrZXlfZGV2aWNlcyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19sYXN0X3NlZW5faWR4IG9uIGtleV9kZXZpY2VzKGxhc3Rfc2Vlbl9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gSW52b2ljZSBzbmFwc2hvdHMgKyB0b3B1cHMgLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNuYXBzaG90IGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFtb3VudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBzb3VyY2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYW51YWwnLFxuICAgICAgICBzdHJpcGVfc2Vzc2lvbl9pZCB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhcHBsaWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB0b3B1cF9ldmVudHMoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXN5bmNfam9icyAoXG4gICAgICAgIGlkIHV1aWQgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1ZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgY29tcGxldGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBoZWFydGJlYXRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIG91dHB1dF90ZXh0IHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19jdXN0b21lcl9jcmVhdGVkX2lkeCBvbiBhc3luY19qb2JzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19zdGF0dXNfaWR4IG9uIGFzeW5jX2pvYnMoc3RhdHVzLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHJlcXVlc3RfaWQgdGV4dCxcbiAgICAgICAgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJyxcbiAgICAgICAga2luZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1ldGhvZCB0ZXh0LFxuICAgICAgICBwYXRoIHRleHQsXG4gICAgICAgIG9yaWdpbiB0ZXh0LFxuICAgICAgICByZWZlcmVyIHRleHQsXG4gICAgICAgIHVzZXJfYWdlbnQgdGV4dCxcbiAgICAgICAgaXAgdGV4dCxcbiAgICAgICAgYXBwX2lkIHRleHQsXG4gICAgICAgIGJ1aWxkX2lkIHRleHQsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQsXG4gICAgICAgIHByb3ZpZGVyIHRleHQsXG4gICAgICAgIG1vZGVsIHRleHQsXG4gICAgICAgIGh0dHBfc3RhdHVzIGludGVnZXIsXG4gICAgICAgIGR1cmF0aW9uX21zIGludGVnZXIsXG4gICAgICAgIGVycm9yX2NvZGUgdGV4dCxcbiAgICAgICAgZXJyb3JfbWVzc2FnZSB0ZXh0LFxuICAgICAgICBlcnJvcl9zdGFjayB0ZXh0LFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgdXBzdHJlYW1fYm9keSB0ZXh0LFxuICAgICAgICBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcblxuICAgICAgLy8gRm9yd2FyZC1jb21wYXRpYmxlIHBhdGNoaW5nOiBpZiBnYXRld2F5X2V2ZW50cyBleGlzdGVkIGZyb20gYW4gb2xkZXIgYnVpbGQsXG4gICAgICAvLyBpdCBtYXkgYmUgbWlzc2luZyBjb2x1bW5zIHVzZWQgYnkgbW9uaXRvciBpbnNlcnRzLlxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1ZXN0X2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBraW5kIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZXZlbnQnO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1bmtub3duJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtZXRob2QgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXRoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgb3JpZ2luIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVmZXJlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVzZXJfYWdlbnQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwcF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ1aWxkX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwaV9rZXlfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHByb3ZpZGVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbW9kZWwgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBodHRwX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGR1cmF0aW9uX21zIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfY29kZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX21lc3NhZ2UgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9zdGFjayB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX2JvZHkgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKTtgLFxuXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfY3JlYXRlZF9pZHggb24gZ2F0ZXdheV9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX3JlcXVlc3RfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKHJlcXVlc3RfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfbGV2ZWxfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGxldmVsLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfZm5faWR4IG9uIGdhdGV3YXlfZXZlbnRzKGZ1bmN0aW9uX25hbWUsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19hcHBfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGFwcF9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gS2FpeHVQdXNoIChEZXBsb3kgUHVzaCkgZW50ZXJwcmlzZSB0YWJsZXMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJvbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkZXBsb3llcic7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19yb2xlX2lkeCBvbiBhcGlfa2V5cyhyb2xlKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5ldGxpZnlfc2l0ZV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChjdXN0b21lcl9pZCwgcHJvamVjdF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3Byb2plY3RzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3Byb2plY3RzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRpdGxlIHRleHQsXG4gICAgICAgIGRlcGxveV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzdGF0ZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1aXJlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgdXBsb2FkZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgdXJsIHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9wdXNoZXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3B1c2hlcyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAocHVzaF9yb3dfaWQsIHNoYTEpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzX3B1c2hfaWR4IG9uIHB1c2hfam9icyhwdXNoX3Jvd19pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGJ1Y2tldF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ1Y2tldF9zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5KGN1c3RvbWVyX2lkLCBidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzX2J1Y2tldF9pZHggb24gcHVzaF9yYXRlX3dpbmRvd3MoYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9kZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RpcmVjdCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXNfcHVzaF9pZHggb24gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAxLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfY3VzdG9tZXJfaWR4IG9uIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcmljaW5nX3ZlcnNpb25zIChcbiAgICAgICAgdmVyc2lvbiBpbnRlZ2VyIHByaW1hcnkga2V5LFxuICAgICAgICBlZmZlY3RpdmVfZnJvbSBkYXRlIG5vdCBudWxsIGRlZmF1bHQgY3VycmVudF9kYXRlLFxuICAgICAgICBjdXJyZW5jeSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ1VTRCcsXG4gICAgICAgIGJhc2VfbW9udGhfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9kZXBsb3lfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9nYl9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgaW5zZXJ0IGludG8gcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24sIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cylcbiAgICAgICB2YWx1ZXMgKDEsIDAsIDEwLCAyNSkgb24gY29uZmxpY3QgKHZlcnNpb24pIGRvIG5vdGhpbmc7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9wdXNoX2JpbGxpbmcgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICB0b3RhbF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBicmVha2Rvd24ganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIC8vIEdpdEh1YiBQdXNoIEdhdGV3YXkgKG9wdGlvbmFsKVxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfZ2l0aHViX3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0b2tlbl90eXBlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb2F1dGgnLFxuICAgICAgICBzY29wZXMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgb3duZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVwbyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYWluJyxcbiAgICAgICAgY29tbWl0X21lc3NhZ2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdLYWl4dSBHaXRIdWIgUHVzaCcsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9lcnJvciB0ZXh0LFxuICAgICAgICBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXN1bHRfY29tbWl0X3NoYSB0ZXh0LFxuICAgICAgICByZXN1bHRfdXJsIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX2N1c3RvbWVyX2lkeCBvbiBnaF9wdXNoX2pvYnMoY3VzdG9tZXJfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfbmV4dF9hdHRlbXB0X2lkeCBvbiBnaF9wdXNoX2pvYnMobmV4dF9hdHRlbXB0X2F0KSB3aGVyZSBzdGF0dXMgaW4gKCdyZXRyeV93YWl0JywnZXJyb3JfdHJhbnNpZW50Jyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgZ2hfcHVzaF9qb2JzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzX2pvYl9pZHggb24gZ2hfcHVzaF9ldmVudHMoam9iX3Jvd19pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwaG9uZV9udW1iZXIgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgdHdpbGlvX3NpZCB0ZXh0LFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIGRlZmF1bHRfbGxtX3Byb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb3BlbmFpJyxcbiAgICAgICAgZGVmYXVsdF9sbG1fbW9kZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdncHQtNC4xLW1pbmknLFxuICAgICAgICB2b2ljZV9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYWxsb3knLFxuICAgICAgICBsb2NhbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdlbi1VUycsXG4gICAgICAgIHRpbWV6b25lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnQW1lcmljYS9QaG9lbml4JyxcbiAgICAgICAgcGxheWJvb2sganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVyc19jdXN0b21lcl9pZHggb24gdm9pY2VfbnVtYmVycyhjdXN0b21lcl9pZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB2b2ljZV9udW1iZXJfaWQgYmlnaW50IHJlZmVyZW5jZXMgdm9pY2VfbnVtYmVycyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHByb3ZpZGVyX2NhbGxfc2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZyb21fbnVtYmVyIHRleHQsXG4gICAgICAgIHRvX251bWJlciB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbml0aWF0ZWQnLFxuICAgICAgICBkaXJlY3Rpb24gdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmJvdW5kJyxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBlbmRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgZHVyYXRpb25fc2Vjb25kcyBpbnRlZ2VyLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdW5pcXVlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfcHJvdmlkZXJfc2lkX3VxIG9uIHZvaWNlX2NhbGxzKHByb3ZpZGVyLCBwcm92aWRlcl9jYWxsX3NpZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19jdXN0b21lcl9pZHggb24gdm9pY2VfY2FsbHMoY3VzdG9tZXJfaWQsIHN0YXJ0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGNhbGxfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgdm9pY2VfY2FsbHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICByb2xlIHRleHQgbm90IG51bGwsIC0tIHVzZXJ8YXNzaXN0YW50fHN5c3RlbXx0b29sXG4gICAgICAgIGNvbnRlbnQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlc19jYWxsX2lkeCBvbiB2b2ljZV9jYWxsX21lc3NhZ2VzKGNhbGxfaWQsIGlkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseSAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWludXRlcyBudW1lcmljIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5X2N1c3RvbWVyX2lkeCBvbiB2b2ljZV91c2FnZV9tb250aGx5KGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuXTtcblxuICAgIGZvciAoY29uc3QgcyBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCBzcWwucXVlcnkocyk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBRdWVyeSBoZWxwZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBwcmV2aW91cyBgcGdgLWlzaCBpbnRlcmZhY2U6XG4gKiAtIHJldHVybnMgeyByb3dzLCByb3dDb3VudCB9XG4gKiAtIHN1cHBvcnRzICQxLCAkMiBwbGFjZWhvbGRlcnMgKyBwYXJhbXMgYXJyYXkgdmlhIHNxbC5xdWVyeSguLi4pXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxKHRleHQsIHBhcmFtcyA9IFtdKSB7XG4gIGF3YWl0IGVuc3VyZVNjaGVtYSgpO1xuICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgY29uc3Qgcm93cyA9IGF3YWl0IHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpO1xuICByZXR1cm4geyByb3dzOiByb3dzIHx8IFtdLCByb3dDb3VudDogQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MubGVuZ3RoIDogMCB9O1xufSIsICJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NHVybChpbnB1dCkge1xuICByZXR1cm4gQnVmZmVyLmZyb20oaW5wdXQpXG4gICAgLnRvU3RyaW5nKFwiYmFzZTY0XCIpXG4gICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvXFwrL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9cXC8vZywgXCJfXCIpO1xufVxuXG5mdW5jdGlvbiB1bmJhc2U2NHVybChpbnB1dCkge1xuICBjb25zdCBzID0gU3RyaW5nKGlucHV0IHx8IFwiXCIpLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpO1xuICBjb25zdCBwYWQgPSBzLmxlbmd0aCAlIDQgPT09IDAgPyBcIlwiIDogXCI9XCIucmVwZWF0KDQgLSAocy5sZW5ndGggJSA0KSk7XG4gIHJldHVybiBCdWZmZXIuZnJvbShzICsgcGFkLCBcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gZW5jS2V5KCkge1xuICAvLyBQcmVmZXIgYSBkZWRpY2F0ZWQgZW5jcnlwdGlvbiBrZXkuIEZhbGwgYmFjayB0byBKV1RfU0VDUkVUIGZvciBkcm9wLWZyaWVuZGx5IGluc3RhbGxzLlxuICBjb25zdCByYXcgPSAocHJvY2Vzcy5lbnYuREJfRU5DUllQVElPTl9LRVkgfHwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXJhdykge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIERCX0VOQ1JZUFRJT05fS0VZIChvciBKV1RfU0VDUkVUIGZhbGxiYWNrKVwiLFxuICAgICAgXCJTZXQgREJfRU5DUllQVElPTl9LRVkgKHJlY29tbWVuZGVkKSBvciBhdCBtaW5pbXVtIEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBlbnYgdmFycy5cIlxuICAgICk7XG4gIH1cbiAgLy8gRGVyaXZlIGEgc3RhYmxlIDMyLWJ5dGUga2V5LlxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJhdykuZGlnZXN0KCk7XG59XG5cbi8qKlxuICogRW5jcnlwdCBzbWFsbCBzZWNyZXRzIGZvciBEQiBzdG9yYWdlIChBRVMtMjU2LUdDTSkuXG4gKiBGb3JtYXQ6IHYxOjxpdl9iNjR1cmw+Ojx0YWdfYjY0dXJsPjo8Y2lwaGVyX2I2NHVybD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY3J5cHRTZWNyZXQocGxhaW50ZXh0KSB7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcygxMik7XG4gIGNvbnN0IGNpcGhlciA9IGNyeXB0by5jcmVhdGVDaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBjb25zdCBjdCA9IEJ1ZmZlci5jb25jYXQoW2NpcGhlci51cGRhdGUoU3RyaW5nKHBsYWludGV4dCksIFwidXRmOFwiKSwgY2lwaGVyLmZpbmFsKCldKTtcbiAgY29uc3QgdGFnID0gY2lwaGVyLmdldEF1dGhUYWcoKTtcbiAgcmV0dXJuIGB2MToke2Jhc2U2NHVybChpdil9OiR7YmFzZTY0dXJsKHRhZyl9OiR7YmFzZTY0dXJsKGN0KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjcnlwdFNlY3JldChlbmMpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhlbmMgfHwgXCJcIik7XG4gIGlmICghcy5zdGFydHNXaXRoKFwidjE6XCIpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFydHMgPSBzLnNwbGl0KFwiOlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gNCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IFssIGl2QiwgdGFnQiwgY3RCXSA9IHBhcnRzO1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSB1bmJhc2U2NHVybChpdkIpO1xuICBjb25zdCB0YWcgPSB1bmJhc2U2NHVybCh0YWdCKTtcbiAgY29uc3QgY3QgPSB1bmJhc2U2NHVybChjdEIpO1xuICBjb25zdCBkZWNpcGhlciA9IGNyeXB0by5jcmVhdGVEZWNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGRlY2lwaGVyLnNldEF1dGhUYWcodGFnKTtcbiAgY29uc3QgcHQgPSBCdWZmZXIuY29uY2F0KFtkZWNpcGhlci51cGRhdGUoY3QpLCBkZWNpcGhlci5maW5hbCgpXSk7XG4gIHJldHVybiBwdC50b1N0cmluZyhcInV0ZjhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21LZXkocHJlZml4ID0gXCJreF9saXZlX1wiKSB7XG4gIGNvbnN0IGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKTtcbiAgcmV0dXJuIHByZWZpeCArIGJhc2U2NHVybChieXRlcykuc2xpY2UoMCwgNDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hhMjU2SGV4KGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhtYWNTaGEyNTZIZXgoc2VjcmV0LCBpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuLyoqXG4gKiBLZXkgaGFzaGluZyBzdHJhdGVneTpcbiAqIC0gRGVmYXVsdDogU0hBLTI1NihrZXkpXG4gKiAtIElmIEtFWV9QRVBQRVIgaXMgc2V0OiBITUFDLVNIQTI1NihLRVlfUEVQUEVSLCBrZXkpXG4gKlxuICogSU1QT1JUQU5UOiBQZXBwZXIgaXMgb3B0aW9uYWwgYW5kIGNhbiBiZSBlbmFibGVkIGxhdGVyLlxuICogQXV0aCBjb2RlIHdpbGwgYXV0by1taWdyYXRlIGxlZ2FjeSBoYXNoZXMgb24gZmlyc3Qgc3VjY2Vzc2Z1bCBsb29rdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlIYXNoSGV4KGlucHV0KSB7XG4gIGNvbnN0IHBlcHBlciA9IHByb2Nlc3MuZW52LktFWV9QRVBQRVI7XG4gIGlmIChwZXBwZXIpIHJldHVybiBobWFjU2hhMjU2SGV4KHBlcHBlciwgaW5wdXQpO1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxlZ2FjeUtleUhhc2hIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduSnd0KHBheWxvYWQsIHR0bFNlY29uZHMgPSAzNjAwKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBoZWFkZXIgPSB7IGFsZzogXCJIUzI1NlwiLCB0eXA6IFwiSldUXCIgfTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IGJvZHkgPSB7IC4uLnBheWxvYWQsIGlhdDogbm93LCBleHA6IG5vdyArIHR0bFNlY29uZHMgfTtcblxuICBjb25zdCBoID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGhlYWRlcikpO1xuICBjb25zdCBwID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBzaWcgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHJldHVybiBgJHtkYXRhfS4ke3NpZ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5Snd0KHRva2VuKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgW2gsIHAsIHNdID0gcGFydHM7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3QgZXhwZWN0ZWQgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKGV4cGVjdGVkKTtcbiAgICBjb25zdCBiID0gQnVmZmVyLmZyb20ocyk7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFjcnlwdG8udGltaW5nU2FmZUVxdWFsKGEsIGIpKSByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKFxuICAgICAgQnVmZmVyLmZyb20ocC5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKSwgXCJiYXNlNjRcIikudG9TdHJpbmcoXCJ1dGYtOFwiKVxuICAgICk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgaWYgKHBheWxvYWQuZXhwICYmIG5vdyA+IHBheWxvYWQuZXhwKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF5bG9hZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGtleUhhc2hIZXgsIGxlZ2FjeUtleUhhc2hIZXgsIHZlcmlmeUp3dCB9IGZyb20gXCIuL2NyeXB0by5qc1wiO1xuaW1wb3J0IHsgbW9udGhLZXlVVEMgfSBmcm9tIFwiLi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIGJhc2VTZWxlY3QoKSB7XG4gIHJldHVybiBgc2VsZWN0IGsuaWQgYXMgYXBpX2tleV9pZCwgay5jdXN0b21lcl9pZCwgay5rZXlfbGFzdDQsIGsubGFiZWwsIGsucm9sZSxcbiAgICAgICAgICAgICAgICAgay5tb250aGx5X2NhcF9jZW50cyBhcyBrZXlfY2FwX2NlbnRzLCBrLnJwbV9saW1pdCwgay5ycGRfbGltaXQsXG4gICAgICAgICAgICAgICAgIGsubWF4X2RldmljZXMsIGsucmVxdWlyZV9pbnN0YWxsX2lkLCBrLmFsbG93ZWRfcHJvdmlkZXJzLCBrLmFsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLm1vbnRobHlfY2FwX2NlbnRzIGFzIGN1c3RvbWVyX2NhcF9jZW50cywgYy5pc19hY3RpdmUsXG4gICAgICAgICAgICAgICAgIGMubWF4X2RldmljZXNfcGVyX2tleSBhcyBjdXN0b21lcl9tYXhfZGV2aWNlc19wZXJfa2V5LCBjLnJlcXVpcmVfaW5zdGFsbF9pZCBhcyBjdXN0b21lcl9yZXF1aXJlX2luc3RhbGxfaWQsXG4gICAgICAgICAgICAgICAgIGMuYWxsb3dlZF9wcm92aWRlcnMgYXMgY3VzdG9tZXJfYWxsb3dlZF9wcm92aWRlcnMsIGMuYWxsb3dlZF9tb2RlbHMgYXMgY3VzdG9tZXJfYWxsb3dlZF9tb2RlbHMsXG4gICAgICAgICAgICAgICAgIGMucGxhbl9uYW1lIGFzIGN1c3RvbWVyX3BsYW5fbmFtZSwgYy5lbWFpbCBhcyBjdXN0b21lcl9lbWFpbFxuICAgICAgICAgIGZyb20gYXBpX2tleXMga1xuICAgICAgICAgIGpvaW4gY3VzdG9tZXJzIGMgb24gYy5pZCA9IGsuY3VzdG9tZXJfaWRgO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwS2V5KHBsYWluS2V5KSB7XG4gIC8vIFByZWZlcnJlZCBoYXNoIChwZXBwZXJlZCBpZiBlbmFibGVkKVxuICBjb25zdCBwcmVmZXJyZWQgPSBrZXlIYXNoSGV4KHBsYWluS2V5KTtcbiAgbGV0IGtleVJlcyA9IGF3YWl0IHEoXG4gICAgYCR7YmFzZVNlbGVjdCgpfVxuICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICBsaW1pdCAxYCxcbiAgICBbcHJlZmVycmVkXVxuICApO1xuICBpZiAoa2V5UmVzLnJvd0NvdW50KSByZXR1cm4ga2V5UmVzLnJvd3NbMF07XG5cbiAgLy8gSWYgS0VZX1BFUFBFUiBpcyBlbmFibGVkLCBhbGxvdyBsZWdhY3kgU0hBLTI1NiBoYXNoZXMgYW5kIGF1dG8tbWlncmF0ZSBvbiBmaXJzdCBoaXQuXG4gIGlmIChwcm9jZXNzLmVudi5LRVlfUEVQUEVSKSB7XG4gICAgY29uc3QgbGVnYWN5ID0gbGVnYWN5S2V5SGFzaEhleChwbGFpbktleSk7XG4gICAga2V5UmVzID0gYXdhaXQgcShcbiAgICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgICB3aGVyZSBrLmtleV9oYXNoPSQxIGFuZCBrLnJldm9rZWRfYXQgaXMgbnVsbFxuICAgICAgIGxpbWl0IDFgLFxuICAgICAgW2xlZ2FjeV1cbiAgICApO1xuICAgIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJvdyA9IGtleVJlcy5yb3dzWzBdO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBxKFxuICAgICAgICBgdXBkYXRlIGFwaV9rZXlzIHNldCBrZXlfaGFzaD0kMVxuICAgICAgICAgd2hlcmUgaWQ9JDIgYW5kIGtleV9oYXNoPSQzYCxcbiAgICAgICAgW3ByZWZlcnJlZCwgcm93LmFwaV9rZXlfaWQsIGxlZ2FjeV1cbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBpZ25vcmUgbWlncmF0aW9uIGVycm9yc1xuICAgIH1cblxuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleUJ5SWQoYXBpX2tleV9pZCkge1xuICBjb25zdCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5pZD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW2FwaV9rZXlfaWRdXG4gICk7XG4gIGlmICgha2V5UmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW4gQXV0aG9yaXphdGlvbiBCZWFyZXIgdG9rZW4uXG4gKiBTdXBwb3J0ZWQ6XG4gKiAtIEthaXh1IHN1Yi1rZXkgKHBsYWluIHZpcnR1YWwga2V5KVxuICogLSBTaG9ydC1saXZlZCB1c2VyIHNlc3Npb24gSldUICh0eXBlOiAndXNlcl9zZXNzaW9uJylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc29sdmVBdXRoKHRva2VuKSB7XG4gIGlmICghdG9rZW4pIHJldHVybiBudWxsO1xuXG4gIC8vIEpXVHMgaGF2ZSAzIGRvdC1zZXBhcmF0ZWQgcGFydHMuIEthaXh1IGtleXMgZG8gbm90LlxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGNvbnN0IHBheWxvYWQgPSB2ZXJpZnlKd3QodG9rZW4pO1xuICAgIGlmICghcGF5bG9hZCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKHBheWxvYWQudHlwZSAhPT0gXCJ1c2VyX3Nlc3Npb25cIikgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBhd2FpdCBsb29rdXBLZXlCeUlkKHBheWxvYWQuYXBpX2tleV9pZCk7XG4gICAgcmV0dXJuIHJvdztcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBsb29rdXBLZXkodG9rZW4pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TW9udGhSb2xsdXAoY3VzdG9tZXJfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBleHRyYV9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zXG4gICAgIGZyb20gbW9udGhseV91c2FnZSB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG4gIGlmIChyb2xsLnJvd0NvdW50ID09PSAwKSByZXR1cm4geyBzcGVudF9jZW50czogMCwgZXh0cmFfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCB9O1xuICByZXR1cm4gcm9sbC5yb3dzWzBdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0S2V5TW9udGhSb2xsdXAoYXBpX2tleV9pZCwgbW9udGggPSBtb250aEtleVVUQygpKSB7XG4gIGNvbnN0IHJvbGwgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgc3BlbnRfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2VucywgY2FsbHNcbiAgICAgZnJvbSBtb250aGx5X2tleV91c2FnZSB3aGVyZSBhcGlfa2V5X2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCkgcmV0dXJuIHJvbGwucm93c1swXTtcblxuICAvLyBCYWNrZmlsbCBmb3IgbWlncmF0ZWQgaW5zdGFsbHMgKHdoZW4gbW9udGhseV9rZXlfdXNhZ2UgZGlkIG5vdCBleGlzdCB5ZXQpLlxuICBjb25zdCBrZXlNZXRhID0gYXdhaXQgcShgc2VsZWN0IGN1c3RvbWVyX2lkIGZyb20gYXBpX2tleXMgd2hlcmUgaWQ9JDFgLCBbYXBpX2tleV9pZF0pO1xuICBjb25zdCBjdXN0b21lcl9pZCA9IGtleU1ldGEucm93Q291bnQgPyBrZXlNZXRhLnJvd3NbMF0uY3VzdG9tZXJfaWQgOiBudWxsO1xuXG4gIGNvbnN0IGFnZyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBjb2FsZXNjZShzdW0oY29zdF9jZW50cyksMCk6OmludCBhcyBzcGVudF9jZW50cyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShpbnB1dF90b2tlbnMpLDApOjppbnQgYXMgaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgY29hbGVzY2Uoc3VtKG91dHB1dF90b2tlbnMpLDApOjppbnQgYXMgb3V0cHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvdW50KCopOjppbnQgYXMgY2FsbHNcbiAgICAgZnJvbSB1c2FnZV9ldmVudHNcbiAgICAgd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgdG9fY2hhcihjcmVhdGVkX2F0IGF0IHRpbWUgem9uZSAnVVRDJywnWVlZWS1NTScpPSQyYCxcbiAgICBbYXBpX2tleV9pZCwgbW9udGhdXG4gICk7XG5cbiAgY29uc3Qgcm93ID0gYWdnLnJvd3NbMF0gfHwgeyBzcGVudF9jZW50czogMCwgaW5wdXRfdG9rZW5zOiAwLCBvdXRwdXRfdG9rZW5zOiAwLCBjYWxsczogMCB9O1xuXG4gIGlmIChjdXN0b21lcl9pZCAhPSBudWxsKSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBtb250aGx5X2tleV91c2FnZShhcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzKVxuICAgICAgIHZhbHVlcyAoJDEsJDIsJDMsJDQsJDUsJDYsJDcpXG4gICAgICAgb24gY29uZmxpY3QgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgIGRvIHVwZGF0ZSBzZXRcbiAgICAgICAgIHNwZW50X2NlbnRzID0gZXhjbHVkZWQuc3BlbnRfY2VudHMsXG4gICAgICAgICBpbnB1dF90b2tlbnMgPSBleGNsdWRlZC5pbnB1dF90b2tlbnMsXG4gICAgICAgICBvdXRwdXRfdG9rZW5zID0gZXhjbHVkZWQub3V0cHV0X3Rva2VucyxcbiAgICAgICAgIGNhbGxzID0gZXhjbHVkZWQuY2FsbHMsXG4gICAgICAgICB1cGRhdGVkX2F0ID0gbm93KClgLFxuICAgICAgW2FwaV9rZXlfaWQsIGN1c3RvbWVyX2lkLCBtb250aCwgcm93LnNwZW50X2NlbnRzIHx8IDAsIHJvdy5pbnB1dF90b2tlbnMgfHwgMCwgcm93Lm91dHB1dF90b2tlbnMgfHwgMCwgcm93LmNhbGxzIHx8IDBdXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiByb3c7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3RpdmVDYXBDZW50cyhrZXlSb3csIHJvbGx1cCkge1xuICBjb25zdCBiYXNlID0ga2V5Um93LmtleV9jYXBfY2VudHMgPz8ga2V5Um93LmN1c3RvbWVyX2NhcF9jZW50cztcbiAgY29uc3QgZXh0cmEgPSByb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIChiYXNlIHx8IDApICsgZXh0cmE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHMgfHwgMDtcbiAgY29uc3QgZXh0cmEgPSBjdXN0b21lclJvbGx1cC5leHRyYV9jZW50cyB8fCAwO1xuICByZXR1cm4gYmFzZSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga2V5Q2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCkge1xuICAvLyBJZiBhIGtleSBvdmVycmlkZSBleGlzdHMsIGl0J3MgYSBoYXJkIGNhcCBmb3IgdGhhdCBrZXkuIE90aGVyd2lzZSBpdCBpbmhlcml0cyB0aGUgY3VzdG9tZXIgY2FwLlxuICBpZiAoa2V5Um93LmtleV9jYXBfY2VudHMgIT0gbnVsbCkgcmV0dXJuIGtleVJvdy5rZXlfY2FwX2NlbnRzO1xuICByZXR1cm4gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKTtcbn1cblxuXG5jb25zdCBST0xFX09SREVSID0gW1widmlld2VyXCIsXCJkZXBsb3llclwiLFwiYWRtaW5cIixcIm93bmVyXCJdO1xuXG5leHBvcnQgZnVuY3Rpb24gcm9sZUF0TGVhc3QoYWN0dWFsLCByZXF1aXJlZCkge1xuICBjb25zdCBhID0gUk9MRV9PUkRFUi5pbmRleE9mKChhY3R1YWwgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgY29uc3QgciA9IFJPTEVfT1JERVIuaW5kZXhPZigocmVxdWlyZWQgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpKTtcbiAgcmV0dXJuIGEgPj0gciAmJiBhICE9PSAtMSAmJiByICE9PSAtMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVLZXlSb2xlKGtleVJvdywgcmVxdWlyZWRSb2xlKSB7XG4gIGNvbnN0IGFjdHVhbCA9IChrZXlSb3c/LnJvbGUgfHwgXCJkZXBsb3llclwiKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIXJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWRSb2xlKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZvcmJpZGRlblwiKTtcbiAgICBlcnIuc3RhdHVzID0gNDAzO1xuICAgIGVyci5jb2RlID0gXCJGT1JCSURERU5cIjtcbiAgICBlcnIuaGludCA9IGBSZXF1aXJlcyByb2xlICcke3JlcXVpcmVkUm9sZX0nLCBidXQga2V5IHJvbGUgaXMgJyR7YWN0dWFsfScuYDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cbiIsICJleHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplUGF0aChpbnB1dCkge1xuICBsZXQgcCA9IFN0cmluZyhpbnB1dCB8fCBcIlwiKS50cmltKCk7XG5cbiAgLy8gTm9ybWFsaXplIHNsYXNoZXNcbiAgcCA9IHAucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XG5cbiAgLy8gRGlzYWxsb3cgVVJMIGZyYWdtZW50cy9xdWVyaWVzXG4gIGlmIChwLmluY2x1ZGVzKFwiI1wiKSB8fCBwLmluY2x1ZGVzKFwiP1wiKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZpbGUgcGF0aHMgbXVzdCBub3QgaW5jbHVkZSAnIycgb3IgJz8nXCIpO1xuICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgLy8gRm9yY2UgYWJzb2x1dGVcbiAgaWYgKCFwLnN0YXJ0c1dpdGgoXCIvXCIpKSBwID0gXCIvXCIgKyBwO1xuXG4gIC8vIENvbGxhcHNlIGR1cGxpY2F0ZSBzbGFzaGVzXG4gIHAgPSBcIi9cIiArIHAuc2xpY2UoMSkucmVwbGFjZSgvXFwvezIsfS9nLCBcIi9cIik7XG5cbiAgLy8gTm8gY29udHJvbCBjaGFyc1xuICBpZiAoL1tcXHgwMC1cXHgxRlxceDdGXS8udGVzdChwKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZpbGUgcGF0aCBjb250YWlucyBjb250cm9sIGNoYXJhY3RlcnNcIik7XG4gICAgZXJyLmNvZGUgPSBcIkJBRF9QQVRIXCI7XG4gICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICAvLyBObyB0cmFpbGluZyBzbGFzaCAoZmlsZXMgb25seSlcbiAgaWYgKHAubGVuZ3RoID4gMSAmJiBwLmVuZHNXaXRoKFwiL1wiKSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkZpbGUgcGF0aCBtdXN0IG5vdCBlbmQgd2l0aCAnLydcIik7XG4gICAgZXJyLmNvZGUgPSBcIkJBRF9QQVRIXCI7XG4gICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICAvLyBGb3JiaWQgdHJhdmVyc2FsIC8gZG90IHNlZ21lbnRzXG4gIGNvbnN0IHNlZ3MgPSBwLnNwbGl0KFwiL1wiKTtcbiAgZm9yIChjb25zdCBzZWcgb2Ygc2Vncykge1xuICAgIGlmIChzZWcgPT09IFwiLi5cIiB8fCBzZWcgPT09IFwiLlwiKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGaWxlIHBhdGggbXVzdCBub3QgaW5jbHVkZSAnLicgb3IgJy4uJyBzZWdtZW50c1wiKTtcbiAgICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgLy8gRm9yYmlkIFdpbmRvd3MtcmVzZXJ2ZWQgYW5kIG90aGVyIGRhbmdlcm91cyBjaGFyYWN0ZXJzIGluIHNlZ21lbnRzXG4gICAgaWYgKC9bPD46XCJ8Kl0vLnRlc3Qoc2VnKSkge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRmlsZSBwYXRoIGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVyc1wiKTtcbiAgICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgICAgZXJyLnN0YXR1cyA9IDQwMDtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICAvLyBSZWFzb25hYmxlIGxlbmd0aCBndWFyZFxuICBpZiAocC5sZW5ndGggPiAxMDI0KSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRmlsZSBwYXRoIHRvbyBsb25nXCIpO1xuICAgIGVyci5jb2RlID0gXCJCQURfUEFUSFwiO1xuICAgIGVyci5zdGF0dXMgPSA0MDA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgcmV0dXJuIHA7XG59XG4iLCAiaW1wb3J0IHsgbm9ybWFsaXplUGF0aCB9IGZyb20gXCIuL3B1c2hQYXRoTm9ybWFsaXplLmpzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVVUklDb21wb25lbnRTYWZlUGF0aChwYXRoV2l0aExlYWRpbmdTbGFzaCkge1xuICBjb25zdCBwID0gbm9ybWFsaXplUGF0aChwYXRoV2l0aExlYWRpbmdTbGFzaCk7XG4gIGNvbnN0IHBhcnRzID0gcC5zbGljZSgxKS5zcGxpdChcIi9cIikubWFwKChzZWcpID0+IGVuY29kZVVSSUNvbXBvbmVudChzZWcpKTtcbiAgcmV0dXJuIHBhcnRzLmpvaW4oXCIvXCIpO1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG4vKipcbiAqIEJlc3QtZWZmb3J0IGF1ZGl0IGxvZzogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1ZGl0KGFjdG9yLCBhY3Rpb24sIHRhcmdldCA9IG51bGwsIG1ldGEgPSB7fSkge1xuICB0cnkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gYXVkaXRfZXZlbnRzKGFjdG9yLCBhY3Rpb24sIHRhcmdldCwgbWV0YSkgdmFsdWVzICgkMSwkMiwkMywkNDo6anNvbmIpYCxcbiAgICAgIFthY3RvciwgYWN0aW9uLCB0YXJnZXQsIEpTT04uc3RyaW5naWZ5KG1ldGEgfHwge30pXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJhdWRpdCBmYWlsZWQ6XCIsIGU/Lm1lc3NhZ2UgfHwgZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBxIH0gZnJvbSBcIi4vZGIuanNcIjtcbmltcG9ydCB7IGVuY3J5cHRTZWNyZXQsIGRlY3J5cHRTZWNyZXQgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuLyoqXG4gKiBQZXItY3VzdG9tZXIgTmV0bGlmeSBBUEkgdG9rZW5zIChlbnRlcnByaXNlIGJvdW5kYXJ5KS5cbiAqXG4gKiAtIFN0b3JlZCBlbmNyeXB0ZWQgaW4gTmV0bGlmeSBEQi5cbiAqIC0gVXNlZCBieSBLYWl4dVB1c2ggdG8gY3JlYXRlIGRlcGxveXMvdXBsb2FkcyBpbiB0aGUgY3VzdG9tZXIncyBOZXRsaWZ5IGFjY291bnQuXG4gKiAtIEZhbGxzIGJhY2sgdG8gcHJvY2Vzcy5lbnYuTkVUTElGWV9BVVRIX1RPS0VOIGlmIG5vIGN1c3RvbWVyIHRva2VuIGV4aXN0cyAoYmFjay1jb21wYXQpLlxuICovXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXROZXRsaWZ5VG9rZW5Gb3JDdXN0b21lcihjdXN0b21lcl9pZCkge1xuICBjb25zdCByZXMgPSBhd2FpdCBxKGBzZWxlY3QgdG9rZW5fZW5jIGZyb20gY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgd2hlcmUgY3VzdG9tZXJfaWQ9JDFgLCBbY3VzdG9tZXJfaWRdKTtcbiAgaWYgKHJlcy5yb3dzLmxlbmd0aCkge1xuICAgIGNvbnN0IGRlYyA9IGRlY3J5cHRTZWNyZXQocmVzLnJvd3NbMF0udG9rZW5fZW5jKTtcbiAgICBpZiAoZGVjKSByZXR1cm4gZGVjO1xuICB9XG4gIHJldHVybiAocHJvY2Vzcy5lbnYuTkVUTElGWV9BVVRIX1RPS0VOIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0TmV0bGlmeVRva2VuRm9yQ3VzdG9tZXIoY3VzdG9tZXJfaWQsIHRva2VuX3BsYWluKSB7XG4gIGNvbnN0IGVuYyA9IGVuY3J5cHRTZWNyZXQodG9rZW5fcGxhaW4pO1xuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyhjdXN0b21lcl9pZCwgdG9rZW5fZW5jLCBjcmVhdGVkX2F0LCB1cGRhdGVkX2F0KVxuICAgICB2YWx1ZXMgKCQxLCQyLG5vdygpLG5vdygpKVxuICAgICBvbiBjb25mbGljdCAoY3VzdG9tZXJfaWQpXG4gICAgIGRvIHVwZGF0ZSBzZXQgdG9rZW5fZW5jPWV4Y2x1ZGVkLnRva2VuX2VuYywgdXBkYXRlZF9hdD1ub3coKWAsXG4gICAgW2N1c3RvbWVyX2lkLCBlbmNdXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhck5ldGxpZnlUb2tlbkZvckN1c3RvbWVyKGN1c3RvbWVyX2lkKSB7XG4gIGF3YWl0IHEoYGRlbGV0ZSBmcm9tIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIHdoZXJlIGN1c3RvbWVyX2lkPSQxYCwgW2N1c3RvbWVyX2lkXSk7XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIG1vbnRoUmFuZ2VVVEMobW9udGgpIHtcbiAgY29uc3QgW3ksIG1dID0gU3RyaW5nKG1vbnRoIHx8IFwiXCIpLnNwbGl0KFwiLVwiKS5tYXAoKHgpID0+IHBhcnNlSW50KHgsIDEwKSk7XG4gIGlmICgheSB8fCAhbSB8fCBtIDwgMSB8fCBtID4gMTIpIHJldHVybiBudWxsO1xuICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0gLSAxLCAxLCAwLCAwLCAwKSk7XG4gIGNvbnN0IGVuZCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0sIDEsIDAsIDAsIDApKTtcbiAgcmV0dXJuIHsgc3RhcnQsIGVuZCB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0UHVzaFByaWNpbmcoY3VzdG9tZXJfaWQpIHtcbiAgbGV0IHB2ID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGIucHJpY2luZ192ZXJzaW9uLCBiLm1vbnRobHlfY2FwX2NlbnRzLFxuICAgICAgICAgICAgcC5iYXNlX21vbnRoX2NlbnRzLCBwLnBlcl9kZXBsb3lfY2VudHMsIHAucGVyX2diX2NlbnRzLCBwLmN1cnJlbmN5XG4gICAgIGZyb20gY3VzdG9tZXJfcHVzaF9iaWxsaW5nIGJcbiAgICAgam9pbiBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgcCBvbiBwLnZlcnNpb24gPSBiLnByaWNpbmdfdmVyc2lvblxuICAgICB3aGVyZSBiLmN1c3RvbWVyX2lkPSQxXG4gICAgIGxpbWl0IDFgLFxuICAgIFtjdXN0b21lcl9pZF1cbiAgKTtcblxuICBpZiAoIXB2LnJvd0NvdW50KSB7XG4gICAgcHYgPSBhd2FpdCBxKFxuICAgICAgYHNlbGVjdCAxIGFzIHByaWNpbmdfdmVyc2lvbiwgMCBhcyBtb250aGx5X2NhcF9jZW50cyxcbiAgICAgICAgICAgICAgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzLCBjdXJyZW5jeVxuICAgICAgIGZyb20gcHVzaF9wcmljaW5nX3ZlcnNpb25zIHdoZXJlIHZlcnNpb249MSBsaW1pdCAxYCxcbiAgICAgIFtdXG4gICAgKTtcbiAgfVxuICByZXR1cm4gcHYucm93Q291bnQgPyBwdi5yb3dzWzBdIDogbnVsbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0UHVzaFVzYWdlKGN1c3RvbWVyX2lkLCByYW5nZSkge1xuICBjb25zdCB1c2FnZSA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdFxuICAgICAgICBjb3VudCgqKSBmaWx0ZXIgKHdoZXJlIGV2ZW50X3R5cGU9J2RlcGxveV9yZWFkeScpOjppbnQgYXMgZGVwbG95c19yZWFkeSxcbiAgICAgICAgY291bnQoKikgZmlsdGVyICh3aGVyZSBldmVudF90eXBlPSdkZXBsb3lfaW5pdCcpOjppbnQgYXMgZGVwbG95c19pbml0LFxuICAgICAgICBjb2FsZXNjZShzdW0oYnl0ZXMpIGZpbHRlciAod2hlcmUgZXZlbnRfdHlwZT0nZmlsZV91cGxvYWQnKSwwKTo6YmlnaW50IGFzIGJ5dGVzX3VwbG9hZGVkXG4gICAgIGZyb20gcHVzaF91c2FnZV9ldmVudHNcbiAgICAgd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIGNyZWF0ZWRfYXQgPj0gJDIgYW5kIGNyZWF0ZWRfYXQgPCAkM2AsXG4gICAgW2N1c3RvbWVyX2lkLCByYW5nZS5zdGFydC50b0lTT1N0cmluZygpLCByYW5nZS5lbmQudG9JU09TdHJpbmcoKV1cbiAgKTtcbiAgcmV0dXJuIHVzYWdlLnJvd3NbMF0gfHwgeyBkZXBsb3lzX3JlYWR5OiAwLCBkZXBsb3lzX2luaXQ6IDAsIGJ5dGVzX3VwbG9hZGVkOiAwIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFN0YWdlZEJ5dGVzKGN1c3RvbWVyX2lkLCByYW5nZSkge1xuICAvLyBDb3VudCBieXRlcyBzdGFnZWQgaW4gY2h1bmsgam9icyB0aGF0IGhhdmUgbm90IGJlZW4gY29tcGxldGVkL2NsZWFyZWQuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBjb2FsZXNjZShzdW0oai5ieXRlc19zdGFnZWQpLDApOjpiaWdpbnQgYXMgYnl0ZXNfc3RhZ2VkXG4gICAgIGZyb20gcHVzaF9qb2JzIGpcbiAgICAgam9pbiBwdXNoX3B1c2hlcyBwIG9uIHAuaWQ9ai5wdXNoX3Jvd19pZFxuICAgICB3aGVyZSBwLmN1c3RvbWVyX2lkPSQxXG4gICAgICAgYW5kIHAuY3JlYXRlZF9hdCA+PSAkMiBhbmQgcC5jcmVhdGVkX2F0IDwgJDNcbiAgICAgICBhbmQgai5zdGF0dXMgaW4gKCd1cGxvYWRpbmcnLCdxdWV1ZWQnLCdhc3NlbWJsaW5nJylgLFxuICAgIFtjdXN0b21lcl9pZCwgcmFuZ2Uuc3RhcnQudG9JU09TdHJpbmcoKSwgcmFuZ2UuZW5kLnRvSVNPU3RyaW5nKCldXG4gICk7XG4gIHJldHVybiBOdW1iZXIocmVzLnJvd3NbMF0/LmJ5dGVzX3N0YWdlZCB8fCAwKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuZm9yY2VQdXNoQ2FwKHsgY3VzdG9tZXJfaWQsIG1vbnRoLCBleHRyYV9kZXBsb3lzID0gMCwgZXh0cmFfYnl0ZXMgPSAwIH0pIHtcbiAgY29uc3QgcmFuZ2UgPSBtb250aFJhbmdlVVRDKG1vbnRoKTtcbiAgaWYgKCFyYW5nZSkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkludmFsaWQgbW9udGggKFlZWVktTU0pXCIpO1xuICAgIGVyci5jb2RlID0gXCJCQURfTU9OVEhcIjtcbiAgICBlcnIuc3RhdHVzID0gNDAwO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIGNvbnN0IGNmZyA9IGF3YWl0IGdldFB1c2hQcmljaW5nKGN1c3RvbWVyX2lkKTtcbiAgaWYgKCFjZmcpIHJldHVybiB7IG9rOiB0cnVlLCBjZmc6IG51bGwgfTsgLy8gSWYgcHVzaCBwcmljaW5nIG5vdCBjb25maWd1cmVkLCBkb24ndCBibG9jay5cblxuICBjb25zdCBjYXAgPSBOdW1iZXIoY2ZnLm1vbnRobHlfY2FwX2NlbnRzIHx8IDApO1xuICBpZiAoIWNhcCB8fCBjYXAgPD0gMCkgcmV0dXJuIHsgb2s6IHRydWUsIGNmZyB9OyAvLyBjYXA9MCA9PiB1bmxpbWl0ZWRcblxuICBjb25zdCB1c2FnZSA9IGF3YWl0IGdldFB1c2hVc2FnZShjdXN0b21lcl9pZCwgcmFuZ2UpO1xuICBjb25zdCBzdGFnZWQgPSBhd2FpdCBnZXRTdGFnZWRCeXRlcyhjdXN0b21lcl9pZCwgcmFuZ2UpO1xuXG4gIGNvbnN0IGRlcGxveXNfaW5pdCA9IE51bWJlcih1c2FnZS5kZXBsb3lzX2luaXQgfHwgMCk7XG4gIGNvbnN0IGRlcGxveXNfcmVhZHkgPSBOdW1iZXIodXNhZ2UuZGVwbG95c19yZWFkeSB8fCAwKTtcbiAgY29uc3QgZGVwbG95c19yZXNlcnZlZCA9IE1hdGgubWF4KDAsIGRlcGxveXNfaW5pdCAtIGRlcGxveXNfcmVhZHkpOyAvLyBpbi1wcm9ncmVzcyAvIGF0dGVtcHRlZCBkZXBsb3lzXG4gIGNvbnN0IGRlcGxveXNfdXNlZCA9IGRlcGxveXNfcmVhZHkgKyBkZXBsb3lzX3Jlc2VydmVkICsgTnVtYmVyKGV4dHJhX2RlcGxveXMgfHwgMCk7XG4gIGNvbnN0IGJ5dGVzX3RvdGFsID0gTnVtYmVyKHVzYWdlLmJ5dGVzX3VwbG9hZGVkIHx8IDApICsgTnVtYmVyKHN0YWdlZCB8fCAwKSArIE51bWJlcihleHRyYV9ieXRlcyB8fCAwKTtcblxuICBjb25zdCBnYiA9IGJ5dGVzX3RvdGFsIC8gMTA3Mzc0MTgyNDsgLy8gR2lCXG4gIGNvbnN0IGJhc2UgPSBOdW1iZXIoY2ZnLmJhc2VfbW9udGhfY2VudHMgfHwgMCk7XG4gIGNvbnN0IGRlcGxveUNvc3QgPSBOdW1iZXIoY2ZnLnBlcl9kZXBsb3lfY2VudHMgfHwgMCkgKiBkZXBsb3lzX3VzZWQ7XG4gIGNvbnN0IGdiQ29zdCA9IE1hdGgucm91bmQoTnVtYmVyKGNmZy5wZXJfZ2JfY2VudHMgfHwgMCkgKiBnYik7XG4gIGNvbnN0IHRvdGFsID0gYmFzZSArIGRlcGxveUNvc3QgKyBnYkNvc3Q7XG5cbiAgaWYgKHRvdGFsID4gY2FwKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiUHVzaCBtb250aGx5IGNhcCByZWFjaGVkXCIpO1xuICAgIGVyci5jb2RlID0gXCJQVVNIX0NBUF9SRUFDSEVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDQwMjtcbiAgICBlcnIucGF5bG9hZCA9IHtcbiAgICAgIGNvZGU6IFwiUFVTSF9DQVBfUkVBQ0hFRFwiLFxuICAgICAgbW9udGgsXG4gICAgICBwcmljaW5nX3ZlcnNpb246IGNmZy5wcmljaW5nX3ZlcnNpb24sXG4gICAgICBtb250aGx5X2NhcF9jZW50czogY2FwLFxuICAgICAgcHJvamVjdGVkX3RvdGFsX2NlbnRzOiB0b3RhbCxcbiAgICAgIGN1cnJlbnQ6IHtcbiAgICAgICAgZGVwbG95c19pbml0LFxuICAgICAgICBkZXBsb3lzX3JlYWR5LFxuICAgICAgICBkZXBsb3lzX3Jlc2VydmVkLFxuICAgICAgICBieXRlc191cGxvYWRlZDogTnVtYmVyKHVzYWdlLmJ5dGVzX3VwbG9hZGVkIHx8IDApLFxuICAgICAgICBieXRlc19zdGFnZWQ6IE51bWJlcihzdGFnZWQgfHwgMClcbiAgICAgIH0sXG4gICAgICBwcm9wb3NlZDoge1xuICAgICAgICBleHRyYV9kZXBsb3lzOiBOdW1iZXIoZXh0cmFfZGVwbG95cyB8fCAwKSxcbiAgICAgICAgZXh0cmFfYnl0ZXM6IE51bWJlcihleHRyYV9ieXRlcyB8fCAwKVxuICAgICAgfVxuICAgIH07XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvazogdHJ1ZSxcbiAgICBjZmcsXG4gICAgbW9udGgsXG4gICAgcHJvamVjdGVkX3RvdGFsX2NlbnRzOiB0b3RhbCxcbiAgICBtb250aGx5X2NhcF9jZW50czogY2FwLFxuICAgIGN1cnJlbnQ6IHtcbiAgICAgIGRlcGxveXNfaW5pdCxcbiAgICAgIGRlcGxveXNfcmVhZHksXG4gICAgICBkZXBsb3lzX3Jlc2VydmVkLFxuICAgICAgYnl0ZXNfdXBsb2FkZWQ6IE51bWJlcih1c2FnZS5ieXRlc191cGxvYWRlZCB8fCAwKSxcbiAgICAgIGJ5dGVzX3N0YWdlZDogTnVtYmVyKHN0YWdlZCB8fCAwKVxuICAgIH1cbiAgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFBQSxTQUFTLGdCQUFnQjs7O0FDQXpCLFNBQVMsWUFBWTtBQWFyQixJQUFJLE9BQU87QUFDWCxJQUFJLGlCQUFpQjtBQUVyQixTQUFTLFNBQVM7QUFDaEIsTUFBSSxLQUFNLFFBQU87QUFFakIsUUFBTSxXQUFXLENBQUMsRUFBRSxRQUFRLElBQUksd0JBQXdCLFFBQVEsSUFBSTtBQUNwRSxNQUFJLENBQUMsVUFBVTtBQUNiLFVBQU0sTUFBTSxJQUFJLE1BQU0sZ0dBQWdHO0FBQ3RILFFBQUksT0FBTztBQUNYLFFBQUksU0FBUztBQUNiLFFBQUksT0FBTztBQUNYLFVBQU07QUFBQSxFQUNSO0FBRUEsU0FBTyxLQUFLO0FBQ1osU0FBTztBQUNUO0FBRUEsZUFBZSxlQUFlO0FBQzVCLE1BQUksZUFBZ0IsUUFBTztBQUUzQixvQkFBa0IsWUFBWTtBQUM1QixVQUFNLE1BQU0sT0FBTztBQUNuQixVQUFNLGFBQWE7QUFBQSxNQUNqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQTJHO0FBQUEsTUFDM0c7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW1CQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFrQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFjQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF1QkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFB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
