import { wrap } from "./_lib/wrap.js";
import { buildCors, json, monthKeyUTC } from "./_lib/http.js";
import { buildPublicStationDigest, fetchSkyeFuelStationSnapshot } from "./_lib/skye-fuel-station.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);
  const snapshot = await fetchSkyeFuelStationSnapshot(req, month, { redact: true });

  return json(200, {
    ok: true,
    station: snapshot.station,
    preview: snapshot.preview,
    digest: buildPublicStationDigest(snapshot),
    overview: snapshot.overview,
    plan_mix: snapshot.plan_mix,
    provider_mix: snapshot.provider_mix,
    topup_sources: snapshot.topup_sources,
    recent_topups: snapshot.recent_topups,
    leaders: snapshot.leaders,
    recent_events: snapshot.recent_events,
    brain_gate: snapshot.brain_gate,
    storage_ready: snapshot.storage_ready
  }, cors);
});