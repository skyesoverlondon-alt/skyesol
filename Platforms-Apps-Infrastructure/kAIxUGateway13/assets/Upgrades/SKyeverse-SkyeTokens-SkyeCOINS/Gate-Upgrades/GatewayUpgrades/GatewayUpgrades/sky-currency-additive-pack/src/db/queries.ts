import type { AuthContext, PricingRule, RouteOption, TraceUsageRecord } from '../types'
import { nowIso } from '../utils/clock'
import { createId } from '../utils/ids'

function parseAliases(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export async function findAppTokenByHash(db: D1Database, tokenHash: string): Promise<AuthContext | null> {
  const row = await db
    .prepare(`
      SELECT id, app_id, org_id, wallet_id, allowed_aliases, rate_limit_rpm
      FROM app_tokens
      WHERE token_hash = ? AND enabled = 1
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<Record<string, unknown>>()

  if (!row) return null

  return {
    tokenId: String(row.id),
    appId: String(row.app_id),
    orgId: String(row.org_id),
    walletId: String(row.wallet_id),
    allowedAliases: parseAliases(row.allowed_aliases),
    rateLimitRpm: row.rate_limit_rpm == null ? null : Number(row.rate_limit_rpm),
  }
}

export async function getWalletById(db: D1Database, walletId: string): Promise<Record<string, unknown> | null> {
  return await db
    .prepare('SELECT * FROM wallets WHERE id = ? LIMIT 1')
    .bind(walletId)
    .first<Record<string, unknown>>()
}

export async function listAliasesForApp(db: D1Database, appId: string): Promise<RouteOption[]> {
  const authRow = await db
    .prepare('SELECT allowed_aliases FROM app_tokens WHERE app_id = ? AND enabled = 1 LIMIT 1')
    .bind(appId)
    .first<Record<string, unknown>>()

  const allowedAliases = parseAliases(authRow?.allowed_aliases)
  if (allowedAliases.length === 0) return []

  const placeholders = allowedAliases.map(() => '?').join(',')
  const result = await db
    .prepare(`
      SELECT ma.alias, p.name AS provider, ma.provider_model AS model, ma.priority, ma.enabled
      FROM model_aliases ma
      JOIN providers p ON p.id = ma.provider_id
      WHERE ma.enabled = 1 AND p.enabled = 1 AND ma.alias IN (${placeholders})
      ORDER BY ma.alias ASC, ma.priority ASC
    `)
    .bind(...allowedAliases)
    .all<Record<string, unknown>>()

  return (result.results ?? []).map((row) => ({
    alias: String(row.alias),
    provider: String(row.provider) as RouteOption['provider'],
    model: String(row.model),
    priority: Number(row.priority),
    enabled: Number(row.enabled) === 1,
  }))
}

export async function listRoutesForAlias(db: D1Database, alias: string): Promise<RouteOption[]> {
  const result = await db
    .prepare(`
      SELECT ma.alias, p.name AS provider, ma.provider_model AS model, ma.priority, ma.enabled
      FROM model_aliases ma
      JOIN providers p ON p.id = ma.provider_id
      WHERE ma.alias = ? AND ma.enabled = 1 AND p.enabled = 1
      ORDER BY ma.priority ASC
    `)
    .bind(alias)
    .all<Record<string, unknown>>()

  return (result.results ?? []).map((row) => ({
    alias: String(row.alias),
    provider: String(row.provider) as RouteOption['provider'],
    model: String(row.model),
    priority: Number(row.priority),
    enabled: Number(row.enabled) === 1,
  }))
}

export async function getPricingRule(db: D1Database, alias: string): Promise<PricingRule | null> {
  const row = await db
    .prepare('SELECT alias, base_burn, input_token_rate, output_token_rate, image_rate, enabled FROM alias_pricing WHERE alias = ? AND enabled = 1 LIMIT 1')
    .bind(alias)
    .first<Record<string, unknown>>()

  if (!row) return null

  return {
    alias: String(row.alias),
    base_burn: Number(row.base_burn),
    input_token_rate: Number(row.input_token_rate),
    output_token_rate: Number(row.output_token_rate),
    image_rate: Number(row.image_rate),
    enabled: Number(row.enabled) === 1,
  }
}

export async function getRoutingPolicy(db: D1Database, alias: string, appId: string, orgId: string): Promise<Record<string, unknown> | null> {
  const exact = await db
    .prepare(`
      SELECT *
      FROM routing_rules
      WHERE alias = ? AND app_id = ? AND org_id = ? AND enabled = 1
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(alias, appId, orgId)
    .first<Record<string, unknown>>()

  if (exact) return exact

  return await db
    .prepare(`
      SELECT *
      FROM routing_rules
      WHERE alias = ? AND (app_id IS NULL OR app_id = '') AND (org_id IS NULL OR org_id = '') AND enabled = 1
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(alias)
    .first<Record<string, unknown>>()
}

export async function updateWalletBalance(db: D1Database, walletId: string, nextBalance: number): Promise<void> {
  await db.prepare('UPDATE wallets SET balance = ? WHERE id = ?').bind(nextBalance, walletId).run()
}

export async function insertWalletTransaction(
  db: D1Database,
  params: {
    walletId: string
    txType: string
    amount: number
    balanceAfter: number
    traceId?: string
    note?: string
  },
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO wallet_transactions (id, wallet_id, tx_type, amount, balance_after, trace_id, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      createId('wtx'),
      params.walletId,
      params.txType,
      params.amount,
      params.balanceAfter,
      params.traceId ?? null,
      params.note ?? null,
      nowIso(),
    )
    .run()
}

export async function insertUsageEvent(db: D1Database, record: TraceUsageRecord): Promise<void> {
  await db
    .prepare(`
      INSERT INTO usage_events (
        id, trace_id, org_id, app_id, user_id, wallet_id, alias, provider, resolved_model,
        request_type, input_tokens, output_tokens, skyfuel_burned, estimated_cost_usd,
        status, latency_ms, error_code, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      createId('usage'),
      record.traceId,
      record.orgId ?? null,
      record.appId ?? null,
      record.userId ?? null,
      record.walletId ?? null,
      record.alias,
      record.provider ?? null,
      record.resolvedModel ?? null,
      record.requestType,
      record.inputTokens ?? null,
      record.outputTokens ?? null,
      record.skyfuelBurned,
      record.estimatedCostUsd,
      record.status,
      record.latencyMs ?? null,
      record.errorCode ?? null,
      record.errorMessage ?? null,
      nowIso(),
    )
    .run()
}

export async function insertFallbackLog(
  db: D1Database,
  params: {
    traceId: string
    fromProvider?: string
    fromModel?: string
    toProvider?: string
    toModel?: string
    reason: string
  },
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO fallback_logs (id, trace_id, from_provider, from_model, to_provider, to_model, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      createId('fallback'),
      params.traceId,
      params.fromProvider ?? null,
      params.fromModel ?? null,
      params.toProvider ?? null,
      params.toModel ?? null,
      params.reason,
      nowIso(),
    )
    .run()
}

export async function listUsageEventsForApp(db: D1Database, appId: string, limit = 25): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(`
      SELECT trace_id, app_id, alias, provider, resolved_model, skyfuel_burned, estimated_cost_usd, status, created_at
      FROM usage_events
      WHERE app_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(appId, limit)
    .all<Record<string, unknown>>()

  return result.results ?? []
}

export async function listProviders(db: D1Database): Promise<Record<string, unknown>[]> {
  const result = await db.prepare('SELECT * FROM providers ORDER BY name ASC').all<Record<string, unknown>>()
  return result.results ?? []
}

export async function listAliases(db: D1Database): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(`
      SELECT ma.alias, ma.task_type, p.name AS provider, ma.provider_model, ma.priority, ma.enabled
      FROM model_aliases ma
      JOIN providers p ON p.id = ma.provider_id
      ORDER BY ma.alias ASC, ma.priority ASC
    `)
    .all<Record<string, unknown>>()
  return result.results ?? []
}

export async function listRoutingRules(db: D1Database): Promise<Record<string, unknown>[]> {
  const result = await db.prepare('SELECT * FROM routing_rules ORDER BY alias ASC, created_at DESC').all<Record<string, unknown>>()
  return result.results ?? []
}

export async function creditWalletById(db: D1Database, walletId: string, amount: number, note?: string): Promise<Record<string, unknown>> {
  const wallet = await getWalletById(db, walletId)
  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`)
  }

  const currentBalance = Number(wallet.balance ?? 0)
  const nextBalance = currentBalance + amount
  await updateWalletBalance(db, walletId, nextBalance)
  await insertWalletTransaction(db, {
    walletId,
    txType: 'credit',
    amount,
    balanceAfter: nextBalance,
    note,
  })

  return {
    wallet_id: walletId,
    previous_balance: currentBalance,
    credited: amount,
    balance: nextBalance,
  }
}


function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function toJson(value: unknown): string | null {
  if (value == null) return null
  return JSON.stringify(value)
}

export async function insertKaixuTrace(db: D1Database, record: {
  traceId: string
  jobId?: string | null
  appId?: string | null
  userId?: string | null
  orgId?: string | null
  lane: string
  engineAlias: string
  publicStatus: string
  upstreamVendor?: string | null
  upstreamModel?: string | null
  inputSizeEstimate?: number | null
  outputSizeEstimate?: number | null
  usageJson?: unknown
  latencyMs?: number | null
  publicResponseJson?: unknown
  publicErrorCode?: string | null
  publicErrorMessage?: string | null
  requestMethod?: string | null
  requestPath?: string | null
  internalResponseJson?: unknown
  internalErrorJson?: unknown
}): Promise<void> {
  const now = nowIso()
  await db.prepare(`
    INSERT INTO kaixu_traces (
      trace_id, job_id, app_id, user_id, org_id, lane, engine_alias, public_status,
      upstream_vendor, upstream_model, input_size_estimate, output_size_estimate,
      usage_json, latency_ms, public_response_json, public_error_code, public_error_message,
      request_method, request_path, internal_response_json, internal_error_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.traceId,
    record.jobId ?? null,
    record.appId ?? null,
    record.userId ?? null,
    record.orgId ?? null,
    record.lane,
    record.engineAlias,
    record.publicStatus,
    record.upstreamVendor ?? null,
    record.upstreamModel ?? null,
    record.inputSizeEstimate ?? null,
    record.outputSizeEstimate ?? null,
    toJson(record.usageJson),
    record.latencyMs ?? null,
    toJson(record.publicResponseJson),
    record.publicErrorCode ?? null,
    record.publicErrorMessage ?? null,
    record.requestMethod ?? null,
    record.requestPath ?? null,
    toJson(record.internalResponseJson),
    toJson(record.internalErrorJson),
    now,
    now,
  ).run()
}

export async function createKaixuJob(db: D1Database, record: {
  jobId: string
  traceId: string
  appId?: string | null
  userId?: string | null
  orgId?: string | null
  lane: string
  engineAlias: string
  status: string
  upstreamVendor?: string | null
  upstreamModel?: string | null
  upstreamJobId?: string | null
  requestJson?: unknown
  resultJson?: unknown
  assetRefs?: unknown
  errorCode?: string | null
  errorMessage?: string | null
  adminErrorRaw?: unknown
  completedAt?: string | null
}): Promise<void> {
  const now = nowIso()
  await db.prepare(`
    INSERT INTO kaixu_jobs (
      job_id, trace_id, app_id, user_id, org_id, lane, engine_alias, status,
      upstream_vendor, upstream_model, upstream_job_id, request_json, result_json,
      asset_refs, error_code, error_message, admin_error_raw, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.jobId,
    record.traceId,
    record.appId ?? null,
    record.userId ?? null,
    record.orgId ?? null,
    record.lane,
    record.engineAlias,
    record.status,
    record.upstreamVendor ?? null,
    record.upstreamModel ?? null,
    record.upstreamJobId ?? null,
    toJson(record.requestJson),
    toJson(record.resultJson),
    toJson(record.assetRefs),
    record.errorCode ?? null,
    record.errorMessage ?? null,
    toJson(record.adminErrorRaw),
    now,
    now,
    record.completedAt ?? null,
  ).run()
}

export async function updateKaixuJob(db: D1Database, jobId: string, patch: {
  status?: string
  upstreamJobId?: string | null
  resultJson?: unknown
  assetRefs?: unknown
  errorCode?: string | null
  errorMessage?: string | null
  adminErrorRaw?: unknown
  completedAt?: string | null
}): Promise<void> {
  await db.prepare(`
    UPDATE kaixu_jobs
    SET status = COALESCE(?, status),
        upstream_job_id = COALESCE(?, upstream_job_id),
        result_json = COALESCE(?, result_json),
        asset_refs = COALESCE(?, asset_refs),
        error_code = COALESCE(?, error_code),
        error_message = COALESCE(?, error_message),
        admin_error_raw = COALESCE(?, admin_error_raw),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
    WHERE job_id = ?
  `).bind(
    patch.status ?? null,
    patch.upstreamJobId ?? null,
    toJson(patch.resultJson),
    toJson(patch.assetRefs),
    patch.errorCode ?? null,
    patch.errorMessage ?? null,
    toJson(patch.adminErrorRaw),
    patch.completedAt ?? null,
    nowIso(),
    jobId,
  ).run()
}

export async function getKaixuJobById(db: D1Database, jobId: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM kaixu_jobs WHERE job_id = ? LIMIT 1').bind(jobId).first<Record<string, unknown>>()
  if (!row) return null
  return {
    ...row,
    request_json: parseJsonField(row.request_json, null),
    result_json: parseJsonField(row.result_json, null),
    asset_refs: parseJsonField(row.asset_refs, []),
    admin_error_raw: parseJsonField(row.admin_error_raw, null),
  }
}

export async function getKaixuTraceById(db: D1Database, traceId: string): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM kaixu_traces WHERE trace_id = ? LIMIT 1').bind(traceId).first<Record<string, unknown>>()
  if (!row) return null
  return {
    ...row,
    usage_json: parseJsonField(row.usage_json, null),
    public_response_json: parseJsonField(row.public_response_json, null),
    internal_response_json: parseJsonField(row.internal_response_json, null),
    internal_error_json: parseJsonField(row.internal_error_json, null),
  }
}

export async function listKaixuTracesForApp(db: D1Database, appId: string, limit = 50): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`
    SELECT trace_id, job_id, app_id, lane, engine_alias, public_status, usage_json, created_at
    FROM kaixu_traces
    WHERE app_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(appId, limit).all<Record<string, unknown>>()
  return (result.results ?? []).map((row) => ({
    ...row,
    usage_json: row.usage_json,
  }))
}
