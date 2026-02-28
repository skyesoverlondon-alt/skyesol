
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
function text(status, body, headers = {}) {
  return new Response(body, { status, headers });
}
function badRequest(message, headers = {}) {
  return json(400, { error: message }, headers);
}
function getBearer(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}
function monthKeyUTC(d = /* @__PURE__ */ new Date()) {
  return d.toISOString().slice(0, 7);
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
async function q(text2, params = []) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(text2, params);
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
function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw configError(
      "Missing JWT_SECRET",
      "Set JWT_SECRET in Netlify \u2192 Site configuration \u2192 Environment variables (use a long random string)."
    );
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = base64url(crypto.createHmac("sha256", secret).update(data).digest());
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(s);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
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
async function lookupKeyById(api_key_id) {
  const keyRes = await q(
    `${baseSelect()}
     where k.id=$1 and k.revoked_at is null
     limit 1`,
    [api_key_id]
  );
  if (!keyRes.rowCount) return null;
  return keyRes.rows[0];
}
async function resolveAuth(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length === 3) {
    const payload = verifyJwt(token);
    if (!payload) return null;
    if (payload.type !== "user_session") return null;
    const row = await lookupKeyById(payload.api_key_id);
    return row;
  }
  return await lookupKey(token);
}
async function getMonthRollup(customer_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, extra_cents, input_tokens, output_tokens
     from monthly_usage where customer_id=$1 and month=$2`,
    [customer_id, month]
  );
  if (roll.rowCount === 0) return { spent_cents: 0, extra_cents: 0, input_tokens: 0, output_tokens: 0 };
  return roll.rows[0];
}
async function getKeyMonthRollup(api_key_id, month = monthKeyUTC()) {
  const roll = await q(
    `select spent_cents, input_tokens, output_tokens, calls
     from monthly_key_usage where api_key_id=$1 and month=$2`,
    [api_key_id, month]
  );
  if (roll.rowCount) return roll.rows[0];
  const keyMeta = await q(`select customer_id from api_keys where id=$1`, [api_key_id]);
  const customer_id = keyMeta.rowCount ? keyMeta.rows[0].customer_id : null;
  const agg = await q(
    `select coalesce(sum(cost_cents),0)::int as spent_cents,
            coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens,
            count(*)::int as calls
     from usage_events
     where api_key_id=$1 and to_char(created_at at time zone 'UTC','YYYY-MM')=$2`,
    [api_key_id, month]
  );
  const row = agg.rows[0] || { spent_cents: 0, input_tokens: 0, output_tokens: 0, calls: 0 };
  if (customer_id != null) {
    await q(
      `insert into monthly_key_usage(api_key_id, customer_id, month, spent_cents, input_tokens, output_tokens, calls)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (api_key_id, month)
       do update set
         spent_cents = excluded.spent_cents,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         calls = excluded.calls,
         updated_at = now()`,
      [api_key_id, customer_id, month, row.spent_cents || 0, row.input_tokens || 0, row.output_tokens || 0, row.calls || 0]
    );
  }
  return row;
}
function customerCapCents(keyRow, customerRollup) {
  const base = keyRow.customer_cap_cents || 0;
  const extra = customerRollup.extra_cents || 0;
  return base + extra;
}
function keyCapCents(keyRow, customerRollup) {
  if (keyRow.key_cap_cents != null) return keyRow.key_cap_cents;
  return customerCapCents(keyRow, customerRollup);
}

// netlify/functions/_lib/csv.js
function esc(v) {
  if (v === null || v === void 0) return "";
  const s = String(v);
  if (/[\n\r,"]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function toCsv({ header, rows }) {
  const lines = [];
  if (header && header.length) lines.push(header.map(esc).join(","));
  for (const r of rows) {
    lines.push(r.map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

// netlify/functions/_lib/invoices.js
function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}
async function computeInvoiceSnapshot(customer_id, month) {
  const cRes = await q(
    `select id, email, plan_name, monthly_cap_cents, is_active,
            stripe_customer_id, auto_topup_enabled, auto_topup_amount_cents, auto_topup_threshold_cents
     from customers where id=$1`,
    [customer_id]
  );
  if (!cRes.rowCount) return null;
  const customer = cRes.rows[0];
  const uRes = await q(
    `select month, spent_cents, extra_cents, input_tokens, output_tokens
     from monthly_usage where customer_id=$1 and month=$2`,
    [customer_id, month]
  );
  const roll = uRes.rowCount ? uRes.rows[0] : { month, spent_cents: 0, extra_cents: 0, input_tokens: 0, output_tokens: 0 };
  const kRes = await q(
    `select k.id as api_key_id, k.key_last4, k.label,
            coalesce(mk.spent_cents,0)::int as spent_cents,
            coalesce(mk.input_tokens,0)::int as input_tokens,
            coalesce(mk.output_tokens,0)::int as output_tokens,
            coalesce(mk.calls,0)::int as calls
     from api_keys k
     left join monthly_key_usage mk
       on mk.api_key_id=k.id and mk.month=$2
     where k.customer_id=$1
     order by mk.spent_cents desc nulls last, k.created_at asc`,
    [customer_id, month]
  );
  const tRes = await q(
    `select amount_cents, source, stripe_session_id, status, created_at
     from topup_events
     where customer_id=$1 and month=$2
     order by created_at asc`,
    [customer_id, month]
  );
  let push = null;
  try {
    const range = monthRangeUTC(month);
    if (range) {
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
      if (pv.rowCount) {
        const cfg = pv.rows[0];
        const usage = await q(
          `select
              count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
              coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
           from push_usage_events
           where customer_id=$1 and created_at >= $2 and created_at < $3`,
          [customer_id, range.start.toISOString(), range.end.toISOString()]
        );
        const deploys = usage.rows[0]?.deploys_ready || 0;
        const bytes = Number(usage.rows[0]?.bytes_uploaded || 0);
        const gb = bytes / 1073741824;
        const base = cfg.base_month_cents;
        const deployCost = cfg.per_deploy_cents * deploys;
        const gbCost = Math.round(cfg.per_gb_cents * gb);
        const total = base + deployCost + gbCost;
        push = {
          pricing_version: cfg.pricing_version,
          currency: cfg.currency,
          base_month_cents: base,
          per_deploy_cents: cfg.per_deploy_cents,
          per_gb_cents: cfg.per_gb_cents,
          monthly_cap_cents: cfg.monthly_cap_cents,
          deploys_ready: deploys,
          bytes_uploaded: bytes,
          gb_estimate: Math.round(gb * 1e3) / 1e3,
          deploy_cost_cents: deployCost,
          storage_cost_cents: gbCost,
          total_cents: total
        };
      }
    }
  } catch {
    push = null;
  }
  const snapshot = {
    generated_at: (/* @__PURE__ */ new Date()).toISOString(),
    month,
    customer: {
      id: customer.id,
      email: customer.email,
      plan_name: customer.plan_name,
      monthly_cap_cents: customer.monthly_cap_cents,
      stripe_customer_id: customer.stripe_customer_id || null
    },
    totals: {
      cap_cents: customer.monthly_cap_cents,
      extra_cents: roll.extra_cents || 0,
      spent_cents: roll.spent_cents || 0,
      input_tokens: roll.input_tokens || 0,
      output_tokens: roll.output_tokens || 0,
      total_tokens: (roll.input_tokens || 0) + (roll.output_tokens || 0),
      push_total_cents: push?.total_cents ?? 0,
      grand_total_cents: (roll.spent_cents || 0) + (roll.extra_cents || 0) + (push?.total_cents ?? 0)
    },
    keys: kRes.rows || [],
    topups: tRes.rows || [],
    auto_topup: {
      enabled: !!customer.auto_topup_enabled,
      threshold_cents: customer.auto_topup_threshold_cents ?? null,
      amount_cents: customer.auto_topup_amount_cents ?? null
    },
    push
  };
  return snapshot;
}

// netlify/functions/user-export.js
function monthRangeUTC2(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}
var user_export_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);
  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization" }, cors);
  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "events").toString();
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString();
  const limit = Math.min(5e3, Math.max(1, parseInt(url.searchParams.get("limit") || "5000", 10)));
  if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Invalid month. Use YYYY-MM", cors);
  const range = monthRangeUTC2(month);
  if (!range) return badRequest("Invalid month. Use YYYY-MM", cors);
  if (type === "events") {
    const res = await q(
      `select created_at, provider, model, input_tokens, output_tokens, cost_cents, install_id
       from usage_events
       where api_key_id=$1 and created_at >= $2 and created_at < $3
       order by created_at asc
       limit $3`,
      [keyRow.api_key_id, range.start.toISOString(), range.end.toISOString(), limit]
    );
    const csv = toCsv({
      header: ["created_at", "provider", "model", "input_tokens", "output_tokens", "cost_cents", "install_id"],
      rows: res.rows.map((r) => [r.created_at, r.provider, r.model, r.input_tokens, r.output_tokens, r.cost_cents, r.install_id])
    });
    return text(200, csv, {
      ...cors,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=kaixu-events-${month}-key${keyRow.key_last4}.csv`
    });
  }
  if (type === "summary") {
    const custRoll = await getMonthRollup(keyRow.customer_id, month);
    const keyRoll = await getKeyMonthRollup(keyRow.api_key_id, month);
    const cap = customerCapCents(keyRow, custRoll);
    const kcap = keyCapCents(keyRow, custRoll);
    const csv = toCsv({
      header: ["month", "customer_id", "plan", "customer_cap_cents", "customer_spent_cents", "customer_extra_cents", "key_id", "key_last4", "key_label", "key_cap_cents", "key_spent_cents"],
      rows: [[
        month,
        keyRow.customer_id,
        keyRow.customer_plan_name || "",
        cap,
        custRoll.spent_cents || 0,
        custRoll.extra_cents || 0,
        keyRow.api_key_id,
        keyRow.key_last4,
        keyRow.label || "",
        kcap,
        keyRoll.spent_cents || 0
      ]]
    });
    return text(200, csv, {
      ...cors,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=kaixu-summary-${month}-key${keyRow.key_last4}.csv`
    });
  }
  if (type === "invoice") {
    const existing = await q(
      `select snapshot, created_at, updated_at from monthly_invoices where customer_id=$1 and month=$2`,
      [keyRow.customer_id, month]
    );
    const snap = existing.rowCount ? existing.rows[0].snapshot : await computeInvoiceSnapshot(keyRow.customer_id, month);
    if (!snap) return json(404, { error: "Invoice not found" }, cors);
    const rows = [];
    rows.push(["TOTAL", "", "", snap.totals.spent_cents, snap.totals.total_tokens]);
    for (const k of snap.keys || []) {
      rows.push(["KEY", k.api_key_id, k.key_last4, k.spent_cents, (k.input_tokens || 0) + (k.output_tokens || 0)]);
    }
    const csv = toCsv({
      header: ["type", "api_key_id", "key_last4", "spent_cents", "total_tokens"],
      rows
    });
    return text(200, csv, {
      ...cors,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=kaixu-invoice-${month}-customer${keyRow.customer_id}.csv`
    });
  }
  return badRequest("Unknown type. Use events|summary|invoice", cors);
});
export {
  user_export_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2F1dGh6LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvY3N2LmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvaW52b2ljZXMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvdXNlci1leHBvcnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBmdW5jdGlvbiBidWlsZENvcnMocmVxKSB7XG4gIGNvbnN0IGFsbG93UmF3ID0gKHByb2Nlc3MuZW52LkFMTE9XRURfT1JJR0lOUyB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IHJlcU9yaWdpbiA9IHJlcS5oZWFkZXJzLmdldChcIm9yaWdpblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJPcmlnaW5cIik7XG5cbiAgLy8gSU1QT1JUQU5UOiBrZWVwIHRoaXMgbGlzdCBhbGlnbmVkIHdpdGggd2hhdGV2ZXIgaGVhZGVycyB5b3VyIGFwcHMgc2VuZC5cbiAgY29uc3QgYWxsb3dIZWFkZXJzID0gXCJhdXRob3JpemF0aW9uLCBjb250ZW50LXR5cGUsIHgta2FpeHUtaW5zdGFsbC1pZCwgeC1rYWl4dS1yZXF1ZXN0LWlkLCB4LWthaXh1LWFwcCwgeC1rYWl4dS1idWlsZCwgeC1hZG1pbi1wYXNzd29yZCwgeC1rYWl4dS1lcnJvci10b2tlbiwgeC1rYWl4dS1tb2RlLCB4LWNvbnRlbnQtc2hhMSwgeC1zZXR1cC1zZWNyZXQsIHgta2FpeHUtam9iLXNlY3JldCwgeC1qb2Itd29ya2VyLXNlY3JldFwiO1xuICBjb25zdCBhbGxvd01ldGhvZHMgPSBcIkdFVCxQT1NULFBVVCxQQVRDSCxERUxFVEUsT1BUSU9OU1wiO1xuXG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzXCI6IGFsbG93SGVhZGVycyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW1ldGhvZHNcIjogYWxsb3dNZXRob2RzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtZXhwb3NlLWhlYWRlcnNcIjogXCJ4LWthaXh1LXJlcXVlc3QtaWRcIixcbiAgICBcImFjY2Vzcy1jb250cm9sLW1heC1hZ2VcIjogXCI4NjQwMFwiXG4gIH07XG5cbiAgLy8gU1RSSUNUIEJZIERFRkFVTFQ6XG4gIC8vIC0gSWYgQUxMT1dFRF9PUklHSU5TIGlzIHVuc2V0L2JsYW5rIGFuZCBhIGJyb3dzZXIgT3JpZ2luIGlzIHByZXNlbnQsIHdlIGRvIE5PVCBncmFudCBDT1JTLlxuICAvLyAtIEFsbG93LWFsbCBpcyBvbmx5IGVuYWJsZWQgd2hlbiBBTExPV0VEX09SSUdJTlMgZXhwbGljaXRseSBjb250YWlucyBcIipcIi5cbiAgaWYgKCFhbGxvd1Jhdykge1xuICAgIC8vIE5vIGFsbG93LW9yaWdpbiBncmFudGVkLiBTZXJ2ZXItdG8tc2VydmVyIHJlcXVlc3RzIChubyBPcmlnaW4gaGVhZGVyKSBzdGlsbCB3b3JrIG5vcm1hbGx5LlxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWQgPSBhbGxvd1Jhdy5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIC8vIEV4cGxpY2l0IGFsbG93LWFsbFxuICBpZiAoYWxsb3dlZC5pbmNsdWRlcyhcIipcIikpIHtcbiAgICBjb25zdCBvcmlnaW4gPSByZXFPcmlnaW4gfHwgXCIqXCI7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiBvcmlnaW4sXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhhY3QtbWF0Y2ggYWxsb3dsaXN0XG4gIGlmIChyZXFPcmlnaW4gJiYgYWxsb3dlZC5pbmNsdWRlcyhyZXFPcmlnaW4pKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiOiByZXFPcmlnaW4sXG4gICAgICB2YXJ5OiBcIk9yaWdpblwiXG4gICAgfTtcbiAgfVxuXG4gIC8vIE9yaWdpbiBwcmVzZW50IGJ1dCBub3QgYWxsb3dlZDogZG8gbm90IGdyYW50IGFsbG93LW9yaWdpbi5cbiAgcmV0dXJuIHtcbiAgICAuLi5iYXNlLFxuICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICB9O1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBqc29uKHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoYm9keSksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAuLi5oZWFkZXJzXG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRleHQoc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhZFJlcXVlc3QobWVzc2FnZSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBqc29uKDQwMCwgeyBlcnJvcjogbWVzc2FnZSB9LCBoZWFkZXJzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJlYXJlcihyZXEpIHtcbiAgY29uc3QgYXV0aCA9IHJlcS5oZWFkZXJzLmdldChcImF1dGhvcml6YXRpb25cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiQXV0aG9yaXphdGlvblwiKSB8fCBcIlwiO1xuICBpZiAoIWF1dGguc3RhcnRzV2l0aChcIkJlYXJlciBcIikpIHJldHVybiBudWxsO1xuICByZXR1cm4gYXV0aC5zbGljZSg3KS50cmltKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb250aEtleVVUQyhkID0gbmV3IERhdGUoKSkge1xuICByZXR1cm4gZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDcpOyAvLyBZWVlZLU1NXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnN0YWxsSWQocmVxKSB7XG4gIHJldHVybiAoXG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1pbnN0YWxsLWlkXCIpIHx8XG4gICAgcmVxLmhlYWRlcnMuZ2V0KFwiWC1LYWl4dS1JbnN0YWxsLUlkXCIpIHx8XG4gICAgXCJcIlxuICApLnRvU3RyaW5nKCkudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckFnZW50KHJlcSkge1xuICByZXR1cm4gKHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiVXNlci1BZ2VudFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnNsaWNlKDAsIDI0MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGllbnRJcChyZXEpIHtcbiAgLy8gTmV0bGlmeSBhZGRzIHgtbmYtY2xpZW50LWNvbm5lY3Rpb24taXAgd2hlbiBkZXBsb3llZCAobWF5IGJlIG1pc3NpbmcgaW4gbmV0bGlmeSBkZXYpLlxuICBjb25zdCBhID0gKHJlcS5oZWFkZXJzLmdldChcIngtbmYtY2xpZW50LWNvbm5lY3Rpb24taXBcIikgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCk7XG4gIGlmIChhKSByZXR1cm4gYTtcblxuICAvLyBGYWxsYmFjayB0byBmaXJzdCBYLUZvcndhcmRlZC1Gb3IgZW50cnkuXG4gIGNvbnN0IHhmZiA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1mb3JcIikgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCF4ZmYpIHJldHVybiBudWxsO1xuICBjb25zdCBmaXJzdCA9IHhmZi5zcGxpdChcIixcIilbMF0udHJpbSgpO1xuICByZXR1cm4gZmlyc3QgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNsZWVwKG1zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBtcykpO1xufSIsICJpbXBvcnQgeyBuZW9uIH0gZnJvbSBcIkBuZXRsaWZ5L25lb25cIjtcblxuLyoqXG4gKiBOZXRsaWZ5IERCIChOZW9uIFBvc3RncmVzKSBoZWxwZXIuXG4gKlxuICogSU1QT1JUQU5UIChOZW9uIHNlcnZlcmxlc3MgZHJpdmVyLCAyMDI1Kyk6XG4gKiAtIGBuZW9uKClgIHJldHVybnMgYSB0YWdnZWQtdGVtcGxhdGUgcXVlcnkgZnVuY3Rpb24uXG4gKiAtIEZvciBkeW5hbWljIFNRTCBzdHJpbmdzICsgJDEgcGxhY2Vob2xkZXJzLCB1c2UgYHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpYC5cbiAqICAgKENhbGxpbmcgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGxpa2Ugc3FsKFwiU0VMRUNUIC4uLlwiKSBjYW4gYnJlYWsgb24gbmV3ZXIgZHJpdmVyIHZlcnNpb25zLilcbiAqXG4gKiBOZXRsaWZ5IERCIGF1dG9tYXRpY2FsbHkgaW5qZWN0cyBgTkVUTElGWV9EQVRBQkFTRV9VUkxgIHdoZW4gdGhlIE5lb24gZXh0ZW5zaW9uIGlzIGF0dGFjaGVkLlxuICovXG5cbmxldCBfc3FsID0gbnVsbDtcbmxldCBfc2NoZW1hUHJvbWlzZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFNxbCgpIHtcbiAgaWYgKF9zcWwpIHJldHVybiBfc3FsO1xuXG4gIGNvbnN0IGhhc0RiVXJsID0gISEocHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMKTtcbiAgaWYgKCFoYXNEYlVybCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcIkRhdGFiYXNlIG5vdCBjb25maWd1cmVkIChtaXNzaW5nIE5FVExJRllfREFUQUJBU0VfVVJMKS4gQXR0YWNoIE5ldGxpZnkgREIgKE5lb24pIHRvIHRoaXMgc2l0ZS5cIik7XG4gICAgZXJyLmNvZGUgPSBcIkRCX05PVF9DT05GSUdVUkVEXCI7XG4gICAgZXJyLnN0YXR1cyA9IDUwMDtcbiAgICBlcnIuaGludCA9IFwiTmV0bGlmeSBVSSBcdTIxOTIgRXh0ZW5zaW9ucyBcdTIxOTIgTmVvbiBcdTIxOTIgQWRkIGRhdGFiYXNlIChvciBydW46IG5weCBuZXRsaWZ5IGRiIGluaXQpLlwiO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIF9zcWwgPSBuZW9uKCk7IC8vIGF1dG8tdXNlcyBwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCBvbiBOZXRsaWZ5XG4gIHJldHVybiBfc3FsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVTY2hlbWEoKSB7XG4gIGlmIChfc2NoZW1hUHJvbWlzZSkgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xuXG4gIF9zY2hlbWFQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gW1xuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgZW1haWwgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHBsYW5fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3N0YXJ0ZXInLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMjAwMCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N1YnNjcmlwdGlvbl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3RhdHVzIHRleHQsXG4gICAgICAgIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHosXG4gICAgICAgIGF1dG9fdG9wdXBfZW5hYmxlZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2UsXG4gICAgICAgIGF1dG9fdG9wdXBfYW1vdW50X2NlbnRzIGludGVnZXIsXG4gICAgICAgIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzIGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFwaV9rZXlzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBrZXlfaGFzaCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAga2V5X2xhc3Q0IHRleHQgbm90IG51bGwsXG4gICAgICAgIGxhYmVsIHRleHQsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIsXG4gICAgICAgIHJwbV9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBycGRfbGltaXQgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6XG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfY3VzdG9tZXJfaWRfaWR4IG9uIGFwaV9rZXlzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfdXNhZ2UgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXh0cmFfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZV9jdXN0b21lcl9tb250aF9pZHggb24gbW9udGhseV9rZXlfdXNhZ2UoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIG1vbnRobHlfa2V5X3VzYWdlIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB1c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfa2V5X2lkeCBvbiB1c2FnZV9ldmVudHMoYXBpX2tleV9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgYWN0b3IgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWN0aW9uIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRhcmdldCB0ZXh0LFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGF1ZGl0X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBhdWRpdF9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB3aW5kb3dfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHdpbmRvd19zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3Nfd2luZG93X2lkeCBvbiByYXRlX2xpbWl0X3dpbmRvd3Mod2luZG93X3N0YXJ0IGRlc2MpO2AsICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2luc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcF9oYXNoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVhIHRleHQ7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfaW5zdGFsbF9pZHggb24gdXNhZ2VfZXZlbnRzKGluc3RhbGxfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYWxlcnRzX3NlbnQgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYWxlcnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgbW9udGgsIGFsZXJ0X3R5cGUpXG4gICAgICApO2AsXG4gICAgXG4gICAgICAvLyAtLS0gRGV2aWNlIGJpbmRpbmcgLyBzZWF0cyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzX3Blcl9rZXkgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1heF9kZXZpY2VzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWlyZV9pbnN0YWxsX2lkIGJvb2xlYW47YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9wcm92aWRlcnMgdGV4dFtdO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlcyAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBpbnN0YWxsX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGRldmljZV9sYWJlbCB0ZXh0LFxuICAgICAgICBmaXJzdF9zZWVuX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9zZWVuX3VhIHRleHQsXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJldm9rZWRfYnkgdGV4dCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIGluc3RhbGxfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfY3VzdG9tZXJfaWR4IG9uIGtleV9kZXZpY2VzKGN1c3RvbWVyX2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2xhc3Rfc2Vlbl9pZHggb24ga2V5X2RldmljZXMobGFzdF9zZWVuX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBJbnZvaWNlIHNuYXBzaG90cyArIHRvcHVwcyAtLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc25hcHNob3QganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYW1vdW50X2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHNvdXJjZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21hbnVhbCcsXG4gICAgICAgIHN0cmlwZV9zZXNzaW9uX2lkIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FwcGxpZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHRvcHVwX2V2ZW50cyhjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhc3luY19qb2JzIChcbiAgICAgICAgaWQgdXVpZCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1vZGVsIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBjb21wbGV0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGhlYXJ0YmVhdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgb3V0cHV0X3RleHQgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX2N1c3RvbWVyX2NyZWF0ZWRfaWR4IG9uIGFzeW5jX2pvYnMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhc3luY19qb2JzX3N0YXR1c19pZHggb24gYXN5bmNfam9icyhzdGF0dXMsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICBcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcmVxdWVzdF9pZCB0ZXh0LFxuICAgICAgICBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nLFxuICAgICAgICBraW5kIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWV0aG9kIHRleHQsXG4gICAgICAgIHBhdGggdGV4dCxcbiAgICAgICAgb3JpZ2luIHRleHQsXG4gICAgICAgIHJlZmVyZXIgdGV4dCxcbiAgICAgICAgdXNlcl9hZ2VudCB0ZXh0LFxuICAgICAgICBpcCB0ZXh0LFxuICAgICAgICBhcHBfaWQgdGV4dCxcbiAgICAgICAgYnVpbGRfaWQgdGV4dCxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50LFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCxcbiAgICAgICAgbW9kZWwgdGV4dCxcbiAgICAgICAgaHR0cF9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgZHVyYXRpb25fbXMgaW50ZWdlcixcbiAgICAgICAgZXJyb3JfY29kZSB0ZXh0LFxuICAgICAgICBlcnJvcl9tZXNzYWdlIHRleHQsXG4gICAgICAgIGVycm9yX3N0YWNrIHRleHQsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICB1cHN0cmVhbV9ib2R5IHRleHQsXG4gICAgICAgIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyBGb3J3YXJkLWNvbXBhdGlibGUgcGF0Y2hpbmc6IGlmIGdhdGV3YXlfZXZlbnRzIGV4aXN0ZWQgZnJvbSBhbiBvbGRlciBidWlsZCxcbiAgICAgIC8vIGl0IG1heSBiZSBtaXNzaW5nIGNvbHVtbnMgdXNlZCBieSBtb25pdG9yIGluc2VydHMuXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVlc3RfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsZXZlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luZm8nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGtpbmQgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdldmVudCc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3Vua25vd24nO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1ldGhvZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhdGggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBvcmlnaW4gdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZWZlcmVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXNlcl9hZ2VudCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBwX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnVpbGRfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjdXN0b21lcl9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXBpX2tleV9pZCBiaWdpbnQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcHJvdmlkZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtb2RlbCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGh0dHBfc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZHVyYXRpb25fbXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9jb2RlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfbWVzc2FnZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX3N0YWNrIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fc3RhdHVzIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdXBzdHJlYW1fYm9keSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGV4dHJhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpO2AsXG5cbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19jcmVhdGVkX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfcmVxdWVzdF9pZHggb24gZ2F0ZXdheV9ldmVudHMocmVxdWVzdF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19sZXZlbF9pZHggb24gZ2F0ZXdheV9ldmVudHMobGV2ZWwsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19mbl9pZHggb24gZ2F0ZXdheV9ldmVudHMoZnVuY3Rpb25fbmFtZSwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2FwcF9pZHggb24gZ2F0ZXdheV9ldmVudHMoYXBwX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIC8vIC0tLSBLYWl4dVB1c2ggKERlcGxveSBQdXNoKSBlbnRlcnByaXNlIHRhYmxlcyAtLS1cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcm9sZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RlcGxveWVyJztgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX3JvbGVfaWR4IG9uIGFwaV9rZXlzKHJvbGUpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfbmV0bGlmeV90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5hbWUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmV0bGlmeV9zaXRlX2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKGN1c3RvbWVyX2lkLCBwcm9qZWN0X2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHJvamVjdHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3Rfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJvamVjdHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGl0bGUgdGV4dCxcbiAgICAgICAgZGVwbG95X2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIHN0YXRlIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcXVpcmVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICB1cGxvYWRlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICB1cmwgdGV4dCxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX3B1c2hlcyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZmlsZV9tYW5pZmVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXNfY3VzdG9tZXJfaWR4IG9uIHB1c2hfcHVzaGVzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChwdXNoX3Jvd19pZCwgc2hhMSlcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2pvYnNfcHVzaF9pZHggb24gcHVzaF9qb2JzKHB1c2hfcm93X2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYnVja2V0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnVja2V0X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkoY3VzdG9tZXJfaWQsIGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3NfYnVja2V0X2lkeCBvbiBwdXNoX3JhdGVfd2luZG93cyhidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9maWxlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb2RlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGlyZWN0JyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9maWxlc19wdXNoX2lkeCBvbiBwdXNoX2ZpbGVzKHB1c2hfcm93X2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDEsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9jdXN0b21lcl9pZHggb24gcHVzaF91c2FnZV9ldmVudHMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgKFxuICAgICAgICB2ZXJzaW9uIGludGVnZXIgcHJpbWFyeSBrZXksXG4gICAgICAgIGVmZmVjdGl2ZV9mcm9tIGRhdGUgbm90IG51bGwgZGVmYXVsdCBjdXJyZW50X2RhdGUsXG4gICAgICAgIGN1cnJlbmN5IHRleHQgbm90IG51bGwgZGVmYXVsdCAnVVNEJyxcbiAgICAgICAgYmFzZV9tb250aF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2RlcGxveV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcGVyX2diX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBpbnNlcnQgaW50byBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiwgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzKVxuICAgICAgIHZhbHVlcyAoMSwgMCwgMTAsIDI1KSBvbiBjb25mbGljdCAodmVyc2lvbikgZG8gbm90aGluZztgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX3B1c2hfYmlsbGluZyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ludm9pY2VzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIHRvdGFsX2NlbnRzIGludGVnZXIgbm90IG51bGwsXG4gICAgICAgIGJyZWFrZG93biBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgLy8gR2l0SHViIFB1c2ggR2F0ZXdheSAob3B0aW9uYWwpXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9naXRodWJfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRva2VuX3R5cGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvYXV0aCcsXG4gICAgICAgIHNjb3BlcyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX2lkIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBvd25lciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXBvIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ21haW4nLFxuICAgICAgICBjb21taXRfbWVzc2FnZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0thaXh1IEdpdEh1YiBQdXNoJyxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHJlY2VpdmVkX3BhcnRzIGludGVnZXJbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OmludFtdLFxuICAgICAgICBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1cGxvYWRpbmcnLFxuICAgICAgICBhdHRlbXB0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbmV4dF9hdHRlbXB0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X2Vycm9yIHRleHQsXG4gICAgICAgIGxhc3RfZXJyb3JfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIHJlc3VsdF9jb21taXRfc2hhIHRleHQsXG4gICAgICAgIHJlc3VsdF91cmwgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfY3VzdG9tZXJfaWR4IG9uIGdoX3B1c2hfam9icyhjdXN0b21lcl9pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19uZXh0X2F0dGVtcHRfaWR4IG9uIGdoX3B1c2hfam9icyhuZXh0X2F0dGVtcHRfYXQpIHdoZXJlIHN0YXR1cyBpbiAoJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgam9iX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBnaF9wdXNoX2pvYnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHNfam9iX2lkeCBvbiBnaF9wdXNoX2V2ZW50cyhqb2Jfcm93X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG5cblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHBob25lX251bWJlciB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICB0d2lsaW9fc2lkIHRleHQsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgZGVmYXVsdF9sbG1fcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdvcGVuYWknLFxuICAgICAgICBkZWZhdWx0X2xsbV9tb2RlbCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2dwdC00LjEtbWluaScsXG4gICAgICAgIHZvaWNlX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhbGxveScsXG4gICAgICAgIGxvY2FsZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2VuLVVTJyxcbiAgICAgICAgdGltZXpvbmUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdBbWVyaWNhL1Bob2VuaXgnLFxuICAgICAgICBwbGF5Ym9vayBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9udW1iZXJzKGN1c3RvbWVyX2lkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHZvaWNlX251bWJlcl9pZCBiaWdpbnQgcmVmZXJlbmNlcyB2b2ljZV9udW1iZXJzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgcHJvdmlkZXJfY2FsbF9zaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnJvbV9udW1iZXIgdGV4dCxcbiAgICAgICAgdG9fbnVtYmVyIHRleHQsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luaXRpYXRlZCcsXG4gICAgICAgIGRpcmVjdGlvbiB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2luYm91bmQnLFxuICAgICAgICBzdGFydGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIGVuZGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBkdXJhdGlvbl9zZWNvbmRzIGludGVnZXIsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB1bmlxdWUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19wcm92aWRlcl9zaWRfdXEgb24gdm9pY2VfY2FsbHMocHJvdmlkZXIsIHByb3ZpZGVyX2NhbGxfc2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX2N1c3RvbWVyX2lkeCBvbiB2b2ljZV9jYWxscyhjdXN0b21lcl9pZCwgc3RhcnRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlcyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY2FsbF9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyB2b2ljZV9jYWxscyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHJvbGUgdGV4dCBub3QgbnVsbCwgLS0gdXNlcnxhc3Npc3RhbnR8c3lzdGVtfHRvb2xcbiAgICAgICAgY29udGVudCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzX2NhbGxfaWR4IG9uIHZvaWNlX2NhbGxfbWVzc2FnZXMoY2FsbF9pZCwgaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5IChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtaW51dGVzIG51bWVyaWMgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHlfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX3VzYWdlX21vbnRobHkoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG5dO1xuXG4gICAgZm9yIChjb25zdCBzIG9mIHN0YXRlbWVudHMpIHtcbiAgICAgIGF3YWl0IHNxbC5xdWVyeShzKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIF9zY2hlbWFQcm9taXNlO1xufVxuXG4vKipcbiAqIFF1ZXJ5IGhlbHBlciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGBwZ2AtaXNoIGludGVyZmFjZTpcbiAqIC0gcmV0dXJucyB7IHJvd3MsIHJvd0NvdW50IH1cbiAqIC0gc3VwcG9ydHMgJDEsICQyIHBsYWNlaG9sZGVycyArIHBhcmFtcyBhcnJheSB2aWEgc3FsLnF1ZXJ5KC4uLilcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHEodGV4dCwgcGFyYW1zID0gW10pIHtcbiAgYXdhaXQgZW5zdXJlU2NoZW1hKCk7XG4gIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICBjb25zdCByb3dzID0gYXdhaXQgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcyk7XG4gIHJldHVybiB7IHJvd3M6IHJvd3MgfHwgW10sIHJvd0NvdW50OiBBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cy5sZW5ndGggOiAwIH07XG59IiwgImltcG9ydCB7IHEgfSBmcm9tIFwiLi9kYi5qc1wiO1xuXG5mdW5jdGlvbiBzYWZlU3RyKHYsIG1heCA9IDgwMDApIHtcbiAgaWYgKHYgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSBTdHJpbmcodik7XG4gIGlmIChzLmxlbmd0aCA8PSBtYXgpIHJldHVybiBzO1xuICByZXR1cm4gcy5zbGljZSgwLCBtYXgpICsgYFx1MjAyNigrJHtzLmxlbmd0aCAtIG1heH0gY2hhcnMpYDtcbn1cblxuZnVuY3Rpb24gcmFuZG9tSWQoKSB7XG4gIHRyeSB7XG4gICAgaWYgKGdsb2JhbFRoaXMuY3J5cHRvPy5yYW5kb21VVUlEKSByZXR1cm4gZ2xvYmFsVGhpcy5jcnlwdG8ucmFuZG9tVVVJRCgpO1xuICB9IGNhdGNoIHt9XG4gIC8vIGZhbGxiYWNrIChub3QgUkZDNDEyMi1wZXJmZWN0LCBidXQgdW5pcXVlIGVub3VnaCBmb3IgdHJhY2luZylcbiAgcmV0dXJuIFwicmlkX1wiICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMikgKyBcIl9cIiArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVxdWVzdElkKHJlcSkge1xuICBjb25zdCBoID0gKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtcmVxdWVzdC1pZFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJ4LXJlcXVlc3QtaWRcIikgfHwgXCJcIikudHJpbSgpO1xuICByZXR1cm4gaCB8fCByYW5kb21JZCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJGdW5jdGlvbk5hbWUocmVxKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwocmVxLnVybCk7XG4gICAgY29uc3QgbSA9IHUucGF0aG5hbWUubWF0Y2goL1xcL1xcLm5ldGxpZnlcXC9mdW5jdGlvbnNcXC8oW15cXC9dKykvaSk7XG4gICAgcmV0dXJuIG0gPyBtWzFdIDogXCJ1bmtub3duXCI7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcInVua25vd25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdE1ldGEocmVxKSB7XG4gIGxldCB1cmwgPSBudWxsO1xuICB0cnkgeyB1cmwgPSBuZXcgVVJMKHJlcS51cmwpOyB9IGNhdGNoIHt9XG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiByZXEubWV0aG9kIHx8IG51bGwsXG4gICAgcGF0aDogdXJsID8gdXJsLnBhdGhuYW1lIDogbnVsbCxcbiAgICBxdWVyeTogdXJsID8gT2JqZWN0LmZyb21FbnRyaWVzKHVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKSA6IHt9LFxuICAgIG9yaWdpbjogcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKSB8fCBudWxsLFxuICAgIHJlZmVyZXI6IHJlcS5oZWFkZXJzLmdldChcInJlZmVyZXJcIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiUmVmZXJlclwiKSB8fCBudWxsLFxuICAgIHVzZXJfYWdlbnQ6IHJlcS5oZWFkZXJzLmdldChcInVzZXItYWdlbnRcIikgfHwgbnVsbCxcbiAgICBpcDogcmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBudWxsLFxuICAgIGFwcF9pZDogKHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtYXBwXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsLFxuICAgIGJ1aWxkX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1idWlsZFwiKSB8fCBcIlwiKS50cmltKCkgfHwgbnVsbFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRXJyb3IoZXJyKSB7XG4gIGNvbnN0IGUgPSBlcnIgfHwge307XG4gIHJldHVybiB7XG4gICAgbmFtZTogc2FmZVN0cihlLm5hbWUsIDIwMCksXG4gICAgbWVzc2FnZTogc2FmZVN0cihlLm1lc3NhZ2UsIDQwMDApLFxuICAgIGNvZGU6IHNhZmVTdHIoZS5jb2RlLCAyMDApLFxuICAgIHN0YXR1czogTnVtYmVyLmlzRmluaXRlKGUuc3RhdHVzKSA/IGUuc3RhdHVzIDogbnVsbCxcbiAgICBoaW50OiBzYWZlU3RyKGUuaGludCwgMjAwMCksXG4gICAgc3RhY2s6IHNhZmVTdHIoZS5zdGFjaywgMTIwMDApLFxuICAgIHVwc3RyZWFtOiBlLnVwc3RyZWFtID8ge1xuICAgICAgcHJvdmlkZXI6IHNhZmVTdHIoZS51cHN0cmVhbS5wcm92aWRlciwgNTApLFxuICAgICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbS5zdGF0dXMpID8gZS51cHN0cmVhbS5zdGF0dXMgOiBudWxsLFxuICAgICAgYm9keTogc2FmZVN0cihlLnVwc3RyZWFtLmJvZHksIDEyMDAwKSxcbiAgICAgIHJlcXVlc3RfaWQ6IHNhZmVTdHIoZS51cHN0cmVhbS5yZXF1ZXN0X2lkLCAyMDApLFxuICAgICAgcmVzcG9uc2VfaGVhZGVyczogZS51cHN0cmVhbS5yZXNwb25zZV9oZWFkZXJzIHx8IHVuZGVmaW5lZFxuICAgIH0gOiB1bmRlZmluZWRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZUpzb25Cb2R5KGJvZHkpIHtcbiAgLy8gU2FmZSBzdW1tYXJ5OyBhdm9pZHMgbG9nZ2luZyBmdWxsIHByb21wdHMgYnkgZGVmYXVsdC5cbiAgY29uc3QgYiA9IGJvZHkgfHwge307XG4gIGNvbnN0IHByb3ZpZGVyID0gKGIucHJvdmlkZXIgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkudG9Mb3dlckNhc2UoKSB8fCBudWxsO1xuICBjb25zdCBtb2RlbCA9IChiLm1vZGVsIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpIHx8IG51bGw7XG5cbiAgbGV0IG1lc3NhZ2VDb3VudCA9IG51bGw7XG4gIGxldCB0b3RhbENoYXJzID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiLm1lc3NhZ2VzKSkge1xuICAgICAgbWVzc2FnZUNvdW50ID0gYi5tZXNzYWdlcy5sZW5ndGg7XG4gICAgICB0b3RhbENoYXJzID0gYi5tZXNzYWdlcy5yZWR1Y2UoKGFjYywgbSkgPT4gYWNjICsgU3RyaW5nKG0/LmNvbnRlbnQgPz8gXCJcIikubGVuZ3RoLCAwKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cblxuICByZXR1cm4ge1xuICAgIHByb3ZpZGVyLFxuICAgIG1vZGVsLFxuICAgIG1heF90b2tlbnM6IE51bWJlci5pc0Zpbml0ZShiLm1heF90b2tlbnMpID8gcGFyc2VJbnQoYi5tYXhfdG9rZW5zLCAxMCkgOiBudWxsLFxuICAgIHRlbXBlcmF0dXJlOiB0eXBlb2YgYi50ZW1wZXJhdHVyZSA9PT0gXCJudW1iZXJcIiA/IGIudGVtcGVyYXR1cmUgOiBudWxsLFxuICAgIG1lc3NhZ2VfY291bnQ6IG1lc3NhZ2VDb3VudCxcbiAgICBtZXNzYWdlX2NoYXJzOiB0b3RhbENoYXJzXG4gIH07XG59XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgbW9uaXRvciBldmVudDogZmFpbHVyZXMgbmV2ZXIgYnJlYWsgdGhlIG1haW4gcmVxdWVzdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVtaXRFdmVudChldikge1xuICB0cnkge1xuICAgIGNvbnN0IGUgPSBldiB8fCB7fTtcbiAgICBjb25zdCBleHRyYSA9IGUuZXh0cmEgfHwge307XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBnYXRld2F5X2V2ZW50c1xuICAgICAgICAocmVxdWVzdF9pZCwgbGV2ZWwsIGtpbmQsIGZ1bmN0aW9uX25hbWUsIG1ldGhvZCwgcGF0aCwgb3JpZ2luLCByZWZlcmVyLCB1c2VyX2FnZW50LCBpcCxcbiAgICAgICAgIGFwcF9pZCwgYnVpbGRfaWQsIGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBwcm92aWRlciwgbW9kZWwsIGh0dHBfc3RhdHVzLCBkdXJhdGlvbl9tcyxcbiAgICAgICAgIGVycm9yX2NvZGUsIGVycm9yX21lc3NhZ2UsIGVycm9yX3N0YWNrLCB1cHN0cmVhbV9zdGF0dXMsIHVwc3RyZWFtX2JvZHksIGV4dHJhKVxuICAgICAgIHZhbHVlc1xuICAgICAgICAoJDEsJDIsJDMsJDQsJDUsJDYsJDcsJDgsJDksJDEwLFxuICAgICAgICAgJDExLCQxMiwkMTMsJDE0LCQxNSwkMTYsJDE3LCQxOCxcbiAgICAgICAgICQxOSwkMjAsJDIxLCQyMiwkMjMsJDI0LCQyNTo6anNvbmIpYCxcbiAgICAgIFtcbiAgICAgICAgc2FmZVN0cihlLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5sZXZlbCB8fCBcImluZm9cIiwgMjApLFxuICAgICAgICBzYWZlU3RyKGUua2luZCB8fCBcImV2ZW50XCIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLmZ1bmN0aW9uX25hbWUgfHwgXCJ1bmtub3duXCIsIDEyMCksXG4gICAgICAgIHNhZmVTdHIoZS5tZXRob2QsIDIwKSxcbiAgICAgICAgc2FmZVN0cihlLnBhdGgsIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5vcmlnaW4sIDUwMCksXG4gICAgICAgIHNhZmVTdHIoZS5yZWZlcmVyLCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUudXNlcl9hZ2VudCwgODAwKSxcbiAgICAgICAgc2FmZVN0cihlLmlwLCAyMDApLFxuXG4gICAgICAgIHNhZmVTdHIoZS5hcHBfaWQsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5idWlsZF9pZCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuY3VzdG9tZXJfaWQpID8gZS5jdXN0b21lcl9pZCA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmFwaV9rZXlfaWQpID8gZS5hcGlfa2V5X2lkIDogbnVsbCxcbiAgICAgICAgc2FmZVN0cihlLnByb3ZpZGVyLCA4MCksXG4gICAgICAgIHNhZmVTdHIoZS5tb2RlbCwgMjAwKSxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuaHR0cF9zdGF0dXMpID8gZS5odHRwX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLmR1cmF0aW9uX21zKSA/IGUuZHVyYXRpb25fbXMgOiBudWxsLFxuXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9jb2RlLCAyMDApLFxuICAgICAgICBzYWZlU3RyKGUuZXJyb3JfbWVzc2FnZSwgNDAwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9zdGFjaywgMTIwMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS51cHN0cmVhbV9zdGF0dXMpID8gZS51cHN0cmVhbV9zdGF0dXMgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUudXBzdHJlYW1fYm9keSwgMTIwMDApLFxuICAgICAgICBKU09OLnN0cmluZ2lmeShleHRyYSB8fCB7fSlcbiAgICAgIF1cbiAgICApO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKFwibW9uaXRvciBlbWl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGJ1aWxkQ29ycywganNvbiB9IGZyb20gXCIuL2h0dHAuanNcIjtcbmltcG9ydCB7IGVtaXRFdmVudCwgZ2V0UmVxdWVzdElkLCBpbmZlckZ1bmN0aW9uTmFtZSwgcmVxdWVzdE1ldGEsIHNlcmlhbGl6ZUVycm9yIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG5mdW5jdGlvbiBub3JtYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3Qgc3RhdHVzID0gZXJyPy5zdGF0dXMgfHwgNTAwO1xuICBjb25zdCBjb2RlID0gZXJyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCI7XG4gIGNvbnN0IG1lc3NhZ2UgPSBlcnI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCI7XG4gIGNvbnN0IGhpbnQgPSBlcnI/LmhpbnQ7XG4gIHJldHVybiB7IHN0YXR1cywgYm9keTogeyBlcnJvcjogbWVzc2FnZSwgY29kZSwgLi4uKGhpbnQgPyB7IGhpbnQgfSA6IHt9KSB9IH07XG59XG5cbmZ1bmN0aW9uIHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgaCA9IG5ldyBIZWFkZXJzKHJlcy5oZWFkZXJzIHx8IHt9KTtcbiAgICBoLnNldChcIngta2FpeHUtcmVxdWVzdC1pZFwiLCByZXF1ZXN0X2lkKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHJlcy5ib2R5LCB7IHN0YXR1czogcmVzLnN0YXR1cywgaGVhZGVyczogaCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlQm9keVByZXZpZXcocmVzKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY3QgPSAocmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgY2xvbmUgPSByZXMuY2xvbmUoKTtcbiAgICBpZiAoY3QuaW5jbHVkZXMoXCJhcHBsaWNhdGlvbi9qc29uXCIpKSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2xvbmUuanNvbigpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGNvbnN0IHQgPSBhd2FpdCBjbG9uZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQubGVuZ3RoID4gMTIwMDApIHJldHVybiB0LnNsaWNlKDAsIDEyMDAwKSArIGBcdTIwMjYoKyR7dC5sZW5ndGggLSAxMjAwMH0gY2hhcnMpYDtcbiAgICByZXR1cm4gdDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXAoaGFuZGxlcikge1xuICByZXR1cm4gYXN5bmMgKHJlcSwgY29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gICAgY29uc3QgcmVxdWVzdF9pZCA9IGdldFJlcXVlc3RJZChyZXEpO1xuICAgIGNvbnN0IGZ1bmN0aW9uX25hbWUgPSBpbmZlckZ1bmN0aW9uTmFtZShyZXEpO1xuICAgIGNvbnN0IG1ldGEgPSByZXF1ZXN0TWV0YShyZXEpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGhhbmRsZXIocmVxLCBjb3JzLCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb25fbXMgPSBEYXRlLm5vdygpIC0gc3RhcnQ7XG4gICAgICBjb25zdCBvdXQgPSByZXMgaW5zdGFuY2VvZiBSZXNwb25zZSA/IHdpdGhSZXF1ZXN0SWQocmVzLCByZXF1ZXN0X2lkKSA6IHJlcztcblxuICAgICAgY29uc3Qgc3RhdHVzID0gb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UgPyBvdXQuc3RhdHVzIDogMjAwO1xuICAgICAgY29uc3QgbGV2ZWwgPSBzdGF0dXMgPj0gNTAwID8gXCJlcnJvclwiIDogc3RhdHVzID49IDQwMCA/IFwid2FyblwiIDogXCJpbmZvXCI7XG4gICAgICBjb25zdCBraW5kID0gc3RhdHVzID49IDQwMCA/IFwiaHR0cF9lcnJvcl9yZXNwb25zZVwiIDogXCJodHRwX3Jlc3BvbnNlXCI7XG5cbiAgICAgIGxldCBleHRyYSA9IHt9O1xuICAgICAgaWYgKHN0YXR1cyA+PSA0MDAgJiYgb3V0IGluc3RhbmNlb2YgUmVzcG9uc2UpIHtcbiAgICAgICAgZXh0cmEucmVzcG9uc2UgPSBhd2FpdCBzYWZlQm9keVByZXZpZXcob3V0KTtcbiAgICAgIH1cbiAgICAgIGlmIChkdXJhdGlvbl9tcyA+PSAxNTAwMCkge1xuICAgICAgICBleHRyYS5zbG93ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGtpbmQsXG4gICAgICAgIGZ1bmN0aW9uX25hbWUsXG4gICAgICAgIC4uLm1ldGEsXG4gICAgICAgIGh0dHBfc3RhdHVzOiBzdGF0dXMsXG4gICAgICAgIGR1cmF0aW9uX21zLFxuICAgICAgICBleHRyYVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBvdXQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcblxuICAgICAgLy8gQmVzdC1lZmZvcnQgZGV0YWlsZWQgbW9uaXRvciByZWNvcmQuXG4gICAgICBjb25zdCBzZXIgPSBzZXJpYWxpemVFcnJvcihlcnIpO1xuICAgICAgYXdhaXQgZW1pdEV2ZW50KHtcbiAgICAgICAgcmVxdWVzdF9pZCxcbiAgICAgICAgbGV2ZWw6IFwiZXJyb3JcIixcbiAgICAgICAga2luZDogXCJ0aHJvd25fZXJyb3JcIixcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgcHJvdmlkZXI6IHNlcj8udXBzdHJlYW0/LnByb3ZpZGVyIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHNlcj8uc3RhdHVzIHx8IDUwMCxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGVycm9yX2NvZGU6IHNlcj8uY29kZSB8fCBcIlNFUlZFUl9FUlJPUlwiLFxuICAgICAgICBlcnJvcl9tZXNzYWdlOiBzZXI/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgIGVycm9yX3N0YWNrOiBzZXI/LnN0YWNrIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX3N0YXR1czogc2VyPy51cHN0cmVhbT8uc3RhdHVzIHx8IG51bGwsXG4gICAgICAgIHVwc3RyZWFtX2JvZHk6IHNlcj8udXBzdHJlYW0/LmJvZHkgfHwgbnVsbCxcbiAgICAgICAgZXh0cmE6IHsgZXJyb3I6IHNlciB9XG4gICAgICB9KTtcblxuICAgICAgLy8gQXZvaWQgNTAyczogYWx3YXlzIHJldHVybiBKU09OLlxuICAgICAgY29uc29sZS5lcnJvcihcIkZ1bmN0aW9uIGVycm9yOlwiLCBlcnIpO1xuICAgICAgY29uc3QgeyBzdGF0dXMsIGJvZHkgfSA9IG5vcm1hbGl6ZUVycm9yKGVycik7XG4gICAgICByZXR1cm4ganNvbihzdGF0dXMsIHsgLi4uYm9keSwgcmVxdWVzdF9pZCB9LCB7IC4uLmNvcnMsIFwieC1rYWl4dS1yZXF1ZXN0LWlkXCI6IHJlcXVlc3RfaWQgfSk7XG4gICAgfVxuICB9O1xufVxuIiwgImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG5mdW5jdGlvbiBjb25maWdFcnJvcihtZXNzYWdlLCBoaW50KSB7XG4gIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLmNvZGUgPSBcIkNPTkZJR1wiO1xuICBlcnIuc3RhdHVzID0gNTAwO1xuICBpZiAoaGludCkgZXJyLmhpbnQgPSBoaW50O1xuICByZXR1cm4gZXJyO1xufVxuXG5mdW5jdGlvbiBiYXNlNjR1cmwoaW5wdXQpIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGlucHV0KVxuICAgIC50b1N0cmluZyhcImJhc2U2NFwiKVxuICAgIC5yZXBsYWNlKC89L2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1xcKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXFwvL2csIFwiX1wiKTtcbn1cblxuZnVuY3Rpb24gdW5iYXNlNjR1cmwoaW5wdXQpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhpbnB1dCB8fCBcIlwiKS5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKTtcbiAgY29uc3QgcGFkID0gcy5sZW5ndGggJSA0ID09PSAwID8gXCJcIiA6IFwiPVwiLnJlcGVhdCg0IC0gKHMubGVuZ3RoICUgNCkpO1xuICByZXR1cm4gQnVmZmVyLmZyb20ocyArIHBhZCwgXCJiYXNlNjRcIik7XG59XG5cbmZ1bmN0aW9uIGVuY0tleSgpIHtcbiAgLy8gUHJlZmVyIGEgZGVkaWNhdGVkIGVuY3J5cHRpb24ga2V5LiBGYWxsIGJhY2sgdG8gSldUX1NFQ1JFVCBmb3IgZHJvcC1mcmllbmRseSBpbnN0YWxscy5cbiAgY29uc3QgcmF3ID0gKHByb2Nlc3MuZW52LkRCX0VOQ1JZUFRJT05fS0VZIHx8IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgaWYgKCFyYXcpIHtcbiAgICB0aHJvdyBjb25maWdFcnJvcihcbiAgICAgIFwiTWlzc2luZyBEQl9FTkNSWVBUSU9OX0tFWSAob3IgSldUX1NFQ1JFVCBmYWxsYmFjaylcIixcbiAgICAgIFwiU2V0IERCX0VOQ1JZUFRJT05fS0VZIChyZWNvbW1lbmRlZCkgb3IgYXQgbWluaW11bSBKV1RfU0VDUkVUIGluIE5ldGxpZnkgZW52IHZhcnMuXCJcbiAgICApO1xuICB9XG4gIC8vIERlcml2ZSBhIHN0YWJsZSAzMi1ieXRlIGtleS5cbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShyYXcpLmRpZ2VzdCgpO1xufVxuXG4vKipcbiAqIEVuY3J5cHQgc21hbGwgc2VjcmV0cyBmb3IgREIgc3RvcmFnZSAoQUVTLTI1Ni1HQ00pLlxuICogRm9ybWF0OiB2MTo8aXZfYjY0dXJsPjo8dGFnX2I2NHVybD46PGNpcGhlcl9iNjR1cmw+XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNyeXB0U2VjcmV0KHBsYWludGV4dCkge1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTIpO1xuICBjb25zdCBjaXBoZXIgPSBjcnlwdG8uY3JlYXRlQ2lwaGVyaXYoXCJhZXMtMjU2LWdjbVwiLCBrZXksIGl2KTtcbiAgY29uc3QgY3QgPSBCdWZmZXIuY29uY2F0KFtjaXBoZXIudXBkYXRlKFN0cmluZyhwbGFpbnRleHQpLCBcInV0ZjhcIiksIGNpcGhlci5maW5hbCgpXSk7XG4gIGNvbnN0IHRhZyA9IGNpcGhlci5nZXRBdXRoVGFnKCk7XG4gIHJldHVybiBgdjE6JHtiYXNlNjR1cmwoaXYpfToke2Jhc2U2NHVybCh0YWcpfToke2Jhc2U2NHVybChjdCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlY3J5cHRTZWNyZXQoZW5jKSB7XG4gIGNvbnN0IHMgPSBTdHJpbmcoZW5jIHx8IFwiXCIpO1xuICBpZiAoIXMuc3RhcnRzV2l0aChcInYxOlwiKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBhcnRzID0gcy5zcGxpdChcIjpcIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDQpIHJldHVybiBudWxsO1xuICBjb25zdCBbLCBpdkIsIHRhZ0IsIGN0Ql0gPSBwYXJ0cztcbiAgY29uc3Qga2V5ID0gZW5jS2V5KCk7XG4gIGNvbnN0IGl2ID0gdW5iYXNlNjR1cmwoaXZCKTtcbiAgY29uc3QgdGFnID0gdW5iYXNlNjR1cmwodGFnQik7XG4gIGNvbnN0IGN0ID0gdW5iYXNlNjR1cmwoY3RCKTtcbiAgY29uc3QgZGVjaXBoZXIgPSBjcnlwdG8uY3JlYXRlRGVjaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBkZWNpcGhlci5zZXRBdXRoVGFnKHRhZyk7XG4gIGNvbnN0IHB0ID0gQnVmZmVyLmNvbmNhdChbZGVjaXBoZXIudXBkYXRlKGN0KSwgZGVjaXBoZXIuZmluYWwoKV0pO1xuICByZXR1cm4gcHQudG9TdHJpbmcoXCJ1dGY4XCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tS2V5KHByZWZpeCA9IFwia3hfbGl2ZV9cIikge1xuICBjb25zdCBieXRlcyA9IGNyeXB0by5yYW5kb21CeXRlcygzMik7XG4gIHJldHVybiBwcmVmaXggKyBiYXNlNjR1cmwoYnl0ZXMpLnNsaWNlKDAsIDQ4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoYTI1NkhleChpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBobWFjU2hhMjU2SGV4KHNlY3JldCwgaW5wdXQpIHtcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGlucHV0KS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbi8qKlxuICogS2V5IGhhc2hpbmcgc3RyYXRlZ3k6XG4gKiAtIERlZmF1bHQ6IFNIQS0yNTYoa2V5KVxuICogLSBJZiBLRVlfUEVQUEVSIGlzIHNldDogSE1BQy1TSEEyNTYoS0VZX1BFUFBFUiwga2V5KVxuICpcbiAqIElNUE9SVEFOVDogUGVwcGVyIGlzIG9wdGlvbmFsIGFuZCBjYW4gYmUgZW5hYmxlZCBsYXRlci5cbiAqIEF1dGggY29kZSB3aWxsIGF1dG8tbWlncmF0ZSBsZWdhY3kgaGFzaGVzIG9uIGZpcnN0IHN1Y2Nlc3NmdWwgbG9va3VwLlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5SGFzaEhleChpbnB1dCkge1xuICBjb25zdCBwZXBwZXIgPSBwcm9jZXNzLmVudi5LRVlfUEVQUEVSO1xuICBpZiAocGVwcGVyKSByZXR1cm4gaG1hY1NoYTI1NkhleChwZXBwZXIsIGlucHV0KTtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsZWdhY3lLZXlIYXNoSGV4KGlucHV0KSB7XG4gIHJldHVybiBzaGEyNTZIZXgoaW5wdXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2lnbkp3dChwYXlsb2FkLCB0dGxTZWNvbmRzID0gMzYwMCkge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGVhZGVyID0geyBhbGc6IFwiSFMyNTZcIiwgdHlwOiBcIkpXVFwiIH07XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCBib2R5ID0geyAuLi5wYXlsb2FkLCBpYXQ6IG5vdywgZXhwOiBub3cgKyB0dGxTZWNvbmRzIH07XG5cbiAgY29uc3QgaCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShoZWFkZXIpKTtcbiAgY29uc3QgcCA9IGJhc2U2NHVybChKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3Qgc2lnID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICByZXR1cm4gYCR7ZGF0YX0uJHtzaWd9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUp3dCh0b2tlbikge1xuICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xuICBpZiAoIXNlY3JldCkge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIEpXVF9TRUNSRVRcIixcbiAgICAgIFwiU2V0IEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBcdTIxOTIgU2l0ZSBjb25maWd1cmF0aW9uIFx1MjE5MiBFbnZpcm9ubWVudCB2YXJpYWJsZXMgKHVzZSBhIGxvbmcgcmFuZG9tIHN0cmluZykuXCJcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDMpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IFtoLCBwLCBzXSA9IHBhcnRzO1xuICBjb25zdCBkYXRhID0gYCR7aH0uJHtwfWA7XG4gIGNvbnN0IGV4cGVjdGVkID0gYmFzZTY0dXJsKGNyeXB0by5jcmVhdGVIbWFjKFwic2hhMjU2XCIsIHNlY3JldCkudXBkYXRlKGRhdGEpLmRpZ2VzdCgpKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGEgPSBCdWZmZXIuZnJvbShleHBlY3RlZCk7XG4gICAgY29uc3QgYiA9IEJ1ZmZlci5mcm9tKHMpO1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBudWxsO1xuICAgIGlmICghY3J5cHRvLnRpbWluZ1NhZmVFcXVhbChhLCBiKSkgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShcbiAgICAgIEJ1ZmZlci5mcm9tKHAucmVwbGFjZSgvLS9nLCBcIitcIikucmVwbGFjZSgvXy9nLCBcIi9cIiksIFwiYmFzZTY0XCIpLnRvU3RyaW5nKFwidXRmLThcIilcbiAgICApO1xuICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIGlmIChwYXlsb2FkLmV4cCAmJiBub3cgPiBwYXlsb2FkLmV4cCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHBheWxvYWQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5pbXBvcnQgeyBrZXlIYXNoSGV4LCBsZWdhY3lLZXlIYXNoSGV4LCB2ZXJpZnlKd3QgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcbmltcG9ydCB7IG1vbnRoS2V5VVRDIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuXG5mdW5jdGlvbiBiYXNlU2VsZWN0KCkge1xuICByZXR1cm4gYHNlbGVjdCBrLmlkIGFzIGFwaV9rZXlfaWQsIGsuY3VzdG9tZXJfaWQsIGsua2V5X2xhc3Q0LCBrLmxhYmVsLCBrLnJvbGUsXG4gICAgICAgICAgICAgICAgIGsubW9udGhseV9jYXBfY2VudHMgYXMga2V5X2NhcF9jZW50cywgay5ycG1fbGltaXQsIGsucnBkX2xpbWl0LFxuICAgICAgICAgICAgICAgICBrLm1heF9kZXZpY2VzLCBrLnJlcXVpcmVfaW5zdGFsbF9pZCwgay5hbGxvd2VkX3Byb3ZpZGVycywgay5hbGxvd2VkX21vZGVscyxcbiAgICAgICAgICAgICAgICAgYy5tb250aGx5X2NhcF9jZW50cyBhcyBjdXN0b21lcl9jYXBfY2VudHMsIGMuaXNfYWN0aXZlLFxuICAgICAgICAgICAgICAgICBjLm1heF9kZXZpY2VzX3Blcl9rZXkgYXMgY3VzdG9tZXJfbWF4X2RldmljZXNfcGVyX2tleSwgYy5yZXF1aXJlX2luc3RhbGxfaWQgYXMgY3VzdG9tZXJfcmVxdWlyZV9pbnN0YWxsX2lkLFxuICAgICAgICAgICAgICAgICBjLmFsbG93ZWRfcHJvdmlkZXJzIGFzIGN1c3RvbWVyX2FsbG93ZWRfcHJvdmlkZXJzLCBjLmFsbG93ZWRfbW9kZWxzIGFzIGN1c3RvbWVyX2FsbG93ZWRfbW9kZWxzLFxuICAgICAgICAgICAgICAgICBjLnBsYW5fbmFtZSBhcyBjdXN0b21lcl9wbGFuX25hbWUsIGMuZW1haWwgYXMgY3VzdG9tZXJfZW1haWxcbiAgICAgICAgICBmcm9tIGFwaV9rZXlzIGtcbiAgICAgICAgICBqb2luIGN1c3RvbWVycyBjIG9uIGMuaWQgPSBrLmN1c3RvbWVyX2lkYDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEtleShwbGFpbktleSkge1xuICAvLyBQcmVmZXJyZWQgaGFzaCAocGVwcGVyZWQgaWYgZW5hYmxlZClcbiAgY29uc3QgcHJlZmVycmVkID0ga2V5SGFzaEhleChwbGFpbktleSk7XG4gIGxldCBrZXlSZXMgPSBhd2FpdCBxKFxuICAgIGAke2Jhc2VTZWxlY3QoKX1cbiAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgbGltaXQgMWAsXG4gICAgW3ByZWZlcnJlZF1cbiAgKTtcbiAgaWYgKGtleVJlcy5yb3dDb3VudCkgcmV0dXJuIGtleVJlcy5yb3dzWzBdO1xuXG4gIC8vIElmIEtFWV9QRVBQRVIgaXMgZW5hYmxlZCwgYWxsb3cgbGVnYWN5IFNIQS0yNTYgaGFzaGVzIGFuZCBhdXRvLW1pZ3JhdGUgb24gZmlyc3QgaGl0LlxuICBpZiAocHJvY2Vzcy5lbnYuS0VZX1BFUFBFUikge1xuICAgIGNvbnN0IGxlZ2FjeSA9IGxlZ2FjeUtleUhhc2hIZXgocGxhaW5LZXkpO1xuICAgIGtleVJlcyA9IGF3YWl0IHEoXG4gICAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgICAgd2hlcmUgay5rZXlfaGFzaD0kMSBhbmQgay5yZXZva2VkX2F0IGlzIG51bGxcbiAgICAgICBsaW1pdCAxYCxcbiAgICAgIFtsZWdhY3ldXG4gICAgKTtcbiAgICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByb3cgPSBrZXlSZXMucm93c1swXTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcShcbiAgICAgICAgYHVwZGF0ZSBhcGlfa2V5cyBzZXQga2V5X2hhc2g9JDFcbiAgICAgICAgIHdoZXJlIGlkPSQyIGFuZCBrZXlfaGFzaD0kM2AsXG4gICAgICAgIFtwcmVmZXJyZWQsIHJvdy5hcGlfa2V5X2lkLCBsZWdhY3ldXG4gICAgICApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gaWdub3JlIG1pZ3JhdGlvbiBlcnJvcnNcbiAgICB9XG5cbiAgICByZXR1cm4gcm93O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb29rdXBLZXlCeUlkKGFwaV9rZXlfaWQpIHtcbiAgY29uc3Qga2V5UmVzID0gYXdhaXQgcShcbiAgICBgJHtiYXNlU2VsZWN0KCl9XG4gICAgIHdoZXJlIGsuaWQ9JDEgYW5kIGsucmV2b2tlZF9hdCBpcyBudWxsXG4gICAgIGxpbWl0IDFgLFxuICAgIFthcGlfa2V5X2lkXVxuICApO1xuICBpZiAoIWtleVJlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBrZXlSZXMucm93c1swXTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIEF1dGhvcml6YXRpb24gQmVhcmVyIHRva2VuLlxuICogU3VwcG9ydGVkOlxuICogLSBLYWl4dSBzdWIta2V5IChwbGFpbiB2aXJ0dWFsIGtleSlcbiAqIC0gU2hvcnQtbGl2ZWQgdXNlciBzZXNzaW9uIEpXVCAodHlwZTogJ3VzZXJfc2Vzc2lvbicpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNvbHZlQXV0aCh0b2tlbikge1xuICBpZiAoIXRva2VuKSByZXR1cm4gbnVsbDtcblxuICAvLyBKV1RzIGhhdmUgMyBkb3Qtc2VwYXJhdGVkIHBhcnRzLiBLYWl4dSBrZXlzIGRvIG5vdC5cbiAgY29uc3QgcGFydHMgPSB0b2tlbi5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDMpIHtcbiAgICBjb25zdCBwYXlsb2FkID0gdmVyaWZ5Snd0KHRva2VuKTtcbiAgICBpZiAoIXBheWxvYWQpIHJldHVybiBudWxsO1xuICAgIGlmIChwYXlsb2FkLnR5cGUgIT09IFwidXNlcl9zZXNzaW9uXCIpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgcm93ID0gYXdhaXQgbG9va3VwS2V5QnlJZChwYXlsb2FkLmFwaV9rZXlfaWQpO1xuICAgIHJldHVybiByb3c7XG4gIH1cblxuICByZXR1cm4gYXdhaXQgbG9va3VwS2V5KHRva2VuKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldE1vbnRoUm9sbHVwKGN1c3RvbWVyX2lkLCBtb250aCA9IG1vbnRoS2V5VVRDKCkpIHtcbiAgY29uc3Qgcm9sbCA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBzcGVudF9jZW50cywgZXh0cmFfY2VudHMsIGlucHV0X3Rva2Vucywgb3V0cHV0X3Rva2Vuc1xuICAgICBmcm9tIG1vbnRobHlfdXNhZ2Ugd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICBbY3VzdG9tZXJfaWQsIG1vbnRoXVxuICApO1xuICBpZiAocm9sbC5yb3dDb3VudCA9PT0gMCkgcmV0dXJuIHsgc3BlbnRfY2VudHM6IDAsIGV4dHJhX2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAgfTtcbiAgcmV0dXJuIHJvbGwucm93c1swXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEtleU1vbnRoUm9sbHVwKGFwaV9rZXlfaWQsIG1vbnRoID0gbW9udGhLZXlVVEMoKSkge1xuICBjb25zdCByb2xsID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IHNwZW50X2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNhbGxzXG4gICAgIGZyb20gbW9udGhseV9rZXlfdXNhZ2Ugd2hlcmUgYXBpX2tleV9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFthcGlfa2V5X2lkLCBtb250aF1cbiAgKTtcbiAgaWYgKHJvbGwucm93Q291bnQpIHJldHVybiByb2xsLnJvd3NbMF07XG5cbiAgLy8gQmFja2ZpbGwgZm9yIG1pZ3JhdGVkIGluc3RhbGxzICh3aGVuIG1vbnRobHlfa2V5X3VzYWdlIGRpZCBub3QgZXhpc3QgeWV0KS5cbiAgY29uc3Qga2V5TWV0YSA9IGF3YWl0IHEoYHNlbGVjdCBjdXN0b21lcl9pZCBmcm9tIGFwaV9rZXlzIHdoZXJlIGlkPSQxYCwgW2FwaV9rZXlfaWRdKTtcbiAgY29uc3QgY3VzdG9tZXJfaWQgPSBrZXlNZXRhLnJvd0NvdW50ID8ga2V5TWV0YS5yb3dzWzBdLmN1c3RvbWVyX2lkIDogbnVsbDtcblxuICBjb25zdCBhZ2cgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgY29hbGVzY2Uoc3VtKGNvc3RfY2VudHMpLDApOjppbnQgYXMgc3BlbnRfY2VudHMsXG4gICAgICAgICAgICBjb2FsZXNjZShzdW0oaW5wdXRfdG9rZW5zKSwwKTo6aW50IGFzIGlucHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvYWxlc2NlKHN1bShvdXRwdXRfdG9rZW5zKSwwKTo6aW50IGFzIG91dHB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb3VudCgqKTo6aW50IGFzIGNhbGxzXG4gICAgIGZyb20gdXNhZ2VfZXZlbnRzXG4gICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIHRvX2NoYXIoY3JlYXRlZF9hdCBhdCB0aW1lIHpvbmUgJ1VUQycsJ1lZWVktTU0nKT0kMmAsXG4gICAgW2FwaV9rZXlfaWQsIG1vbnRoXVxuICApO1xuXG4gIGNvbnN0IHJvdyA9IGFnZy5yb3dzWzBdIHx8IHsgc3BlbnRfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCwgY2FsbHM6IDAgfTtcblxuICBpZiAoY3VzdG9tZXJfaWQgIT0gbnVsbCkge1xuICAgIGF3YWl0IHEoXG4gICAgICBgaW5zZXJ0IGludG8gbW9udGhseV9rZXlfdXNhZ2UoYXBpX2tleV9pZCwgY3VzdG9tZXJfaWQsIG1vbnRoLCBzcGVudF9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zLCBjYWxscylcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3KVxuICAgICAgIG9uIGNvbmZsaWN0IChhcGlfa2V5X2lkLCBtb250aClcbiAgICAgICBkbyB1cGRhdGUgc2V0XG4gICAgICAgICBzcGVudF9jZW50cyA9IGV4Y2x1ZGVkLnNwZW50X2NlbnRzLFxuICAgICAgICAgaW5wdXRfdG9rZW5zID0gZXhjbHVkZWQuaW5wdXRfdG9rZW5zLFxuICAgICAgICAgb3V0cHV0X3Rva2VucyA9IGV4Y2x1ZGVkLm91dHB1dF90b2tlbnMsXG4gICAgICAgICBjYWxscyA9IGV4Y2x1ZGVkLmNhbGxzLFxuICAgICAgICAgdXBkYXRlZF9hdCA9IG5vdygpYCxcbiAgICAgIFthcGlfa2V5X2lkLCBjdXN0b21lcl9pZCwgbW9udGgsIHJvdy5zcGVudF9jZW50cyB8fCAwLCByb3cuaW5wdXRfdG9rZW5zIHx8IDAsIHJvdy5vdXRwdXRfdG9rZW5zIHx8IDAsIHJvdy5jYWxscyB8fCAwXVxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcm93O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0aXZlQ2FwQ2VudHMoa2V5Um93LCByb2xsdXApIHtcbiAgY29uc3QgYmFzZSA9IGtleVJvdy5rZXlfY2FwX2NlbnRzID8/IGtleVJvdy5jdXN0b21lcl9jYXBfY2VudHM7XG4gIGNvbnN0IGV4dHJhID0gcm9sbHVwLmV4dHJhX2NlbnRzIHx8IDA7XG4gIHJldHVybiAoYmFzZSB8fCAwKSArIGV4dHJhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VzdG9tZXJDYXBDZW50cyhrZXlSb3csIGN1c3RvbWVyUm9sbHVwKSB7XG4gIGNvbnN0IGJhc2UgPSBrZXlSb3cuY3VzdG9tZXJfY2FwX2NlbnRzIHx8IDA7XG4gIGNvbnN0IGV4dHJhID0gY3VzdG9tZXJSb2xsdXAuZXh0cmFfY2VudHMgfHwgMDtcbiAgcmV0dXJuIGJhc2UgKyBleHRyYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGtleUNhcENlbnRzKGtleVJvdywgY3VzdG9tZXJSb2xsdXApIHtcbiAgLy8gSWYgYSBrZXkgb3ZlcnJpZGUgZXhpc3RzLCBpdCdzIGEgaGFyZCBjYXAgZm9yIHRoYXQga2V5LiBPdGhlcndpc2UgaXQgaW5oZXJpdHMgdGhlIGN1c3RvbWVyIGNhcC5cbiAgaWYgKGtleVJvdy5rZXlfY2FwX2NlbnRzICE9IG51bGwpIHJldHVybiBrZXlSb3cua2V5X2NhcF9jZW50cztcbiAgcmV0dXJuIGN1c3RvbWVyQ2FwQ2VudHMoa2V5Um93LCBjdXN0b21lclJvbGx1cCk7XG59XG5cblxuY29uc3QgUk9MRV9PUkRFUiA9IFtcInZpZXdlclwiLFwiZGVwbG95ZXJcIixcImFkbWluXCIsXCJvd25lclwiXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJvbGVBdExlYXN0KGFjdHVhbCwgcmVxdWlyZWQpIHtcbiAgY29uc3QgYSA9IFJPTEVfT1JERVIuaW5kZXhPZigoYWN0dWFsIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIGNvbnN0IHIgPSBST0xFX09SREVSLmluZGV4T2YoKHJlcXVpcmVkIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKSk7XG4gIHJldHVybiBhID49IHIgJiYgYSAhPT0gLTEgJiYgciAhPT0gLTE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlS2V5Um9sZShrZXlSb3csIHJlcXVpcmVkUm9sZSkge1xuICBjb25zdCBhY3R1YWwgPSAoa2V5Um93Py5yb2xlIHx8IFwiZGVwbG95ZXJcIikudG9Mb3dlckNhc2UoKTtcbiAgaWYgKCFyb2xlQXRMZWFzdChhY3R1YWwsIHJlcXVpcmVkUm9sZSkpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJGb3JiaWRkZW5cIik7XG4gICAgZXJyLnN0YXR1cyA9IDQwMztcbiAgICBlcnIuY29kZSA9IFwiRk9SQklEREVOXCI7XG4gICAgZXJyLmhpbnQgPSBgUmVxdWlyZXMgcm9sZSAnJHtyZXF1aXJlZFJvbGV9JywgYnV0IGtleSByb2xlIGlzICcke2FjdHVhbH0nLmA7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG4iLCAiZnVuY3Rpb24gZXNjKHYpIHtcbiAgaWYgKHYgPT09IG51bGwgfHwgdiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gXCJcIjtcbiAgY29uc3QgcyA9IFN0cmluZyh2KTtcbiAgaWYgKC9bXFxuXFxyLFwiXS8udGVzdChzKSkge1xuICAgIHJldHVybiAnXCInICsgcy5yZXBsYWNlKC9cIi9nLCAnXCJcIicpICsgJ1wiJztcbiAgfVxuICByZXR1cm4gcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvQ3N2KHsgaGVhZGVyLCByb3dzIH0pIHtcbiAgY29uc3QgbGluZXMgPSBbXTtcbiAgaWYgKGhlYWRlciAmJiBoZWFkZXIubGVuZ3RoKSBsaW5lcy5wdXNoKGhlYWRlci5tYXAoZXNjKS5qb2luKFwiLFwiKSk7XG4gIGZvciAoY29uc3QgciBvZiByb3dzKSB7XG4gICAgbGluZXMucHVzaChyLm1hcChlc2MpLmpvaW4oXCIsXCIpKTtcbiAgfVxuICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKSArIFwiXFxuXCI7XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gJy4vZGIuanMnO1xuXG5mdW5jdGlvbiBtb250aFJhbmdlVVRDKG1vbnRoKSB7XG4gIGNvbnN0IFt5LCBtXSA9IFN0cmluZyhtb250aCB8fCAnJykuc3BsaXQoJy0nKS5tYXAoKHgpID0+IHBhcnNlSW50KHgsIDEwKSk7XG4gIGlmICgheSB8fCAhbSB8fCBtIDwgMSB8fCBtID4gMTIpIHJldHVybiBudWxsO1xuICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0gLSAxLCAxLCAwLCAwLCAwKSk7XG4gIGNvbnN0IGVuZCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0sIDEsIDAsIDAsIDApKTtcbiAgcmV0dXJuIHsgc3RhcnQsIGVuZCB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29tcHV0ZUludm9pY2VTbmFwc2hvdChjdXN0b21lcl9pZCwgbW9udGgpIHtcbiAgY29uc3QgY1JlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBpZCwgZW1haWwsIHBsYW5fbmFtZSwgbW9udGhseV9jYXBfY2VudHMsIGlzX2FjdGl2ZSxcbiAgICAgICAgICAgIHN0cmlwZV9jdXN0b21lcl9pZCwgYXV0b190b3B1cF9lbmFibGVkLCBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cywgYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHNcbiAgICAgZnJvbSBjdXN0b21lcnMgd2hlcmUgaWQ9JDFgLFxuICAgIFtjdXN0b21lcl9pZF1cbiAgKTtcbiAgaWYgKCFjUmVzLnJvd0NvdW50KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgY3VzdG9tZXIgPSBjUmVzLnJvd3NbMF07XG5cbiAgY29uc3QgdVJlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBtb250aCwgc3BlbnRfY2VudHMsIGV4dHJhX2NlbnRzLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnNcbiAgICAgZnJvbSBtb250aGx5X3VzYWdlIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsXG4gICAgW2N1c3RvbWVyX2lkLCBtb250aF1cbiAgKTtcbiAgY29uc3Qgcm9sbCA9IHVSZXMucm93Q291bnQgPyB1UmVzLnJvd3NbMF0gOiB7IG1vbnRoLCBzcGVudF9jZW50czogMCwgZXh0cmFfY2VudHM6IDAsIGlucHV0X3Rva2VuczogMCwgb3V0cHV0X3Rva2VuczogMCB9O1xuXG4gIGNvbnN0IGtSZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3Qgay5pZCBhcyBhcGlfa2V5X2lkLCBrLmtleV9sYXN0NCwgay5sYWJlbCxcbiAgICAgICAgICAgIGNvYWxlc2NlKG1rLnNwZW50X2NlbnRzLDApOjppbnQgYXMgc3BlbnRfY2VudHMsXG4gICAgICAgICAgICBjb2FsZXNjZShtay5pbnB1dF90b2tlbnMsMCk6OmludCBhcyBpbnB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShtay5vdXRwdXRfdG9rZW5zLDApOjppbnQgYXMgb3V0cHV0X3Rva2VucyxcbiAgICAgICAgICAgIGNvYWxlc2NlKG1rLmNhbGxzLDApOjppbnQgYXMgY2FsbHNcbiAgICAgZnJvbSBhcGlfa2V5cyBrXG4gICAgIGxlZnQgam9pbiBtb250aGx5X2tleV91c2FnZSBta1xuICAgICAgIG9uIG1rLmFwaV9rZXlfaWQ9ay5pZCBhbmQgbWsubW9udGg9JDJcbiAgICAgd2hlcmUgay5jdXN0b21lcl9pZD0kMVxuICAgICBvcmRlciBieSBtay5zcGVudF9jZW50cyBkZXNjIG51bGxzIGxhc3QsIGsuY3JlYXRlZF9hdCBhc2NgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG5cbiAgY29uc3QgdFJlcyA9IGF3YWl0IHEoXG4gICAgYHNlbGVjdCBhbW91bnRfY2VudHMsIHNvdXJjZSwgc3RyaXBlX3Nlc3Npb25faWQsIHN0YXR1cywgY3JlYXRlZF9hdFxuICAgICBmcm9tIHRvcHVwX2V2ZW50c1xuICAgICB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgbW9udGg9JDJcbiAgICAgb3JkZXIgYnkgY3JlYXRlZF9hdCBhc2NgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG5cbiAgLy8gLS0tIEthaXh1UHVzaCBjaGFyZ2VzIChkZXBsb3kgcHVzaGVzKSAtLS1cbiAgbGV0IHB1c2ggPSBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IHJhbmdlID0gbW9udGhSYW5nZVVUQyhtb250aCk7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyBwcmljaW5nIGNmZyAoZGVmYXVsdCB2MSBpZiBub3QgY29uZmlndXJlZCBmb3IgY3VzdG9tZXIpXG4gICAgICBsZXQgcHYgPSBhd2FpdCBxKFxuICAgICAgICBgc2VsZWN0IGIucHJpY2luZ192ZXJzaW9uLCBiLm1vbnRobHlfY2FwX2NlbnRzLFxuICAgICAgICAgICAgICAgIHAuYmFzZV9tb250aF9jZW50cywgcC5wZXJfZGVwbG95X2NlbnRzLCBwLnBlcl9nYl9jZW50cywgcC5jdXJyZW5jeVxuICAgICAgICAgZnJvbSBjdXN0b21lcl9wdXNoX2JpbGxpbmcgYlxuICAgICAgICAgam9pbiBwdXNoX3ByaWNpbmdfdmVyc2lvbnMgcCBvbiBwLnZlcnNpb24gPSBiLnByaWNpbmdfdmVyc2lvblxuICAgICAgICAgd2hlcmUgYi5jdXN0b21lcl9pZD0kMVxuICAgICAgICAgbGltaXQgMWAsXG4gICAgICAgIFtjdXN0b21lcl9pZF1cbiAgICAgICk7XG5cbiAgICAgIGlmICghcHYucm93Q291bnQpIHtcbiAgICAgICAgcHYgPSBhd2FpdCBxKFxuICAgICAgICAgIGBzZWxlY3QgMSBhcyBwcmljaW5nX3ZlcnNpb24sIDAgYXMgbW9udGhseV9jYXBfY2VudHMsXG4gICAgICAgICAgICAgICAgICBiYXNlX21vbnRoX2NlbnRzLCBwZXJfZGVwbG95X2NlbnRzLCBwZXJfZ2JfY2VudHMsIGN1cnJlbmN5XG4gICAgICAgICAgIGZyb20gcHVzaF9wcmljaW5nX3ZlcnNpb25zIHdoZXJlIHZlcnNpb249MSBsaW1pdCAxYCxcbiAgICAgICAgICBbXVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAocHYucm93Q291bnQpIHtcbiAgICAgICAgY29uc3QgY2ZnID0gcHYucm93c1swXTtcblxuICAgICAgICBjb25zdCB1c2FnZSA9IGF3YWl0IHEoXG4gICAgICAgICAgYHNlbGVjdFxuICAgICAgICAgICAgICBjb3VudCgqKSBmaWx0ZXIgKHdoZXJlIGV2ZW50X3R5cGU9J2RlcGxveV9yZWFkeScpOjppbnQgYXMgZGVwbG95c19yZWFkeSxcbiAgICAgICAgICAgICAgY29hbGVzY2Uoc3VtKGJ5dGVzKSBmaWx0ZXIgKHdoZXJlIGV2ZW50X3R5cGU9J2ZpbGVfdXBsb2FkJyksMCk6OmJpZ2ludCBhcyBieXRlc191cGxvYWRlZFxuICAgICAgICAgICBmcm9tIHB1c2hfdXNhZ2VfZXZlbnRzXG4gICAgICAgICAgIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBjcmVhdGVkX2F0ID49ICQyIGFuZCBjcmVhdGVkX2F0IDwgJDNgLFxuICAgICAgICAgIFtjdXN0b21lcl9pZCwgcmFuZ2Uuc3RhcnQudG9JU09TdHJpbmcoKSwgcmFuZ2UuZW5kLnRvSVNPU3RyaW5nKCldXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZGVwbG95cyA9IHVzYWdlLnJvd3NbMF0/LmRlcGxveXNfcmVhZHkgfHwgMDtcbiAgICAgICAgY29uc3QgYnl0ZXMgPSBOdW1iZXIodXNhZ2Uucm93c1swXT8uYnl0ZXNfdXBsb2FkZWQgfHwgMCk7XG4gICAgICAgIGNvbnN0IGdiID0gYnl0ZXMgLyAxMDczNzQxODI0O1xuXG4gICAgICAgIGNvbnN0IGJhc2UgPSBjZmcuYmFzZV9tb250aF9jZW50cztcbiAgICAgICAgY29uc3QgZGVwbG95Q29zdCA9IGNmZy5wZXJfZGVwbG95X2NlbnRzICogZGVwbG95cztcbiAgICAgICAgY29uc3QgZ2JDb3N0ID0gTWF0aC5yb3VuZChjZmcucGVyX2diX2NlbnRzICogZ2IpO1xuICAgICAgICBjb25zdCB0b3RhbCA9IGJhc2UgKyBkZXBsb3lDb3N0ICsgZ2JDb3N0O1xuXG4gICAgICAgIHB1c2ggPSB7XG4gICAgICAgICAgcHJpY2luZ192ZXJzaW9uOiBjZmcucHJpY2luZ192ZXJzaW9uLFxuICAgICAgICAgIGN1cnJlbmN5OiBjZmcuY3VycmVuY3ksXG4gICAgICAgICAgYmFzZV9tb250aF9jZW50czogYmFzZSxcbiAgICAgICAgICBwZXJfZGVwbG95X2NlbnRzOiBjZmcucGVyX2RlcGxveV9jZW50cyxcbiAgICAgICAgICBwZXJfZ2JfY2VudHM6IGNmZy5wZXJfZ2JfY2VudHMsXG4gICAgICAgICAgbW9udGhseV9jYXBfY2VudHM6IGNmZy5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgICAgICBkZXBsb3lzX3JlYWR5OiBkZXBsb3lzLFxuICAgICAgICAgIGJ5dGVzX3VwbG9hZGVkOiBieXRlcyxcbiAgICAgICAgICBnYl9lc3RpbWF0ZTogTWF0aC5yb3VuZChnYiAqIDEwMDApIC8gMTAwMCxcbiAgICAgICAgICBkZXBsb3lfY29zdF9jZW50czogZGVwbG95Q29zdCxcbiAgICAgICAgICBzdG9yYWdlX2Nvc3RfY2VudHM6IGdiQ29zdCxcbiAgICAgICAgICB0b3RhbF9jZW50czogdG90YWxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIC8vIElmIHB1c2ggdGFibGVzIGFyZW4ndCBwcmVzZW50IHlldCwga2VlcCBzbmFwc2hvdCB3b3JraW5nIGZvciBBSSBpbnZvaWNlcy5cbiAgICBwdXNoID0gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IHNuYXBzaG90ID0ge1xuICAgIGdlbmVyYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIG1vbnRoLFxuICAgIGN1c3RvbWVyOiB7XG4gICAgICBpZDogY3VzdG9tZXIuaWQsXG4gICAgICBlbWFpbDogY3VzdG9tZXIuZW1haWwsXG4gICAgICBwbGFuX25hbWU6IGN1c3RvbWVyLnBsYW5fbmFtZSxcbiAgICAgIG1vbnRobHlfY2FwX2NlbnRzOiBjdXN0b21lci5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgIHN0cmlwZV9jdXN0b21lcl9pZDogY3VzdG9tZXIuc3RyaXBlX2N1c3RvbWVyX2lkIHx8IG51bGxcbiAgICB9LFxuICAgIHRvdGFsczoge1xuICAgICAgY2FwX2NlbnRzOiBjdXN0b21lci5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgIGV4dHJhX2NlbnRzOiByb2xsLmV4dHJhX2NlbnRzIHx8IDAsXG4gICAgICBzcGVudF9jZW50czogcm9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgaW5wdXRfdG9rZW5zOiByb2xsLmlucHV0X3Rva2VucyB8fCAwLFxuICAgICAgb3V0cHV0X3Rva2Vuczogcm9sbC5vdXRwdXRfdG9rZW5zIHx8IDAsXG4gICAgICB0b3RhbF90b2tlbnM6IChyb2xsLmlucHV0X3Rva2VucyB8fCAwKSArIChyb2xsLm91dHB1dF90b2tlbnMgfHwgMCksXG4gICAgICBwdXNoX3RvdGFsX2NlbnRzOiBwdXNoPy50b3RhbF9jZW50cyA/PyAwLFxuICAgICAgZ3JhbmRfdG90YWxfY2VudHM6IChyb2xsLnNwZW50X2NlbnRzIHx8IDApICsgKHJvbGwuZXh0cmFfY2VudHMgfHwgMCkgKyAocHVzaD8udG90YWxfY2VudHMgPz8gMClcbiAgICB9LFxuICAgIGtleXM6IGtSZXMucm93cyB8fCBbXSxcbiAgICB0b3B1cHM6IHRSZXMucm93cyB8fCBbXSxcbiAgICBhdXRvX3RvcHVwOiB7XG4gICAgICBlbmFibGVkOiAhIWN1c3RvbWVyLmF1dG9fdG9wdXBfZW5hYmxlZCxcbiAgICAgIHRocmVzaG9sZF9jZW50czogY3VzdG9tZXIuYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHMgPz8gbnVsbCxcbiAgICAgIGFtb3VudF9jZW50czogY3VzdG9tZXIuYXV0b190b3B1cF9hbW91bnRfY2VudHMgPz8gbnVsbFxuICAgIH0sXG4gICAgcHVzaFxuICB9O1xuXG4gIHJldHVybiBzbmFwc2hvdDtcbn1cbiIsICJpbXBvcnQgeyB3cmFwIH0gZnJvbSBcIi4vX2xpYi93cmFwLmpzXCI7XG5pbXBvcnQgeyBidWlsZENvcnMsIGpzb24sIGJhZFJlcXVlc3QsIGdldEJlYXJlciwgbW9udGhLZXlVVEMsIHRleHQgfSBmcm9tIFwiLi9fbGliL2h0dHAuanNcIjtcbmltcG9ydCB7IHJlc29sdmVBdXRoLCBnZXRNb250aFJvbGx1cCwgZ2V0S2V5TW9udGhSb2xsdXAsIGN1c3RvbWVyQ2FwQ2VudHMsIGtleUNhcENlbnRzIH0gZnJvbSBcIi4vX2xpYi9hdXRoei5qc1wiO1xuaW1wb3J0IHsgcSB9IGZyb20gXCIuL19saWIvZGIuanNcIjtcbmltcG9ydCB7IHRvQ3N2IH0gZnJvbSBcIi4vX2xpYi9jc3YuanNcIjtcbmltcG9ydCB7IGNvbXB1dGVJbnZvaWNlU25hcHNob3QgfSBmcm9tIFwiLi9fbGliL2ludm9pY2VzLmpzXCI7XG5cbmZ1bmN0aW9uIG1vbnRoUmFuZ2VVVEMobW9udGgpIHtcbiAgY29uc3QgW3ksIG1dID0gU3RyaW5nKG1vbnRoIHx8IFwiXCIpLnNwbGl0KFwiLVwiKS5tYXAoKHgpID0+IHBhcnNlSW50KHgsIDEwKSk7XG4gIGlmICgheSB8fCAhbSB8fCBtIDwgMSB8fCBtID4gMTIpIHJldHVybiBudWxsO1xuICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0gLSAxLCAxLCAwLCAwLCAwKSk7XG4gIGNvbnN0IGVuZCA9IG5ldyBEYXRlKERhdGUuVVRDKHksIG0sIDEsIDAsIDAsIDApKTtcbiAgcmV0dXJuIHsgc3RhcnQsIGVuZCB9O1xufVxuXG5cbi8qKlxuICogVXNlciBleHBvcnRzIGZvciB0aGUgY3VycmVudGx5IGF1dGhlbnRpY2F0ZWQga2V5LlxuICogR0VUIC8ubmV0bGlmeS9mdW5jdGlvbnMvdXNlci1leHBvcnQ/dHlwZT1ldmVudHN8c3VtbWFyeXxpbnZvaWNlJm1vbnRoPVlZWVktTU1cbiAqXG4gKiBBdXRoOiBBdXRob3JpemF0aW9uOiBCZWFyZXIgPEthaXh1IFZpcnR1YWwgS2V5PlxuICovXG5leHBvcnQgZGVmYXVsdCB3cmFwKGFzeW5jIChyZXEpID0+IHtcbiAgY29uc3QgY29ycyA9IGJ1aWxkQ29ycyhyZXEpO1xuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDIwNCwgaGVhZGVyczogY29ycyB9KTtcbiAgaWYgKHJlcS5tZXRob2QgIT09IFwiR0VUXCIpIHJldHVybiBqc29uKDQwNSwgeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9LCBjb3JzKTtcblxuICBjb25zdCB0b2tlbiA9IGdldEJlYXJlcihyZXEpO1xuICBpZiAoIXRva2VuKSByZXR1cm4ganNvbig0MDEsIHsgZXJyb3I6IFwiTWlzc2luZyBBdXRob3JpemF0aW9uXCIgfSwgY29ycyk7XG5cbiAgY29uc3Qga2V5Um93ID0gYXdhaXQgcmVzb2x2ZUF1dGgodG9rZW4pO1xuICBpZiAoIWtleVJvdykgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIkludmFsaWQgb3IgcmV2b2tlZCBrZXlcIiB9LCBjb3JzKTtcblxuICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcS51cmwpO1xuICBjb25zdCB0eXBlID0gKHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwidHlwZVwiKSB8fCBcImV2ZW50c1wiKS50b1N0cmluZygpO1xuICBjb25zdCBtb250aCA9ICh1cmwuc2VhcmNoUGFyYW1zLmdldChcIm1vbnRoXCIpIHx8IG1vbnRoS2V5VVRDKCkpLnRvU3RyaW5nKCk7XG4gIGNvbnN0IGxpbWl0ID0gTWF0aC5taW4oNTAwMCwgTWF0aC5tYXgoMSwgcGFyc2VJbnQodXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJsaW1pdFwiKSB8fCBcIjUwMDBcIiwgMTApKSk7XG5cbiAgaWYgKCEvXlxcZHs0fS1cXGR7Mn0kLy50ZXN0KG1vbnRoKSkgcmV0dXJuIGJhZFJlcXVlc3QoXCJJbnZhbGlkIG1vbnRoLiBVc2UgWVlZWS1NTVwiLCBjb3JzKTtcblxuICBjb25zdCByYW5nZSA9IG1vbnRoUmFuZ2VVVEMobW9udGgpO1xuICBpZiAoIXJhbmdlKSByZXR1cm4gYmFkUmVxdWVzdChcIkludmFsaWQgbW9udGguIFVzZSBZWVlZLU1NXCIsIGNvcnMpO1xuXG4gIGlmICh0eXBlID09PSBcImV2ZW50c1wiKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3QgY3JlYXRlZF9hdCwgcHJvdmlkZXIsIG1vZGVsLCBpbnB1dF90b2tlbnMsIG91dHB1dF90b2tlbnMsIGNvc3RfY2VudHMsIGluc3RhbGxfaWRcbiAgICAgICBmcm9tIHVzYWdlX2V2ZW50c1xuICAgICAgIHdoZXJlIGFwaV9rZXlfaWQ9JDEgYW5kIGNyZWF0ZWRfYXQgPj0gJDIgYW5kIGNyZWF0ZWRfYXQgPCAkM1xuICAgICAgIG9yZGVyIGJ5IGNyZWF0ZWRfYXQgYXNjXG4gICAgICAgbGltaXQgJDNgLFxuICAgICAgW2tleVJvdy5hcGlfa2V5X2lkLCByYW5nZS5zdGFydC50b0lTT1N0cmluZygpLCByYW5nZS5lbmQudG9JU09TdHJpbmcoKSwgbGltaXRdXG4gICAgKTtcblxuICAgIGNvbnN0IGNzdiA9IHRvQ3N2KHtcbiAgICAgIGhlYWRlcjogW1wiY3JlYXRlZF9hdFwiLCBcInByb3ZpZGVyXCIsIFwibW9kZWxcIiwgXCJpbnB1dF90b2tlbnNcIiwgXCJvdXRwdXRfdG9rZW5zXCIsIFwiY29zdF9jZW50c1wiLCBcImluc3RhbGxfaWRcIl0sXG4gICAgICByb3dzOiByZXMucm93cy5tYXAociA9PiBbci5jcmVhdGVkX2F0LCByLnByb3ZpZGVyLCByLm1vZGVsLCByLmlucHV0X3Rva2Vucywgci5vdXRwdXRfdG9rZW5zLCByLmNvc3RfY2VudHMsIHIuaW5zdGFsbF9pZF0pXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGV4dCgyMDAsIGNzdiwge1xuICAgICAgLi4uY29ycyxcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwidGV4dC9jc3Y7IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgIFwiY29udGVudC1kaXNwb3NpdGlvblwiOiBgYXR0YWNobWVudDsgZmlsZW5hbWU9a2FpeHUtZXZlbnRzLSR7bW9udGh9LWtleSR7a2V5Um93LmtleV9sYXN0NH0uY3N2YFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09IFwic3VtbWFyeVwiKSB7XG4gICAgY29uc3QgY3VzdFJvbGwgPSBhd2FpdCBnZXRNb250aFJvbGx1cChrZXlSb3cuY3VzdG9tZXJfaWQsIG1vbnRoKTtcbiAgICBjb25zdCBrZXlSb2xsID0gYXdhaXQgZ2V0S2V5TW9udGhSb2xsdXAoa2V5Um93LmFwaV9rZXlfaWQsIG1vbnRoKTtcbiAgICBjb25zdCBjYXAgPSBjdXN0b21lckNhcENlbnRzKGtleVJvdywgY3VzdFJvbGwpO1xuICAgIGNvbnN0IGtjYXAgPSBrZXlDYXBDZW50cyhrZXlSb3csIGN1c3RSb2xsKTtcblxuICAgIGNvbnN0IGNzdiA9IHRvQ3N2KHtcbiAgICAgIGhlYWRlcjogW1wibW9udGhcIiwgXCJjdXN0b21lcl9pZFwiLCBcInBsYW5cIiwgXCJjdXN0b21lcl9jYXBfY2VudHNcIiwgXCJjdXN0b21lcl9zcGVudF9jZW50c1wiLCBcImN1c3RvbWVyX2V4dHJhX2NlbnRzXCIsIFwia2V5X2lkXCIsIFwia2V5X2xhc3Q0XCIsIFwia2V5X2xhYmVsXCIsIFwia2V5X2NhcF9jZW50c1wiLCBcImtleV9zcGVudF9jZW50c1wiXSxcbiAgICAgIHJvd3M6IFtbXG4gICAgICAgIG1vbnRoLFxuICAgICAgICBrZXlSb3cuY3VzdG9tZXJfaWQsXG4gICAgICAgIGtleVJvdy5jdXN0b21lcl9wbGFuX25hbWUgfHwgXCJcIixcbiAgICAgICAgY2FwLFxuICAgICAgICBjdXN0Um9sbC5zcGVudF9jZW50cyB8fCAwLFxuICAgICAgICBjdXN0Um9sbC5leHRyYV9jZW50cyB8fCAwLFxuICAgICAgICBrZXlSb3cuYXBpX2tleV9pZCxcbiAgICAgICAga2V5Um93LmtleV9sYXN0NCxcbiAgICAgICAga2V5Um93LmxhYmVsIHx8IFwiXCIsXG4gICAgICAgIGtjYXAsXG4gICAgICAgIGtleVJvbGwuc3BlbnRfY2VudHMgfHwgMFxuICAgICAgXV1cbiAgICB9KTtcblxuICAgIHJldHVybiB0ZXh0KDIwMCwgY3N2LCB7XG4gICAgICAuLi5jb3JzLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L2NzdjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgXCJjb250ZW50LWRpc3Bvc2l0aW9uXCI6IGBhdHRhY2htZW50OyBmaWxlbmFtZT1rYWl4dS1zdW1tYXJ5LSR7bW9udGh9LWtleSR7a2V5Um93LmtleV9sYXN0NH0uY3N2YFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHR5cGUgPT09IFwiaW52b2ljZVwiKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBxKFxuICAgICAgYHNlbGVjdCBzbmFwc2hvdCwgY3JlYXRlZF9hdCwgdXBkYXRlZF9hdCBmcm9tIG1vbnRobHlfaW52b2ljZXMgd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIG1vbnRoPSQyYCxcbiAgICAgIFtrZXlSb3cuY3VzdG9tZXJfaWQsIG1vbnRoXVxuICAgICk7XG5cbiAgICBjb25zdCBzbmFwID0gZXhpc3Rpbmcucm93Q291bnQgPyBleGlzdGluZy5yb3dzWzBdLnNuYXBzaG90IDogKGF3YWl0IGNvbXB1dGVJbnZvaWNlU25hcHNob3Qoa2V5Um93LmN1c3RvbWVyX2lkLCBtb250aCkpO1xuICAgIGlmICghc25hcCkgcmV0dXJuIGpzb24oNDA0LCB7IGVycm9yOiBcIkludm9pY2Ugbm90IGZvdW5kXCIgfSwgY29ycyk7XG5cbiAgICAvLyBQcm92aWRlIGEgc2ltcGxlIGludm9pY2UgQ1NWOiB0b3RhbHMgKyBwZXIta2V5IHJvd3NcbiAgICBjb25zdCByb3dzID0gW107XG4gICAgcm93cy5wdXNoKFtcIlRPVEFMXCIsIFwiXCIsIFwiXCIsIHNuYXAudG90YWxzLnNwZW50X2NlbnRzLCBzbmFwLnRvdGFscy50b3RhbF90b2tlbnNdKTtcbiAgICBmb3IgKGNvbnN0IGsgb2YgKHNuYXAua2V5cyB8fCBbXSkpIHtcbiAgICAgIHJvd3MucHVzaChbXCJLRVlcIiwgay5hcGlfa2V5X2lkLCBrLmtleV9sYXN0NCwgay5zcGVudF9jZW50cywgKGsuaW5wdXRfdG9rZW5zIHx8IDApICsgKGsub3V0cHV0X3Rva2VucyB8fCAwKV0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNzdiA9IHRvQ3N2KHtcbiAgICAgIGhlYWRlcjogW1widHlwZVwiLCBcImFwaV9rZXlfaWRcIiwgXCJrZXlfbGFzdDRcIiwgXCJzcGVudF9jZW50c1wiLCBcInRvdGFsX3Rva2Vuc1wiXSxcbiAgICAgIHJvd3NcbiAgICB9KTtcblxuICAgIHJldHVybiB0ZXh0KDIwMCwgY3N2LCB7XG4gICAgICAuLi5jb3JzLFxuICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L2NzdjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgXCJjb250ZW50LWRpc3Bvc2l0aW9uXCI6IGBhdHRhY2htZW50OyBmaWxlbmFtZT1rYWl4dS1pbnZvaWNlLSR7bW9udGh9LWN1c3RvbWVyJHtrZXlSb3cuY3VzdG9tZXJfaWR9LmNzdmBcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBiYWRSZXF1ZXN0KFwiVW5rbm93biB0eXBlLiBVc2UgZXZlbnRzfHN1bW1hcnl8aW52b2ljZVwiLCBjb3JzKTtcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFBTyxTQUFTLFVBQVUsS0FBSztBQUM3QixRQUFNLFlBQVksUUFBUSxJQUFJLG1CQUFtQixJQUFJLEtBQUs7QUFDMUQsUUFBTSxZQUFZLElBQUksUUFBUSxJQUFJLFFBQVEsS0FBSyxJQUFJLFFBQVEsSUFBSSxRQUFRO0FBR3ZFLFFBQU0sZUFBZTtBQUNyQixRQUFNLGVBQWU7QUFFckIsUUFBTSxPQUFPO0FBQUEsSUFDWCxnQ0FBZ0M7QUFBQSxJQUNoQyxnQ0FBZ0M7QUFBQSxJQUNoQyxpQ0FBaUM7QUFBQSxJQUNqQywwQkFBMEI7QUFBQSxFQUM1QjtBQUtBLE1BQUksQ0FBQyxVQUFVO0FBRWIsV0FBTztBQUFBLE1BQ0wsR0FBRztBQUFBLE1BQ0gsR0FBSSxZQUFZLEVBQUUsTUFBTSxTQUFTLElBQUksQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRjtBQUVBLFFBQU0sVUFBVSxTQUFTLE1BQU0sR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxP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QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFBMkc7QUFBQSxNQUMzRztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BbUJBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUErQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWtCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BZUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFTQTtBQUFBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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
