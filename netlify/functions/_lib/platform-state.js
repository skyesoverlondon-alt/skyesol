import { hasConfiguredDb, q } from "./db.js";

export const PLATFORM_APPS = {
  "skyefuelstation": {
    app_id: "skyefuelstation",
    title: "SkyeFuelStation",
    launch_url: "/skyefuelstation/",
    gateway_tab: "station",
    description: "Public fuel station and asset surface with Gateway observability.",
    storage_mode: "gateway-metrics",
    visibility: "public"
  },
  "skyespace": {
    app_id: "skyespace",
    title: "SkyeSpace",
    launch_url: "/skyespace/",
    description: "Shared-auth district, feed, and messaging surface routed through root functions.",
    storage_mode: "gateway-functions",
    visibility: "public"
  },
  "skymail-suite": {
    app_id: "skymail-suite",
    title: "SkyMail Suite",
    launch_url: "/skymail-suite/",
    description: "Supplemental desk, recovery, intake, contact-brain, and reply-studio ecology.",
    storage_mode: "platform-state",
    visibility: "admin"
  },
  "cohort-command": {
    app_id: "cohort-command",
    title: "Cohort Command",
    launch_url: "/cohort-command/",
    description: "Founder-only cohort generator, roster, scoring, and student command surface.",
    storage_mode: "platform-state",
    visibility: "admin"
  }
};

function getPlatformMeta(appId) {
  const meta = PLATFORM_APPS[String(appId || "").trim()];
  if (!meta) {
    const err = new Error("Unknown platform app_id");
    err.status = 400;
    err.code = "UNKNOWN_PLATFORM_APP";
    throw err;
  }
  return meta;
}

function toInt(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function summaryText(summary) {
  const text = String(summary?.summary_text || "").trim();
  return text || "No shared state has been saved yet.";
}

export function buildPlatformSummary(appId, state = {}) {
  const meta = getPlatformMeta(appId);

  if (appId === "cohort-command") {
    const students = Array.isArray(state.students) ? state.students : [];
    const active = students.filter((student) => student?.status === "active").length;
    const pending = students.filter((student) => student?.status === "pending").length;
    return {
      cohort_name: String(state?.cohort?.name || meta.title),
      total_students: students.length,
      active_students: active,
      pending_students: pending,
      generated_preview_id: String(state?.generatedPreviewId || ""),
      summary_text: `${students.length} seats · ${active} active · ${pending} pending`
    };
  }

  if (appId === "skymail-suite") {
    const sharedDesk = Array.isArray(state.sharedDesk) ? state.sharedDesk : [];
    const followUps = Array.isArray(state.followUps) ? state.followUps : [];
    const intake = Array.isArray(state.intake) ? state.intake : [];
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const replyTemplates = Array.isArray(state.replyTemplates) ? state.replyTemplates : [];
    const recoveryLog = Array.isArray(state.recoveryLog) ? state.recoveryLog : [];
    const analytics = state.analytics || {};
    return {
      shared_desk_count: sharedDesk.length,
      follow_up_count: followUps.length,
      intake_count: intake.length,
      contact_count: contacts.length,
      reply_template_count: replyTemplates.length,
      recovery_count: recoveryLog.length,
      monthly_recovered: toInt(analytics.monthlyRecovered),
      open_assignments: toInt(analytics.openAssignments),
      summary_text: `${sharedDesk.length} desk threads · ${followUps.length} follow-ups · ${toInt(analytics.monthlyRecovered)} recovered`
    };
  }

  return {
    summary_text: meta.description
  };
}

export async function getPlatformState(appId) {
  const meta = getPlatformMeta(appId);
  if (!hasConfiguredDb()) return null;

  const result = await q(
    `select app_id, title, state, summary, visibility, updated_by, created_at, updated_at
     from platform_state_docs
     where app_id = $1
     limit 1`,
    [meta.app_id]
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    ...meta,
    title: row.title || meta.title,
    state: row.state || {},
    summary: row.summary || {},
    summary_text: summaryText(row.summary || {}),
    visibility: row.visibility || meta.visibility,
    updated_by: row.updated_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    remote_state: true
  };
}

export async function savePlatformState(appId, state, updatedBy = "admin") {
  const meta = getPlatformMeta(appId);
  const summary = buildPlatformSummary(meta.app_id, state || {});

  await q(
    `insert into platform_state_docs(app_id, title, state, summary, visibility, updated_by)
     values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
     on conflict (app_id)
     do update set
       title = excluded.title,
       state = excluded.state,
       summary = excluded.summary,
       visibility = excluded.visibility,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [
      meta.app_id,
      String(state?.cohort?.name || state?.meta?.title || meta.title),
      JSON.stringify(state || {}),
      JSON.stringify(summary),
      meta.visibility,
      String(updatedBy || "admin")
    ]
  );

  return await getPlatformState(meta.app_id);
}

export async function deletePlatformState(appId) {
  const meta = getPlatformMeta(appId);
  if (!hasConfiguredDb()) return { deleted: false, app_id: meta.app_id };
  await q(`delete from platform_state_docs where app_id = $1`, [meta.app_id]);
  return { deleted: true, app_id: meta.app_id };
}

export async function listPlatformControl() {
  const docsById = new Map();

  if (hasConfiguredDb()) {
    const result = await q(
      `select app_id, title, summary, visibility, updated_by, created_at, updated_at
       from platform_state_docs`,
      []
    );
    for (const row of result.rows || []) {
      docsById.set(row.app_id, row);
    }
  }

  return Object.values(PLATFORM_APPS).map((meta) => {
    const row = docsById.get(meta.app_id);
    const summary = row?.summary || buildPlatformSummary(meta.app_id, {});
    return {
      ...meta,
      title: row?.title || meta.title,
      summary,
      summary_text: summaryText(summary),
      has_remote_state: !!row,
      updated_by: row?.updated_by || null,
      created_at: row?.created_at || null,
      updated_at: row?.updated_at || null,
      storage_status: hasConfiguredDb() ? (row ? "connected" : meta.storage_mode === "platform-state" ? "ready" : "linked") : "db-unconfigured"
    };
  });
}