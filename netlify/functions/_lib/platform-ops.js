import { hasConfiguredDb, q } from "./db.js";

const DEFAULT_ROW = {
  health_status: "unreviewed",
  onboarding_stage: "untracked",
  lifecycle_status: "active",
  owner: "",
  notes: "",
  flags: {},
  updated_by: null,
  last_checked_at: null,
  created_at: null,
  updated_at: null
};

function normalizeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizeFlags(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function getBackupBrainSignal() {
  const configured = !!String(process.env.KAIXU_BACKUP_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const locked = !!String(process.env.KAIXU_BACKUP_TOKEN || "").trim();
  return {
    configured,
    locked,
    provider: String(process.env.KAIXU_PUBLIC_PROVIDER_NAME || "Skyes Over London").trim(),
    model: String(process.env.KAIXU_PUBLIC_MODEL_NAME || "skAIxU Flow6.7").trim(),
    status: configured ? "ready" : "unconfigured"
  };
}

export async function listPlatformOpsStatus(appIds = []) {
  const map = new Map();
  if (!hasConfiguredDb()) return map;

  const result = appIds.length
    ? await q(
      `select * from platform_ops_status where app_id = any($1::text[]) order by app_id asc`,
      [appIds]
    )
    : await q(`select * from platform_ops_status order by app_id asc`, []);

  for (const row of result.rows || []) {
    map.set(row.app_id, {
      app_id: row.app_id,
      health_status: normalizeText(row.health_status, DEFAULT_ROW.health_status),
      onboarding_stage: normalizeText(row.onboarding_stage, DEFAULT_ROW.onboarding_stage),
      lifecycle_status: normalizeText(row.lifecycle_status, DEFAULT_ROW.lifecycle_status),
      owner: normalizeText(row.owner),
      notes: normalizeText(row.notes),
      flags: normalizeFlags(row.flags),
      updated_by: row.updated_by || null,
      last_checked_at: row.last_checked_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    });
  }

  return map;
}

export async function savePlatformOpsStatus(appId, patch = {}, updatedBy = "admin") {
  if (!hasConfiguredDb()) {
    const err = new Error("Database not configured.");
    err.status = 503;
    throw err;
  }

  const normalized = {
    health_status: normalizeText(patch.health_status, DEFAULT_ROW.health_status) || DEFAULT_ROW.health_status,
    onboarding_stage: normalizeText(patch.onboarding_stage, DEFAULT_ROW.onboarding_stage) || DEFAULT_ROW.onboarding_stage,
    lifecycle_status: normalizeText(patch.lifecycle_status, DEFAULT_ROW.lifecycle_status) || DEFAULT_ROW.lifecycle_status,
    owner: normalizeText(patch.owner),
    notes: normalizeText(patch.notes),
    flags: normalizeFlags(patch.flags),
    updated_by: normalizeText(updatedBy, "admin"),
    last_checked_at: patch.last_checked_at || new Date().toISOString()
  };

  await q(
    `insert into platform_ops_status(app_id, health_status, onboarding_stage, lifecycle_status, owner, notes, flags, updated_by, last_checked_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::timestamptz)
     on conflict (app_id)
     do update set
       health_status = excluded.health_status,
       onboarding_stage = excluded.onboarding_stage,
       lifecycle_status = excluded.lifecycle_status,
       owner = excluded.owner,
       notes = excluded.notes,
       flags = excluded.flags,
       updated_by = excluded.updated_by,
       last_checked_at = excluded.last_checked_at,
       updated_at = now()`,
    [
      appId,
      normalized.health_status,
      normalized.onboarding_stage,
      normalized.lifecycle_status,
      normalized.owner,
      normalized.notes,
      JSON.stringify(normalized.flags),
      normalized.updated_by,
      normalized.last_checked_at
    ]
  );

  const rows = await listPlatformOpsStatus([appId]);
  return rows.get(appId) || { app_id: appId, ...DEFAULT_ROW, ...normalized };
}

export function summarizePlatformOps(rows = []) {
  return {
    attention_needed: rows.filter((row) => ["warning", "critical"].includes(String(row?.health_status || ""))).length,
    onboarding_inflight: rows.filter((row) => !["complete", "untracked", "none"].includes(String(row?.onboarding_stage || ""))).length,
    reviewed: rows.filter((row) => String(row?.health_status || "") !== "unreviewed").length
  };
}