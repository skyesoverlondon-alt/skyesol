
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/gh-chunk-cleanup.js
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

// netlify/functions/gh-chunk-cleanup.js
function store() {
  return getStore({ name: "kaixu_github_push_chunks", consistency: "strong" });
}
function hoursInt(v, dflt) {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}
var gh_chunk_cleanup_default = async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);
  const retentionHrs = hoursInt(process.env.GITHUB_CHUNK_RETENTION_HOURS, 48);
  const cutoff = new Date(Date.now() - retentionHrs * 3600 * 1e3).toISOString();
  const st = store();
  let jobs_examined = 0;
  let expired_jobs = 0;
  let deleted_chunks = 0;
  for (let batch = 0; batch < 5; batch++) {
    const res = await q(
      `select job_id, parts
       from gh_push_jobs
       where status in ('uploading','queued','assembling','retry_wait','error_transient')
         and updated_at < $1
       order by updated_at asc
       limit 200`,
      [cutoff]
    );
    jobs_examined += res.rowCount || 0;
    if (!res.rowCount) break;
    for (const row of res.rows) {
      const jobId = row.job_id;
      const parts = Math.max(0, parseInt(row.parts || "0", 10));
      try {
        for (let i = 0; i < parts; i++) {
          await st.delete(`ghzip/${jobId}/${i}`);
          deleted_chunks++;
        }
      } catch {
      }
      await q(
        `update gh_push_jobs
         set status='expired',
             last_error=$2,
             last_error_at=now(),
             bytes_staged=0,
             part_bytes='{}'::jsonb,
             received_parts='{}'::int[],
             updated_at=now()
         where job_id=$1`,
        [jobId, `Expired after ${retentionHrs}h; chunks cleaned`]
      );
      expired_jobs++;
    }
  }
  return json(
    200,
    { ok: true, retention_hours: retentionHrs, cutoff, jobs_examined, expired_jobs, deleted_chunks },
    cors
  );
};
export {
  gh_chunk_cleanup_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvZ2gtY2h1bmstY2xlYW51cC5qcyIsICJuZXRsaWZ5L2Z1bmN0aW9ucy9fbGliL2RiLmpzIiwgIm5ldGxpZnkvZnVuY3Rpb25zL19saWIvaHR0cC5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZ2V0U3RvcmUgfSBmcm9tIFwiQG5ldGxpZnkvYmxvYnNcIjtcbmltcG9ydCB7IHEgfSBmcm9tIFwiLi9fbGliL2RiLmpzXCI7XG5pbXBvcnQgeyBidWlsZENvcnMsIGpzb24gfSBmcm9tIFwiLi9fbGliL2h0dHAuanNcIjtcblxuLyoqXG4gKiBTY2hlZHVsZWQgY2xlYW51cCBmb3IgR2l0SHViIFB1c2ggY2h1bmsgYmxvYnMuXG4gKlxuICogV2h5IGl0IGV4aXN0czpcbiAqIC0gR2l0SHViIFB1c2ggam9icyBzdGFnZSBaSVAgcGFydHMgaW4gTmV0bGlmeSBCbG9icy5cbiAqIC0gSWYgYSBqb2IgaXMgYWJhbmRvbmVkIG9yIHJlcGVhdGVkbHkgZmFpbHMsIHRob3NlIGJsb2JzIHdvdWxkIG90aGVyd2lzZSBwZXJzaXN0LlxuICpcbiAqIFJ1bnM6IEBkYWlseSAobmV0bGlmeS50b21sKVxuICogUmV0ZW50aW9uOiBHSVRIVUJfQ0hVTktfUkVURU5USU9OX0hPVVJTIChkZWZhdWx0IDQ4KVxuICovXG5mdW5jdGlvbiBzdG9yZSgpIHtcbiAgcmV0dXJuIGdldFN0b3JlKHsgbmFtZTogXCJrYWl4dV9naXRodWJfcHVzaF9jaHVua3NcIiwgY29uc2lzdGVuY3k6IFwic3Ryb25nXCIgfSk7XG59XG5cbmZ1bmN0aW9uIGhvdXJzSW50KHYsIGRmbHQpIHtcbiAgY29uc3QgbiA9IHBhcnNlSW50KFN0cmluZyh2IHx8IFwiXCIpLCAxMCk7XG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUobikgJiYgbiA+IDAgPyBuIDogZGZsdDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgKHJlcSkgPT4ge1xuICBjb25zdCBjb3JzID0gYnVpbGRDb3JzKHJlcSk7XG4gIGlmIChyZXEubWV0aG9kID09PSBcIk9QVElPTlNcIikgcmV0dXJuIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogMjA0LCBoZWFkZXJzOiBjb3JzIH0pO1xuICBpZiAocmVxLm1ldGhvZCAhPT0gXCJHRVRcIiAmJiByZXEubWV0aG9kICE9PSBcIlBPU1RcIikgcmV0dXJuIGpzb24oNDA1LCB7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0sIGNvcnMpO1xuXG4gIGNvbnN0IHJldGVudGlvbkhycyA9IGhvdXJzSW50KHByb2Nlc3MuZW52LkdJVEhVQl9DSFVOS19SRVRFTlRJT05fSE9VUlMsIDQ4KTtcbiAgY29uc3QgY3V0b2ZmID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIHJldGVudGlvbkhycyAqIDM2MDAgKiAxMDAwKS50b0lTT1N0cmluZygpO1xuXG4gIGNvbnN0IHN0ID0gc3RvcmUoKTtcbiAgbGV0IGpvYnNfZXhhbWluZWQgPSAwO1xuICBsZXQgZXhwaXJlZF9qb2JzID0gMDtcbiAgbGV0IGRlbGV0ZWRfY2h1bmtzID0gMDtcblxuICAvLyBQcm9jZXNzIGluIGJvdW5kZWQgYmF0Y2hlcyBzbyBhIHNpbmdsZSBydW4gY2FuXHUyMDE5dCBleHBsb2RlXG4gIGZvciAobGV0IGJhdGNoID0gMDsgYmF0Y2ggPCA1OyBiYXRjaCsrKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgcShcbiAgICAgIGBzZWxlY3Qgam9iX2lkLCBwYXJ0c1xuICAgICAgIGZyb20gZ2hfcHVzaF9qb2JzXG4gICAgICAgd2hlcmUgc3RhdHVzIGluICgndXBsb2FkaW5nJywncXVldWVkJywnYXNzZW1ibGluZycsJ3JldHJ5X3dhaXQnLCdlcnJvcl90cmFuc2llbnQnKVxuICAgICAgICAgYW5kIHVwZGF0ZWRfYXQgPCAkMVxuICAgICAgIG9yZGVyIGJ5IHVwZGF0ZWRfYXQgYXNjXG4gICAgICAgbGltaXQgMjAwYCxcbiAgICAgIFtjdXRvZmZdXG4gICAgKTtcblxuICAgIGpvYnNfZXhhbWluZWQgKz0gcmVzLnJvd0NvdW50IHx8IDA7XG4gICAgaWYgKCFyZXMucm93Q291bnQpIGJyZWFrO1xuXG4gICAgZm9yIChjb25zdCByb3cgb2YgcmVzLnJvd3MpIHtcbiAgICAgIGNvbnN0IGpvYklkID0gcm93LmpvYl9pZDtcbiAgICAgIGNvbnN0IHBhcnRzID0gTWF0aC5tYXgoMCwgcGFyc2VJbnQocm93LnBhcnRzIHx8IFwiMFwiLCAxMCkpO1xuXG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzOyBpKyspIHtcbiAgICAgICAgICBhd2FpdCBzdC5kZWxldGUoYGdoemlwLyR7am9iSWR9LyR7aX1gKTtcbiAgICAgICAgICBkZWxldGVkX2NodW5rcysrO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gYmVzdC1lZmZvcnQgZGVsZXRlczsgd2Ugc3RpbGwgZXhwaXJlIHRoZSBqb2IgcmVjb3JkXG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHEoXG4gICAgICAgIGB1cGRhdGUgZ2hfcHVzaF9qb2JzXG4gICAgICAgICBzZXQgc3RhdHVzPSdleHBpcmVkJyxcbiAgICAgICAgICAgICBsYXN0X2Vycm9yPSQyLFxuICAgICAgICAgICAgIGxhc3RfZXJyb3JfYXQ9bm93KCksXG4gICAgICAgICAgICAgYnl0ZXNfc3RhZ2VkPTAsXG4gICAgICAgICAgICAgcGFydF9ieXRlcz0ne30nOjpqc29uYixcbiAgICAgICAgICAgICByZWNlaXZlZF9wYXJ0cz0ne30nOjppbnRbXSxcbiAgICAgICAgICAgICB1cGRhdGVkX2F0PW5vdygpXG4gICAgICAgICB3aGVyZSBqb2JfaWQ9JDFgLFxuICAgICAgICBbam9iSWQsIGBFeHBpcmVkIGFmdGVyICR7cmV0ZW50aW9uSHJzfWg7IGNodW5rcyBjbGVhbmVkYF1cbiAgICAgICk7XG4gICAgICBleHBpcmVkX2pvYnMrKztcbiAgICB9XG4gIH1cblxuICByZXR1cm4ganNvbihcbiAgICAyMDAsXG4gICAgeyBvazogdHJ1ZSwgcmV0ZW50aW9uX2hvdXJzOiByZXRlbnRpb25IcnMsIGN1dG9mZiwgam9ic19leGFtaW5lZCwgZXhwaXJlZF9qb2JzLCBkZWxldGVkX2NodW5rcyB9LFxuICAgIGNvcnNcbiAgKTtcbn07XG4iLCAiaW1wb3J0IHsgbmVvbiB9IGZyb20gXCJAbmV0bGlmeS9uZW9uXCI7XG5cbi8qKlxuICogTmV0bGlmeSBEQiAoTmVvbiBQb3N0Z3JlcykgaGVscGVyLlxuICpcbiAqIElNUE9SVEFOVCAoTmVvbiBzZXJ2ZXJsZXNzIGRyaXZlciwgMjAyNSspOlxuICogLSBgbmVvbigpYCByZXR1cm5zIGEgdGFnZ2VkLXRlbXBsYXRlIHF1ZXJ5IGZ1bmN0aW9uLlxuICogLSBGb3IgZHluYW1pYyBTUUwgc3RyaW5ncyArICQxIHBsYWNlaG9sZGVycywgdXNlIGBzcWwucXVlcnkodGV4dCwgcGFyYW1zKWAuXG4gKiAgIChDYWxsaW5nIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBsaWtlIHNxbChcIlNFTEVDVCAuLi5cIikgY2FuIGJyZWFrIG9uIG5ld2VyIGRyaXZlciB2ZXJzaW9ucy4pXG4gKlxuICogTmV0bGlmeSBEQiBhdXRvbWF0aWNhbGx5IGluamVjdHMgYE5FVExJRllfREFUQUJBU0VfVVJMYCB3aGVuIHRoZSBOZW9uIGV4dGVuc2lvbiBpcyBhdHRhY2hlZC5cbiAqL1xuXG5sZXQgX3NxbCA9IG51bGw7XG5sZXQgX3NjaGVtYVByb21pc2UgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRTcWwoKSB7XG4gIGlmIChfc3FsKSByZXR1cm4gX3NxbDtcblxuICBjb25zdCBoYXNEYlVybCA9ICEhKHByb2Nlc3MuZW52Lk5FVExJRllfREFUQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCk7XG4gIGlmICghaGFzRGJVcmwpIHtcbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJEYXRhYmFzZSBub3QgY29uZmlndXJlZCAobWlzc2luZyBORVRMSUZZX0RBVEFCQVNFX1VSTCkuIEF0dGFjaCBOZXRsaWZ5IERCIChOZW9uKSB0byB0aGlzIHNpdGUuXCIpO1xuICAgIGVyci5jb2RlID0gXCJEQl9OT1RfQ09ORklHVVJFRFwiO1xuICAgIGVyci5zdGF0dXMgPSA1MDA7XG4gICAgZXJyLmhpbnQgPSBcIk5ldGxpZnkgVUkgXHUyMTkyIEV4dGVuc2lvbnMgXHUyMTkyIE5lb24gXHUyMTkyIEFkZCBkYXRhYmFzZSAob3IgcnVuOiBucHggbmV0bGlmeSBkYiBpbml0KS5cIjtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBfc3FsID0gbmVvbigpOyAvLyBhdXRvLXVzZXMgcHJvY2Vzcy5lbnYuTkVUTElGWV9EQVRBQkFTRV9VUkwgb24gTmV0bGlmeVxuICByZXR1cm4gX3NxbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlU2NoZW1hKCkge1xuICBpZiAoX3NjaGVtYVByb21pc2UpIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcblxuICBfc2NoZW1hUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3FsID0gZ2V0U3FsKCk7XG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IFtcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcnMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGVtYWlsIHRleHQgbm90IG51bGwgdW5pcXVlLFxuICAgICAgICBwbGFuX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdzdGFydGVyJyxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDIwMDAsXG4gICAgICAgIGlzX2FjdGl2ZSBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgdHJ1ZSxcbiAgICAgICAgc3RyaXBlX2N1c3RvbWVyX2lkIHRleHQsXG4gICAgICAgIHN0cmlwZV9zdWJzY3JpcHRpb25faWQgdGV4dCxcbiAgICAgICAgc3RyaXBlX3N0YXR1cyB0ZXh0LFxuICAgICAgICBzdHJpcGVfY3VycmVudF9wZXJpb2RfZW5kIHRpbWVzdGFtcHR6LFxuICAgICAgICBhdXRvX3RvcHVwX2VuYWJsZWQgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IGZhbHNlLFxuICAgICAgICBhdXRvX3RvcHVwX2Ftb3VudF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBhdXRvX3RvcHVwX3RocmVzaG9sZF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhcGlfa2V5cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAga2V5X2hhc2ggdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIGtleV9sYXN0NCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBsYWJlbCB0ZXh0LFxuICAgICAgICBtb250aGx5X2NhcF9jZW50cyBpbnRlZ2VyLFxuICAgICAgICBycG1fbGltaXQgaW50ZWdlcixcbiAgICAgICAgcnBkX2xpbWl0IGludGVnZXIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcmV2b2tlZF9hdCB0aW1lc3RhbXB0elxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFwaV9rZXlzX2N1c3RvbWVyX2lkX2lkeCBvbiBhcGlfa2V5cyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X3VzYWdlIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc3BlbnRfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGV4dHJhX2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBtb250aGx5X2tleV91c2FnZSAoXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBtb250aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzcGVudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgaW5wdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBjYWxscyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoYXBpX2tleV9pZCwgbW9udGgpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgbW9udGhseV9rZXlfdXNhZ2VfY3VzdG9tZXJfbW9udGhfaWR4IG9uIG1vbnRobHlfa2V5X3VzYWdlKGN1c3RvbWVyX2lkLCBtb250aCk7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBtb250aGx5X2tleV91c2FnZSBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB1c2FnZV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBpbnB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG91dHB1dF90b2tlbnMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHVzYWdlX2V2ZW50c19jdXN0b21lcl9tb250aF9pZHggb24gdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2tleV9pZHggb24gdXNhZ2VfZXZlbnRzKGFwaV9rZXlfaWQsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGFjdG9yIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFjdGlvbiB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0YXJnZXQgdGV4dCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhdWRpdF9ldmVudHNfY3JlYXRlZF9pZHggb24gYXVkaXRfZXZlbnRzKGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyByYXRlX2xpbWl0X3dpbmRvd3MgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgd2luZG93X3N0YXJ0IHRpbWVzdGFtcHR6IG5vdCBudWxsLFxuICAgICAgICBjb3VudCBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBhcGlfa2V5X2lkLCB3aW5kb3dfc3RhcnQpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcmF0ZV9saW1pdF93aW5kb3dzX3dpbmRvd19pZHggb24gcmF0ZV9saW1pdF93aW5kb3dzKHdpbmRvd19zdGFydCBkZXNjKTtgLCAgICAgIGBhbHRlciB0YWJsZSBhcGlfa2V5cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9zZWVuX2F0IHRpbWVzdGFtcHR6O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGxhc3Rfc2Vlbl9pbnN0YWxsX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSB1c2FnZV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGluc3RhbGxfaWQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHVzYWdlX2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgaXBfaGFzaCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgdXNhZ2VfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyB1YSB0ZXh0O2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdXNhZ2VfZXZlbnRzX2luc3RhbGxfaWR4IG9uIHVzYWdlX2V2ZW50cyhpbnN0YWxsX2lkKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGFsZXJ0c19zZW50IChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsLFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFsZXJ0X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIGFwaV9rZXlfaWQsIG1vbnRoLCBhbGVydF90eXBlKVxuICAgICAgKTtgLFxuICAgIFxuICAgICAgLy8gLS0tIERldmljZSBiaW5kaW5nIC8gc2VhdHMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgY3VzdG9tZXJzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlc19wZXJfa2V5IGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuIG5vdCBudWxsIGRlZmF1bHQgZmFsc2U7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGN1c3RvbWVycyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYWxsb3dlZF9tb2RlbHMganNvbmI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBjdXN0b21lcnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHN0cmlwZV9jdXJyZW50X3BlcmlvZF9lbmQgdGltZXN0YW1wdHo7YCxcblxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtYXhfZGV2aWNlcyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJlcXVpcmVfaW5zdGFsbF9pZCBib29sZWFuO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFsbG93ZWRfcHJvdmlkZXJzIHRleHRbXTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGFwaV9rZXlzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBhbGxvd2VkX21vZGVscyBqc29uYjtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMga2V5X2RldmljZXMgKFxuICAgICAgICBhcGlfa2V5X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGFwaV9rZXlzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgaW5zdGFsbF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBkZXZpY2VfbGFiZWwgdGV4dCxcbiAgICAgICAgZmlyc3Rfc2Vlbl9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBsYXN0X3NlZW5fYXQgdGltZXN0YW1wdHosXG4gICAgICAgIGxhc3Rfc2Vlbl91YSB0ZXh0LFxuICAgICAgICByZXZva2VkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXZva2VkX2J5IHRleHQsXG4gICAgICAgIHByaW1hcnkga2V5IChhcGlfa2V5X2lkLCBpbnN0YWxsX2lkKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGtleV9kZXZpY2VzX2N1c3RvbWVyX2lkeCBvbiBrZXlfZGV2aWNlcyhjdXN0b21lcl9pZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBrZXlfZGV2aWNlc19sYXN0X3NlZW5faWR4IG9uIGtleV9kZXZpY2VzKGxhc3Rfc2Vlbl9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gSW52b2ljZSBzbmFwc2hvdHMgKyB0b3B1cHMgLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgbW9udGhseV9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHNuYXBzaG90IGpzb25iIG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgcHJpbWFyeSBrZXkgKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB0b3B1cF9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIGFtb3VudF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBzb3VyY2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYW51YWwnLFxuICAgICAgICBzdHJpcGVfc2Vzc2lvbl9pZCB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdhcHBsaWVkJyxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdG9wdXBfZXZlbnRzX2N1c3RvbWVyX21vbnRoX2lkeCBvbiB0b3B1cF9ldmVudHMoY3VzdG9tZXJfaWQsIG1vbnRoKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgYXN5bmNfam9icyAoXG4gICAgICAgIGlkIHV1aWQgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBtb2RlbCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1ZXN0IGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIHN0YXR1cyB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgY29tcGxldGVkX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICBoZWFydGJlYXRfYXQgdGltZXN0YW1wdHosXG4gICAgICAgIG91dHB1dF90ZXh0IHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGlucHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgb3V0cHV0X3Rva2VucyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbWV0YSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19jdXN0b21lcl9jcmVhdGVkX2lkeCBvbiBhc3luY19qb2JzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgYXN5bmNfam9ic19zdGF0dXNfaWR4IG9uIGFzeW5jX2pvYnMoc3RhdHVzLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHJlcXVlc3RfaWQgdGV4dCxcbiAgICAgICAgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJyxcbiAgICAgICAga2luZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBmdW5jdGlvbl9uYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG1ldGhvZCB0ZXh0LFxuICAgICAgICBwYXRoIHRleHQsXG4gICAgICAgIG9yaWdpbiB0ZXh0LFxuICAgICAgICByZWZlcmVyIHRleHQsXG4gICAgICAgIHVzZXJfYWdlbnQgdGV4dCxcbiAgICAgICAgaXAgdGV4dCxcbiAgICAgICAgYXBwX2lkIHRleHQsXG4gICAgICAgIGJ1aWxkX2lkIHRleHQsXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQsXG4gICAgICAgIHByb3ZpZGVyIHRleHQsXG4gICAgICAgIG1vZGVsIHRleHQsXG4gICAgICAgIGh0dHBfc3RhdHVzIGludGVnZXIsXG4gICAgICAgIGR1cmF0aW9uX21zIGludGVnZXIsXG4gICAgICAgIGVycm9yX2NvZGUgdGV4dCxcbiAgICAgICAgZXJyb3JfbWVzc2FnZSB0ZXh0LFxuICAgICAgICBlcnJvcl9zdGFjayB0ZXh0LFxuICAgICAgICB1cHN0cmVhbV9zdGF0dXMgaW50ZWdlcixcbiAgICAgICAgdXBzdHJlYW1fYm9keSB0ZXh0LFxuICAgICAgICBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KClcbiAgICAgICk7YCxcblxuICAgICAgLy8gRm9yd2FyZC1jb21wYXRpYmxlIHBhdGNoaW5nOiBpZiBnYXRld2F5X2V2ZW50cyBleGlzdGVkIGZyb20gYW4gb2xkZXIgYnVpbGQsXG4gICAgICAvLyBpdCBtYXkgYmUgbWlzc2luZyBjb2x1bW5zIHVzZWQgYnkgbW9uaXRvciBpbnNlcnRzLlxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyByZXF1ZXN0X2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGV2ZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmZvJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBraW5kIHRleHQgbm90IG51bGwgZGVmYXVsdCAnZXZlbnQnO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZ1bmN0aW9uX25hbWUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICd1bmtub3duJztgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBtZXRob2QgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBwYXRoIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgb3JpZ2luIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgcmVmZXJlciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVzZXJfYWdlbnQgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBpcCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwcF9pZCB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGJ1aWxkX2lkIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGFwaV9rZXlfaWQgYmlnaW50O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHByb3ZpZGVyIHRleHQ7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbW9kZWwgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBodHRwX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGR1cmF0aW9uX21zIGludGVnZXI7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBnYXRld2F5X2V2ZW50cyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgZXJyb3JfY29kZSB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGVycm9yX21lc3NhZ2UgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBlcnJvcl9zdGFjayB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX3N0YXR1cyBpbnRlZ2VyO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHVwc3RyZWFtX2JvZHkgdGV4dDtgLFxuICAgICAgYGFsdGVyIHRhYmxlIGdhdGV3YXlfZXZlbnRzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBleHRyYSBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgZ2F0ZXdheV9ldmVudHMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKTtgLFxuXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfY3JlYXRlZF9pZHggb24gZ2F0ZXdheV9ldmVudHMoY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdhdGV3YXlfZXZlbnRzX3JlcXVlc3RfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKHJlcXVlc3RfaWQpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfbGV2ZWxfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGxldmVsLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2F0ZXdheV9ldmVudHNfZm5faWR4IG9uIGdhdGV3YXlfZXZlbnRzKGZ1bmN0aW9uX25hbWUsIGNyZWF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnYXRld2F5X2V2ZW50c19hcHBfaWR4IG9uIGdhdGV3YXlfZXZlbnRzKGFwcF9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG4gICAgICAvLyAtLS0gS2FpeHVQdXNoIChEZXBsb3kgUHVzaCkgZW50ZXJwcmlzZSB0YWJsZXMgLS0tXG4gICAgICBgYWx0ZXIgdGFibGUgYXBpX2tleXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHJvbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdkZXBsb3llcic7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBhcGlfa2V5c19yb2xlX2lkeCBvbiBhcGlfa2V5cyhyb2xlKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGN1c3RvbWVyX25ldGxpZnlfdG9rZW5zIChcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IHByaW1hcnkga2V5IHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgdG9rZW5fZW5jIHRleHQgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcm9qZWN0cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHJvamVjdF9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBuYW1lIHRleHQgbm90IG51bGwsXG4gICAgICAgIG5ldGxpZnlfc2l0ZV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlIChjdXN0b21lcl9pZCwgcHJvamVjdF9pZClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBwdXNoX3Byb2plY3RzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3Byb2plY3RzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wdXNoZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGFwaV9rZXlfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgYXBpX2tleXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcm9qZWN0X3Jvd19pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBwdXNoX3Byb2plY3RzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgcHVzaF9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgYnJhbmNoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHRpdGxlIHRleHQsXG4gICAgICAgIGRlcGxveV9pZCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBzdGF0ZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICByZXF1aXJlZF9kaWdlc3RzIHRleHRbXSBub3QgbnVsbCBkZWZhdWx0ICd7fSc6OnRleHRbXSxcbiAgICAgICAgdXBsb2FkZWRfZGlnZXN0cyB0ZXh0W10gbm90IG51bGwgZGVmYXVsdCAne30nOjp0ZXh0W10sXG4gICAgICAgIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgdXJsIHRleHQsXG4gICAgICAgIGVycm9yIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9wdXNoZXMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIGZpbGVfbWFuaWZlc3QganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcHVzaGVzX2N1c3RvbWVyX2lkeCBvbiBwdXNoX3B1c2hlcyhjdXN0b21lcl9pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgcHVzaF9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wdXNoZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBzaGExIGNoYXIoNDApIG5vdCBudWxsLFxuICAgICAgICBkZXBsb3lfcGF0aCB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBwYXJ0cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgZXJyb3IgdGV4dCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICB1cGRhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVuaXF1ZSAocHVzaF9yb3dfaWQsIHNoYTEpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgcHVzaF9qb2JzX3B1c2hfaWR4IG9uIHB1c2hfam9icyhwdXNoX3Jvd19pZCwgdXBkYXRlZF9hdCBkZXNjKTtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYnl0ZXNfc3RhZ2VkIGJpZ2ludCBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIHBhcnRfYnl0ZXMganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYjtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDA7YCxcbiAgICAgIGBhbHRlciB0YWJsZSBwdXNoX2pvYnMgYWRkIGNvbHVtbiBpZiBub3QgZXhpc3RzIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0ejtgLFxuICAgICAgYGFsdGVyIHRhYmxlIHB1c2hfam9icyBhZGQgY29sdW1uIGlmIG5vdCBleGlzdHMgbGFzdF9lcnJvciB0ZXh0O2AsXG4gICAgICBgYWx0ZXIgdGFibGUgcHVzaF9qb2JzIGFkZCBjb2x1bW4gaWYgbm90IGV4aXN0cyBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6O2AsXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3JhdGVfd2luZG93cyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGJ1Y2tldF90eXBlIHRleHQgbm90IG51bGwsXG4gICAgICAgIGJ1Y2tldF9zdGFydCB0aW1lc3RhbXB0eiBub3QgbnVsbCxcbiAgICAgICAgY291bnQgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHByaW1hcnkga2V5KGN1c3RvbWVyX2lkLCBidWNrZXRfdHlwZSwgYnVja2V0X3N0YXJ0KVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfcmF0ZV93aW5kb3dzX2J1Y2tldF9pZHggb24gcHVzaF9yYXRlX3dpbmRvd3MoYnVja2V0X3R5cGUsIGJ1Y2tldF9zdGFydCBkZXNjKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZGVwbG95X3BhdGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgc2hhMSBjaGFyKDQwKSBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgbW9kZSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ2RpcmVjdCcsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfZmlsZXNfcHVzaF9pZHggb24gcHVzaF9maWxlcyhwdXNoX3Jvd19pZCk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBwdXNoX3VzYWdlX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHB1c2hfcm93X2lkIGJpZ2ludCByZWZlcmVuY2VzIHB1c2hfcHVzaGVzKGlkKSBvbiBkZWxldGUgc2V0IG51bGwsXG4gICAgICAgIGV2ZW50X3R5cGUgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgYnl0ZXMgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgcHJpY2luZ192ZXJzaW9uIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAxLFxuICAgICAgICBjb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIHB1c2hfdXNhZ2VfY3VzdG9tZXJfaWR4IG9uIHB1c2hfdXNhZ2VfZXZlbnRzKGN1c3RvbWVyX2lkLCBjcmVhdGVkX2F0IGRlc2MpO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9wcmljaW5nX3ZlcnNpb25zIChcbiAgICAgICAgdmVyc2lvbiBpbnRlZ2VyIHByaW1hcnkga2V5LFxuICAgICAgICBlZmZlY3RpdmVfZnJvbSBkYXRlIG5vdCBudWxsIGRlZmF1bHQgY3VycmVudF9kYXRlLFxuICAgICAgICBjdXJyZW5jeSB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ1VTRCcsXG4gICAgICAgIGJhc2VfbW9udGhfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9kZXBsb3lfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIHBlcl9nYl9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgaW5zZXJ0IGludG8gcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24sIGJhc2VfbW9udGhfY2VudHMsIHBlcl9kZXBsb3lfY2VudHMsIHBlcl9nYl9jZW50cylcbiAgICAgICB2YWx1ZXMgKDEsIDAsIDEwLCAyNSkgb24gY29uZmxpY3QgKHZlcnNpb24pIGRvIG5vdGhpbmc7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBjdXN0b21lcl9wdXNoX2JpbGxpbmcgKFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgcHJpbWFyeSBrZXkgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwcmljaW5nX3ZlcnNpb24gaW50ZWdlciBub3QgbnVsbCByZWZlcmVuY2VzIHB1c2hfcHJpY2luZ192ZXJzaW9ucyh2ZXJzaW9uKSxcbiAgICAgICAgbW9udGhseV9jYXBfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgcHVzaF9pbnZvaWNlcyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBub3QgbnVsbCByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIG1vbnRoIHRleHQgbm90IG51bGwsXG4gICAgICAgIHByaWNpbmdfdmVyc2lvbiBpbnRlZ2VyIG5vdCBudWxsIHJlZmVyZW5jZXMgcHVzaF9wcmljaW5nX3ZlcnNpb25zKHZlcnNpb24pLFxuICAgICAgICB0b3RhbF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsLFxuICAgICAgICBicmVha2Rvd24ganNvbmIgbm90IG51bGwsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBwcmltYXJ5IGtleSAoY3VzdG9tZXJfaWQsIG1vbnRoKVxuICAgICAgKTtgLFxuXG4gICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgIC8vIEdpdEh1YiBQdXNoIEdhdGV3YXkgKG9wdGlvbmFsKVxuICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgY3VzdG9tZXJfZ2l0aHViX3Rva2VucyAoXG4gICAgICAgIGN1c3RvbWVyX2lkIGJpZ2ludCBwcmltYXJ5IGtleSByZWZlcmVuY2VzIGN1c3RvbWVycyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIHRva2VuX2VuYyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICB0b2tlbl90eXBlIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb2F1dGgnLFxuICAgICAgICBzY29wZXMgdGV4dFtdIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6dGV4dFtdLFxuICAgICAgICBjcmVhdGVkX2F0IHRpbWVzdGFtcHR6IG5vdCBudWxsIGRlZmF1bHQgbm93KCksXG4gICAgICAgIHVwZGF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIGdoX3B1c2hfam9icyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9pZCB0ZXh0IG5vdCBudWxsIHVuaXF1ZSxcbiAgICAgICAgb3duZXIgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgcmVwbyB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBicmFuY2ggdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdtYWluJyxcbiAgICAgICAgY29tbWl0X21lc3NhZ2UgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdLYWl4dSBHaXRIdWIgUHVzaCcsXG4gICAgICAgIHBhcnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICByZWNlaXZlZF9wYXJ0cyBpbnRlZ2VyW10gbm90IG51bGwgZGVmYXVsdCAne30nOjppbnRbXSxcbiAgICAgICAgcGFydF9ieXRlcyBqc29uYiBub3QgbnVsbCBkZWZhdWx0ICd7fSc6Ompzb25iLFxuICAgICAgICBieXRlc19zdGFnZWQgYmlnaW50IG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgc3RhdHVzIHRleHQgbm90IG51bGwgZGVmYXVsdCAndXBsb2FkaW5nJyxcbiAgICAgICAgYXR0ZW1wdHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIG5leHRfYXR0ZW1wdF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgbGFzdF9lcnJvciB0ZXh0LFxuICAgICAgICBsYXN0X2Vycm9yX2F0IHRpbWVzdGFtcHR6LFxuICAgICAgICByZXN1bHRfY29tbWl0X3NoYSB0ZXh0LFxuICAgICAgICByZXN1bHRfdXJsIHRleHQsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdXBkYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZ2hfcHVzaF9qb2JzX2N1c3RvbWVyX2lkeCBvbiBnaF9wdXNoX2pvYnMoY3VzdG9tZXJfaWQsIHVwZGF0ZWRfYXQgZGVzYyk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyBnaF9wdXNoX2pvYnNfbmV4dF9hdHRlbXB0X2lkeCBvbiBnaF9wdXNoX2pvYnMobmV4dF9hdHRlbXB0X2F0KSB3aGVyZSBzdGF0dXMgaW4gKCdyZXRyeV93YWl0JywnZXJyb3JfdHJhbnNpZW50Jyk7YCxcbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBnaF9wdXNoX2V2ZW50cyAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgYXBpX2tleV9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBhcGlfa2V5cyhpZCkgb24gZGVsZXRlIGNhc2NhZGUsXG4gICAgICAgIGpvYl9yb3dfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgZ2hfcHVzaF9qb2JzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgZXZlbnRfdHlwZSB0ZXh0IG5vdCBudWxsLFxuICAgICAgICBieXRlcyBiaWdpbnQgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmIsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKVxuICAgICAgKTtgLFxuICAgICAgYGNyZWF0ZSBpbmRleCBpZiBub3QgZXhpc3RzIGdoX3B1c2hfZXZlbnRzX2pvYl9pZHggb24gZ2hfcHVzaF9ldmVudHMoam9iX3Jvd19pZCwgY3JlYXRlZF9hdCBkZXNjKTtgLFxuXG5cbiAgICAgIGBjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyB2b2ljZV9udW1iZXJzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICBwaG9uZV9udW1iZXIgdGV4dCBub3QgbnVsbCB1bmlxdWUsXG4gICAgICAgIHByb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAndHdpbGlvJyxcbiAgICAgICAgdHdpbGlvX3NpZCB0ZXh0LFxuICAgICAgICBpc19hY3RpdmUgYm9vbGVhbiBub3QgbnVsbCBkZWZhdWx0IHRydWUsXG4gICAgICAgIGRlZmF1bHRfbGxtX3Byb3ZpZGVyIHRleHQgbm90IG51bGwgZGVmYXVsdCAnb3BlbmFpJyxcbiAgICAgICAgZGVmYXVsdF9sbG1fbW9kZWwgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdncHQtNC4xLW1pbmknLFxuICAgICAgICB2b2ljZV9uYW1lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnYWxsb3knLFxuICAgICAgICBsb2NhbGUgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdlbi1VUycsXG4gICAgICAgIHRpbWV6b25lIHRleHQgbm90IG51bGwgZGVmYXVsdCAnQW1lcmljYS9QaG9lbml4JyxcbiAgICAgICAgcGxheWJvb2sganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYixcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfbnVtYmVyc19jdXN0b21lcl9pZHggb24gdm9pY2VfbnVtYmVycyhjdXN0b21lcl9pZCk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxzIChcbiAgICAgICAgaWQgYmlnc2VyaWFsIHByaW1hcnkga2V5LFxuICAgICAgICBjdXN0b21lcl9pZCBiaWdpbnQgbm90IG51bGwgcmVmZXJlbmNlcyBjdXN0b21lcnMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICB2b2ljZV9udW1iZXJfaWQgYmlnaW50IHJlZmVyZW5jZXMgdm9pY2VfbnVtYmVycyhpZCkgb24gZGVsZXRlIHNldCBudWxsLFxuICAgICAgICBwcm92aWRlciB0ZXh0IG5vdCBudWxsIGRlZmF1bHQgJ3R3aWxpbycsXG4gICAgICAgIHByb3ZpZGVyX2NhbGxfc2lkIHRleHQgbm90IG51bGwsXG4gICAgICAgIGZyb21fbnVtYmVyIHRleHQsXG4gICAgICAgIHRvX251bWJlciB0ZXh0LFxuICAgICAgICBzdGF0dXMgdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbml0aWF0ZWQnLFxuICAgICAgICBkaXJlY3Rpb24gdGV4dCBub3QgbnVsbCBkZWZhdWx0ICdpbmJvdW5kJyxcbiAgICAgICAgc3RhcnRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpLFxuICAgICAgICBlbmRlZF9hdCB0aW1lc3RhbXB0eixcbiAgICAgICAgZHVyYXRpb25fc2Vjb25kcyBpbnRlZ2VyLFxuICAgICAgICBlc3RfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgYmlsbF9jb3N0X2NlbnRzIGludGVnZXIgbm90IG51bGwgZGVmYXVsdCAwLFxuICAgICAgICBtZXRhIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgdW5pcXVlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbHNfcHJvdmlkZXJfc2lkX3VxIG9uIHZvaWNlX2NhbGxzKHByb3ZpZGVyLCBwcm92aWRlcl9jYWxsX3NpZCk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV9jYWxsc19jdXN0b21lcl9pZHggb24gdm9pY2VfY2FsbHMoY3VzdG9tZXJfaWQsIHN0YXJ0ZWRfYXQgZGVzYyk7YCxcblxuICAgICAgYGNyZWF0ZSB0YWJsZSBpZiBub3QgZXhpc3RzIHZvaWNlX2NhbGxfbWVzc2FnZXMgKFxuICAgICAgICBpZCBiaWdzZXJpYWwgcHJpbWFyeSBrZXksXG4gICAgICAgIGNhbGxfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgdm9pY2VfY2FsbHMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLFxuICAgICAgICByb2xlIHRleHQgbm90IG51bGwsIC0tIHVzZXJ8YXNzaXN0YW50fHN5c3RlbXx0b29sXG4gICAgICAgIGNvbnRlbnQgdGV4dCBub3QgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdCB0aW1lc3RhbXB0eiBub3QgbnVsbCBkZWZhdWx0IG5vdygpXG4gICAgICApO2AsXG4gICAgICBgY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgdm9pY2VfY2FsbF9tZXNzYWdlc19jYWxsX2lkeCBvbiB2b2ljZV9jYWxsX21lc3NhZ2VzKGNhbGxfaWQsIGlkKTtgLFxuXG4gICAgICBgY3JlYXRlIHRhYmxlIGlmIG5vdCBleGlzdHMgdm9pY2VfdXNhZ2VfbW9udGhseSAoXG4gICAgICAgIGlkIGJpZ3NlcmlhbCBwcmltYXJ5IGtleSxcbiAgICAgICAgY3VzdG9tZXJfaWQgYmlnaW50IG5vdCBudWxsIHJlZmVyZW5jZXMgY3VzdG9tZXJzKGlkKSBvbiBkZWxldGUgY2FzY2FkZSxcbiAgICAgICAgbW9udGggdGV4dCBub3QgbnVsbCxcbiAgICAgICAgbWludXRlcyBudW1lcmljIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgZXN0X2Nvc3RfY2VudHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGJpbGxfY29zdF9jZW50cyBpbnRlZ2VyIG5vdCBudWxsIGRlZmF1bHQgMCxcbiAgICAgICAgY2FsbHMgaW50ZWdlciBub3QgbnVsbCBkZWZhdWx0IDAsXG4gICAgICAgIGNyZWF0ZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBub3coKSxcbiAgICAgICAgdW5pcXVlKGN1c3RvbWVyX2lkLCBtb250aClcbiAgICAgICk7YCxcbiAgICAgIGBjcmVhdGUgaW5kZXggaWYgbm90IGV4aXN0cyB2b2ljZV91c2FnZV9tb250aGx5X2N1c3RvbWVyX2lkeCBvbiB2b2ljZV91c2FnZV9tb250aGx5KGN1c3RvbWVyX2lkLCBtb250aCk7YCxcblxuXTtcblxuICAgIGZvciAoY29uc3QgcyBvZiBzdGF0ZW1lbnRzKSB7XG4gICAgICBhd2FpdCBzcWwucXVlcnkocyk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBfc2NoZW1hUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBRdWVyeSBoZWxwZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBwcmV2aW91cyBgcGdgLWlzaCBpbnRlcmZhY2U6XG4gKiAtIHJldHVybnMgeyByb3dzLCByb3dDb3VudCB9XG4gKiAtIHN1cHBvcnRzICQxLCAkMiBwbGFjZWhvbGRlcnMgKyBwYXJhbXMgYXJyYXkgdmlhIHNxbC5xdWVyeSguLi4pXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxKHRleHQsIHBhcmFtcyA9IFtdKSB7XG4gIGF3YWl0IGVuc3VyZVNjaGVtYSgpO1xuICBjb25zdCBzcWwgPSBnZXRTcWwoKTtcbiAgY29uc3Qgcm93cyA9IGF3YWl0IHNxbC5xdWVyeSh0ZXh0LCBwYXJhbXMpO1xuICByZXR1cm4geyByb3dzOiByb3dzIHx8IFtdLCByb3dDb3VudDogQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MubGVuZ3RoIDogMCB9O1xufSIsICJleHBvcnQgZnVuY3Rpb24gYnVpbGRDb3JzKHJlcSkge1xuICBjb25zdCBhbGxvd1JhdyA9IChwcm9jZXNzLmVudi5BTExPV0VEX09SSUdJTlMgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCByZXFPcmlnaW4gPSByZXEuaGVhZGVycy5nZXQoXCJvcmlnaW5cIikgfHwgcmVxLmhlYWRlcnMuZ2V0KFwiT3JpZ2luXCIpO1xuXG4gIC8vIElNUE9SVEFOVDoga2VlcCB0aGlzIGxpc3QgYWxpZ25lZCB3aXRoIHdoYXRldmVyIGhlYWRlcnMgeW91ciBhcHBzIHNlbmQuXG4gIGNvbnN0IGFsbG93SGVhZGVycyA9IFwiYXV0aG9yaXphdGlvbiwgY29udGVudC10eXBlLCB4LWthaXh1LWluc3RhbGwtaWQsIHgta2FpeHUtcmVxdWVzdC1pZCwgeC1rYWl4dS1hcHAsIHgta2FpeHUtYnVpbGQsIHgtYWRtaW4tcGFzc3dvcmQsIHgta2FpeHUtZXJyb3ItdG9rZW4sIHgta2FpeHUtbW9kZSwgeC1jb250ZW50LXNoYTEsIHgtc2V0dXAtc2VjcmV0LCB4LWthaXh1LWpvYi1zZWNyZXQsIHgtam9iLXdvcmtlci1zZWNyZXRcIjtcbiAgY29uc3QgYWxsb3dNZXRob2RzID0gXCJHRVQsUE9TVCxQVVQsUEFUQ0gsREVMRVRFLE9QVElPTlNcIjtcblxuICBjb25zdCBiYXNlID0ge1xuICAgIFwiYWNjZXNzLWNvbnRyb2wtYWxsb3ctaGVhZGVyc1wiOiBhbGxvd0hlYWRlcnMsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1tZXRob2RzXCI6IGFsbG93TWV0aG9kcyxcbiAgICBcImFjY2Vzcy1jb250cm9sLWV4cG9zZS1oZWFkZXJzXCI6IFwieC1rYWl4dS1yZXF1ZXN0LWlkXCIsXG4gICAgXCJhY2Nlc3MtY29udHJvbC1tYXgtYWdlXCI6IFwiODY0MDBcIlxuICB9O1xuXG4gIC8vIFNUUklDVCBCWSBERUZBVUxUOlxuICAvLyAtIElmIEFMTE9XRURfT1JJR0lOUyBpcyB1bnNldC9ibGFuayBhbmQgYSBicm93c2VyIE9yaWdpbiBpcyBwcmVzZW50LCB3ZSBkbyBOT1QgZ3JhbnQgQ09SUy5cbiAgLy8gLSBBbGxvdy1hbGwgaXMgb25seSBlbmFibGVkIHdoZW4gQUxMT1dFRF9PUklHSU5TIGV4cGxpY2l0bHkgY29udGFpbnMgXCIqXCIuXG4gIGlmICghYWxsb3dSYXcpIHtcbiAgICAvLyBObyBhbGxvdy1vcmlnaW4gZ3JhbnRlZC4gU2VydmVyLXRvLXNlcnZlciByZXF1ZXN0cyAobm8gT3JpZ2luIGhlYWRlcikgc3RpbGwgd29yayBub3JtYWxseS5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC4uLihyZXFPcmlnaW4gPyB7IHZhcnk6IFwiT3JpZ2luXCIgfSA6IHt9KVxuICAgIH07XG4gIH1cblxuICBjb25zdCBhbGxvd2VkID0gYWxsb3dSYXcuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblxuICAvLyBFeHBsaWNpdCBhbGxvdy1hbGxcbiAgaWYgKGFsbG93ZWQuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgY29uc3Qgb3JpZ2luID0gcmVxT3JpZ2luIHx8IFwiKlwiO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogb3JpZ2luLFxuICAgICAgLi4uKHJlcU9yaWdpbiA/IHsgdmFyeTogXCJPcmlnaW5cIiB9IDoge30pXG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4YWN0LW1hdGNoIGFsbG93bGlzdFxuICBpZiAocmVxT3JpZ2luICYmIGFsbG93ZWQuaW5jbHVkZXMocmVxT3JpZ2luKSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXCJhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW5cIjogcmVxT3JpZ2luLFxuICAgICAgdmFyeTogXCJPcmlnaW5cIlxuICAgIH07XG4gIH1cblxuICAvLyBPcmlnaW4gcHJlc2VudCBidXQgbm90IGFsbG93ZWQ6IGRvIG5vdCBncmFudCBhbGxvdy1vcmlnaW4uXG4gIHJldHVybiB7XG4gICAgLi4uYmFzZSxcbiAgICAuLi4ocmVxT3JpZ2luID8geyB2YXJ5OiBcIk9yaWdpblwiIH0gOiB7fSlcbiAgfTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24ganNvbihzdGF0dXMsIGJvZHksIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVyc1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0KHN0YXR1cywgYm9keSwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXMsIGhlYWRlcnMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWRSZXF1ZXN0KG1lc3NhZ2UsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4ganNvbig0MDAsIHsgZXJyb3I6IG1lc3NhZ2UgfSwgaGVhZGVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCZWFyZXIocmVxKSB7XG4gIGNvbnN0IGF1dGggPSByZXEuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIkF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgaWYgKCFhdXRoLnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGF1dGguc2xpY2UoNykudHJpbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9udGhLZXlVVEMoZCA9IG5ldyBEYXRlKCkpIHtcbiAgcmV0dXJuIGQudG9JU09TdHJpbmcoKS5zbGljZSgwLCA3KTsgLy8gWVlZWS1NTVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5zdGFsbElkKHJlcSkge1xuICByZXR1cm4gKFxuICAgIHJlcS5oZWFkZXJzLmdldChcIngta2FpeHUtaW5zdGFsbC1pZFwiKSB8fFxuICAgIHJlcS5oZWFkZXJzLmdldChcIlgtS2FpeHUtSW5zdGFsbC1JZFwiKSB8fFxuICAgIFwiXCJcbiAgKS50b1N0cmluZygpLnRyaW0oKS5zbGljZSgwLCA4MCkgfHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudChyZXEpIHtcbiAgcmV0dXJuIChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpIHx8IHJlcS5oZWFkZXJzLmdldChcIlVzZXItQWdlbnRcIikgfHwgXCJcIikudG9TdHJpbmcoKS5zbGljZSgwLCAyNDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIC8vIE5ldGxpZnkgYWRkcyB4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwIHdoZW4gZGVwbG95ZWQgKG1heSBiZSBtaXNzaW5nIGluIG5ldGxpZnkgZGV2KS5cbiAgY29uc3QgYSA9IChyZXEuaGVhZGVycy5nZXQoXCJ4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCkudHJpbSgpO1xuICBpZiAoYSkgcmV0dXJuIGE7XG5cbiAgLy8gRmFsbGJhY2sgdG8gZmlyc3QgWC1Gb3J3YXJkZWQtRm9yIGVudHJ5LlxuICBjb25zdCB4ZmYgPSAocmVxLmhlYWRlcnMuZ2V0KFwieC1mb3J3YXJkZWQtZm9yXCIpIHx8IFwiXCIpLnRvU3RyaW5nKCk7XG4gIGlmICgheGZmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZmlyc3QgPSB4ZmYuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgcmV0dXJuIGZpcnN0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgbXMpKTtcbn0iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQUEsU0FBUyxnQkFBZ0I7OztBQ0F6QixTQUFTLFlBQVk7QUFhckIsSUFBSSxPQUFPO0FBQ1gsSUFBSSxpQkFBaUI7QUFFckIsU0FBUyxTQUFTO0FBQ2hCLE1BQUksS0FBTSxRQUFPO0FBRWpCLFFBQU0sV0FBVyxDQUFDLEVBQUUsUUFBUSxJQUFJLHdCQUF3QixRQUFRLElBQUk7QUFDcEUsTUFBSSxDQUFDLFVBQVU7QUFDYixVQUFNLE1BQU0sSUFBSSxNQUFNLGdHQUFnRztBQUN0SCxRQUFJLE9BQU87QUFDWCxRQUFJLFNBQVM7QUFDYixRQUFJLE9BQU87QUFDWCxVQUFNO0FBQUEsRUFDUjtBQUVBLFNBQU8sS0FBSztBQUNaLFNBQU87QUFDVDtBQUVBLGVBQWUsZUFBZTtBQUM1QixNQUFJLGVBQWdCLFFBQU87QUFFM0Isb0JBQWtCLFlBQVk7QUFDNUIsVUFBTSxNQUFNLE9BQU87QUFDbkIsVUFBTSxhQUFhO0FBQUEsTUFDakI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BV0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVFBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxNQUEyRztBQUFBLE1BQzNHO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFRQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFtQkE7QUFBQSxNQUNBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQStCQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUdBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BVUE7QUFBQSxNQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1Ba0JBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFlQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BRUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU9BO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVlBO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVNBO0FBQUE7QUFBQSxNQUVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFPQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BY0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BUUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BdUJBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQVVBO0FBQUEsTUFHQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWVBO0FBQUEsTUFFQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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
