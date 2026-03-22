import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";
import { buildCors, json } from "./_lib/http.js";
import { PLATFORM_APPS } from "./_lib/platform-state.js";
import { wrap } from "./_lib/wrap.js";

function clampInt(v, def, min, max) {
  const n = parseInt(String(v ?? def), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function asText(value) {
  return String(value ?? "").trim();
}

function asList(value) {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}

const SKYMAIL_COLLECTIONS = {
  sharedDesk: "Shared Desk",
  followUps: "Follow-Up Engine",
  intake: "Intake Vault",
  contacts: "Contact Brain",
  replyTemplates: "Reply Studio",
  recoveryLog: "Recovery Engine"
};

function appLabel(appId) {
  const key = asText(appId);
  return PLATFORM_APPS[key]?.title || key;
}

function collectionLabel(collection) {
  const key = asText(collection);
  return SKYMAIL_COLLECTIONS[key] || key;
}

function eventStatus(event, fallback = "activity") {
  return asText(event?.http_status || event?.level || fallback);
}

function summaryText(summary) {
  if (!summary || typeof summary !== "object") return "";
  return asText(summary.summary_text);
}

function describePlatformOps(meta, appId) {
  const parts = [];
  if (asText(meta.health_status)) parts.push(`${asText(meta.health_status)} health`);
  if (asText(meta.onboarding_stage)) parts.push(`${asText(meta.onboarding_stage)} onboarding`);
  if (asText(meta.lifecycle_status)) parts.push(`${asText(meta.lifecycle_status)} lifecycle`);
  if (asText(meta.owner)) parts.push(`owner ${asText(meta.owner)}`);
  return parts.length
    ? `Ops updated for ${appLabel(appId)}: ${parts.join(" · ")}`
    : `Ops updated for ${appLabel(appId)}`;
}

function eventSummary(event) {
  const meta = event?.meta && typeof event.meta === "object" ? event.meta : {};
  const action = asText(event?.action);
  const functionName = asText(event?.function_name);
  const target = asText(event?.target);

  if (action === "cohort.config_upsert") {
    const sections = asList(meta.sections);
    return {
      group: "cohort-config",
      groupLabel: "Cohort Config",
      targetLabel: appLabel("cohort-command"),
      summary: sections.length
        ? `Founder config updated: ${sections.join(", ")}`
        : "Founder config updated"
    };
  }

  if (action === "cohort.student_upsert") {
    const studentId = asText(meta.student_id || event?.target);
    return {
      group: "cohort-students",
      groupLabel: "Cohort Students",
      targetLabel: studentId || appLabel("cohort-command"),
      summary: studentId ? `Student saved: ${studentId}` : "Founder student saved"
    };
  }

  if (action === "cohort.student_patch") {
    const studentId = asText(meta.student_id || event?.target);
    const fields = asList(meta.fields);
    return {
      group: "cohort-students",
      groupLabel: "Cohort Students",
      targetLabel: studentId || appLabel("cohort-command"),
      summary: studentId
        ? `Student patched: ${studentId}${fields.length ? ` (${fields.join(", ")})` : ""}`
        : `Founder student patched${fields.length ? ` (${fields.join(", ")})` : ""}`
    };
  }

  if (action === "cohort.student_delete") {
    const studentId = asText(meta.student_id || event?.target);
    return {
      group: "cohort-students",
      groupLabel: "Cohort Students",
      targetLabel: studentId || appLabel("cohort-command"),
      summary: studentId ? `Student deleted: ${studentId}` : "Founder student deleted"
    };
  }

  if (action === "cohort.student_clear_all") {
    return {
      group: "cohort-students",
      groupLabel: "Cohort Students",
      targetLabel: appLabel("cohort-command"),
      summary: "Founder cleared all students"
    };
  }

  if (action === "skymail_suite.upsert") {
    const summary = summaryText(meta.summary);
    const storageMode = asText(meta.storage_mode);
    return {
      group: "skymail-suite",
      groupLabel: "SkyMail Suite",
      targetLabel: appLabel("skymail-suite"),
      summary: summary
        ? `Suite synced: ${summary}`
        : `Suite synced${storageMode ? ` (${storageMode})` : ""}`
    };
  }

  if (action.startsWith("skymail.item_upsert.")) {
    const collection = asText(meta.collection || action.split(".").slice(-1)[0]);
    const itemId = asText(meta.item_id || target);
    const label = collectionLabel(collection);
    return {
      group: `skymail-${collection}`,
      groupLabel: `SkyMail ${label}`,
      targetLabel: itemId || label,
      summary: itemId ? `${label} item saved: ${itemId}` : `${label} item saved`
    };
  }

  if (action.startsWith("skymail.item_delete.")) {
    const collection = asText(meta.collection || action.split(".").slice(-1)[0]);
    const itemId = asText(meta.item_id || target);
    const label = collectionLabel(collection);
    return {
      group: `skymail-${collection}`,
      groupLabel: `SkyMail ${label}`,
      targetLabel: itemId || label,
      summary: itemId ? `${label} item deleted: ${itemId}` : `${label} item deleted`
    };
  }

  if (action === "platform_ops.upsert") {
    const appId = asText(meta.app_id || target);
    return {
      group: "platform-ops",
      groupLabel: "Platform Ops",
      targetLabel: appLabel(appId),
      summary: describePlatformOps(meta, appId)
    };
  }

  if (action === "platform_state.upsert") {
    const appId = asText(meta.app_id || target);
    const summary = summaryText(meta.summary);
    const visibility = asText(meta.visibility);
    return {
      group: "platform-state",
      groupLabel: "Platform State",
      targetLabel: appLabel(appId),
      summary: summary
        ? `State updated for ${appLabel(appId)}: ${summary}`
        : `State updated for ${appLabel(appId)}${visibility ? ` (${visibility})` : ""}`
    };
  }

  if (action === "platform_state.delete") {
    const appId = asText(meta.app_id || target);
    return {
      group: "platform-state",
      groupLabel: "Platform State",
      targetLabel: appLabel(appId),
      summary: `State deleted for ${appLabel(appId)}`
    };
  }

  if (functionName === "admin-cohort-command") {
    return {
      group: "cohort-config",
      groupLabel: "Cohort Config",
      targetLabel: appLabel("cohort-command"),
      summary: `Config endpoint ${asText(event?.http_status || event?.level || "activity")}`
    };
  }

  if (functionName === "admin-cohort-command-students" || functionName === "cohort-command-student") {
    return {
      group: "cohort-students",
      groupLabel: "Cohort Students",
      targetLabel: appLabel("cohort-command"),
      summary: `Student endpoint ${asText(event?.http_status || event?.level || "activity")}`
    };
  }

  if (functionName === "admin-skymail-suite") {
    return {
      group: "skymail-suite",
      groupLabel: "SkyMail Suite",
      targetLabel: appLabel("skymail-suite"),
      summary: `Suite endpoint ${eventStatus(event)}`
    };
  }

  if (functionName === "admin-skymail-suite-items") {
    return {
      group: "skymail-lanes",
      groupLabel: "SkyMail Lanes",
      targetLabel: appLabel("skymail-suite"),
      summary: `Lane endpoint ${eventStatus(event)}`
    };
  }

  if (functionName === "admin-skyefuel-station") {
    return {
      group: "skyefuelstation",
      groupLabel: "SkyeFuelStation",
      targetLabel: appLabel("skyefuelstation"),
      summary: `Admin station snapshot ${eventStatus(event)}`
    };
  }

  if (functionName === "skye-fuel-station-overview") {
    return {
      group: "skyefuelstation",
      groupLabel: "SkyeFuelStation",
      targetLabel: appLabel("skyefuelstation"),
      summary: `Public station overview ${eventStatus(event)}`
    };
  }

  if (functionName === "admin-platform-ops") {
    return {
      group: "platform-ops",
      groupLabel: "Platform Ops",
      targetLabel: appLabel(target),
      summary: `Ops endpoint ${eventStatus(event)}`
    };
  }

  if (functionName === "admin-platform-control") {
    return {
      group: "platform-control",
      groupLabel: "Platform Control",
      targetLabel: "Gateway 13",
      summary: `Platform control snapshot ${eventStatus(event)}`
    };
  }

  return {
    group: "platform-activity",
    groupLabel: "Platform Activity",
    targetLabel: target || functionName || "Gateway 13",
    summary: `Unclassified ${functionName || action || "platform"} event ${eventStatus(event)} - summary wiring pending`
  };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  const url = new URL(req.url);
  const appId = String(url.searchParams.get("app_id") || "").trim();
  const limit = clampInt(url.searchParams.get("limit"), 100, 1, 500);

  const auditParams = [];
  let auditWhere = `(
    action like 'platform_%' or
    action like 'skymail.%' or
    action like 'skymail_%' or
    action like 'cohort.%' or
    action like 'cohort_%'
  )`;
  if (appId) {
    auditParams.push(appId, appId);
    auditWhere += ` and (target = $1 or coalesce(meta->>'app_id','') = $2)`;
  }

  const gatewayParams = [];
  let gatewayWhere = `(
    function_name in (
      'admin-platform-control',
      'admin-platform-ops',
      'admin-skymail-suite',
      'admin-skymail-suite-items',
      'admin-cohort-command',
      'admin-cohort-command-students',
      'cohort-command-student',
      'admin-skyefuel-station',
      'skye-fuel-station-overview'
    )
    or app_id in ('skyefuelstation','skymail-suite','cohort-command','skyespace')
  )`;
  if (appId) {
    gatewayParams.push(appId, appId);
    gatewayWhere += ` and (app_id = $1 or extra->>'app_id' = $2)`;
  }

  const [auditRes, gatewayRes] = await Promise.all([
    q(`
      select
        'audit' as source,
        created_at,
        actor,
        action,
        target,
        meta,
        null::text as level,
        null::text as kind,
        null::text as function_name,
        null::integer as http_status,
        null::text as request_id
      from audit_events
      where ${auditWhere}
      order by created_at desc
      limit ${limit}
    `, auditParams),
    q(`
      select
        'gateway' as source,
        created_at,
        coalesce(function_name, 'gateway') as actor,
        coalesce(kind, level, 'event') as action,
        coalesce(app_id, extra->>'app_id', function_name, '') as target,
        extra as meta,
        level,
        kind,
        function_name,
        http_status,
        request_id
      from gateway_events
      where ${gatewayWhere}
      order by created_at desc
      limit ${limit}
    `, gatewayParams)
  ]);

  const events = [...(auditRes.rows || []), ...(gatewayRes.rows || [])]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit)
    .map((event) => ({
      ...event,
      ...eventSummary(event)
    }));

  return json(200, { ok: true, events }, cors);
});