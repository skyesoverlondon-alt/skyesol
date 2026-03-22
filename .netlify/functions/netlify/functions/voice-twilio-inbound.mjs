
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

// netlify/functions/_lib/twilio.js
import crypto from "crypto";
function computeTwilioSignature({ url, params, authToken }) {
  const keys = Object.keys(params || {}).sort();
  let data = url;
  for (const k of keys) data += k + (params[k] ?? "");
  const h = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  return h;
}
function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function validateTwilioRequest({ req, url, params }) {
  const auth = (process.env.TWILIO_AUTH_TOKEN || "").toString();
  if (!auth) return { ok: false, status: 500, error: "Missing TWILIO_AUTH_TOKEN" };
  const sig = req.headers.get("x-twilio-signature") || req.headers.get("X-Twilio-Signature") || "";
  if (!sig) return { ok: false, status: 401, error: "Missing X-Twilio-Signature" };
  const expected = computeTwilioSignature({ url, params, authToken: auth });
  const ok = timingSafeEqual(sig, expected);
  if (!ok) return { ok: false, status: 401, error: "Invalid Twilio signature" };
  return { ok: true };
}
function twiml(xmlBody) {
  return new Response(xmlBody, {
    status: 200,
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
function escapeXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function sayGatherTwiml({ say, actionUrl, language = "en-US", voice = "alice", hints = null, timeout = 3 }) {
  const sayText = escapeXml(say || "");
  const action = escapeXml(actionUrl);
  const hintAttr = hints ? ` speechHints="${escapeXml(hints)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${action}" method="POST" timeout="${timeout}" speechTimeout="auto" language="${escapeXml(language)}"${hintAttr}>
    <Say voice="${escapeXml(voice)}">${sayText}</Say>
  </Gather>
  <Say voice="${escapeXml(voice)}">I didn't catch that. Please say that again.</Say>
  <Redirect method="POST">${action}</Redirect>
</Response>`;
}

// netlify/functions/_lib/voice.js
async function getVoiceNumberByTo(toNumber) {
  const to = (toNumber || "").toString().trim();
  if (!to) return null;
  const r = await q(`select * from voice_numbers where phone_number = $1 and is_active = true`, [to]);
  return r.rows[0] || null;
}
async function upsertCall({ customerId, voiceNumberId, provider, callSid, fromNumber, toNumber, meta = {} }) {
  const r = await q(
    `insert into voice_calls (customer_id, voice_number_id, provider, provider_call_sid, from_number, to_number, meta)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (provider, provider_call_sid)
     do update set from_number=excluded.from_number, to_number=excluded.to_number
     returning *`,
    [customerId, voiceNumberId, provider, callSid, fromNumber || null, toNumber || null, JSON.stringify(meta || {})]
  );
  return r.rows[0];
}
async function addCallMessage(callId, role, content) {
  await q(
    `insert into voice_call_messages (call_id, role, content) values ($1,$2,$3)`,
    [callId, role, (content || "").toString()]
  );
}

// netlify/functions/voice-twilio-inbound.js
var voice_twilio_inbound_default = wrap(async (req) => {
  const bodyText = await req.text();
  const params = Object.fromEntries(new URLSearchParams(bodyText));
  const url = new URL(req.url);
  const fullUrl = url.toString();
  const v = validateTwilioRequest({ req, url: fullUrl, params });
  if (!v.ok) return new Response(v.error, { status: v.status || 401, headers: { "content-type": "text/plain" } });
  const callSid = params.CallSid || params.CallSID;
  const from = params.From || "";
  const to = params.To || "";
  if (!callSid || !to) return new Response("Missing CallSid/To", { status: 400 });
  const vn = await getVoiceNumberByTo(to);
  if (!vn) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured.</Say><Hangup/></Response>`);
  }
  const call = await upsertCall({
    customerId: vn.customer_id,
    voiceNumberId: vn.id,
    provider: "twilio",
    callSid,
    fromNumber: from,
    toNumber: to,
    meta: { twilio: { account_sid: params.AccountSid || null } }
  });
  const greeting = vn.playbook && vn.playbook.greeting ? vn.playbook.greeting : "SOLEnterprises. How can I help you today?";
  await addCallMessage(call.id, "system", `CALL_START from=${from} to=${to}`);
  await addCallMessage(call.id, "assistant", greeting);
  const actionUrl = new URL("/.netlify/functions/voice-twilio-turn", url.origin).toString();
  const xml = sayGatherTwiml({
    say: greeting,
    actionUrl,
    language: vn.locale || "en-US",
    voice: "alice"
  });
  return twiml(xml);
});
export {
  voice_twilio_inbound_default as default
};
