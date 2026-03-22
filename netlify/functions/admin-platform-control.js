import { requireAdmin } from "./_lib/admin.js";
import { hasConfiguredDb } from "./_lib/db.js";
import { buildCors, json, monthKeyUTC } from "./_lib/http.js";
import { getBackupBrainSignal, listPlatformOpsStatus, summarizePlatformOps } from "./_lib/platform-ops.js";
import { listPlatformControl } from "./_lib/platform-state.js";
import { fetchSkyeFuelStationSnapshot } from "./_lib/skye-fuel-station.js";
import { getSkymailSuiteState } from "./_lib/skymail-suite.js";
import { wrap } from "./_lib/wrap.js";

function defaultOps(appId) {
  return {
    app_id: appId,
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
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);

  const platforms = await listPlatformControl();
  const [opsMap, skymail, stationSnapshot] = await Promise.all([
    listPlatformOpsStatus(platforms.map((platform) => platform.app_id)),
    getSkymailSuiteState(),
    fetchSkyeFuelStationSnapshot(req, month, { redact: true })
  ]);
  const backupBrain = getBackupBrainSignal();

  const mergedPlatforms = platforms.map((platform) => {
    const ops = opsMap.get(platform.app_id) || defaultOps(platform.app_id);
    const next = { ...platform, platform_ops: ops };

    if (platform.app_id === "skymail-suite" && skymail?.summary) {
      next.summary = skymail.summary;
      next.summary_text = skymail.summary.summary_text;
      next.has_remote_state = true;
      next.storage_mode = skymail.storage_mode || "dedicated-mail-tables";
      next.storage_status = skymail.storage_mode === "dedicated-mail-tables" ? "connected" : "migrating";
      next.updated_at = skymail.updated_at || platform.updated_at || null;
    }

    if (platform.app_id === "skyefuelstation") {
      next.summary = {
        active_customers: Number(stationSnapshot?.overview?.customers?.active || 0),
        active_keys: Number(stationSnapshot?.overview?.keys?.active || 0),
        token_volume: Number(stationSnapshot?.overview?.treasury?.token_volume || 0),
        topup_cents: Number(stationSnapshot?.overview?.treasury?.topup_cents || 0),
        brain_connected: !!stationSnapshot?.brain_gate?.connected
      };
      next.summary_text = `${next.summary.active_customers} active customers · ${next.summary.active_keys} live keys · ${next.summary.token_volume} tokens`;
      next.storage_status = stationSnapshot?.storage_ready ? "live-telemetry" : "config-only";
    }

    return next;
  });

  const remoteDocs = mergedPlatforms.filter((platform) => platform.has_remote_state);
  const cohort = mergedPlatforms.find((platform) => platform.app_id === "cohort-command");
  const skymailPlatform = mergedPlatforms.find((platform) => platform.app_id === "skymail-suite");
  const opsSummary = summarizePlatformOps(Array.from(opsMap.values()));

  return json(200, {
    ok: true,
    storage_ready: hasConfiguredDb(),
    counts: {
      surfaces: mergedPlatforms.length,
      connected_remote_docs: remoteDocs.length,
      cohort_seats: Number(cohort?.summary?.total_students || 0),
      skymail_threads: Number(skymailPlatform?.summary?.shared_desk_count || 0),
      attention_needed: Number(opsSummary.attention_needed || 0),
      onboarding_inflight: Number(opsSummary.onboarding_inflight || 0),
      reviewed_platforms: Number(opsSummary.reviewed || 0),
      station_active_customers: Number(stationSnapshot?.overview?.customers?.active || 0),
      station_active_keys: Number(stationSnapshot?.overview?.keys?.active || 0)
    },
    month,
    backup_brain: backupBrain,
    station: {
      storage_ready: !!stationSnapshot?.storage_ready,
      brain_gate: stationSnapshot?.brain_gate || null,
      overview: stationSnapshot?.overview || null
    },
    platforms: mergedPlatforms
  }, cors);
});