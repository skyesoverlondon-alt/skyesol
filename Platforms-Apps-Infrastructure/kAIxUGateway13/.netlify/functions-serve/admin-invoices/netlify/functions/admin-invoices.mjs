
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

// netlify/functions/_lib/admin.js
function truthyEnv(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}
function requireAdmin(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const payload = verifyJwt(token);
    if (payload && payload.role === "admin") return payload;
  }
  if (!truthyEnv(process.env.DISABLE_ADMIN_PASSWORD_HEADER)) {
    const pass = (req.headers.get("x-admin-password") || "").toString();
    const expected = (process.env.ADMIN_PASSWORD || "").toString();
    if (pass && expected && pass === expected) {
      return { role: "admin", via: "password" };
    }
  }
  return null;
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

// netlify/functions/admin-invoices.js
var admin_invoices_default = wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  const url = new URL(req.url);
  const customer_id = url.searchParams.get("customer_id") ? parseInt(url.searchParams.get("customer_id"), 10) : null;
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString();
  if (!customer_id) return badRequest("Missing customer_id", cors);
  if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Invalid month. Use YYYY-MM", cors);
  if (req.method === "GET") {
    const res = await q(`select snapshot, created_at, updated_at from monthly_invoices where customer_id=$1 and month=$2`, [customer_id, month]);
    if (res.rowCount) {
      return json(200, { exists: true, month, customer_id, snapshot: res.rows[0].snapshot, created_at: res.rows[0].created_at, updated_at: res.rows[0].updated_at }, cors);
    }
    const snap = await computeInvoiceSnapshot(customer_id, month);
    if (!snap) return json(404, { error: "Customer not found" }, cors);
    return json(200, { exists: false, month, customer_id, snapshot: snap }, cors);
  }
  if (req.method === "POST") {
    const snap = await computeInvoiceSnapshot(customer_id, month);
    if (!snap) return json(404, { error: "Customer not found" }, cors);
    await q(
      `insert into monthly_invoices(customer_id, month, snapshot)
       values ($1,$2,$3)
       on conflict (customer_id, month)
       do update set snapshot=excluded.snapshot, updated_at=now()`,
      [customer_id, month, snap]
    );
    await audit("admin", "INVOICE_SNAPSHOT", `customer:${customer_id}`, { month });
    return json(200, { ok: true, month, customer_id, snapshot: snap }, cors);
  }
  return json(405, { error: "Method not allowed" }, cors);
});
export {
  admin_invoices_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9odHRwLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvZGIuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9tb25pdG9yLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvd3JhcC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2NyeXB0by5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2FkbWluLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvaW52b2ljZXMuanMiLCAibmV0bGlmeS9mdW5jdGlvbnMvX2xpYi9hdWRpdC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9hZG1pbi1pbnZvaWNlcy5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29ycyhyZXEpIHtcbiAgY29uc3QgYWxsb3dSYXcgPSAocHJvY2Vzcy5lbnYuQUxMT1dFRF9PUklHSU5TIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgcmVxT3JpZ2luID0gcmVxLmhlYWRlcnMuZ2V0KFwib3JpZ2luXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIk9yaWdpblwiKTtcblxuICAvLyBJTVBPUlRBTlQ6IGtlZXAgdGhpcyBsaXN0IGFsaWduZWQgd2l0aCB3aGF0ZXZlciBoZWFkZXJzIHlvdXIgYXBwcyBzZW5kLlxuICBjb25zdCBhbGxvd0hlYWRlcnMgPSBcImF1dGhvcml6YXRpb24sIGNvbnRlbnQtdHlwZSwgeC1rYWl4dS1pbnN0YWxsLWlkLCB4LWthaXh1LXJlcXVlc3QtaWQsIHgta2FpeHUtYXBwLCB4LWthaXh1LWJ1aWxkLCB4LWFkbWluLXBhc3N3b3JkLCB4LWthaXh1LWVycm9yLXRva2VuLCB4LWthaXh1LW1vZGUsIHgtY29udGVudC1zaGExLCB4LXNldHVwLXNlY3JldCwgeC1rYWl4dS1qb2Itc2VjcmV0LCB4LWpvYi13b3JrZXItc2VjcmV0XCI7XG4gIGNvbnN0IGFsbG93TWV0aG9kcyA9IFwiR0VULFBPU1QsUFVULFBBVENILERFTEVURSxPUFRJT05TXCI7XG5cbiAgY29uc3QgYmFzZSA9IHtcbiAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnNcIjogYWxsb3dIZWFkZXJzLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kc1wiOiBhbGxvd01ldGhvZHMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1leHBvc2UtaGVhZGVyc1wiOiBcIngta2FpeHUtcmVxdWVzdC1pZFwiLFxuICAgIFwiYWNjZXNzLWNvbnRyb2wtbWF4LWFnZVwiOiBcIjg2NDAwXCJcbiAgfTtcblxuICAvLyBTVFJJQ1QgQlkgREVGQVVMVDpcbiAgLy8gLSBJZiBBTExPV0VEX09SSUdJTlMgaXMgdW5zZXQvYmxhbmsgYW5kIGEgYnJvd3NlciBPcmlnaW4gaXMgcHJlc2VudCwgd2UgZG8gTk9UIGdyYW50IENPUlMuXG4gIC8vIC0gQWxsb3ctYWxsIGlzIG9ubHkgZW5hYmxlZCB3aGVuIEFMTE9XRURfT1JJR0lOUyBleHBsaWNpdGx5IGNvbnRhaW5zIFwiKlwiLlxuICBpZiAoIWFsbG93UmF3KSB7XG4gICAgLy8gTm8gYWxsb3ctb3JpZ2luIGdyYW50ZWQuIFNlcnZlci10by1zZXJ2ZXIgcmVxdWVzdHMgKG5vIE9yaWdpbiBoZWFkZXIpIHN0aWxsIHdvcmsgbm9ybWFsbHkuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2UsXG4gICAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZCA9IGFsbG93UmF3LnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgLy8gRXhwbGljaXQgYWxsb3ctYWxsXG4gIGlmIChhbGxvd2VkLmluY2x1ZGVzKFwiKlwiKSkge1xuICAgIGNvbnN0IG9yaWdpbiA9IHJlcU9yaWdpbiB8fCBcIipcIjtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IG9yaWdpbixcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICAvLyBFeGFjdC1tYXRjaCBhbGxvd2xpc3RcbiAgaWYgKHJlcU9yaWdpbiAmJiBhbGxvd2VkLmluY2x1ZGVzKHJlcU9yaWdpbikpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luXCI6IHJlcU9yaWdpbixcbiAgICAgIHZhcnk6IFwiT3JpZ2luXCJcbiAgICB9O1xuICB9XG5cbiAgLy8gT3JpZ2luIHByZXNlbnQgYnV0IG5vdCBhbGxvd2VkOiBkbyBub3QgZ3JhbnQgYWxsb3ctb3JpZ2luLlxuICByZXR1cm4ge1xuICAgIC4uLmJhc2UsXG4gICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gIH07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGpzb24oc3RhdHVzLCBib2R5LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShib2R5KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLThcIixcbiAgICAgIC4uLmhlYWRlcnNcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGV4dChzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzLCBoZWFkZXJzIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFkUmVxdWVzdChtZXNzYWdlLCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIGpzb24oNDAwLCB7IGVycm9yOiBtZXNzYWdlIH0sIGhlYWRlcnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmVhcmVyKHJlcSkge1xuICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnMuZ2V0KFwiYXV0aG9yaXphdGlvblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJBdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIGlmICghYXV0aC5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdXRoLnNsaWNlKDcpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vbnRoS2V5VVRDKGQgPSBuZXcgRGF0ZSgpKSB7XG4gIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgNyk7IC8vIFlZWVktTU1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RhbGxJZChyZXEpIHtcbiAgcmV0dXJuIChcbiAgICByZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWluc3RhbGwtaWRcIikgfHxcbiAgICByZXEuaGVhZGVycy5nZXQoXCJYLUthaXh1LUluc3RhbGwtSWRcIikgfHxcbiAgICBcIlwiXG4gICkudG9TdHJpbmcoKS50cmltKCkuc2xpY2UoMCwgODApIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VyQWdlbnQocmVxKSB7XG4gIHJldHVybiAocmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJVc2VyLUFnZW50XCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkuc2xpY2UoMCwgMjQwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENsaWVudElwKHJlcSkge1xuICAvLyBOZXRsaWZ5IGFkZHMgeC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcCB3aGVuIGRlcGxveWVkIChtYXkgYmUgbWlzc2luZyBpbiBuZXRsaWZ5IGRldikuXG4gIGNvbnN0IGEgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1uZi1jbGllbnQtY29ubmVjdGlvbi1pcFwiKSB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKTtcbiAgaWYgKGEpIHJldHVybiBhO1xuXG4gIC8vIEZhbGxiYWNrIHRvIGZpcnN0IFgtRm9yd2FyZGVkLUZvciBlbnRyeS5cbiAgY29uc3QgeGZmID0gKHJlcS5oZWFkZXJzLmdldChcIngtZm9yd2FyZGVkLWZvclwiKSB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXhmZikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGZpcnN0ID0geGZmLnNwbGl0KFwiLFwiKVswXS50cmltKCk7XG4gIHJldHVybiBmaXJzdCB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2xlZXAobXMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG59IiwgImltcG9ydCB7IG5lb24gfSBmcm9tIFwiQG5ldGxpZnkvbmVvblwiO1xuXG4vKipcbiAqIE5ldGxpZnkgREIgKE5lb24gUG9zdGdyZXMpIGhlbHBlci5cbiAqXG4gKiBJTVBPUlRBTlQgKE5lb24gc2VydmVybGVzcyBkcml2ZXIsIDIwMjUrKTpcbiAqIC0gYG5lb24oKWAgcmV0dXJucyBhIHRhZ2dlZC10ZW1wbGF0ZSBxdWVyeSBmdW5jdGlvbi5cbiAqIC0gRm9yIGR5bmFtaWMgU1FMIHN0cmluZ3MgKyAkMSBwbGFjZWhvbGRlcnMsIHVzZSBgc3FsLnF1ZXJ5KHRleHQsIHBhcmFtcylgLlxuICogICAoQ2FsbGluZyB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gbGlrZSBzcWwoXCJTRUxFQ1QgLi4uXCIpIGNhbiBicmVhayBvbiBuZXdlciBkcml2ZXIgdmVyc2lvbnMuKVxuICpcbiAqIE5ldGxpZnkgREIgYXV0b21hdGljYWxseSBpbmplY3RzIGBORVRMSUZZX0RBVEFCQVNFX1VSTGAgd2hlbiB0aGUgTmVvbiBleHRlbnNpb24gaXMgYXR0YWNoZWQuXG4gKi9cblxubGV0IF9zcWwgPSBudWxsO1xubGV0IF9zY2hlbWFQcm9taXNlID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0U3FsKCkge1xuICBpZiAoX3NxbCkgcmV0dXJuIF9zcWw7XG5cbiAgY29uc3QgaGFzRGJVcmwgPSAhIShwcm9jZXNzLmVudi5ORVRMSUZZX0RBVEFCQVNFX1VSTCB8fCBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpO1xuICBpZiAoIWhhc0RiVXJsKSB7XG4gICAgY29uc3QgZXJyID0gbmV3IEVycm9yKFwiRGF0YWJhc2Ugbm90IGNvbmZpZ3VyZWQgKG1pc3NpbmcgTkVUTElGWV9EQVRBQkFTRV9VUkwpLiBBdHRhY2ggTmV0bGlmeSBEQiAoTmVvbikgdG8gdGhpcyBzaXRlLlwiKTtcbiAgICBlcnIuY29kZSA9IFwiREJfTk9UX0NPTkZJR1VSRURcIjtcbiAgICBlcnIuc3RhdHVzID0gNTAwO1xuICAgIGVyci5oaW50ID0gXCJOZXRsaWZ5IFVJIFx1MjE5MiBFeHRlbnNpb25zIFx1MjE5MiBOZW9uIFx1MjE5MiBBZGQgZGF0YWJhc2UgKG9yIHJ1bjogbnB4IG5ldGxpZnkgZGIgaW5pdCkuXCI7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgX3NxbCA9IG5lb24oKTsgLy8gYXV0by11c2VzIHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIG9uIE5ldGxpZnlcbiAgcmV0dXJuIF9zcWw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVNjaGVtYSgpIHtcbiAgaWYgKF9zY2hlbWFQcm9taXNlKSByZXR1cm4gX3NjaGVtYVByb21pc2U7XG5cbiAgX3NjaGVtYVByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNxbCA9IGdldFNxbCgpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBbXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBlbWFpbCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgcGxhbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnc3RhcnRlcicsXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAyMDAwLFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIHN0cmlwZV9jdXN0b21lcl9pZCB0ZXh0LFxuICAgICAgICBzdHJpcGVfc3Vic2NyaXB0aW9uX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdGF0dXMgdGV4dCxcbiAgICAgICAgc3RyaXBlX2N1cnJlbnRfcGVyaW9kX2VuZCB0aW1lc3RhbXB0eixcbiAgICAgICAgYXV0b190b3B1cF9lbmFibGVkIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCBmYWxzZSxcbiAgICAgICAgYXV0b190b3B1cF9hbW91bnRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgYXV0b190b3B1cF90aHJlc2hvbGRfY2VudHMgaW50ZWdlcixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXBpX2tleXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGtleV9oYXNoIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBrZXlfbGFzdDQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbGFiZWwgdGV4dCxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlcixcbiAgICAgICAgcnBtX2xpbWl0IGludGVnZXIsXG4gICAgICAgIHJwZF9saW1pdCBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHJldm9rZWRfYXQgdGltZXN0YW1wdHpcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19jdXN0b21lcl9pZF9pZHggb24gYXBpX2tleXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV91c2FnZSAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNwZW50X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBleHRyYV9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2UgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGFwaV9rZXlfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIG1vbnRobHlfa2V5X3VzYWdlX2N1c3RvbWVyX21vbnRoX2lkeCBvbiBtb250aGx5X2tleV91c2FnZShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgbW9udGhseV9rZXlfdXNhZ2UgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHNfY3VzdG9tZXJfbW9udGhfaWR4IG9uIHVzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19rZXlfaWR4IG9uIHVzYWdlX2V2ZW50cyhhcGlfa2V5X2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBhY3RvciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhY3Rpb24gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdGFyZ2V0IHRleHQsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXVkaXRfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGF1ZGl0X2V2ZW50cyhjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHdpbmRvd19zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgYXBpX2tleV9pZCwgd2luZG93X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHJhdGVfbGltaXRfd2luZG93c193aW5kb3dfaWR4IG9uIHJhdGVfbGltaXRfd2luZG93cyh3aW5kb3dfc3RhcnQgZGVzYyk7YCwgICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X3NlZW5faW5zdGFsbF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGlwX2hhc2ggdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgdWEgdGV4dDtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19pbnN0YWxsX2lkeCBvbiB1c2FnZV9ldmVudHMoaW5zdGFsbF9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhbGVydHNfc2VudCAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbGVydF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCBtb250aCwgYWxlcnRfdHlwZSlcbiAgICAgICk7YCxcbiAgICBcbiAgICAgIC8vIC0tLSBEZXZpY2UgYmluZGluZyAvIHNlYXRzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXNfcGVyX2tleSBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfbW9kZWxzIGpzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWF4X2RldmljZXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1aXJlX2luc3RhbGxfaWQgYm9vbGVhbjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX3Byb3ZpZGVycyB0ZXh0W107YCxcbiAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzIChcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGluc3RhbGxfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZGV2aWNlX2xhYmVsIHRleHQsXG4gICAgICAgIGZpcnN0X3NlZW5fYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBsYXN0X3NlZW5fdWEgdGV4dCxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmV2b2tlZF9ieSB0ZXh0LFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgaW5zdGFsbF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19jdXN0b21lcl9pZHggb24ga2V5X2RldmljZXMoY3VzdG9tZXJfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMga2V5X2RldmljZXNfbGFzdF9zZWVuX2lkeCBvbiBrZXlfZGV2aWNlcyhsYXN0X3NlZW5fYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEludm9pY2Ugc25hcHNob3RzICsgdG9wdXBzIC0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIG1vbnRobHlfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzbmFwc2hvdCBqc29uYiBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHByaW1hcnkga2V5IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBhbW91bnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgc291cmNlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFudWFsJyxcbiAgICAgICAgc3RyaXBlX3Nlc3Npb25faWQgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYXBwbGllZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHRvcHVwX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdG9wdXBfZXZlbnRzKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnMgKFxuICAgICAgICBpZCB1dWlkIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbW9kZWwgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWVzdCBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdxdWV1ZWQnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGNvbXBsZXRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgaGVhcnRiZWF0X2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBvdXRwdXRfdGV4dCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1ldGEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfY3VzdG9tZXJfY3JlYXRlZF9pZHggb24gYXN5bmNfam9icyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFzeW5jX2pvYnNfc3RhdHVzX2lkeCBvbiBhc3luY19qb2JzKHN0YXR1cywgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgIFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICByZXF1ZXN0X2lkIHRleHQsXG4gICAgICAgIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbycsXG4gICAgICAgIGtpbmQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtZXRob2QgdGV4dCxcbiAgICAgICAgcGF0aCB0ZXh0LFxuICAgICAgICBvcmlnaW4gdGV4dCxcbiAgICAgICAgcmVmZXJlciB0ZXh0LFxuICAgICAgICB1c2VyX2FnZW50IHRleHQsXG4gICAgICAgIGlwIHRleHQsXG4gICAgICAgIGFwcF9pZCB0ZXh0LFxuICAgICAgICBidWlsZF9pZCB0ZXh0LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50LFxuICAgICAgICBwcm92aWRlciB0ZXh0LFxuICAgICAgICBtb2RlbCB0ZXh0LFxuICAgICAgICBodHRwX3N0YXR1cyBpbnRlZ2VyLFxuICAgICAgICBkdXJhdGlvbl9tcyBpbnRlZ2VyLFxuICAgICAgICBlcnJvcl9jb2RlIHRleHQsXG4gICAgICAgIGVycm9yX21lc3NhZ2UgdGV4dCxcbiAgICAgICAgZXJyb3Jfc3RhY2sgdGV4dCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzIGludGVnZXIsXG4gICAgICAgIHVwc3RyZWFtX2JvZHkgdGV4dCxcbiAgICAgICAgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG5cbiAgICAgIC8vIEZvcndhcmQtY29tcGF0aWJsZSBwYXRjaGluZzogaWYgZ2F0ZXdheV9ldmVudHMgZXhpc3RlZCBmcm9tIGFuIG9sZGVyIGJ1aWxkLFxuICAgICAgLy8gaXQgbWF5IGJlIG1pc3NpbmcgY29sdW1ucyB1c2VkIGJ5IG1vbml0b3IgaW5zZXJ0cy5cbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVxdWVzdF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxldmVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5mbyc7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMga2luZCB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2V2ZW50JztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAndW5rbm93bic7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbWV0aG9kIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcGF0aCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG9yaWdpbiB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlZmVyZXIgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1c2VyX2FnZW50IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXAgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcHBfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBidWlsZF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhcGlfa2V5X2lkIGJpZ2ludDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwcm92aWRlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG1vZGVsIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaHR0cF9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBkdXJhdGlvbl9tcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX2NvZGUgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9tZXNzYWdlIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3Jfc3RhY2sgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1cHN0cmVhbV9ib2R5IHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXh0cmEganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCk7YCxcblxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2NyZWF0ZWRfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19yZXF1ZXN0X2lkeCBvbiBnYXRld2F5X2V2ZW50cyhyZXF1ZXN0X2lkKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2xldmVsX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhsZXZlbCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX2ZuX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhmdW5jdGlvbl9uYW1lLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfYXBwX2lkeCBvbiBnYXRld2F5X2V2ZW50cyhhcHBfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgLy8gLS0tIEthaXh1UHVzaCAoRGVwbG95IFB1c2gpIGVudGVycHJpc2UgdGFibGVzIC0tLVxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByb2xlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZGVwbG95ZXInO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXBpX2tleXNfcm9sZV9pZHggb24gYXBpX2tleXMocm9sZSk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9uZXRsaWZ5X3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJvamVjdHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHByb2plY3RfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbmFtZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuZXRsaWZ5X3NpdGVfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAoY3VzdG9tZXJfaWQsIHByb2plY3RfaWQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0c19jdXN0b21lcl9pZHggb24gcHVzaF9wcm9qZWN0cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcm9qZWN0cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGJyYW5jaCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0aXRsZSB0ZXh0LFxuICAgICAgICBkZXBsb3lfaWQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3RhdGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVxdWlyZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIHVwbG9hZGVkX2RpZ2VzdHMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHVybCB0ZXh0LFxuICAgICAgICBlcnJvciB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfcHVzaGVzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBmaWxlX21hbmlmZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3B1c2hlc19jdXN0b21lcl9pZHggb24gcHVzaF9wdXNoZXMoY3VzdG9tZXJfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcGFydHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1bmlxdWUgKHB1c2hfcm93X2lkLCBzaGExKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfam9ic19wdXNoX2lkeCBvbiBwdXNoX2pvYnMocHVzaF9yb3dfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ5dGVzX3N0YWdlZCBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXJ0X2J5dGVzIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHo7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3RfZXJyb3IgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0ejtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9yYXRlX3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBidWNrZXRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBidWNrZXRfc3RhcnQgdGltZXN0YW1wdHogbm90IG51bGwsXG4gICAgICAgIGNvdW50IGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwcmltYXJ5IGtleShjdXN0b21lcl9pZCwgYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93c19idWNrZXRfaWR4IG9uIHB1c2hfcmF0ZV93aW5kb3dzKGJ1Y2tldF90eXBlLCBidWNrZXRfc3RhcnQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGRlcGxveV9wYXRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNoYTEgY2hhcig0MCkgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vZGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkaXJlY3QnLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX2ZpbGVzX3B1c2hfaWR4IG9uIHB1c2hfZmlsZXMocHVzaF9yb3dfaWQpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF91c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwdXNoX3Jvd19pZCBiaWdpbnQgcmVmZXJlbmNlcyBwdXNoX3B1c2hlcyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBldmVudF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ5dGVzIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMSxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3VzYWdlX2V2ZW50cyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyAoXG4gICAgICAgIHZlcnNpb24gaW50ZWdlciBwcmltYXJ5IGtleSxcbiAgICAgICAgZWZmZWN0aXZlX2Zyb20gZGF0ZSBub3QgbnVsbCBkZWZhdWx0IGN1cnJlbnRfZGF0ZSxcbiAgICAgICAgY3VycmVuY3kgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdVU0QnLFxuICAgICAgICBiYXNlX21vbnRoX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZGVwbG95X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBwZXJfZ2JfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGluc2VydCBpbnRvIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uLCBiYXNlX21vbnRoX2NlbnRzLCBwZXJfZGVwbG95X2NlbnRzLCBwZXJfZ2JfY2VudHMpXG4gICAgICAgdmFsdWVzICgxLCAwLCAxMCwgMjUpIG9uIGNvbmZsaWN0ICh2ZXJzaW9uKSBkbyBub3RoaW5nO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfcHVzaF9iaWxsaW5nIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3ByaWNpbmdfdmVyc2lvbnModmVyc2lvbiksXG4gICAgICAgIG1vbnRobHlfY2FwX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfaW52b2ljZXMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgdG90YWxfY2VudHMgaW50ZWdlciBub3QgbnVsbCxcbiAgICAgICAgYnJlYWtkb3duIGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcblxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAvLyBHaXRIdWIgUHVzaCBHYXRld2F5IChvcHRpb25hbClcbiAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX2dpdGh1Yl90b2tlbnMgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB0b2tlbl9lbmMgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgdG9rZW5fdHlwZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29hdXRoJyxcbiAgICAgICAgc2NvcGVzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2JfaWQgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIG93bmVyIHRleHQgbm90IG51bGwsXG4gICAgICAgIHJlcG8gdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwgZGVmYXVsdCAnbWFpbicsXG4gICAgICAgIGNvbW1pdF9tZXNzYWdlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnS2FpeHUgR2l0SHViIFB1c2gnLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcmVjZWl2ZWRfcGFydHMgaW50ZWdlcltdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6aW50W10sXG4gICAgICAgIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3VwbG9hZGluZycsXG4gICAgICAgIGF0dGVtcHRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBuZXh0X2F0dGVtcHRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3RfZXJyb3IgdGV4dCxcbiAgICAgICAgbGFzdF9lcnJvcl9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgcmVzdWx0X2NvbW1pdF9zaGEgdGV4dCxcbiAgICAgICAgcmVzdWx0X3VybCB0ZXh0LFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9ic19jdXN0b21lcl9pZHggb24gZ2hfcHVzaF9qb2JzKGN1c3RvbWVyX2lkLCB1cGRhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX25leHRfYXR0ZW1wdF9pZHggb24gZ2hfcHVzaF9qb2JzKG5leHRfYXR0ZW1wdF9hdCkgd2hlcmUgc3RhdHVzIGluICgncmV0cnlfd2FpdCcsJ2Vycm9yX3RyYW5zaWVudCcpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBqb2Jfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGdoX3B1c2hfam9icyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50c19qb2JfaWR4IG9uIGdoX3B1c2hfZXZlbnRzKGpvYl9yb3dfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcblxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVycyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcGhvbmVfbnVtYmVyIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHR3aWxpb19zaWQgdGV4dCxcbiAgICAgICAgaXNfYWN0aXZlIGJvb2xlYW4gbm90IG51bGwgZGVmYXVsdCB0cnVlLFxuICAgICAgICBkZWZhdWx0X2xsbV9wcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ29wZW5haScsXG4gICAgICAgIGRlZmF1bHRfbGxtX21vZGVsIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZ3B0LTQuMS1taW5pJyxcbiAgICAgICAgdm9pY2VfbmFtZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2FsbG95JyxcbiAgICAgICAgbG9jYWxlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZW4tVVMnLFxuICAgICAgICB0aW1lem9uZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ0FtZXJpY2EvUGhvZW5peCcsXG4gICAgICAgIHBsYXlib29rIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX251bWJlcnNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX251bWJlcnMoY3VzdG9tZXJfaWQpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxscyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdm9pY2VfbnVtYmVyX2lkIGJpZ2ludCByZWZlcmVuY2VzIHZvaWNlX251bWJlcnMoaWQpIG9uIGRlbGV0ZSBzZXQgbnVsbCxcbiAgICAgICAgcHJvdmlkZXIgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd0d2lsaW8nLFxuICAgICAgICBwcm92aWRlcl9jYWxsX3NpZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmcm9tX251bWJlciB0ZXh0LFxuICAgICAgICB0b19udW1iZXIgdGV4dCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5pdGlhdGVkJyxcbiAgICAgICAgZGlyZWN0aW9uIHRleHQgbm90IG51bGwgZGVmYXVsdCAnaW5ib3VuZCcsXG4gICAgICAgIHN0YXJ0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgZW5kZWRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGR1cmF0aW9uX3NlY29uZHMgaW50ZWdlcixcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzX3Byb3ZpZGVyX3NpZF91cSBvbiB2b2ljZV9jYWxscyhwcm92aWRlciwgcHJvdmlkZXJfY2FsbF9zaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfY3VzdG9tZXJfaWR4IG9uIHZvaWNlX2NhbGxzKGN1c3RvbWVyX2lkLCBzdGFydGVkX2F0IGRlc2MpO2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsX21lc3NhZ2VzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjYWxsX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHZvaWNlX2NhbGxzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcm9sZSB0ZXh0IG5vdCBudWxsLCAtLSB1c2VyfGFzc2lzdGFudHxzeXN0ZW18dG9vbFxuICAgICAgICBjb250ZW50IHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXNfY2FsbF9pZHggb24gdm9pY2VfY2FsbF9tZXNzYWdlcyhjYWxsX2lkLCBpZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX3VzYWdlX21vbnRobHkgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1pbnV0ZXMgbnVtZXJpYyBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGVzdF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBiaWxsX2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNhbGxzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZShjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseV9jdXN0b21lcl9pZHggb24gdm9pY2VfdXNhZ2VfbW9udGhseShjdXN0b21lcl9pZCwgbW9udGgpO2AsXG5cbl07XG5cbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGVtZW50cykge1xuICAgICAgYXdhaXQgc3FsLnF1ZXJ5KHMpO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gX3NjaGVtYVByb21pc2U7XG59XG5cbi8qKlxuICogUXVlcnkgaGVscGVyIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgYHBnYC1pc2ggaW50ZXJmYWNlOlxuICogLSByZXR1cm5zIHsgcm93cywgcm93Q291bnQgfVxuICogLSBzdXBwb3J0cyAkMSwgJDIgcGxhY2Vob2xkZXJzICsgcGFyYW1zIGFycmF5IHZpYSBzcWwucXVlcnkoLi4uKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcSh0ZXh0LCBwYXJhbXMgPSBbXSkge1xuICBhd2FpdCBlbnN1cmVTY2hlbWEoKTtcbiAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBzcWwucXVlcnkodGV4dCwgcGFyYW1zKTtcbiAgcmV0dXJuIHsgcm93czogcm93cyB8fCBbXSwgcm93Q291bnQ6IEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzLmxlbmd0aCA6IDAgfTtcbn0iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbmZ1bmN0aW9uIHNhZmVTdHIodiwgbWF4ID0gODAwMCkge1xuICBpZiAodiA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcyA9IFN0cmluZyh2KTtcbiAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXHUyMDI2KCske3MubGVuZ3RoIC0gbWF4fSBjaGFycylgO1xufVxuXG5mdW5jdGlvbiByYW5kb21JZCgpIHtcbiAgdHJ5IHtcbiAgICBpZiAoZ2xvYmFsVGhpcy5jcnlwdG8/LnJhbmRvbVVVSUQpIHJldHVybiBnbG9iYWxUaGlzLmNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH0gY2F0Y2gge31cbiAgLy8gZmFsbGJhY2sgKG5vdCBSRkM0MTIyLXBlcmZlY3QsIGJ1dCB1bmlxdWUgZW5vdWdoIGZvciB0cmFjaW5nKVxuICByZXR1cm4gXCJyaWRfXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKSArIFwiX1wiICsgRGF0ZS5ub3coKS50b1N0cmluZygxNik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0SWQocmVxKSB7XG4gIGNvbnN0IGggPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIngtcmVxdWVzdC1pZFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIHJldHVybiBoIHx8IHJhbmRvbUlkKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmZlckZ1bmN0aW9uTmFtZShyZXEpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1ID0gbmV3IFVSTChyZXEudXJsKTtcbiAgICBjb25zdCBtID0gdS5wYXRobmFtZS5tYXRjaCgvXFwvXFwubmV0bGlmeVxcL2Z1bmN0aW9uc1xcLyhbXlxcL10rKS9pKTtcbiAgICByZXR1cm4gbSA/IG1bMV0gOiBcInVua25vd25cIjtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwidW5rbm93blwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0TWV0YShyZXEpIHtcbiAgbGV0IHVybCA9IG51bGw7XG4gIHRyeSB7IHVybCA9IG5ldyBVUkwocmVxLnVybCk7IH0gY2F0Y2gge31cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IHJlcS5tZXRob2QgfHwgbnVsbCxcbiAgICBwYXRoOiB1cmwgPyB1cmwucGF0aG5hbWUgOiBudWxsLFxuICAgIHF1ZXJ5OiB1cmwgPyBPYmplY3QuZnJvbUVudHJpZXModXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCkpIDoge30sXG4gICAgb3JpZ2luOiByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpIHx8IG51bGwsXG4gICAgcmVmZXJlcjogcmVxLmhlYWRlcnMuZ2V0KFwicmVmZXJlclwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJSZWZlcmVyXCIpIHx8IG51bGwsXG4gICAgdXNlcl9hZ2VudDogcmVxLmhlYWRlcnMuZ2V0KFwidXNlci1hZ2VudFwiKSB8fCBudWxsLFxuICAgIGlwOiByZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IG51bGwsXG4gICAgYXBwX2lkOiAocmVxLmhlYWRlcnMuZ2V0KFwieC1rYWl4dS1hcHBcIikgfHwgXCJcIikudHJpbSgpIHx8IG51bGwsXG4gICAgYnVpbGRfaWQ6IChyZXEuaGVhZGVycy5nZXQoXCJ4LWthaXh1LWJ1aWxkXCIpIHx8IFwiXCIpLnRyaW0oKSB8fCBudWxsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVFcnJvcihlcnIpIHtcbiAgY29uc3QgZSA9IGVyciB8fCB7fTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBzYWZlU3RyKGUubmFtZSwgMjAwKSxcbiAgICBtZXNzYWdlOiBzYWZlU3RyKGUubWVzc2FnZSwgNDAwMCksXG4gICAgY29kZTogc2FmZVN0cihlLmNvZGUsIDIwMCksXG4gICAgc3RhdHVzOiBOdW1iZXIuaXNGaW5pdGUoZS5zdGF0dXMpID8gZS5zdGF0dXMgOiBudWxsLFxuICAgIGhpbnQ6IHNhZmVTdHIoZS5oaW50LCAyMDAwKSxcbiAgICBzdGFjazogc2FmZVN0cihlLnN0YWNrLCAxMjAwMCksXG4gICAgdXBzdHJlYW06IGUudXBzdHJlYW0gPyB7XG4gICAgICBwcm92aWRlcjogc2FmZVN0cihlLnVwc3RyZWFtLnByb3ZpZGVyLCA1MCksXG4gICAgICBzdGF0dXM6IE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtLnN0YXR1cykgPyBlLnVwc3RyZWFtLnN0YXR1cyA6IG51bGwsXG4gICAgICBib2R5OiBzYWZlU3RyKGUudXBzdHJlYW0uYm9keSwgMTIwMDApLFxuICAgICAgcmVxdWVzdF9pZDogc2FmZVN0cihlLnVwc3RyZWFtLnJlcXVlc3RfaWQsIDIwMCksXG4gICAgICByZXNwb25zZV9oZWFkZXJzOiBlLnVwc3RyZWFtLnJlc3BvbnNlX2hlYWRlcnMgfHwgdW5kZWZpbmVkXG4gICAgfSA6IHVuZGVmaW5lZFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyaXplSnNvbkJvZHkoYm9keSkge1xuICAvLyBTYWZlIHN1bW1hcnk7IGF2b2lkcyBsb2dnaW5nIGZ1bGwgcHJvbXB0cyBieSBkZWZhdWx0LlxuICBjb25zdCBiID0gYm9keSB8fCB7fTtcbiAgY29uc3QgcHJvdmlkZXIgPSAoYi5wcm92aWRlciB8fCBcIlwiKS50b1N0cmluZygpLnRyaW0oKS50b0xvd2VyQ2FzZSgpIHx8IG51bGw7XG4gIGNvbnN0IG1vZGVsID0gKGIubW9kZWwgfHwgXCJcIikudG9TdHJpbmcoKS50cmltKCkgfHwgbnVsbDtcblxuICBsZXQgbWVzc2FnZUNvdW50ID0gbnVsbDtcbiAgbGV0IHRvdGFsQ2hhcnMgPSBudWxsO1xuICB0cnkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGIubWVzc2FnZXMpKSB7XG4gICAgICBtZXNzYWdlQ291bnQgPSBiLm1lc3NhZ2VzLmxlbmd0aDtcbiAgICAgIHRvdGFsQ2hhcnMgPSBiLm1lc3NhZ2VzLnJlZHVjZSgoYWNjLCBtKSA9PiBhY2MgKyBTdHJpbmcobT8uY29udGVudCA/PyBcIlwiKS5sZW5ndGgsIDApO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxuXG4gIHJldHVybiB7XG4gICAgcHJvdmlkZXIsXG4gICAgbW9kZWwsXG4gICAgbWF4X3Rva2VuczogTnVtYmVyLmlzRmluaXRlKGIubWF4X3Rva2VucykgPyBwYXJzZUludChiLm1heF90b2tlbnMsIDEwKSA6IG51bGwsXG4gICAgdGVtcGVyYXR1cmU6IHR5cGVvZiBiLnRlbXBlcmF0dXJlID09PSBcIm51bWJlclwiID8gYi50ZW1wZXJhdHVyZSA6IG51bGwsXG4gICAgbWVzc2FnZV9jb3VudDogbWVzc2FnZUNvdW50LFxuICAgIG1lc3NhZ2VfY2hhcnM6IHRvdGFsQ2hhcnNcbiAgfTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBtb25pdG9yIGV2ZW50OiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW1pdEV2ZW50KGV2KSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZSA9IGV2IHx8IHt9O1xuICAgIGNvbnN0IGV4dHJhID0gZS5leHRyYSB8fCB7fTtcbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIGdhdGV3YXlfZXZlbnRzXG4gICAgICAgIChyZXF1ZXN0X2lkLCBsZXZlbCwga2luZCwgZnVuY3Rpb25fbmFtZSwgbWV0aG9kLCBwYXRoLCBvcmlnaW4sIHJlZmVyZXIsIHVzZXJfYWdlbnQsIGlwLFxuICAgICAgICAgYXBwX2lkLCBidWlsZF9pZCwgY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIHByb3ZpZGVyLCBtb2RlbCwgaHR0cF9zdGF0dXMsIGR1cmF0aW9uX21zLFxuICAgICAgICAgZXJyb3JfY29kZSwgZXJyb3JfbWVzc2FnZSwgZXJyb3Jfc3RhY2ssIHVwc3RyZWFtX3N0YXR1cywgdXBzdHJlYW1fYm9keSwgZXh0cmEpXG4gICAgICAgdmFsdWVzXG4gICAgICAgICgkMSwkMiwkMywkNCwkNSwkNiwkNywkOCwkOSwkMTAsXG4gICAgICAgICAkMTEsJDEyLCQxMywkMTQsJDE1LCQxNiwkMTcsJDE4LFxuICAgICAgICAgJDE5LCQyMCwkMjEsJDIyLCQyMywkMjQsJDI1Ojpqc29uYilgLFxuICAgICAgW1xuICAgICAgICBzYWZlU3RyKGUucmVxdWVzdF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmxldmVsIHx8IFwiaW5mb1wiLCAyMCksXG4gICAgICAgIHNhZmVTdHIoZS5raW5kIHx8IFwiZXZlbnRcIiwgODApLFxuICAgICAgICBzYWZlU3RyKGUuZnVuY3Rpb25fbmFtZSB8fCBcInVua25vd25cIiwgMTIwKSxcbiAgICAgICAgc2FmZVN0cihlLm1ldGhvZCwgMjApLFxuICAgICAgICBzYWZlU3RyKGUucGF0aCwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLm9yaWdpbiwgNTAwKSxcbiAgICAgICAgc2FmZVN0cihlLnJlZmVyZXIsIDgwMCksXG4gICAgICAgIHNhZmVTdHIoZS51c2VyX2FnZW50LCA4MDApLFxuICAgICAgICBzYWZlU3RyKGUuaXAsIDIwMCksXG5cbiAgICAgICAgc2FmZVN0cihlLmFwcF9pZCwgMjAwKSxcbiAgICAgICAgc2FmZVN0cihlLmJ1aWxkX2lkLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5jdXN0b21lcl9pZCkgPyBlLmN1c3RvbWVyX2lkIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuYXBpX2tleV9pZCkgPyBlLmFwaV9rZXlfaWQgOiBudWxsLFxuICAgICAgICBzYWZlU3RyKGUucHJvdmlkZXIsIDgwKSxcbiAgICAgICAgc2FmZVN0cihlLm1vZGVsLCAyMDApLFxuICAgICAgICBOdW1iZXIuaXNGaW5pdGUoZS5odHRwX3N0YXR1cykgPyBlLmh0dHBfc3RhdHVzIDogbnVsbCxcbiAgICAgICAgTnVtYmVyLmlzRmluaXRlKGUuZHVyYXRpb25fbXMpID8gZS5kdXJhdGlvbl9tcyA6IG51bGwsXG5cbiAgICAgICAgc2FmZVN0cihlLmVycm9yX2NvZGUsIDIwMCksXG4gICAgICAgIHNhZmVTdHIoZS5lcnJvcl9tZXNzYWdlLCA0MDAwKSxcbiAgICAgICAgc2FmZVN0cihlLmVycm9yX3N0YWNrLCAxMjAwMCksXG4gICAgICAgIE51bWJlci5pc0Zpbml0ZShlLnVwc3RyZWFtX3N0YXR1cykgPyBlLnVwc3RyZWFtX3N0YXR1cyA6IG51bGwsXG4gICAgICAgIHNhZmVTdHIoZS51cHN0cmVhbV9ib2R5LCAxMjAwMCksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGV4dHJhIHx8IHt9KVxuICAgICAgXVxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJtb25pdG9yIGVtaXQgZmFpbGVkOlwiLCBlPy5tZXNzYWdlIHx8IGUpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgYnVpbGRDb3JzLCBqc29uIH0gZnJvbSBcIi4vaHR0cC5qc1wiO1xuaW1wb3J0IHsgZW1pdEV2ZW50LCBnZXRSZXF1ZXN0SWQsIGluZmVyRnVuY3Rpb25OYW1lLCByZXF1ZXN0TWV0YSwgc2VyaWFsaXplRXJyb3IgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVycm9yKGVycikge1xuICBjb25zdCBzdGF0dXMgPSBlcnI/LnN0YXR1cyB8fCA1MDA7XG4gIGNvbnN0IGNvZGUgPSBlcnI/LmNvZGUgfHwgXCJTRVJWRVJfRVJST1JcIjtcbiAgY29uc3QgbWVzc2FnZSA9IGVycj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIjtcbiAgY29uc3QgaGludCA9IGVycj8uaGludDtcbiAgcmV0dXJuIHsgc3RhdHVzLCBib2R5OiB7IGVycm9yOiBtZXNzYWdlLCBjb2RlLCAuLi4oaGludCA/IHsgaGludCB9IDoge30pIH0gfTtcbn1cblxuZnVuY3Rpb24gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBoID0gbmV3IEhlYWRlcnMocmVzLmhlYWRlcnMgfHwge30pO1xuICAgIGguc2V0KFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsIHJlcXVlc3RfaWQpO1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UocmVzLmJvZHksIHsgc3RhdHVzOiByZXMuc3RhdHVzLCBoZWFkZXJzOiBoIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhZmVCb2R5UHJldmlldyhyZXMpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjdCA9IChyZXMuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBjbG9uZSA9IHJlcy5jbG9uZSgpO1xuICAgIGlmIChjdC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uL2pzb25cIikpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjbG9uZS5qc29uKCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgY29uc3QgdCA9IGF3YWl0IGNsb25lLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICBpZiAodHlwZW9mIHQgPT09IFwic3RyaW5nXCIgJiYgdC5sZW5ndGggPiAxMjAwMCkgcmV0dXJuIHQuc2xpY2UoMCwgMTIwMDApICsgYFx1MjAyNigrJHt0Lmxlbmd0aCAtIDEyMDAwfSBjaGFycylgO1xuICAgIHJldHVybiB0O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcChoYW5kbGVyKSB7XG4gIHJldHVybiBhc3luYyAocmVxLCBjb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgICBjb25zdCByZXF1ZXN0X2lkID0gZ2V0UmVxdWVzdElkKHJlcSk7XG4gICAgY29uc3QgZnVuY3Rpb25fbmFtZSA9IGluZmVyRnVuY3Rpb25OYW1lKHJlcSk7XG4gICAgY29uc3QgbWV0YSA9IHJlcXVlc3RNZXRhKHJlcSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgaGFuZGxlcihyZXEsIGNvcnMsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbl9tcyA9IERhdGUubm93KCkgLSBzdGFydDtcbiAgICAgIGNvbnN0IG91dCA9IHJlcyBpbnN0YW5jZW9mIFJlc3BvbnNlID8gd2l0aFJlcXVlc3RJZChyZXMsIHJlcXVlc3RfaWQpIDogcmVzO1xuXG4gICAgICBjb25zdCBzdGF0dXMgPSBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSA/IG91dC5zdGF0dXMgOiAyMDA7XG4gICAgICBjb25zdCBsZXZlbCA9IHN0YXR1cyA+PSA1MDAgPyBcImVycm9yXCIgOiBzdGF0dXMgPj0gNDAwID8gXCJ3YXJuXCIgOiBcImluZm9cIjtcbiAgICAgIGNvbnN0IGtpbmQgPSBzdGF0dXMgPj0gNDAwID8gXCJodHRwX2Vycm9yX3Jlc3BvbnNlXCIgOiBcImh0dHBfcmVzcG9uc2VcIjtcblxuICAgICAgbGV0IGV4dHJhID0ge307XG4gICAgICBpZiAoc3RhdHVzID49IDQwMCAmJiBvdXQgaW5zdGFuY2VvZiBSZXNwb25zZSkge1xuICAgICAgICBleHRyYS5yZXNwb25zZSA9IGF3YWl0IHNhZmVCb2R5UHJldmlldyhvdXQpO1xuICAgICAgfVxuICAgICAgaWYgKGR1cmF0aW9uX21zID49IDE1MDAwKSB7XG4gICAgICAgIGV4dHJhLnNsb3cgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAga2luZCxcbiAgICAgICAgZnVuY3Rpb25fbmFtZSxcbiAgICAgICAgLi4ubWV0YSxcbiAgICAgICAgaHR0cF9zdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgZHVyYXRpb25fbXMsXG4gICAgICAgIGV4dHJhXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIG91dDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uX21zID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXG4gICAgICAvLyBCZXN0LWVmZm9ydCBkZXRhaWxlZCBtb25pdG9yIHJlY29yZC5cbiAgICAgIGNvbnN0IHNlciA9IHNlcmlhbGl6ZUVycm9yKGVycik7XG4gICAgICBhd2FpdCBlbWl0RXZlbnQoe1xuICAgICAgICByZXF1ZXN0X2lkLFxuICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICBraW5kOiBcInRocm93bl9lcnJvclwiLFxuICAgICAgICBmdW5jdGlvbl9uYW1lLFxuICAgICAgICAuLi5tZXRhLFxuICAgICAgICBwcm92aWRlcjogc2VyPy51cHN0cmVhbT8ucHJvdmlkZXIgfHwgdW5kZWZpbmVkLFxuICAgICAgICBodHRwX3N0YXR1czogc2VyPy5zdGF0dXMgfHwgNTAwLFxuICAgICAgICBkdXJhdGlvbl9tcyxcbiAgICAgICAgZXJyb3JfY29kZTogc2VyPy5jb2RlIHx8IFwiU0VSVkVSX0VSUk9SXCIsXG4gICAgICAgIGVycm9yX21lc3NhZ2U6IHNlcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICAgICAgZXJyb3Jfc3RhY2s6IHNlcj8uc3RhY2sgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fc3RhdHVzOiBzZXI/LnVwc3RyZWFtPy5zdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgdXBzdHJlYW1fYm9keTogc2VyPy51cHN0cmVhbT8uYm9keSB8fCBudWxsLFxuICAgICAgICBleHRyYTogeyBlcnJvcjogc2VyIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdm9pZCA1MDJzOiBhbHdheXMgcmV0dXJuIEpTT04uXG4gICAgICBjb25zb2xlLmVycm9yKFwiRnVuY3Rpb24gZXJyb3I6XCIsIGVycik7XG4gICAgICBjb25zdCB7IHN0YXR1cywgYm9keSB9ID0gbm9ybWFsaXplRXJyb3IoZXJyKTtcbiAgICAgIHJldHVybiBqc29uKHN0YXR1cywgeyAuLi5ib2R5LCByZXF1ZXN0X2lkIH0sIHsgLi4uY29ycywgXCJ4LWthaXh1LXJlcXVlc3QtaWRcIjogcmVxdWVzdF9pZCB9KTtcbiAgICB9XG4gIH07XG59XG4iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5cbmZ1bmN0aW9uIGNvbmZpZ0Vycm9yKG1lc3NhZ2UsIGhpbnQpIHtcbiAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuY29kZSA9IFwiQ09ORklHXCI7XG4gIGVyci5zdGF0dXMgPSA1MDA7XG4gIGlmIChoaW50KSBlcnIuaGludCA9IGhpbnQ7XG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NHVybChpbnB1dCkge1xuICByZXR1cm4gQnVmZmVyLmZyb20oaW5wdXQpXG4gICAgLnRvU3RyaW5nKFwiYmFzZTY0XCIpXG4gICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvXFwrL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9cXC8vZywgXCJfXCIpO1xufVxuXG5mdW5jdGlvbiB1bmJhc2U2NHVybChpbnB1dCkge1xuICBjb25zdCBzID0gU3RyaW5nKGlucHV0IHx8IFwiXCIpLnJlcGxhY2UoLy0vZywgXCIrXCIpLnJlcGxhY2UoL18vZywgXCIvXCIpO1xuICBjb25zdCBwYWQgPSBzLmxlbmd0aCAlIDQgPT09IDAgPyBcIlwiIDogXCI9XCIucmVwZWF0KDQgLSAocy5sZW5ndGggJSA0KSk7XG4gIHJldHVybiBCdWZmZXIuZnJvbShzICsgcGFkLCBcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gZW5jS2V5KCkge1xuICAvLyBQcmVmZXIgYSBkZWRpY2F0ZWQgZW5jcnlwdGlvbiBrZXkuIEZhbGwgYmFjayB0byBKV1RfU0VDUkVUIGZvciBkcm9wLWZyaWVuZGx5IGluc3RhbGxzLlxuICBjb25zdCByYXcgPSAocHJvY2Vzcy5lbnYuREJfRU5DUllQVElPTl9LRVkgfHwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCBcIlwiKS50b1N0cmluZygpO1xuICBpZiAoIXJhdykge1xuICAgIHRocm93IGNvbmZpZ0Vycm9yKFxuICAgICAgXCJNaXNzaW5nIERCX0VOQ1JZUFRJT05fS0VZIChvciBKV1RfU0VDUkVUIGZhbGxiYWNrKVwiLFxuICAgICAgXCJTZXQgREJfRU5DUllQVElPTl9LRVkgKHJlY29tbWVuZGVkKSBvciBhdCBtaW5pbXVtIEpXVF9TRUNSRVQgaW4gTmV0bGlmeSBlbnYgdmFycy5cIlxuICAgICk7XG4gIH1cbiAgLy8gRGVyaXZlIGEgc3RhYmxlIDMyLWJ5dGUga2V5LlxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHJhdykuZGlnZXN0KCk7XG59XG5cbi8qKlxuICogRW5jcnlwdCBzbWFsbCBzZWNyZXRzIGZvciBEQiBzdG9yYWdlIChBRVMtMjU2LUdDTSkuXG4gKiBGb3JtYXQ6IHYxOjxpdl9iNjR1cmw+Ojx0YWdfYjY0dXJsPjo8Y2lwaGVyX2I2NHVybD5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY3J5cHRTZWNyZXQocGxhaW50ZXh0KSB7XG4gIGNvbnN0IGtleSA9IGVuY0tleSgpO1xuICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcygxMik7XG4gIGNvbnN0IGNpcGhlciA9IGNyeXB0by5jcmVhdGVDaXBoZXJpdihcImFlcy0yNTYtZ2NtXCIsIGtleSwgaXYpO1xuICBjb25zdCBjdCA9IEJ1ZmZlci5jb25jYXQoW2NpcGhlci51cGRhdGUoU3RyaW5nKHBsYWludGV4dCksIFwidXRmOFwiKSwgY2lwaGVyLmZpbmFsKCldKTtcbiAgY29uc3QgdGFnID0gY2lwaGVyLmdldEF1dGhUYWcoKTtcbiAgcmV0dXJuIGB2MToke2Jhc2U2NHVybChpdil9OiR7YmFzZTY0dXJsKHRhZyl9OiR7YmFzZTY0dXJsKGN0KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjcnlwdFNlY3JldChlbmMpIHtcbiAgY29uc3QgcyA9IFN0cmluZyhlbmMgfHwgXCJcIik7XG4gIGlmICghcy5zdGFydHNXaXRoKFwidjE6XCIpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGFydHMgPSBzLnNwbGl0KFwiOlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gNCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IFssIGl2QiwgdGFnQiwgY3RCXSA9IHBhcnRzO1xuICBjb25zdCBrZXkgPSBlbmNLZXkoKTtcbiAgY29uc3QgaXYgPSB1bmJhc2U2NHVybChpdkIpO1xuICBjb25zdCB0YWcgPSB1bmJhc2U2NHVybCh0YWdCKTtcbiAgY29uc3QgY3QgPSB1bmJhc2U2NHVybChjdEIpO1xuICBjb25zdCBkZWNpcGhlciA9IGNyeXB0by5jcmVhdGVEZWNpcGhlcml2KFwiYWVzLTI1Ni1nY21cIiwga2V5LCBpdik7XG4gIGRlY2lwaGVyLnNldEF1dGhUYWcodGFnKTtcbiAgY29uc3QgcHQgPSBCdWZmZXIuY29uY2F0KFtkZWNpcGhlci51cGRhdGUoY3QpLCBkZWNpcGhlci5maW5hbCgpXSk7XG4gIHJldHVybiBwdC50b1N0cmluZyhcInV0ZjhcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21LZXkocHJlZml4ID0gXCJreF9saXZlX1wiKSB7XG4gIGNvbnN0IGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKTtcbiAgcmV0dXJuIHByZWZpeCArIGJhc2U2NHVybChieXRlcykuc2xpY2UoMCwgNDgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hhMjU2SGV4KGlucHV0KSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhtYWNTaGEyNTZIZXgoc2VjcmV0LCBpbnB1dCkge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoaW5wdXQpLmRpZ2VzdChcImhleFwiKTtcbn1cblxuLyoqXG4gKiBLZXkgaGFzaGluZyBzdHJhdGVneTpcbiAqIC0gRGVmYXVsdDogU0hBLTI1NihrZXkpXG4gKiAtIElmIEtFWV9QRVBQRVIgaXMgc2V0OiBITUFDLVNIQTI1NihLRVlfUEVQUEVSLCBrZXkpXG4gKlxuICogSU1QT1JUQU5UOiBQZXBwZXIgaXMgb3B0aW9uYWwgYW5kIGNhbiBiZSBlbmFibGVkIGxhdGVyLlxuICogQXV0aCBjb2RlIHdpbGwgYXV0by1taWdyYXRlIGxlZ2FjeSBoYXNoZXMgb24gZmlyc3Qgc3VjY2Vzc2Z1bCBsb29rdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlIYXNoSGV4KGlucHV0KSB7XG4gIGNvbnN0IHBlcHBlciA9IHByb2Nlc3MuZW52LktFWV9QRVBQRVI7XG4gIGlmIChwZXBwZXIpIHJldHVybiBobWFjU2hhMjU2SGV4KHBlcHBlciwgaW5wdXQpO1xuICByZXR1cm4gc2hhMjU2SGV4KGlucHV0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxlZ2FjeUtleUhhc2hIZXgoaW5wdXQpIHtcbiAgcmV0dXJuIHNoYTI1NkhleChpbnB1dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduSnd0KHBheWxvYWQsIHR0bFNlY29uZHMgPSAzNjAwKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBoZWFkZXIgPSB7IGFsZzogXCJIUzI1NlwiLCB0eXA6IFwiSldUXCIgfTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IGJvZHkgPSB7IC4uLnBheWxvYWQsIGlhdDogbm93LCBleHA6IG5vdyArIHR0bFNlY29uZHMgfTtcblxuICBjb25zdCBoID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGhlYWRlcikpO1xuICBjb25zdCBwID0gYmFzZTY0dXJsKEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcbiAgY29uc3QgZGF0YSA9IGAke2h9LiR7cH1gO1xuICBjb25zdCBzaWcgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHJldHVybiBgJHtkYXRhfS4ke3NpZ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5Snd0KHRva2VuKSB7XG4gIGNvbnN0IHNlY3JldCA9IHByb2Nlc3MuZW52LkpXVF9TRUNSRVQ7XG4gIGlmICghc2VjcmV0KSB7XG4gICAgdGhyb3cgY29uZmlnRXJyb3IoXG4gICAgICBcIk1pc3NpbmcgSldUX1NFQ1JFVFwiLFxuICAgICAgXCJTZXQgSldUX1NFQ1JFVCBpbiBOZXRsaWZ5IFx1MjE5MiBTaXRlIGNvbmZpZ3VyYXRpb24gXHUyMTkyIEVudmlyb25tZW50IHZhcmlhYmxlcyAodXNlIGEgbG9uZyByYW5kb20gc3RyaW5nKS5cIlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwYXJ0cyA9IHRva2VuLnNwbGl0KFwiLlwiKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgW2gsIHAsIHNdID0gcGFydHM7XG4gIGNvbnN0IGRhdGEgPSBgJHtofS4ke3B9YDtcbiAgY29uc3QgZXhwZWN0ZWQgPSBiYXNlNjR1cmwoY3J5cHRvLmNyZWF0ZUhtYWMoXCJzaGEyNTZcIiwgc2VjcmV0KS51cGRhdGUoZGF0YSkuZGlnZXN0KCkpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYSA9IEJ1ZmZlci5mcm9tKGV4cGVjdGVkKTtcbiAgICBjb25zdCBiID0gQnVmZmVyLmZyb20ocyk7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCFjcnlwdG8udGltaW5nU2FmZUVxdWFsKGEsIGIpKSByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKFxuICAgICAgQnVmZmVyLmZyb20ocC5yZXBsYWNlKC8tL2csIFwiK1wiKS5yZXBsYWNlKC9fL2csIFwiL1wiKSwgXCJiYXNlNjRcIikudG9TdHJpbmcoXCJ1dGYtOFwiKVxuICAgICk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgaWYgKHBheWxvYWQuZXhwICYmIG5vdyA+IHBheWxvYWQuZXhwKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gcGF5bG9hZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyB2ZXJpZnlKd3QgfSBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuZnVuY3Rpb24gdHJ1dGh5RW52KHYpe1xuICBjb25zdCBzID0gU3RyaW5nKHYgfHwgXCJcIikudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiBzID09PSBcIjFcIiB8fCBzID09PSBcInRydWVcIiB8fCBzID09PSBcInllc1wiIHx8IHMgPT09IFwieVwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZUFkbWluKHJlcSkge1xuICAvLyBQcmVmZXJyZWQ6IHNob3J0LWxpdmVkIGFkbWluIEpXVFxuICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnMuZ2V0KFwiYXV0aG9yaXphdGlvblwiKSB8fCByZXEuaGVhZGVycy5nZXQoXCJBdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIGNvbnN0IHRva2VuID0gYXV0aC5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSA/IGF1dGguc2xpY2UoNykgOiBudWxsO1xuICBpZiAodG9rZW4pIHtcbiAgICBjb25zdCBwYXlsb2FkID0gdmVyaWZ5Snd0KHRva2VuKTtcbiAgICBpZiAocGF5bG9hZCAmJiBwYXlsb2FkLnJvbGUgPT09IFwiYWRtaW5cIikgcmV0dXJuIHBheWxvYWQ7XG4gIH1cblxuICAvLyBCYWNrLWNvbXBhdCBmb3IgdGhlIGJ1bmRsZWQgYWRtaW4gVUk6IHBlci1yZXF1ZXN0IHBhc3N3b3JkIGhlYWRlclxuICAvLyBZb3UgY2FuIGRpc2FibGUgdGhpcyBlbnRpcmVseSBieSBzZXR0aW5nIERJU0FCTEVfQURNSU5fUEFTU1dPUkRfSEVBREVSPXRydWVcbiAgaWYgKCF0cnV0aHlFbnYocHJvY2Vzcy5lbnYuRElTQUJMRV9BRE1JTl9QQVNTV09SRF9IRUFERVIpKSB7XG4gICAgY29uc3QgcGFzcyA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LWFkbWluLXBhc3N3b3JkXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgZXhwZWN0ZWQgPSAocHJvY2Vzcy5lbnYuQURNSU5fUEFTU1dPUkQgfHwgXCJcIikudG9TdHJpbmcoKTtcbiAgICBpZiAocGFzcyAmJiBleHBlY3RlZCAmJiBwYXNzID09PSBleHBlY3RlZCkge1xuICAgICAgcmV0dXJuIHsgcm9sZTogXCJhZG1pblwiLCB2aWE6IFwicGFzc3dvcmRcIiB9O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuIiwgImltcG9ydCB7IHEgfSBmcm9tICcuL2RiLmpzJztcblxuZnVuY3Rpb24gbW9udGhSYW5nZVVUQyhtb250aCkge1xuICBjb25zdCBbeSwgbV0gPSBTdHJpbmcobW9udGggfHwgJycpLnNwbGl0KCctJykubWFwKCh4KSA9PiBwYXJzZUludCh4LCAxMCkpO1xuICBpZiAoIXkgfHwgIW0gfHwgbSA8IDEgfHwgbSA+IDEyKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtIC0gMSwgMSwgMCwgMCwgMCkpO1xuICBjb25zdCBlbmQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5LCBtLCAxLCAwLCAwLCAwKSk7XG4gIHJldHVybiB7IHN0YXJ0LCBlbmQgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbXB1dGVJbnZvaWNlU25hcHNob3QoY3VzdG9tZXJfaWQsIG1vbnRoKSB7XG4gIGNvbnN0IGNSZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgaWQsIGVtYWlsLCBwbGFuX25hbWUsIG1vbnRobHlfY2FwX2NlbnRzLCBpc19hY3RpdmUsXG4gICAgICAgICAgICBzdHJpcGVfY3VzdG9tZXJfaWQsIGF1dG9fdG9wdXBfZW5hYmxlZCwgYXV0b190b3B1cF9hbW91bnRfY2VudHMsIGF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzXG4gICAgIGZyb20gY3VzdG9tZXJzIHdoZXJlIGlkPSQxYCxcbiAgICBbY3VzdG9tZXJfaWRdXG4gICk7XG4gIGlmICghY1Jlcy5yb3dDb3VudCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGN1c3RvbWVyID0gY1Jlcy5yb3dzWzBdO1xuXG4gIGNvbnN0IHVSZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgbW9udGgsIHNwZW50X2NlbnRzLCBleHRyYV9jZW50cywgaW5wdXRfdG9rZW5zLCBvdXRwdXRfdG9rZW5zXG4gICAgIGZyb20gbW9udGhseV91c2FnZSB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgbW9udGg9JDJgLFxuICAgIFtjdXN0b21lcl9pZCwgbW9udGhdXG4gICk7XG4gIGNvbnN0IHJvbGwgPSB1UmVzLnJvd0NvdW50ID8gdVJlcy5yb3dzWzBdIDogeyBtb250aCwgc3BlbnRfY2VudHM6IDAsIGV4dHJhX2NlbnRzOiAwLCBpbnB1dF90b2tlbnM6IDAsIG91dHB1dF90b2tlbnM6IDAgfTtcblxuICBjb25zdCBrUmVzID0gYXdhaXQgcShcbiAgICBgc2VsZWN0IGsuaWQgYXMgYXBpX2tleV9pZCwgay5rZXlfbGFzdDQsIGsubGFiZWwsXG4gICAgICAgICAgICBjb2FsZXNjZShtay5zcGVudF9jZW50cywwKTo6aW50IGFzIHNwZW50X2NlbnRzLFxuICAgICAgICAgICAgY29hbGVzY2UobWsuaW5wdXRfdG9rZW5zLDApOjppbnQgYXMgaW5wdXRfdG9rZW5zLFxuICAgICAgICAgICAgY29hbGVzY2UobWsub3V0cHV0X3Rva2VucywwKTo6aW50IGFzIG91dHB1dF90b2tlbnMsXG4gICAgICAgICAgICBjb2FsZXNjZShtay5jYWxscywwKTo6aW50IGFzIGNhbGxzXG4gICAgIGZyb20gYXBpX2tleXMga1xuICAgICBsZWZ0IGpvaW4gbW9udGhseV9rZXlfdXNhZ2UgbWtcbiAgICAgICBvbiBtay5hcGlfa2V5X2lkPWsuaWQgYW5kIG1rLm1vbnRoPSQyXG4gICAgIHdoZXJlIGsuY3VzdG9tZXJfaWQ9JDFcbiAgICAgb3JkZXIgYnkgbWsuc3BlbnRfY2VudHMgZGVzYyBudWxscyBsYXN0LCBrLmNyZWF0ZWRfYXQgYXNjYCxcbiAgICBbY3VzdG9tZXJfaWQsIG1vbnRoXVxuICApO1xuXG4gIGNvbnN0IHRSZXMgPSBhd2FpdCBxKFxuICAgIGBzZWxlY3QgYW1vdW50X2NlbnRzLCBzb3VyY2UsIHN0cmlwZV9zZXNzaW9uX2lkLCBzdGF0dXMsIGNyZWF0ZWRfYXRcbiAgICAgZnJvbSB0b3B1cF9ldmVudHNcbiAgICAgd2hlcmUgY3VzdG9tZXJfaWQ9JDEgYW5kIG1vbnRoPSQyXG4gICAgIG9yZGVyIGJ5IGNyZWF0ZWRfYXQgYXNjYCxcbiAgICBbY3VzdG9tZXJfaWQsIG1vbnRoXVxuICApO1xuXG4gIC8vIC0tLSBLYWl4dVB1c2ggY2hhcmdlcyAoZGVwbG95IHB1c2hlcykgLS0tXG4gIGxldCBwdXNoID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByYW5nZSA9IG1vbnRoUmFuZ2VVVEMobW9udGgpO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gcHJpY2luZyBjZmcgKGRlZmF1bHQgdjEgaWYgbm90IGNvbmZpZ3VyZWQgZm9yIGN1c3RvbWVyKVxuICAgICAgbGV0IHB2ID0gYXdhaXQgcShcbiAgICAgICAgYHNlbGVjdCBiLnByaWNpbmdfdmVyc2lvbiwgYi5tb250aGx5X2NhcF9jZW50cyxcbiAgICAgICAgICAgICAgICBwLmJhc2VfbW9udGhfY2VudHMsIHAucGVyX2RlcGxveV9jZW50cywgcC5wZXJfZ2JfY2VudHMsIHAuY3VycmVuY3lcbiAgICAgICAgIGZyb20gY3VzdG9tZXJfcHVzaF9iaWxsaW5nIGJcbiAgICAgICAgIGpvaW4gcHVzaF9wcmljaW5nX3ZlcnNpb25zIHAgb24gcC52ZXJzaW9uID0gYi5wcmljaW5nX3ZlcnNpb25cbiAgICAgICAgIHdoZXJlIGIuY3VzdG9tZXJfaWQ9JDFcbiAgICAgICAgIGxpbWl0IDFgLFxuICAgICAgICBbY3VzdG9tZXJfaWRdXG4gICAgICApO1xuXG4gICAgICBpZiAoIXB2LnJvd0NvdW50KSB7XG4gICAgICAgIHB2ID0gYXdhaXQgcShcbiAgICAgICAgICBgc2VsZWN0IDEgYXMgcHJpY2luZ192ZXJzaW9uLCAwIGFzIG1vbnRobHlfY2FwX2NlbnRzLFxuICAgICAgICAgICAgICAgICAgYmFzZV9tb250aF9jZW50cywgcGVyX2RlcGxveV9jZW50cywgcGVyX2diX2NlbnRzLCBjdXJyZW5jeVxuICAgICAgICAgICBmcm9tIHB1c2hfcHJpY2luZ192ZXJzaW9ucyB3aGVyZSB2ZXJzaW9uPTEgbGltaXQgMWAsXG4gICAgICAgICAgW11cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHB2LnJvd0NvdW50KSB7XG4gICAgICAgIGNvbnN0IGNmZyA9IHB2LnJvd3NbMF07XG5cbiAgICAgICAgY29uc3QgdXNhZ2UgPSBhd2FpdCBxKFxuICAgICAgICAgIGBzZWxlY3RcbiAgICAgICAgICAgICAgY291bnQoKikgZmlsdGVyICh3aGVyZSBldmVudF90eXBlPSdkZXBsb3lfcmVhZHknKTo6aW50IGFzIGRlcGxveXNfcmVhZHksXG4gICAgICAgICAgICAgIGNvYWxlc2NlKHN1bShieXRlcykgZmlsdGVyICh3aGVyZSBldmVudF90eXBlPSdmaWxlX3VwbG9hZCcpLDApOjpiaWdpbnQgYXMgYnl0ZXNfdXBsb2FkZWRcbiAgICAgICAgICAgZnJvbSBwdXNoX3VzYWdlX2V2ZW50c1xuICAgICAgICAgICB3aGVyZSBjdXN0b21lcl9pZD0kMSBhbmQgY3JlYXRlZF9hdCA+PSAkMiBhbmQgY3JlYXRlZF9hdCA8ICQzYCxcbiAgICAgICAgICBbY3VzdG9tZXJfaWQsIHJhbmdlLnN0YXJ0LnRvSVNPU3RyaW5nKCksIHJhbmdlLmVuZC50b0lTT1N0cmluZygpXVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGRlcGxveXMgPSB1c2FnZS5yb3dzWzBdPy5kZXBsb3lzX3JlYWR5IHx8IDA7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gTnVtYmVyKHVzYWdlLnJvd3NbMF0/LmJ5dGVzX3VwbG9hZGVkIHx8IDApO1xuICAgICAgICBjb25zdCBnYiA9IGJ5dGVzIC8gMTA3Mzc0MTgyNDtcblxuICAgICAgICBjb25zdCBiYXNlID0gY2ZnLmJhc2VfbW9udGhfY2VudHM7XG4gICAgICAgIGNvbnN0IGRlcGxveUNvc3QgPSBjZmcucGVyX2RlcGxveV9jZW50cyAqIGRlcGxveXM7XG4gICAgICAgIGNvbnN0IGdiQ29zdCA9IE1hdGgucm91bmQoY2ZnLnBlcl9nYl9jZW50cyAqIGdiKTtcbiAgICAgICAgY29uc3QgdG90YWwgPSBiYXNlICsgZGVwbG95Q29zdCArIGdiQ29zdDtcblxuICAgICAgICBwdXNoID0ge1xuICAgICAgICAgIHByaWNpbmdfdmVyc2lvbjogY2ZnLnByaWNpbmdfdmVyc2lvbixcbiAgICAgICAgICBjdXJyZW5jeTogY2ZnLmN1cnJlbmN5LFxuICAgICAgICAgIGJhc2VfbW9udGhfY2VudHM6IGJhc2UsXG4gICAgICAgICAgcGVyX2RlcGxveV9jZW50czogY2ZnLnBlcl9kZXBsb3lfY2VudHMsXG4gICAgICAgICAgcGVyX2diX2NlbnRzOiBjZmcucGVyX2diX2NlbnRzLFxuICAgICAgICAgIG1vbnRobHlfY2FwX2NlbnRzOiBjZmcubW9udGhseV9jYXBfY2VudHMsXG4gICAgICAgICAgZGVwbG95c19yZWFkeTogZGVwbG95cyxcbiAgICAgICAgICBieXRlc191cGxvYWRlZDogYnl0ZXMsXG4gICAgICAgICAgZ2JfZXN0aW1hdGU6IE1hdGgucm91bmQoZ2IgKiAxMDAwKSAvIDEwMDAsXG4gICAgICAgICAgZGVwbG95X2Nvc3RfY2VudHM6IGRlcGxveUNvc3QsXG4gICAgICAgICAgc3RvcmFnZV9jb3N0X2NlbnRzOiBnYkNvc3QsXG4gICAgICAgICAgdG90YWxfY2VudHM6IHRvdGFsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvLyBJZiBwdXNoIHRhYmxlcyBhcmVuJ3QgcHJlc2VudCB5ZXQsIGtlZXAgc25hcHNob3Qgd29ya2luZyBmb3IgQUkgaW52b2ljZXMuXG4gICAgcHVzaCA9IG51bGw7XG4gIH1cblxuICBjb25zdCBzbmFwc2hvdCA9IHtcbiAgICBnZW5lcmF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBtb250aCxcbiAgICBjdXN0b21lcjoge1xuICAgICAgaWQ6IGN1c3RvbWVyLmlkLFxuICAgICAgZW1haWw6IGN1c3RvbWVyLmVtYWlsLFxuICAgICAgcGxhbl9uYW1lOiBjdXN0b21lci5wbGFuX25hbWUsXG4gICAgICBtb250aGx5X2NhcF9jZW50czogY3VzdG9tZXIubW9udGhseV9jYXBfY2VudHMsXG4gICAgICBzdHJpcGVfY3VzdG9tZXJfaWQ6IGN1c3RvbWVyLnN0cmlwZV9jdXN0b21lcl9pZCB8fCBudWxsXG4gICAgfSxcbiAgICB0b3RhbHM6IHtcbiAgICAgIGNhcF9jZW50czogY3VzdG9tZXIubW9udGhseV9jYXBfY2VudHMsXG4gICAgICBleHRyYV9jZW50czogcm9sbC5leHRyYV9jZW50cyB8fCAwLFxuICAgICAgc3BlbnRfY2VudHM6IHJvbGwuc3BlbnRfY2VudHMgfHwgMCxcbiAgICAgIGlucHV0X3Rva2Vuczogcm9sbC5pbnB1dF90b2tlbnMgfHwgMCxcbiAgICAgIG91dHB1dF90b2tlbnM6IHJvbGwub3V0cHV0X3Rva2VucyB8fCAwLFxuICAgICAgdG90YWxfdG9rZW5zOiAocm9sbC5pbnB1dF90b2tlbnMgfHwgMCkgKyAocm9sbC5vdXRwdXRfdG9rZW5zIHx8IDApLFxuICAgICAgcHVzaF90b3RhbF9jZW50czogcHVzaD8udG90YWxfY2VudHMgPz8gMCxcbiAgICAgIGdyYW5kX3RvdGFsX2NlbnRzOiAocm9sbC5zcGVudF9jZW50cyB8fCAwKSArIChyb2xsLmV4dHJhX2NlbnRzIHx8IDApICsgKHB1c2g/LnRvdGFsX2NlbnRzID8/IDApXG4gICAgfSxcbiAgICBrZXlzOiBrUmVzLnJvd3MgfHwgW10sXG4gICAgdG9wdXBzOiB0UmVzLnJvd3MgfHwgW10sXG4gICAgYXV0b190b3B1cDoge1xuICAgICAgZW5hYmxlZDogISFjdXN0b21lci5hdXRvX3RvcHVwX2VuYWJsZWQsXG4gICAgICB0aHJlc2hvbGRfY2VudHM6IGN1c3RvbWVyLmF1dG9fdG9wdXBfdGhyZXNob2xkX2NlbnRzID8/IG51bGwsXG4gICAgICBhbW91bnRfY2VudHM6IGN1c3RvbWVyLmF1dG9fdG9wdXBfYW1vdW50X2NlbnRzID8/IG51bGxcbiAgICB9LFxuICAgIHB1c2hcbiAgfTtcblxuICByZXR1cm4gc25hcHNob3Q7XG59XG4iLCAiaW1wb3J0IHsgcSB9IGZyb20gXCIuL2RiLmpzXCI7XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgYXVkaXQgbG9nOiBmYWlsdXJlcyBuZXZlciBicmVhayB0aGUgbWFpbiByZXF1ZXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVkaXQoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0ID0gbnVsbCwgbWV0YSA9IHt9KSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcShcbiAgICAgIGBpbnNlcnQgaW50byBhdWRpdF9ldmVudHMoYWN0b3IsIGFjdGlvbiwgdGFyZ2V0LCBtZXRhKSB2YWx1ZXMgKCQxLCQyLCQzLCQ0Ojpqc29uYilgLFxuICAgICAgW2FjdG9yLCBhY3Rpb24sIHRhcmdldCwgSlNPTi5zdHJpbmdpZnkobWV0YSB8fCB7fSldXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybihcImF1ZGl0IGZhaWxlZDpcIiwgZT8ubWVzc2FnZSB8fCBlKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IHdyYXAgfSBmcm9tIFwiLi9fbGliL3dyYXAuanNcIjtcbmltcG9ydCB7IGJ1aWxkQ29ycywganNvbiwgYmFkUmVxdWVzdCwgbW9udGhLZXlVVEMgfSBmcm9tIFwiLi9fbGliL2h0dHAuanNcIjtcbmltcG9ydCB7IHJlcXVpcmVBZG1pbiB9IGZyb20gXCIuL19saWIvYWRtaW4uanNcIjtcbmltcG9ydCB7IHEgfSBmcm9tIFwiLi9fbGliL2RiLmpzXCI7XG5pbXBvcnQgeyBjb21wdXRlSW52b2ljZVNuYXBzaG90IH0gZnJvbSBcIi4vX2xpYi9pbnZvaWNlcy5qc1wiO1xuaW1wb3J0IHsgYXVkaXQgfSBmcm9tIFwiLi9fbGliL2F1ZGl0LmpzXCI7XG5cbi8qKlxuICogQWRtaW4gaW52b2ljZSBzbmFwc2hvdHMuXG4gKiBHRVQgIC8ubmV0bGlmeS9mdW5jdGlvbnMvYWRtaW4taW52b2ljZXM/Y3VzdG9tZXJfaWQ9MTIzJm1vbnRoPVlZWVktTU1cbiAqIFBPU1QgLy5uZXRsaWZ5L2Z1bmN0aW9ucy9hZG1pbi1pbnZvaWNlcz9jdXN0b21lcl9pZD0xMjMmbW9udGg9WVlZWS1NTSAgKGNyZWF0ZXMvdXBkYXRlcyBzbmFwc2hvdClcbiAqL1xuZXhwb3J0IGRlZmF1bHQgd3JhcChhc3luYyAocmVxKSA9PiB7XG4gIGNvbnN0IGNvcnMgPSBidWlsZENvcnMocmVxKTtcbiAgaWYgKHJlcS5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSByZXR1cm4gbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiAyMDQsIGhlYWRlcnM6IGNvcnMgfSk7XG5cbiAgY29uc3QgYWRtaW4gPSByZXF1aXJlQWRtaW4ocmVxKTtcbiAgaWYgKCFhZG1pbikgcmV0dXJuIGpzb24oNDAxLCB7IGVycm9yOiBcIlVuYXV0aG9yaXplZFwiIH0sIGNvcnMpO1xuXG4gIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG4gIGNvbnN0IGN1c3RvbWVyX2lkID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJjdXN0b21lcl9pZFwiKSA/IHBhcnNlSW50KHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwiY3VzdG9tZXJfaWRcIiksIDEwKSA6IG51bGw7XG4gIGNvbnN0IG1vbnRoID0gKHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwibW9udGhcIikgfHwgbW9udGhLZXlVVEMoKSkudG9TdHJpbmcoKTtcblxuICBpZiAoIWN1c3RvbWVyX2lkKSByZXR1cm4gYmFkUmVxdWVzdChcIk1pc3NpbmcgY3VzdG9tZXJfaWRcIiwgY29ycyk7XG4gIGlmICghL15cXGR7NH0tXFxkezJ9JC8udGVzdChtb250aCkpIHJldHVybiBiYWRSZXF1ZXN0KFwiSW52YWxpZCBtb250aC4gVXNlIFlZWVktTU1cIiwgY29ycyk7XG5cbiAgaWYgKHJlcS5tZXRob2QgPT09IFwiR0VUXCIpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBxKGBzZWxlY3Qgc25hcHNob3QsIGNyZWF0ZWRfYXQsIHVwZGF0ZWRfYXQgZnJvbSBtb250aGx5X2ludm9pY2VzIHdoZXJlIGN1c3RvbWVyX2lkPSQxIGFuZCBtb250aD0kMmAsIFtjdXN0b21lcl9pZCwgbW9udGhdKTtcbiAgICBpZiAocmVzLnJvd0NvdW50KSB7XG4gICAgICByZXR1cm4ganNvbigyMDAsIHsgZXhpc3RzOiB0cnVlLCBtb250aCwgY3VzdG9tZXJfaWQsIHNuYXBzaG90OiByZXMucm93c1swXS5zbmFwc2hvdCwgY3JlYXRlZF9hdDogcmVzLnJvd3NbMF0uY3JlYXRlZF9hdCwgdXBkYXRlZF9hdDogcmVzLnJvd3NbMF0udXBkYXRlZF9hdCB9LCBjb3JzKTtcbiAgICB9XG4gICAgY29uc3Qgc25hcCA9IGF3YWl0IGNvbXB1dGVJbnZvaWNlU25hcHNob3QoY3VzdG9tZXJfaWQsIG1vbnRoKTtcbiAgICBpZiAoIXNuYXApIHJldHVybiBqc29uKDQwNCwgeyBlcnJvcjogXCJDdXN0b21lciBub3QgZm91bmRcIiB9LCBjb3JzKTtcbiAgICByZXR1cm4ganNvbigyMDAsIHsgZXhpc3RzOiBmYWxzZSwgbW9udGgsIGN1c3RvbWVyX2lkLCBzbmFwc2hvdDogc25hcCB9LCBjb3JzKTtcbiAgfVxuXG4gIGlmIChyZXEubWV0aG9kID09PSBcIlBPU1RcIikge1xuICAgIGNvbnN0IHNuYXAgPSBhd2FpdCBjb21wdXRlSW52b2ljZVNuYXBzaG90KGN1c3RvbWVyX2lkLCBtb250aCk7XG4gICAgaWYgKCFzbmFwKSByZXR1cm4ganNvbig0MDQsIHsgZXJyb3I6IFwiQ3VzdG9tZXIgbm90IGZvdW5kXCIgfSwgY29ycyk7XG5cbiAgICBhd2FpdCBxKFxuICAgICAgYGluc2VydCBpbnRvIG1vbnRobHlfaW52b2ljZXMoY3VzdG9tZXJfaWQsIG1vbnRoLCBzbmFwc2hvdClcbiAgICAgICB2YWx1ZXMgKCQxLCQyLCQzKVxuICAgICAgIG9uIGNvbmZsaWN0IChjdXN0b21lcl9pZCwgbW9udGgpXG4gICAgICAgZG8gdXBkYXRlIHNldCBzbmFwc2hvdD1leGNsdWRlZC5zbmFwc2hvdCwgdXBkYXRlZF9hdD1ub3coKWAsXG4gICAgICBbY3VzdG9tZXJfaWQsIG1vbnRoLCBzbmFwXVxuICAgICk7XG5cbiAgICBhd2FpdCBhdWRpdChcImFkbWluXCIsIFwiSU5WT0lDRV9TTkFQU0hPVFwiLCBgY3VzdG9tZXI6JHtjdXN0b21lcl9pZH1gLCB7IG1vbnRoIH0pO1xuXG4gICAgcmV0dXJuIGpzb24oMjAwLCB7IG9rOiB0cnVlLCBtb250aCwgY3VzdG9tZXJfaWQsIHNuYXBzaG90OiBzbmFwIH0sIGNvcnMpO1xuICB9XG5cbiAgcmV0dXJuIGpzb24oNDA1LCB7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0sIGNvcnMpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQU8sU0FBUyxVQUFVLEtBQUs7QUFDN0IsUUFBTSxZQUFZ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QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBLE1BQTJHO0FBQUEsTUFDM0c7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW1CQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BK0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BR0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1BO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFrQkE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BU0E7QUFBQTtBQUFBLE1BRUE7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
