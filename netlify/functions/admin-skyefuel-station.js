import { wrap } from "./_lib/wrap.js";
import { buildCors, json, monthKeyUTC } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import {
  fetchSkyeFuelStationSnapshot
} from "./_lib/skye-fuel-station.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);
  const snapshot = await fetchSkyeFuelStationSnapshot(req, month);
  return json(200, snapshot, cors);
});