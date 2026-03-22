import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { buildStationPreview, getSkyeFuelStationConfig } from "./_lib/skye-fuel-station.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const station = getSkyeFuelStationConfig(req);
  return json(200, {
    station,
    preview: buildStationPreview(station, 100)
  }, cors);
});