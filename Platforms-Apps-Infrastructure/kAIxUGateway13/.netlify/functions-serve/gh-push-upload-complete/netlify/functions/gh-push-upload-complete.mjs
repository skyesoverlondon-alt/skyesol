
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/_lib/http.js
function buildCors(req) {
  const allowRaw = (process.env.ALLOWED_ORIGINS || "").trim();
  const reqOrigin = req.headers.get("origin") || req.headers.get("Origin");
  const allowHeaders = "authorization, content-type, x-kaixu-install-id, x-kaixu-request-id, x-kaixu-app, x-kaixu-build, x-admin-password, x-kaixu-error-token, x-kaixu-mode, x-content-sha1, x-setup-secret, x-kaixu-job-secret, x-job-worker-secret";
  const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  const base = {
    "access-control-allow-headers": allowHeaders,
    "access-control-allow-methods": allowMethods,
    "access-control-expose-headers": "x-kaixu-request-id",
    "access-control-max-age": "86400"
  };
  if (!allowRaw) {
    return {
      ...base,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  const allowed = allowRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes("*")) {
    const origin = reqOrigin || "*";
    return {
      ...base,
      "access-control-allow-origin": origin,
      ...reqOrigin ? { vary: "Origin" } : {}
    };
  }
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return {
      ...base,
      "access-control-allow-origin": reqOrigin,
      vary: "Origin"
    };
  }
  return {
    ...base,
    ...reqOrigin ? { vary: "Origin" } : {}
  };
}
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
function badRequest(message, headers = {}) {
  return json(400, { error: message }, headers);
}
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

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

// netlify/functions/_lib/monitor.js
function safeStr(v, max = 8e3) {
  if (v == null) return null;
  const s = String(v);
  if (s.length <= max) return s;
  return s.slice(0, max) + `\u2026(+${s.length - max} chars)`;
}
function randomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return "rid_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function getRequestId(req) {
  const h = (req.headers.get("x-kaixu-request-id") || req.headers.get("x-request-id") || "").trim();
  return h || randomId();
}
function inferFunctionName(req) {
  try {
    const u = new URL(req.url);
    const m = u.pathname.match(/\/\.netlify\/functions\/([^\/]+)/i);
    return m ? m[1] : "unknown";
  } catch {
    return "unknown";
  }
}
function requestMeta(req) {
  let url = null;
  try {
    url = new URL(req.url);
  } catch {
  }
  return {
    method: req.method || null,
    path: url ? url.pathname : null,
    query: url ? Object.fromEntries(url.searchParams.entries()) : {},
    origin: req.headers.get("origin") || req.headers.get("Origin") || null,
    referer: req.headers.get("referer") || req.headers.get("Referer") || null,
    user_agent: req.headers.get("user-agent") || null,
    ip: req.headers.get("x-nf-client-connection-ip") || null,
    app_id: (req.headers.get("x-kaixu-app") || "").trim() || null,
    build_id: (req.headers.get("x-kaixu-build") || "").trim() || null
  };
}
function serializeError(err) {
  const e = err || {};
  return {
    name: safeStr(e.name, 200),
    message: safeStr(e.message, 4e3),
    code: safeStr(e.code, 200),
    status: Number.isFinite(e.status) ? e.status : null,
    hint: safeStr(e.hint, 2e3),
    stack: safeStr(e.stack, 12e3),
    upstream: e.upstream ? {
      provider: safeStr(e.upstream.provider, 50),
      status: Number.isFinite(e.upstream.status) ? e.upstream.status : null,
      body: safeStr(e.upstream.body, 12e3),
      request_id: safeStr(e.upstream.request_id, 200),
      response_headers: e.upstream.response_headers || void 0
    } : void 0
  };
}
async function emitEvent(ev) {
  try {
    const e = ev || {};
    const extra = e.extra || {};
    await q(
      `insert into gateway_events
        (request_id, level, kind, function_name, method, path, origin, referer, user_agent, ip,
         app_id, build_id, customer_id, api_key_id, provider, model, http_status, duration_ms,
         error_code, error_message, error_stack, upstream_status, upstream_body, extra)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,$24,$25::jsonb)`,
      [
        safeStr(e.request_id, 200),
        safeStr(e.level || "info", 20),
        safeStr(e.kind || "event", 80),
        safeStr(e.function_name || "unknown", 120),
        safeStr(e.method, 20),
        safeStr(e.path, 500),
        safeStr(e.origin, 500),
        safeStr(e.referer, 800),
        safeStr(e.user_agent, 800),
        safeStr(e.ip, 200),
        safeStr(e.app_id, 200),
        safeStr(e.build_id, 200),
        Number.isFinite(e.customer_id) ? e.customer_id : null,
        Number.isFinite(e.api_key_id) ? e.api_key_id : null,
        safeStr(e.provider, 80),
        safeStr(e.model, 200),
        Number.isFinite(e.http_status) ? e.http_status : null,
        Number.isFinite(e.duration_ms) ? e.duration_ms : null,
        safeStr(e.error_code, 200),
        safeStr(e.error_message, 4e3),
        safeStr(e.error_stack, 12e3),
        Number.isFinite(e.upstream_status) ? e.upstream_status : null,
        safeStr(e.upstream_body, 12e3),
        JSON.stringify(extra || {})
      ]
    );
  } catch (e) {
    console.warn("monitor emit failed:", e?.message || e);
  }
}

// netlify/functions/_lib/wrap.js
function normalizeError(err) {
  const status = err?.status || 500;
  const code = err?.code || "SERVER_ERROR";
  const message = err?.message || "Unknown error";
  const hint = err?.hint;
  return { status, body: { error: message, code, ...hint ? { hint } : {} } };
}
function withRequestId(res, request_id) {
  try {
    const h = new Headers(res.headers || {});
    h.set("x-kaixu-request-id", request_id);
    return new Response(res.body, { status: res.status, headers: h });
  } catch {
    return res;
  }
}
async function safeBodyPreview(res) {
  try {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const clone = res.clone();
    if (ct.includes("application/json")) {
      const data = await clone.json().catch(() => null);
      return data;
    }
    const t = await clone.text().catch(() => "");
    if (typeof t === "string" && t.length > 12e3) return t.slice(0, 12e3) + `\u2026(+${t.length - 12e3} chars)`;
    return t;
  } catch {
    return null;
  }
}
function wrap(handler) {
  return async (req, context) => {
    const start = Date.now();
    const cors = buildCors(req);
    const request_id = getRequestId(req);
    const function_name = inferFunctionName(req);
    const meta = requestMeta(req);
    try {
      const res = await handler(req, cors, context);
      const duration_ms = Date.now() - start;
      const out = res instanceof Response ? withRequestId(res, request_id) : res;
      const status = out instanceof Response ? out.status : 200;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const kind = status >= 400 ? "http_error_response" : "http_response";
      let extra = {};
      if (status >= 400 && out instanceof Response) {
        extra.response = await safeBodyPreview(out);
      }
      if (duration_ms >= 15e3) {
        extra.slow = true;
      }
      await emitEvent({
        request_id,
        level,
        kind,
        function_name,
        ...meta,
        http_status: status,
        duration_ms,
        extra
      });
      return out;
    } catch (err) {
      const duration_ms = Date.now() - start;
      const ser = serializeError(err);
      await emitEvent({
        request_id,
        level: "error",
        kind: "thrown_error",
        function_name,
        ...meta,
        provider: ser?.upstream?.provider || void 0,
        http_status: ser?.status || 500,
        duration_ms,
        error_code: ser?.code || "SERVER_ERROR",
        error_message: ser?.message || "Unknown error",
        error_stack: ser?.stack || null,
        upstream_status: ser?.upstream?.status || null,
        upstream_body: ser?.upstream?.body || null,
        extra: { error: ser }
      });
      console.error("Function error:", err);
      const { status, body } = normalizeError(err);
      return json(status, { ...body, request_id }, { ...cors, "x-kaixu-request-id": request_id });
    }
  };
}

// netlify/functions/_lib/crypto.js
import crypto from "crypto";
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

// netlify/functions/gh-push-upload-complete.js
var gh_push_upload_complete_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);
  const workerSecret = (process.env.JOB_WORKER_SECRET || "").trim();
  if (!workerSecret) return json(500, { error: "Missing JOB_WORKER_SECRET", code: "CONFIG" }, cors);
  const key = getBearer(req);
  if (!key) return json(401, { error: "Missing Authorization Bearer Kaixu Key" }, cors);
  const krow = await lookupKey(key);
  if (!krow) return json(401, { error: "Invalid Kaixu Key" }, cors);
  requireKeyRole(krow, "deployer");
  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON", cors);
  }
  const jobId = (body.jobId || "").toString();
  if (!jobId) return badRequest("Missing jobId", cors);
  const j = await q(`select id, customer_id, parts, received_parts, status from gh_push_jobs where job_id=$1 limit 1`, [jobId]);
  if (!j.rowCount) return json(404, { error: "Job not found" }, cors);
  const job = j.rows[0];
  if (job.customer_id !== krow.customer_id) return json(403, { error: "Forbidden" }, cors);
  const parts = parseInt(job.parts, 10);
  if (!parts || parts < 1) return json(409, { error: "No chunks uploaded yet (parts not set)" }, cors);
  const received = new Set(job.received_parts || []);
  for (let i = 0; i < parts; i++) {
    if (!received.has(i)) return json(409, { error: `Missing chunk part ${i}`, code: "PARTS_INCOMPLETE" }, cors);
  }
  await q(`update gh_push_jobs set status='queued', updated_at=now() where id=$1`, [job.id]);
  const origin = process.env.URL || new URL(req.url).origin;
  await fetch(`${origin}/.netlify/functions/gh-push-background`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kaixu-job-secret": workerSecret
    },
    body: JSON.stringify({ jobId })
  });
  await q(
    `insert into gh_push_events(customer_id, api_key_id, job_row_id, event_type, bytes, meta)
     values ($1,$2,$3,'queue',0,$4::jsonb)`,
    [krow.customer_id, krow.api_key_id, job.id, JSON.stringify({ parts })]
  );
  await audit(`key:${krow.key_last4}`, "GITHUB_PUSH_QUEUE", `gh:${jobId}`, { parts });
  return json(202, { ok: true, queued: true, jobId }, cors);
});
export {
  gh_push_upload_complete_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2F1dGh6LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvYXVkaXQuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvZ2gtcHVzaC11cGxvYWQtY29tcGxldGUuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBmdW5jdGlvbiBidWlsZENvcnMocmVxKSB7XG4gIGNvbnN0IGFsbG93UmF3ID0gKHByb2Nlc3MuZW52LkFMTE9XRURfT1JJR0lOUyB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IHJlcU9yaWdpbiA9IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIik7XG5cbiAgLy8gSU1QT1JUQU5UOiBrZWVwIHRoaXMgbGlzdCBhbGlnbmVkIHdpdGggd2hhdGV2ZXIgaGVhZGVycyB5b3VyIGFwcHMgc2VuZC5cbiAgY29uc3QgYWxsb3dIZWFkZXJzID0gXCJhdXRob3JpemF0aW9uLCBjb250ZW50LXR5cGUsIHgta2FpeHUtaW5zdGFsbC1pZCwgeC1rYWl4dS1yZXF1ZXN0LWlkLCB4LWthaXh1LWFwcCwgeC1rYWl4dS1idWlsZCwgeC1hZG1pbi1wYXNzd29yZCwgeC1rYWl4dS1lcnJvci10b2tlbiwgeC1rYWl4dS1tb2RlLCB4LWNvbnRlbnQtc2hhMSwgeC1zZXR1cC1zZWNyZXQsIHgta2FpeHUtam9iLXNlY3JldCwgeC1qb2Itd29ya2VyLXNlY3JldFwiO1xuICBjb25zdCBhbGxvd01ldGhvZHMgPSBcIkdFVCxQT1NULFBVVCxQQVRDSCxERUxFVEUsT1BUSU9OU1wiO1xuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzXCI6IGFsbG93SGVhZGVycyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW1ldGhvZHNcIjogYWxsb3dNZXRob2RzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtZXhwb3NlLWhlYWRlcnNcIjogXCJ4LWthaXh1LXJlcXVlc3QtaWRcIixcbiAgICBcImFjY2Vzcy1jb250cm9sLW1heC1hZ2VcIjogXCI4NjQwMFwiXG4gIH07XG5cbiAgLy8gU1RSSUNUIEJZIERFRkFVTFQ6XG4gIC8vIC0gSWYgQUxMT1dFRF9PUklHSU5TIGlzIHVuc2V0L2JsYW5rIGFuZCBhIGJyb3dzZXIgT3JpZ2luIGlzIHByZXNlbnQsIHdlIGRvIE5PVCBncmFudCBDT1JTLlxuICAvLyAtIEFsbG93LWFsbCBpcyBvbmx5IGVuYWJsZWQgd2hlbiBBTExPV0VEX09SSUdJTlMgZXhwbGljaXRseSBjb250YWlucyBcIipcIi5cbiAgaWYgKCFhbGxvd1Jhdykge1xuICAgIC8vIE5vIGFsbG93LW9yaWdpbiBncmFudGVkLiBTZXJ2ZXItdG8tc2VydmVyIHJlcXVlc3RzIChubyBPcmlnaW4gaGVhZGVyKSBzdGlsbCB3b3JrIG5vcm1hbGx5LlxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWQgPSBhbGxvd1Jhdy5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIC8vIEV4cGxpY2l0IGFsbG93LWFsbFxuICBpZiAoYWxsb3dlZC5pbmNsdWRlcyhcIipcIikpIHtcbiAgICBjb25zdCBvcmlnaW4gPSByZXFPcmlnaW4gfHwgXCIqXCI7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiBvcmlnaW4sXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhhY3QtbWF0Y2ggYWxsb3dsaXN0XG4gIGlmIChyZXFPcmlnaW4gJiYgYWxsb3dlZC5pbmNsdWRlcyhyZXFPcmlnaW4pKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiByZXFPcmlnaW4sXG4gICAgICB2YXJ5OiBcIk9yaWdpblwiXG4gICAgfTtcbiAgfVxuXG4gIC8vIE9yaWdpbiBwcmVzZW50IGJ1dCBub3QgYWxsb3dlZDogZG8gbm90IGdyYW50IGFsbG93LW9yaWdpbi5cbiAgcmV0dXJuIHtcbiAgICAuLi5iYXNlLFxuICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBqc29uKHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAuLi5oZWFkZXJzXG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRleHQoc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhZFJlcXVlc3QobWVzc2FnZSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBqc29uKDQwMCwgeyBlcnJvcjogbWVzc2FnZSB9LCBoZWFkZXJzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJlYXJlcihyZXEpIHtcbiAgY29uc3QgYXV0aCA9IHJlcS5oZWFkZXJzLmdldChcImF1dGhvcml6YXRpb25cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiQXV0aG9yaXphdGlvblwiKSB8fCBcIlwiO1xuICBpZiAoIWF1dGguc3RhcnRzV2l0aChcIkJlYXJlciBcIikpIHJldHVybiBudWxsO1xuICByZXR1cm4gYXV0aC5zbGljZSg3KS50cmltKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb250aEtleVVUQyhkID0gbmV3IERhdGUoKSkge1xuICByZXR1cm4gZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDcpOyAvLyBZWVlZLU1NXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0YWxsSWQocmVxKSB7XG4gIHJldHVybiAoXG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1pbnN0YWxsLWlkXCIpIHx8XG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwiWC1LYWl4dS1JbnN0YWxsLUlkXCIpIHx8XG4gICAgXCJcIlxuICApLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckFnZW50KHJlcSkge1xuICByZXR1cm4gKHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiVXNlci1BZ2VudFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnNsaWNlKDAsIDI0MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGllbnRJcChyZXEpIHtcbiAgLy8gTmV0bGlmeSBhZGRzIHgtbmYtY2xpZW50LWNvbm5lY3Rpb24taXAgd2hlbiBkZXBsb3llZCAobWF5IGJlIG1pc3NpbmcgaW4gbmV0bGlmeSBkZXYpLlxuICBjb25zdCBhID0gKHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmIChhKSByZXR1cm4gYTtcblxuICAvLyBGYWxsYmFjayB0byBmaXJzdCBYLUZvcndhcmRlZC1Gb3IgZW50cnkuXG4gIGNvbnN0IHhmZiA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1mb3JcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCF4ZmYpIHJldHVybiBudWxsO1xuICBjb25zdCBmaXJzdCA9IHhmZi5zcGxpdChcIixcIilbMF0udHJpbSgpO1xuICByZXR1cm4gZmlyc3QgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNsZWVwKG1zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBtcykpO1xufSIsICJpbXBvcnQgeyBuZW9uIH0gZnJvbSBcIkBuZXRsaWZ5L25lb25cIjtcblxuLyoqXG4gKiBOZXRsaWZ5IERCIChOZW9uIFBvc3RncmVzKSBoZWxwZXIuXG4gKlxuICogSU1QT1JUQU5UIChOZW9uIHNlcnZlcmxlc3MgZHJpdmVyLCAyMDI1Kyk6XG4gKiAtIGBuZW9uKClgIHJldHVybnMgYSB0YWdnZWQtdGVtcGxhdGUgcXVlcnkgZnVuY3Rpb24uXG4gKiAtIEZvciBkeW5hbWljIFNRTCBzdHJpbmdzICsgJDEgcGxhY2Vob2xkZXJzLCB1c2UgYHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpYC5cbiAqICAgKENhbGxpbmcgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGxpa2Ugc3FsKFwiU0VMRUNUIC4uLlwiKSBjYW4gYnJlYWsgb24gbmV3ZXIgZHJpdmVyIHZlcnNpb25zLilcbiAqXG4gKiBOZXRsaWZ5IERCIGF1dG9tYXRpY2FsbHkgaW5qZWN0cyBgTkVUTElGWV9EQVRBQkFTRV9VUkxgIHdoZW4gdGhlIE5lb24gZXh0ZW5zaW9uIGlzIGF0dGFjaGVkLlxuICovXG5cbmxldCBfc3FsID0gbnVsbDtcbmxldCBfc2NoZW1hUHJvbWlzZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFNxbCgpIHtcbiAgaWYgKF9zcWwpIHJldHVybiBfc3FsO1xuXG4gIGNvbnN0IGhhc0RiVXJsID0gISEocHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMKTtcbiAgaWYgKCFoYXNEYlVybCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkRhdGFiYXNlIG5vdCBjb25maWd1cmVkIChtaXNzaW5nIE5FVExJRllfREFUQUJBU0VfVVJMKS4gQXR0YWNoIE5ldGxpZnkgREIgKE5lb24pIHRvIHRoaXMgc2l0ZS5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkRCX05PVF9DT05GSUdVUkVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiTmV0bGlmeSBVSSBcdTIxOTIgRXh0ZW5zaW9ucyBcdTIxOTIgTmVvbiBcdTIxOTIgQWRkIGRhdGFiYXNlIChvciBydW46IG5weCBuZXRsaWZ5IGRiIGluaXQpLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIF9zcWwgPSBuZW9uKCk7IC8vIGF1dG8tdXNlcyBwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCBvbiBOZXRsaWZ5XG4gIHJldHVybiBfc3FsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVTY2hlbWEoKSB7XG4gIGlmIChfc2NoZW1hUHJvbWlzZSkgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xuXG4gIF9zY2hlbWFQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgZW1haWwgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHBsYW5fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3N0YXJ0ZXInLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMjAwMCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N1YnNjcmlwdGlvbl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3RhdHVzIHRleHQsXG4gICAgICAgIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHosXG4gICAgICAgIGF1dG9fdG9wdXBfZW5hYmxlZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2UsXG4gICAgICAgIGF1dG9fdG9wdXBfYW1vdW50X2NlbnRzIGludGVnZXIsXG4gICAgICAgIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzIGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFwaV9rZXlzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBrZXlfaGFzaCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAga2V5X2xhc3Q0IHRleHQgbm90IG51bGwsXG4gICAgICAgIGxhYmVsIHRleHQsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIsXG4gICAgICAgIHJwbV9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBycGRfbGltaXQgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6XG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfY3VzdG9tZXJfaWRfaWR4IG9uIGFwaV9rZXlzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfdXNhZ2UgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXh0cmFfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZV9jdXN0b21lcl9tb250aF9pZHggb24gbW9udGhseV9rZXlfdXNhZ2UoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIG1vbnRobHlfa2V5X3VzYWdlIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB1c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfa2V5X2lkeCBvbiB1c2FnZV9ldmVudHMoYXBpX2tleV9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgYWN0b3IgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWN0aW9uIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRhcmdldCB0ZXh0LFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBhdWRpdF9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB3aW5kb3dfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3Nfd2luZG93X2lkeCBvbiByYXRlX2xpbWl0X3dpbmRvd3Mod2luZG93X3N0YXJ0IGRlc2MpO2AsICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2luc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcF9oYXNoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVhIHRleHQ7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfaW5zdGFsbF9pZHggb24gdXNhZ2VfZXZlbnRzKGluc3RhbGxfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYWxlcnRzX3NlbnQgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWxlcnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgbW9udGgsIGFsZXJ0X3R5cGUpXG4gICAgICApO2AsXG4gICAgXG4gICAgICAvLyAtLS0gRGV2aWNlIGJpbmRpbmcgLyBzZWF0cyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzX3Blcl9rZXkgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW47YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlcyAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBpbnN0YWxsX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGRldmljZV9sYWJlbCB0ZXh0LFxuICAgICAgICBmaXJzdF9zZWVuX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9zZWVuX3VhIHRleHQsXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJldm9rZWRfYnkgdGV4dCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfY3VzdG9tZXJfaWR4IG9uIGtleV9kZXZpY2VzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2xhc3Rfc2Vlbl9pZHggb24ga2V5X2RldmljZXMobGFzdF9zZWVuX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBJbnZvaWNlIHNuYXBzaG90cyArIHRvcHVwcyAtLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc25hcHNob3QganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYW1vdW50X2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHNvdXJjZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21hbnVhbCcsXG4gICAgICAgIHN0cmlwZV9zZXNzaW9uX2lkIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FwcGxpZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHRvcHVwX2V2ZW50cyhjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhc3luY19qb2JzIChcbiAgICAgICAgaWQgdXVpZCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBjb21wbGV0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGhlYXJ0YmVhdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgb3V0cHV0X3RleHQgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX2N1c3RvbWVyX2NyZWF0ZWRfaWR4IG9uIGFzeW5jX2pvYnMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX3N0YXR1c19pZHggb24gYXN5bmNfam9icyhzdGF0dXMsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICBcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcmVxdWVzdF9pZCB0ZXh0LFxuICAgICAgICBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nLFxuICAgICAgICBraW5kIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWV0aG9kIHRleHQsXG4gICAgICAgIHBhdGggdGV4dCxcbiAgICAgICAgb3JpZ2luIHRleHQsXG4gICAgICAgIHJlZmVyZXIgdGV4dCxcbiAgICAgICAgdXNlcl9hZ2VudCB0ZXh0LFxuICAgICAgICBpcCB0ZXh0LFxuICAgICAgICBhcHBfaWQgdGV4dCxcbiAgICAgICAgYnVpbGRfaWQgdGV4dCxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50LFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCxcbiAgICAgICAgbW9kZWwgdGV4dCxcbiAgICAgICAgaHR0cF9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgZHVyYXRpb25fbXMgaW50ZWdlcixcbiAgICAgICAgZXJyb3JfY29kZSB0ZXh0LFxuICAgICAgICBlcnJvcl9tZXNzYWdlIHRleHQsXG4gICAgICAgIGVycm9yX3N0YWNrIHRleHQsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICB1cHN0cmVhbV9ib2R5IHRleHQsXG4gICAgICAgIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyBGb3J3YXJkLWNvbXBhdGlibGUgcGF0Y2hpbmc6IGlmIGdhdGV3YXlfZXZlbnRzIGV4aXN0ZWQgZnJvbSBhbiBvbGRlciBidWlsZCxcbiAgICAgIC8vIGl0IG1heSBiZSBtaXNzaW5nIGNvbHVtbnMgdXNlZCBieSBtb25pdG9yIGluc2VydHMuXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVlc3RfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGtpbmQgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdldmVudCc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3Vua25vd24nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1ldGhvZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhdGggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBvcmlnaW4gdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZWZlcmVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXNlcl9hZ2VudCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBwX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnVpbGRfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjdXN0b21lcl9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBpX2tleV9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcHJvdmlkZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtb2RlbCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGh0dHBfc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZHVyYXRpb25fbXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9jb2RlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfbWVzc2FnZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX3N0YWNrIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fYm9keSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpO2AsXG5cbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfcmVxdWVzdF9pZHggb24gZ2F0ZXdheV9ldmVudHMocmVxdWVzdF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19sZXZlbF9pZHggb24gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19mbl9pZHggb24gZ2F0ZXdheV9ldmVudHMoZnVuY3Rpb25fbmFtZSwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2FwcF9pZHggb24gZ2F0ZXdheV9ldmVudHMoYXBwX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBLYWl4dVB1c2ggKERlcGxveSBQdXNoKSBlbnRlcnByaXNlIHRhYmxlcyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcm9sZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RlcGxveWVyJztgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX3JvbGVfaWR4IG9uIGFwaV9rZXlzKHJvbGUpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmV0bGlmeV9zaXRlX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKGN1c3RvbWVyX2lkLCBwcm9qZWN0X2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHJvamVjdHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3Rfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJvamVjdHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGl0bGUgdGV4dCxcbiAgICAgICAgZGVwbG95X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIHN0YXRlIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVpcmVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICB1cGxvYWRlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICB1cmwgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX3B1c2hlcyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHVzaGVzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChwdXNoX3Jvd19pZCwgc2hhMSlcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2pvYnNfcHVzaF9pZHggb24gcHVzaF9qb2JzKHB1c2hfcm93X2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYnVja2V0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnVja2V0X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkoY3VzdG9tZXJfaWQsIGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3NfYnVja2V0X2lkeCBvbiBwdXNoX3JhdGVfd2luZG93cyhidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9maWxlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb2RlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGlyZWN0JyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9maWxlc19wdXNoX2lkeCBvbiBwdXNoX2ZpbGVzKHB1c2hfcm93X2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDEsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9jdXN0b21lcl9pZHggb24gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgKFxuICAgICAgICB2ZXJzaW9uIGludGVnZXIgcHJpbWFyeSBrZXksXG4gICAgICAgIGVmZmVjdGl2ZV9mcm9tIGRhdGUgbm90IG51bGwgZGVmYXVsdCBjdXJyZW50X2RhdGUsXG4gICAgICAgIGN1cnJlbmN5IHRleHQgbm90IG51bGwgZGVmYXVsdCAnVVNEJyxcbiAgICAgICAgYmFzZV9tb250aF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2RlcGxveV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2diX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBpbnNlcnQgaW50byBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiwgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzKVxuICAgICAgIHZhbHVlcyAoMSwgMCwgMTAsIDI1KSBvbiBjb25mbGljdCAodmVyc2lvbikgZG8gbm90aGluZztgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX3B1c2hfYmlsbGluZyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIHRvdGFsX2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIGJyZWFrZG93biBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgLy8gR2l0SHViIFB1c2ggR2F0ZXdheSAob3B0aW9uYWwpXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9naXRodWJfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRva2VuX3R5cGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvYXV0aCcsXG4gICAgICAgIHNjb3BlcyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBvd25lciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXBvIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21haW4nLFxuICAgICAgICBjb21taXRfbWVzc2FnZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0thaXh1IEdpdEh1YiBQdXNoJyxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X2Vycm9yIHRleHQsXG4gICAgICAgIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJlc3VsdF9jb21taXRfc2hhIHRleHQsXG4gICAgICAgIHJlc3VsdF91cmwgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfY3VzdG9tZXJfaWR4IG9uIGdoX3B1c2hfam9icyhjdXN0b21lcl9pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19uZXh0X2F0dGVtcHRfaWR4IG9uIGdoX3B1c2hfam9icyhuZXh0X2F0dGVtcHRfYXQpIHdoZXJlIHN0YXR1cyBpbiAoJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBnaF9wdXNoX2pvYnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHNfam9iX2lkeCBvbiBnaF9wdXNoX2V2ZW50cyhqb2Jfcm93X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHBob25lX251bWJlciB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICB0d2lsaW9fc2lkIHRleHQsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgZGVmYXVsdF9sbG1fcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvcGVuYWknLFxuICAgICAgICBkZWZhdWx0X2xsbV9tb2RlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2dwdC00LjEtbWluaScsXG4gICAgICAgIHZvaWNlX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhbGxveScsXG4gICAgICAgIGxvY2FsZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2VuLVVTJyxcbiAgICAgICAgdGltZXpvbmUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdBbWVyaWNhL1Bob2VuaXgnLFxuICAgICAgICBwbGF5Ym9vayBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9udW1iZXJzKGN1c3RvbWVyX2lkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHZvaWNlX251bWJlcl9pZCBiaWdpbnQgcmVmZXJlbmNlcyB2b2ljZV9udW1iZXJzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgcHJvdmlkZXJfY2FsbF9zaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnJvbV9udW1iZXIgdGV4dCxcbiAgICAgICAgdG9fbnVtYmVyIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luaXRpYXRlZCcsXG4gICAgICAgIGRpcmVjdGlvbiB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luYm91bmQnLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGVuZGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBkdXJhdGlvbl9zZWNvbmRzIGludGVnZXIsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB1bmlxdWUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19wcm92aWRlcl9zaWRfdXEgb24gdm9pY2VfY2FsbHMocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9jYWxscyhjdXN0b21lcl9pZCwgc3RhcnRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY2FsbF9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyB2b2ljZV9jYWxscyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHJvbGUgdGV4dCBub3QgbnVsbCwgLS0gdXNlcnxhc3Npc3RhbnR8c3lzdGVtfHRvb2xcbiAgICAgICAgY29udGVudCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzX2NhbGxfaWR4IG9uIHZvaWNlX2NhbGxfbWVzc2FnZXMoY2FsbF9pZCwgaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5IChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtaW51dGVzIG51bWVyaWMgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHlfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX3VzYWdlX21vbnRobHkoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG5dO1xuXG4gICAgZm9yIChjb25zdCBzIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHNxbC5xdWVyeShzKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xufVxuXG4vKipcbiAqIFF1ZXJ5IGhlbHBlciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGBwZ2AtaXNoIGludGVyZmFjZTpcbiAqIC0gcmV0dXJucyB7IHJvd3MsIHJvd0NvdW50IH1cbiAqIC0gc3VwcG9ydHMgJDEsICQyIHBsYWNlaG9sZGVycyArIHBhcmFtcyBhcnJheSB2aWEgc3FsLnF1ZXJ5KC4uLilcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHEodGV4dCwgcGFyYW1zID0gW10pIHtcbiAgYXdhaXQgZW5zdXJlU2NoZW1hKCk7XG4gIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICBjb25zdCByb3dzID0gYXdhaXQgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcyk7XG4gIHJldHVybiB7IHJvd3M6IHJvd3MgfHwgW10sIHJvd0NvdW50OiBBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cy5sZW5ndGggOiAwIH07XG59IiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBzYWZlU3RyKHYsIG1heCA9IDgwMDApIHtcbiAgaWYgKHYgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSBTdHJpbmcodik7XG4gIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbn1cblxuZnVuY3Rpb24gcmFuZG9tSWQoKSB7XG4gIHRyeSB7XG4gICAgaWYgKGdsb2JhbFRoaXMuY3J5cHRvPy5yYW5kb21VVUlEKSByZXR1cm4gZ2xvYmFsVGhpcy5jcnlwdG8ucmFuZG9tVVVJRCgpO1xuICB9IGNhdGNoIHt9XG4gIC8vIGZhbGxiYWNrIChub3QgUkZDNDEyMi1wZXJmZWN0LCBidXQgdW5pcXVlIGVub3VnaCBmb3IgdHJhY2luZylcbiAgcmV0dXJuIFwicmlkX1wiICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMikgKyBcIl9cIiArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVxdWVzdElkKHJlcSkge1xuICBjb25zdCBoID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtcmVxdWVzdC1pZFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LXJlcXVlc3QtaWRcIikgfHwgXCJcIikudHJpbSgpO1xuICByZXR1cm4gaCB8fCByYW5kb21JZCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJGdW5jdGlvbk5hbWUocmVxKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwocmVxLnVybCk7XG4gICAgY29uc3QgbSA9IHUucGF0aG5hbWUubWF0Y2goL1xcL1xcLm5ldGxpZnlcXC9mdW5jdGlvbnNcXC8oW15cXC9dKykvaSk7XG4gICAgcmV0dXJuIG0gPyBtWzFdIDogXCJ1bmtub3duXCI7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcInVua25vd25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdE1ldGEocmVxKSB7XG4gIGxldCB1cmwgPSBudWxsO1xuICB0cnkgeyB1cmwgPSBuZXcgVVJMKHJlcS51cmwpOyB9IGNhdGNoIHt9XG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiByZXEubWV0aG9kIHx8IG51bGwsXG4gICAgcGF0aDogdXJsID8gdXJsLnBhdGhuYW1lIDogbnVsbCxcbiAgICBxdWVyeTogdXJsID8gT2JqZWN0LmZyb21FbnRyaWVzKHVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKSA6IHt9LFxuICAgIG9yaWdpbjogcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKSB8fCBudWxsLFxuICAgIHJlZmVyZXI6IHJlcS5oZWFkZXJzLmdldChcInJlZmVyZXJcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiUmVmZXJlclwiKSB8fCBudWxsLFxuICAgIHVzZXJfYWdlbnQ6IHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgbnVsbCxcbiAgICBpcDogcmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBudWxsLFxuICAgIGFwcF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYXBwXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsLFxuICAgIGJ1aWxkX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1idWlsZFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IGUgPSBlcnIgfHwge307XG4gIHJldHVybiB7XG4gICAgbmFtZTogc2FmZVN0cihlLm5hbWUsIDIwMCksXG4gICAgbWVzc2FnZTogc2FmZVN0cihlLm1lc3NhZ2UsIDQwMDApLFxuICAgIGNvZGU6IHNhZmVTdHIoZS5jb2RlLCAyMDApLFxuICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUuc3RhdHVzKSA/IGUuc3RhdHVzIDogbnVsbCxcbiAgICBoaW50OiBzYWZlU3RyKGUuaGludCwgMjAwMCksXG4gICAgc3RhY2s6IHNhZmVTdHIoZS5zdGFjaywgMTIwMDApLFxuICAgIHVwc3RyZWFtOiBlLnVwc3RyZWFtID8ge1xuICAgICAgcHJvdmlkZXI6IHNhZmVTdHIoZS51cHN0cmVhbS5wcm92aWRlciwgNTApLFxuICAgICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbS5zdGF0dXMpID8gZS51cHN0cmVhbS5zdGF0dXMgOiBudWxsLFxuICAgICAgYm9keTogc2FmZVN0cihlLnVwc3RyZWFtLmJvZHksIDEyMDAwKSxcbiAgICAgIHJlcXVlc3RfaWQ6IHNhZmVTdHIoZS51cHN0cmVhbS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgcmVzcG9uc2VfaGVhZGVyczogZS51cHN0cmVhbS5yZXNwb25zZV9oZWFkZXJzIHx8IHVuZGVmaW5lZFxuICAgIH0gOiB1bmRlZmluZWRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZUpzb25Cb2R5KGJvZHkpIHtcbiAgLy8gU2FmZSBzdW1tYXJ5OyBhdm9pZHMgbG9nZ2luZyBmdWxsIHByb21wdHMgYnkgZGVmYXVsdC5cbiAgY29uc3QgYiA9IGJvZHkgfHwge307XG4gIGNvbnN0IHByb3ZpZGVyID0gKGIucHJvdmlkZXIgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkudG9Mb3dlckNhc2UoKSB8fCBudWxsO1xuICBjb25zdCBtb2RlbCA9IChiLm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpIHx8IG51bGw7XG5cbiAgbGV0IG1lc3NhZ2VDb3VudCA9IG51bGw7XG4gIGxldCB0b3RhbENoYXJzID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiLm1lc3NhZ2VzKSkge1xuICAgICAgbWVzc2FnZUNvdW50ID0gYi5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICB0b3RhbENoYXJzID0gYi5tZXNzYWdlcy5yZWR1Y2UoKGFjYywgbSkgPT4gYWNjICsgU3RyaW5nKG0/LmNvbnRlbnQgPz8gXCJcIikubGVuZ3RoLCAwKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cblxuICByZXR1cm4ge1xuICAgIHByb3ZpZGVyLFxuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IE51bWJlci5pc0Zpbml0ZShiLm1heF90b2tlbnMpID8gcGFyc2VJbnQoYi5tYXhfdG9rZW5zLCAxMCkgOiBudWxsLFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgYi50ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IGIudGVtcGVyYXR1cmUgOiBudWxsLFxuICAgIG1lc3NhZ2VfY291bnQ6IG1lc3NhZ2VDb3VudCxcbiAgICBtZXNzYWdlX2NoYXJzOiB0b3RhbENoYXJzXG4gIH07XG59XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgbW9uaXRvciBldmVudDogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVtaXRFdmVudChldikge1xuICB0cnkge1xuICAgIGNvbnN0IGUgPSBldiB8fCB7fTtcbiAgICBjb25zdCBleHRyYSA9IGUuZXh0cmEgfHwge307XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBnYXRld2F5X2V2ZW50c1xuICAgICAgICAocmVxdWVzdF9pZCwgbGV2ZWwsIGtpbmQsIGZ1bmN0aW9uX25hbWUsIG1ldGhvZCwgcGF0aCwgb3JpZ2luLCByZWZlcmVyLCB1c2VyX2FnZW50LCBpcCxcbiAgICAgICAgIGFwcF9pZCwgYnVpbGRfaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGh0dHBfc3RhdHVzLCBkdXJhdGlvbl9tcyxcbiAgICAgICAgIGVycm9yX2NvZGUsIGVycm9yX21lc3NhZ2UsIGVycm9yX3N0YWNrLCB1cHN0cmVhbV9zdGF0dXMsIHVwc3RyZWFtX2JvZHksIGV4dHJhKVxuICAgICAgIHZhbHVlc1xuICAgICAgICAoJDEsJDIsJDMsJDQsJDUsJDYsJDcsJDgsJDksJDEwLFxuICAgICAgICAgJDExLCQxMiwkMTMsJDE0LCQxNSwkMTYsJDE3LCQxOCxcbiAgICAgICAgICQxOSwkMjAsJDIxLCQyMiwkMjMsJDI0LCQyNTo6anNvbmIpYCxcbiAgICAgIFtcbiAgICAgICAgc2FmZVN0cihlLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5sZXZlbCB8fCBcImluZm9cIiwgMjApLFxuICAgICAgICBzYWZlU3RyKGUua2luZCB8fCBcImV2ZW50XCIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLmZ1bmN0aW9uX25hbWUgfHwgXCJ1bmtub3duXCIsIDEyMCksXG4gICAgICAgIHNhZmVTdHIoZS5tZXRob2QsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLnBhdGgsIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5vcmlnaW4sIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5yZWZlcmVyLCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUudXNlcl9hZ2VudCwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLmlwLCAyMDApLFxuXG4gICAgICAgIHNhZmVTdHIoZS5hcHBfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5idWlsZF9pZCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuY3VzdG9tZXJfaWQpID8gZS5jdXN0b21lcl9pZCA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmFwaV9rZXlfaWQpID8gZS5hcGlfa2V5X2lkIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnByb3ZpZGVyLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5tb2RlbCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuaHR0cF9zdGF0dXMpID8gZS5odHRwX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmR1cmF0aW9uX21zKSA/IGUuZHVyYXRpb25fbXMgOiBudWxsLFxuXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9jb2RlLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfbWVzc2FnZSwgNDAwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9zdGFjaywgMTIwMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbV9zdGF0dXMpID8gZS51cHN0cmVhbV9zdGF0dXMgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUudXBzdHJlYW1fYm9keSwgMTIwMDApLFxuICAgICAgICBKU09OLnN0cmluZ2lmeShleHRyYSB8fCB7fSlcbiAgICAgIF1cbiAgICApO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKFwibW9uaXRvciBlbWl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGJ1aWxkQ29ycywganNvbiB9IGZyb20gXCIuL2h0dHAuanNcIjtcbmltcG9ydCB7IGVtaXRFdmVudCwgZ2V0UmVxdWVzdElkLCBpbmZlckZ1bmN0aW9uTmFtZSwgcmVxdWVzdE1ldGEsIHNlcmlhbGl6ZUVycm9yIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG5mdW5jdGlvbiBub3JtYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3Qgc3RhdHVzID0gZXJyPy5zdGF0dXMgfHwgNTAwO1xuICBjb25zdCBjb2RlID0gZXJyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCI7XG4gIGNvbnN0IG1lc3NhZ2UgPSBlcnI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCI7XG4gIGNvbnN0IGhpbnQgPSBlcnI/LmhpbnQ7XG4gIHJldHVybiB7IHN0YXR1cywgYm9keTogeyBlcnJvcjogbWVzc2FnZSwgY29kZSwgLi4uKGhpbnQgPyB7IGhpbnQgfSA6IHt9KSB9IH07XG59XG5cbmZ1bmN0aW9uIHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgaCA9IG5ldyBIZWFkZXJzKHJlcy5oZWFkZXJzIHx8IHt9KTtcbiAgICBoLnNldChcIngta2FpeHUtcmVxdWVzdC1pZFwiLCByZXF1ZXN0X2lkKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHJlcy5ib2R5LCB7IHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogaCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlQm9keVByZXZpZXcocmVzKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY3QgPSAocmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgY2xvbmUgPSByZXMuY2xvbmUoKTtcbiAgICBpZiAoY3QuaW5jbHVkZXMoXCJhcHBsaWNhdGlvbi9qc29uXCIpKSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2xvbmUuanNvbigpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGNvbnN0IHQgPSBhd2FpdCBjbG9uZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQubGVuZ3RoID4gMTIwMDApIHJldHVybiB0LnNsaWNlKDAsIDEyMDAwKSArIGBcdTIwMjYoKyR7dC5sZW5ndGggLSAxMjAwMH0gY2hhcnMpYDtcbiAgICByZXR1cm4gdDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXAoaGFuZGxlcikge1xuICByZXR1cm4gYXN5bmMgKHJlcSwgY29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gICAgY29uc3QgcmVxdWVzdF9pZCA9IGdldFJlcXVlc3RJZChyZXEpO1xuICAgIGNvbnN0IGZ1bmN0aW9uX25hbWUgPSBpbmZlckZ1bmN0aW9uTmFtZShyZXEpO1xuICAgIGNvbnN0IG1ldGEgPSByZXF1ZXN0TWV0YShyZXEpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGhhbmRsZXIocmVxLCBjb3JzLCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG4gICAgICBjb25zdCBvdXQgPSByZXMgaW5zdGFuY2VvZiBSZXNwb25zZSA/IHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSA6IHJlcztcblxuICAgICAgY29uc3Qgc3RhdHVzID0gb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UgPyBvdXQuc3RhdHVzIDogMjAwO1xuICAgICAgY29uc3QgbGV2ZWwgPSBzdGF0dXMgPj0gNTAwID8gXCJlcnJvclwiIDogc3RhdHVzID49IDQwMCA/IFwid2FyblwiIDogXCJpbmZvXCI7XG4gICAgICBjb25zdCBraW5kID0gc3RhdHVzID49IDQwMCA/IFwiaHR0cF9lcnJvcl9yZXNwb25zZVwiIDogXCJodHRwX3Jlc3BvbnNlXCI7XG5cbiAgICAgIGxldCBleHRyYSA9IHt9O1xuICAgICAgaWYgKHN0YXR1cyA+PSA0MDAgJiYgb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UpIHtcbiAgICAgICAgZXh0cmEucmVzcG9uc2UgPSBhd2FpdCBzYWZlQm9keVByZXZpZXcob3V0KTtcbiAgICAgIH1cbiAgICAgIGlmIChkdXJhdGlvbl9tcyA+PSAxNTAwMCkge1xuICAgICAgICBleHRyYS5zbG93ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGtpbmQsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBleHRyYVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBvdXQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcblxuICAgICAgLy8gQmVzdC1lZmZvcnQgZGV0YWlsZWQgbW9uaXRvciByZWNvcmQuXG4gICAgICBjb25zdCBzZXIgPSBzZXJpYWxpemVFcnJvcihlcnIpO1xuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWw6IFwiZXJyb3JcIixcbiAgICAgICAga2luZDogXCJ0aHJvd25fZXJyb3JcIixcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgcHJvdmlkZXI6IHNlcj8udXBzdHJlYW0/LnByb3ZpZGVyIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHNlcj8uc3RhdHVzIHx8IDUwMCxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGVycm9yX2NvZGU6IHNlcj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiLFxuICAgICAgICBlcnJvcl9tZXNzYWdlOiBzZXI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgIGVycm9yX3N0YWNrOiBzZXI/LnN0YWNrIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1czogc2VyPy51cHN0cmVhbT8uc3RhdHVzIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX2JvZHk6IHNlcj8udXBzdHJlYW0/LmJvZHkgfHwgbnVsbCxcbiAgICAgICAgZXh0cmE6IHsgZXJyb3I6IHNlciB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQXZvaWQgNTAyczogYWx3YXlzIHJldHVybiBKU09OLlxuICAgICAgY29uc29sZS5lcnJvcihcIkZ1bmN0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgICAgY29uc3QgeyBzdGF0dXMsIGJvZHkgfSA9IG5vcm1hbGl6ZUVycm9yKGVycik7XG4gICAgICByZXR1cm4ganNvbihzdGF0dXMsIHsgLi4uYm9keSwgcmVxdWVzdF9pZCB9LCB7IC4uLmNvcnMsIFwieC1rYWl4dS1yZXF1ZXN0LWlkXCI6IHJlcXVlc3RfaWQgfSk7XG4gICAgfVxuICB9O1xufVxuIiwgImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG5mdW5jdGlvbiBjb25maWdFcnJvcihtZXNzYWdlLCBoaW50KSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICBlcnIuc3RhdHVzID0gNTAwO1xuICBpZiAoaGludCkgZXJyLmhpbnQgPSBoaW50O1xuICByZXR1cm4gZXJyO1xufVxuXG5mdW5jdGlvbiBiYXNlNjR1cmwoaW5wdXQpIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGlucHV0KVxuICAgIC50b1N0cmluZyhcImJhc2U2NFwiKVxuICAgIC5yZXBsYWNlKC89L2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1xcKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXFwvL2csIFwiX1wiKTtcbn1cblxuZnVuY3Rpb24gdW5iYXNlNjR1cmwoaW5wdXQpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhpbnB1dCB8fCBcIlwiKS5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKTtcbiAgY29uc3QgcGFkID0gcy5sZW5ndGggJSA0ID09PSAwID8gXCJcIiA6IFwiPVwiLnJlcGVhdCg0IC0gKHMubGVuZ3RoICUgNCkpO1xuICByZXR1cm4gQnVmZmVyLmZyb20ocyArIHBhZCwgXCJiYXNlNjRcIik7XG59XG5cbmZ1bmN0aW9uIGVuY0tleSgpIHtcbiAgLy8gUHJlZmVyIGEgZGVkaWNhdGVkIGVuY3J5cHRpb24ga2V5LiBGYWxsIGJhY2sgdG8gSldUX1NFQ1JFVCBmb3IgZHJvcC1mcmllbmRseSBpbnN0YWxscy5cbiAgY29uc3QgcmF3ID0gKHByb2Nlc3MuZW52LkRCX0VOQ1JZUFRJT05fS0VZIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCFyYXcpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBEQl9FTkNSWVBUSU9OX0tFWSAob3IgSldUX1NFQ1JFVCBmYWxsYmFjaylcIixcbiAgICAgIFwiU2V0IERCX0VOQ1JZUFRJT05fS0VZIChyZWNvbW1lbmRlZCkgb3IgYXQgbWluaW11bSBKV1RfU0VDUkVUIGluIE5ldGxpZnkgZW52IHZhcnMuXCJcbiAgICApO1xuICB9XG4gIC8vIERlcml2ZSBhIHN0YWJsZSAzMi1ieXRlIGtleS5cbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShyYXcpLmRpZ2VzdCgpO1xufVxuXG4vKipcbiAqIEVuY3J5cHQgc21hbGwgc2VjcmV0cyBmb3IgREIgc3RvcmFnZSAoQUVTLTI1Ni1HQ00pLlxuICogRm9ybWF0OiB2MTo8aXZfYjY0dXJsPjo8dGFnX2I2NHVybD46PGNpcGhlcl9iNjR1cmw+XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNyeXB0U2VjcmV0KHBsYWludGV4dCkge1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTIpO1xuICBjb25zdCBjaXBoZXIgPSBjcnlwdG8uY3JlYXRlQ2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgY29uc3QgY3QgPSBCdWZmZXIuY29uY2F0KFtjaXBoZXIudXBkYXRlKFN0cmluZyhwbGFpbnRleHQpLCBcInV0ZjhcIiksIGNpcGhlci5maW5hbCgpXSk7XG4gIGNvbnN0IHRhZyA9IGNpcGhlci5nZXRBdXRoVGFnKCk7XG4gIHJldHVybiBgdjE6JHtiYXNlNjR1cmwoaXYpfToke2Jhc2U2NHVybCh0YWcpfToke2Jhc2U2NHVybChjdCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlY3J5cHRTZWNyZXQoZW5jKSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoZW5jIHx8IFwiXCIpO1xuICBpZiAoIXMuc3RhcnRzV2l0aChcInYxOlwiKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBhcnRzID0gcy5zcGxpdChcIjpcIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDQpIHJldHVybiBudWxsO1xuICBjb25zdCBbLCBpdkIsIHRhZ0IsIGN0Ql0gPSBwYXJ0cztcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gdW5iYXNlNjR1cmwoaXZCKTtcbiAgY29uc3QgdGFnID0gdW5iYXNlNjR1cmwodGFnQik7XG4gIGNvbnN0IGN0ID0gdW5iYXNlNjR1cmwoY3RCKTtcbiAgY29uc3QgZGVjaXBoZXIgPSBjcnlwdG8uY3JlYXRlRGVjaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBkZWNpcGhlci5zZXRBdXRoVGFnKHRhZyk7XG4gIGNvbnN0IHB0ID0gQnVmZmVyLmNvbmNhdChbZGVjaXBoZXIudXBkYXRlKGN0KSwgZGVjaXBoZXIuZmluYWwoKV0pO1xuICByZXR1cm4gcHQudG9TdHJpbmcoXCJ1dGY4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tS2V5KHByZWZpeCA9IFwia3hfbGl2ZV9cIikge1xuICBjb25zdCBieXRlcyA9IGNyeXB0by5yYW5kb21CeXRlcygzMik7XG4gIHJldHVybiBwcmVmaXggKyBiYXNlNjR1cmwoYnl0ZXMpLnNsaWNlKDAsIDQ4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoYTI1NkhleChpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBobWFjU2hhMjU2SGV4KHNlY3JldCwgaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbi8qKlxuICogS2V5IGhhc2hpbmcgc3RyYXRlZ3k6XG4gKiAtIERlZmF1bHQ6IFNIQS0yNTYoa2V5KVxuICogLSBJZiBLRVlfUEVQUEVSIGlzIHNldDogSE1BQy1TSEEyNTYoS0VZX1BFUFBFUiwga2V5KVxuICpcbiAqIElNUE9SVEFOVDogUGVwcGVyIGlzIG9wdGlvbmFsIGFuZCBjYW4gYmUgZW5hYmxlZCBsYXRlci5cbiAqIEF1dGggY29kZSB3aWxsIGF1dG8tbWlncmF0ZSBsZWdhY3kgaGFzaGVzIG9uIGZpcnN0IHN1Y2Nlc3NmdWwgbG9va3VwLlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5SGFzaEhleChpbnB1dCkge1xuICBjb25zdCBwZXBwZXIgPSBwcm9jZXNzLmVudi5LRVlfUEVQUEVSO1xuICBpZiAocGVwcGVyKSByZXR1cm4gaG1hY1NoYTI1NkhleChwZXBwZXIsIGlucHV0KTtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsZWdhY3lLZXlIYXNoSGV4KGlucHV0KSB7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2lnbkp3dChwYXlsb2FkLCB0dGxTZWNvbmRzID0gMzYwMCkge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGVhZGVyID0geyBhbGc6IFwiSFMyNTZcIiwgdHlwOiBcIkpXVFwiIH07XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCBib2R5ID0geyAuLi5wYXlsb2FkLCBpYXQ6IG5vdywgZXhwOiBub3cgKyB0dGxTZWNvbmRzIH07XG5cbiAgY29uc3QgaCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShoZWFkZXIpKTtcbiAgY29uc3QgcCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3Qgc2lnID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICByZXR1cm4gYCR7ZGF0YX0uJHtzaWd9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUp3dCh0b2tlbikge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDMpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IFtoLCBwLCBzXSA9IHBhcnRzO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IGV4cGVjdGVkID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGEgPSBCdWZmZXIuZnJvbShleHBlY3RlZCk7XG4gICAgY29uc3QgYiA9IEJ1ZmZlci5mcm9tKHMpO1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBudWxsO1xuICAgIGlmICghY3J5cHRvLnRpbWluZ1NhZmVFcXVhbChhLCBiKSkgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShcbiAgICAgIEJ1ZmZlci5mcm9tKHAucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIiksIFwiYmFzZTY0XCIpLnRvU3RyaW5nKFwidXRmLThcIilcbiAgICApO1xuICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIGlmIChwYXlsb2FkLmV4cCAmJiBub3cgPiBwYXlsb2FkLmV4cCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHBheWxvYWQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5pbXBvcnQgeyBrZXlIYXNoSGV4LCBsZWdhY3lLZXlIYXNoSGV4LCB2ZXJpZnlKd3QgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcbmltcG9ydCB7IG1vbnRoS2V5VVRDIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuXG5mdW5jdGlvbiBiYXNlU2VsZWN0KCkge1xuICByZXR1cm4gYHNlbGVjdCBrLmlkIGFzIGFwaV9rZXlfaWQsIGsuY3VzdG9tZXJfaWQsIGsua2V5X2xhc3Q0LCBrLmxhYmVsLCBrLnJvbGUsXG4gICAgICAgICAgICAgICAgIGsubW9udGhseV9jYXBfY2VudHMgYXMga2V5X2NhcF9jZW50cywgay5ycG1fbGltaXQsIGsucnBkX2xpbWl0LFxuICAgICAgICAgICAgICAgICBrLm1heF9kZXZpY2VzLCBrLnJlcXVpcmVfaW5zdGFsbF9pZCwgay5hbGxvd2VkX3Byb3ZpZGVycywgay5hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5tb250aGx5X2NhcF9jZW50cyBhcyBjdXN0b21lcl9jYXBfY2VudHMsIGMuaXNfYWN0aXZlLFxuICAgICAgICAgICAgICAgICBjLm1heF9kZXZpY2VzX3Blcl9rZXkgYXMgY3VzdG9tZXJfbWF4X2RldmljZXNfcGVyX2tleSwgYy5yZXF1aXJlX2luc3RhbGxfaWQgYXMgY3VzdG9tZXJfcmVxdWlyZV9pbnN0YWxsX2lkLFxuICAgICAgICAgICAgICAgICBjLmFsbG93ZWRfcHJvdmlkZXJzIGFzIGN1c3RvbWVyX2FsbG93ZWRfcHJvdmlkZXJzLCBjLmFsbG93ZWRfbW9kZWxzIGFzIGN1c3RvbWVyX2FsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLnBsYW5fbmFtZSBhcyBjdXN0b21lcl9wbGFuX25hbWUsIGMuZW1haWwgYXMgY3VzdG9tZXJfZW1haWxcbiAgICAgICAgICBmcm9tIGFwaV9rZXlzIGtcbiAgICAgICAgICBqb2luIGN1c3RvbWVycyBjIG9uIGMuaWQgPSBrLmN1c3RvbWVyX2lkYDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleShwbGFpbktleSkge1xuICAvLyBQcmVmZXJyZWQgaGFzaCAocGVwcGVyZWQgaWYgZW5hYmxlZClcbiAgY29uc3QgcHJlZmVycmVkID0ga2V5SGFzaEhleChwbGFpbktleSk7XG4gIGxldCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW3ByZWZlcnJlZF1cbiAgKTtcbiAgaWYgKGtleVJlcy5yb3dDb3VudCkgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xuXG4gIC8vIElmIEtFWV9QRVBQRVIgaXMgZW5hYmxlZCwgYWxsb3cgbGVnYWN5IFNIQS0yNTYgaGFzaGVzIGFuZCBhdXRvLW1pZ3JhdGUgb24gZmlyc3QgaGl0LlxuICBpZiAocHJvY2Vzcy5lbnYuS0VZX1BFUFBFUikge1xuICAgIGNvbnN0IGxlZ2FjeSA9IGxlZ2FjeUtleUhhc2hIZXgocGxhaW5LZXkpO1xuICAgIGtleVJlcyA9IGF3YWl0IHEoXG4gICAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgICBsaW1pdCAxYCxcbiAgICAgIFtsZWdhY3ldXG4gICAgKTtcbiAgICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBrZXlSZXMucm93c1swXTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcShcbiAgICAgICAgYHVwZGF0ZSBhcGlfa2V5cyBzZXQga2V5X2hhc2g9JDFcbiAgICAgICAgIHdoZXJlIGlkPSQyIGFuZCBrZXlfaGFzaD0kM2AsXG4gICAgICAgIFtwcmVmZXJyZWQsIHJvdy5hcGlfa2V5X2lkLCBsZWdhY3ldXG4gICAgICApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gaWdub3JlIG1pZ3JhdGlvbiBlcnJvcnNcbiAgICB9XG5cbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXlCeUlkKGFwaV9rZXlfaWQpIHtcbiAgY29uc3Qga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsuaWQ9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFthcGlfa2V5X2lkXVxuICApO1xuICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBrZXlSZXMucm93c1swXTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIEF1dGhvcml6YXRpb24gQmVhcmVyIHRva2VuLlxuICogU3VwcG9ydGVkOlxuICogLSBLYWl4dSBzdWIta2V5IChwbGFpbiB2aXJ0dWFsIGtleSlcbiAqIC0gU2hvcnQtbGl2ZWQgdXNlciBzZXNzaW9uIEpXVCAodHlwZTogJ3VzZXJfc2Vzc2lvbicpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNvbHZlQXV0aCh0b2tlbikge1xuICBpZiAoIXRva2VuKSByZXR1cm4gbnVsbDtcblxuICAvLyBKV1RzIGhhdmUgMyBkb3Qtc2VwYXJhdGVkIHBhcnRzLiBLYWl4dSBrZXlzIGRvIG5vdC5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDMpIHtcbiAgICBjb25zdCBwYXlsb2FkID0gdmVyaWZ5Snd0KHRva2VuKTtcbiAgICBpZiAoIXBheWxvYWQpIHJldHVybiBudWxsO1xuICAgIGlmIChwYXlsb2FkLnR5cGUgIT09IFwidXNlcl9zZXNzaW9uXCIpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0gYXdhaXQgbG9va3VwS2V5QnlJZChwYXlsb2FkLmFwaV9rZXlfaWQpO1xuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gYXdhaXQgbG9va3VwS2V5KHRva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldE1vbnRoUm9sbHVwKGN1c3RvbWVyX2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgZXh0cmFfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2Vuc1xuICAgICBmcm9tIG1vbnRobHlfdXNhZ2Ugd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbY3VzdG9tZXJfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCA9PT0gMCkgcmV0dXJuIHsgc3BlbnRfY2VudHM6IDAsIGV4dHJhX2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAgfTtcbiAgcmV0dXJuIHJvbGwucm93c1swXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEtleU1vbnRoUm9sbHVwKGFwaV9rZXlfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzXG4gICAgIGZyb20gbW9udGhseV9rZXlfdXNhZ2Ugd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQpIHJldHVybiByb2xsLnJvd3NbMF07XG5cbiAgLy8gQmFja2ZpbGwgZm9yIG1pZ3JhdGVkIGluc3RhbGxzICh3aGVuIG1vbnRobHlfa2V5X3VzYWdlIGRpZCBub3QgZXhpc3QgeWV0KS5cbiAgY29uc3Qga2V5TWV0YSA9IGF3YWl0IHEoYHNlbGVjdCBjdXN0b21lcl9pZCBmcm9tIGFwaV9rZXlzIHdoZXJlIGlkPSQxYCwgW2FwaV9rZXlfaWRdKTtcbiAgY29uc3QgY3VzdG9tZXJfaWQgPSBrZXlNZXRhLnJvd0NvdW50ID8ga2V5TWV0YS5yb3dzWzBdLmN1c3RvbWVyX2lkIDogbnVsbDtcblxuICBjb25zdCBhZ2cgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgY29hbGVzY2Uoc3VtKGNvc3RfY2VudHMpLDApOjppbnQgYXMgc3BlbnRfY2VudHMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0oaW5wdXRfdG9rZW5zKSwwKTo6aW50IGFzIGlucHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShvdXRwdXRfdG9rZW5zKSwwKTo6aW50IGFzIG91dHB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb3VudCgqKTo6aW50IGFzIGNhbGxzXG4gICAgIGZyb20gdXNhZ2VfZXZlbnRzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIHRvX2NoYXIoY3JlYXRlZF9hdCBhdCB0aW1lIHpvbmUgJ1VUQycsJ1lZWVktTU0nKT0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuXG4gIGNvbnN0IHJvdyA9IGFnZy5yb3dzWzBdIHx8IHsgc3BlbnRfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCwgY2FsbHM6IDAgfTtcblxuICBpZiAoY3VzdG9tZXJfaWQgIT0gbnVsbCkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gbW9udGhseV9rZXlfdXNhZ2UoYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxscylcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICBkbyB1cGRhdGUgc2V0XG4gICAgICAgICBzcGVudF9jZW50cyA9IGV4Y2x1ZGVkLnNwZW50X2NlbnRzLFxuICAgICAgICAgaW5wdXRfdG9rZW5zID0gZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgICAgb3V0cHV0X3Rva2VucyA9IGV4Y2x1ZGVkLm91dHB1dF90b2tlbnMsXG4gICAgICAgICBjYWxscyA9IGV4Y2x1ZGVkLmNhbGxzLFxuICAgICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICAgIFthcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHJvdy5zcGVudF9jZW50cyB8fCAwLCByb3cuaW5wdXRfdG9rZW5zIHx8IDAsIHJvdy5vdXRwdXRfdG9rZW5zIHx8IDAsIHJvdy5jYWxscyB8fCAwXVxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcm93O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0aXZlQ2FwQ2VudHMoa2V5Um93LCByb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5rZXlfY2FwX2NlbnRzID8/IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHM7XG4gIGNvbnN0IGV4dHJhID0gcm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiAoYmFzZSB8fCAwKSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzIHx8IDA7XG4gIGNvbnN0IGV4dHJhID0gY3VzdG9tZXJSb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIGJhc2UgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGtleUNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgLy8gSWYgYSBrZXkgb3ZlcnJpZGUgZXhpc3RzLCBpdCdzIGEgaGFyZCBjYXAgZm9yIHRoYXQga2V5LiBPdGhlcndpc2UgaXQgaW5oZXJpdHMgdGhlIGN1c3RvbWVyIGNhcC5cbiAgaWYgKGtleVJvdy5rZXlfY2FwX2NlbnRzICE9IG51bGwpIHJldHVybiBrZXlSb3cua2V5X2NhcF9jZW50cztcbiAgcmV0dXJuIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCk7XG59XG5cblxuY29uc3QgUk9MRV9PUkRFUiA9IFtcInZpZXdlclwiLFwiZGVwbG95ZXJcIixcImFkbWluXCIsXCJvd25lclwiXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWQpIHtcbiAgY29uc3QgYSA9IFJPTEVfT1JERVIuaW5kZXhPZigoYWN0dWFsIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIGNvbnN0IHIgPSBST0xFX09SREVSLmluZGV4T2YoKHJlcXVpcmVkIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIHJldHVybiBhID49IHIgJiYgYSAhPT0gLTEgJiYgciAhPT0gLTE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlS2V5Um9sZShrZXlSb3csIHJlcXVpcmVkUm9sZSkge1xuICBjb25zdCBhY3R1YWwgPSAoa2V5Um93Py5yb2xlIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKTtcbiAgaWYgKCFyb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkUm9sZSkpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGb3JiaWRkZW5cIik7XG4gICAgZXJyLnN0YXR1cyA9IDQwMztcbiAgICBlcnIuY29kZSA9IFwiRk9SQklEREVOXCI7XG4gICAgZXJyLmhpbnQgPSBgUmVxdWlyZXMgcm9sZSAnJHtyZXF1aXJlZFJvbGV9JywgYnV0IGtleSByb2xlIGlzICcke2FjdHVhbH0nLmA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgYXVkaXQgbG9nOiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVkaXQoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0ID0gbnVsbCwgbWV0YSA9IHt9KSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBhdWRpdF9ldmVudHMoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0LCBtZXRhKSB2YWx1ZXMgKCQxLCQyLCQzLCQ0Ojpqc29uYilgLFxuICAgICAgW2FjdG9yLCBhY3Rpb24sIHRhcmdldCwgSlNPTi5zdHJpbmdpZnkobWV0YSB8fCB7fSldXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcImF1ZGl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IHdyYXAgfSBmcm9tIFwiLi9fbGliL3dyYXAuanNcIjtcbmltcG9ydCB7IGJ1aWxkQ29ycywganNvbiwgYmFkUmVxdWVzdCwgZ2V0QmVhcmVyIH0gZnJvbSBcIi4vX2xpYi9odHRwLmpzXCI7XG5pbXBvcnQgeyBsb29rdXBLZXksIHJlcXVpcmVLZXlSb2xlIH0gZnJvbSBcIi4vX2xpYi9hdXRoei5qc1wiO1xuaW1wb3J0IHsgcSB9IGZyb20gXCIuL19saWIvZGIuanNcIjtcbmltcG9ydCB7IGF1ZGl0IH0gZnJvbSBcIi4vX2xpYi9hdWRpdC5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwNCwgaGVhZGVyczogY29ycyB9KTtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSByZXR1cm4ganNvbig0MDUsIHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgY29ycyk7XG5cbiAgY29uc3Qgd29ya2VyU2VjcmV0ID0gKHByb2Nlc3MuZW52LkpPQl9XT1JLRVJfU0VDUkVUIHx8IFwiXCIpLnRyaW0oKTtcbiAgaWYgKCF3b3JrZXJTZWNyZXQpIHJldHVybiBqc29uKDUwMCwgeyBlcnJvcjogXCJNaXNzaW5nIEpPQl9XT1JLRVJfU0VDUkVUXCIsIGNvZGU6IFwiQ09ORklHXCIgfSwgY29ycyk7XG5cbiAgY29uc3Qga2V5ID0gZ2V0QmVhcmVyKHJlcSk7XG4gIGlmICgha2V5KSByZXR1cm4ganNvbig0MDEsIHsgZXJyb3I6IFwiTWlzc2luZyBBdXRob3JpemF0aW9uIEJlYXJlciBLYWl4dSBLZXlcIiB9LCBjb3JzKTtcblxuICBjb25zdCBrcm93ID0gYXdhaXQgbG9va3VwS2V5KGtleSk7XG4gIGlmICgha3JvdykgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIkludmFsaWQgS2FpeHUgS2V5XCIgfSwgY29ycyk7XG5cbiAgcmVxdWlyZUtleVJvbGUoa3JvdywgXCJkZXBsb3llclwiKTtcblxuICBsZXQgYm9keTtcbiAgdHJ5IHsgYm9keSA9IGF3YWl0IHJlcS5qc29uKCk7IH0gY2F0Y2ggeyByZXR1cm4gYmFkUmVxdWVzdChcIkludmFsaWQgSlNPTlwiLCBjb3JzKTsgfVxuICBjb25zdCBqb2JJZCA9IChib2R5LmpvYklkIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgham9iSWQpIHJldHVybiBiYWRSZXF1ZXN0KFwiTWlzc2luZyBqb2JJZFwiLCBjb3JzKTtcblxuICBjb25zdCBqID0gYXdhaXQgcShgc2VsZWN0IGlkLCBjdXN0b21lcl9pZCwgcGFydHMsIHJlY2VpdmVkX3BhcnRzLCBzdGF0dXMgZnJvbSBnaF9wdXNoX2pvYnMgd2hlcmUgam9iX2lkPSQxIGxpbWl0IDFgLCBbam9iSWRdKTtcbiAgaWYgKCFqLnJvd0NvdW50KSByZXR1cm4ganNvbig0MDQsIHsgZXJyb3I6IFwiSm9iIG5vdCBmb3VuZFwiIH0sIGNvcnMpO1xuICBjb25zdCBqb2IgPSBqLnJvd3NbMF07XG4gIGlmIChqb2IuY3VzdG9tZXJfaWQgIT09IGtyb3cuY3VzdG9tZXJfaWQpIHJldHVybiBqc29uKDQwMywgeyBlcnJvcjogXCJGb3JiaWRkZW5cIiB9LCBjb3JzKTtcblxuICBjb25zdCBwYXJ0cyA9IHBhcnNlSW50KGpvYi5wYXJ0cywgMTApO1xuICBpZiAoIXBhcnRzIHx8IHBhcnRzIDwgMSkgcmV0dXJuIGpzb24oNDA5LCB7IGVycm9yOiBcIk5vIGNodW5rcyB1cGxvYWRlZCB5ZXQgKHBhcnRzIG5vdCBzZXQpXCIgfSwgY29ycyk7XG5cbiAgY29uc3QgcmVjZWl2ZWQgPSBuZXcgU2V0KGpvYi5yZWNlaXZlZF9wYXJ0cyB8fCBbXSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHM7IGkrKykge1xuICAgIGlmICghcmVjZWl2ZWQuaGFzKGkpKSByZXR1cm4ganNvbig0MDksIHsgZXJyb3I6IGBNaXNzaW5nIGNodW5rIHBhcnQgJHtpfWAsIGNvZGU6IFwiUEFSVFNfSU5DT01QTEVURVwiIH0sIGNvcnMpO1xuICB9XG5cbiAgYXdhaXQgcShgdXBkYXRlIGdoX3B1c2hfam9icyBzZXQgc3RhdHVzPSdxdWV1ZWQnLCB1cGRhdGVkX2F0PW5vdygpIHdoZXJlIGlkPSQxYCwgW2pvYi5pZF0pO1xuXG4gIC8vIFRyaWdnZXIgYmFja2dyb3VuZCB3b3JrZXJcbiAgY29uc3Qgb3JpZ2luID0gcHJvY2Vzcy5lbnYuVVJMIHx8IG5ldyBVUkwocmVxLnVybCkub3JpZ2luO1xuICBhd2FpdCBmZXRjaChgJHtvcmlnaW59Ly5uZXRsaWZ5L2Z1bmN0aW9ucy9naC1wdXNoLWJhY2tncm91bmRgLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIFwieC1rYWl4dS1qb2Itc2VjcmV0XCI6IHdvcmtlclNlY3JldFxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBqb2JJZCB9KVxuICB9KTtcblxuICBhd2FpdCBxKFxuICAgIGBpbnNlcnQgaW50byBnaF9wdXNoX2V2ZW50cyhjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgam9iX3Jvd19pZCwgZXZlbnRfdHlwZSwgYnl0ZXMsIG1ldGEpXG4gICAgIHZhbHVlcyAoJDEsJDIsJDMsJ3F1ZXVlJywwLCQ0Ojpqc29uYilgLFxuICAgIFtrcm93LmN1c3RvbWVyX2lkLCBrcm93LmFwaV9rZXlfaWQsIGpvYi5pZCwgSlNPTi5zdHJpbmdpZnkoeyBwYXJ0cyB9KV1cbiAgKTtcblxuICBhd2FpdCBhdWRpdChga2V5OiR7a3Jvdy5rZXlfbGFzdDR9YCwgXCJHSVRIVUJfUFVTSF9RVUVVRVwiLCBgZ2g6JHtqb2JJZH1gLCB7IHBhcnRzIH0pO1xuXG4gIHJldHVybiBqc29uKDIwMiwgeyBvazogdHJ1ZSwgcXVldWVkOiB0cnVlLCBqb2JJZCB9LCBjb3JzKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUFPLFNBQVMsVUFBVSxLQUFLO0FBQzdCLFFBQU0sWUFBWSxRQUFRLElBQUksbUJBQW1CLElBQUksS0FBSztBQUMxRCxRQUFNLFlBQVksSUFBSSxRQUFRLElB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TUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQTJHO0FBQUEsTUFDM0c7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW1CQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFrQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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
