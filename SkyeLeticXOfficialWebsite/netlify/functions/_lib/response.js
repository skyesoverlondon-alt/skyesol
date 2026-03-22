
function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}
function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(payload) };
}
function ok(payload) { return json(200, { ok: true, ...payload }); }
function fail(statusCode, error, extra = {}) { return json(statusCode, { ok: false, error, ...extra }); }
function parseBody(event) {
  if (!event.body) return {};
  try { return JSON.parse(event.body); }
  catch { return {}; }
}
module.exports = { corsHeaders, json, ok, fail, parseBody };
