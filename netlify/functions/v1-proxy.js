import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function upstreamBase() {
  return String(process.env.KAIXU_V1_UPSTREAM || "").trim().replace(/\/+$/, "");
}

function buildUpstreamUrl(reqUrl) {
  const url = new URL(reqUrl);
  const marker = "/.netlify/functions/v1-proxy";
  const idx = url.pathname.indexOf(marker);
  const tail = idx === -1 ? "/" : (url.pathname.slice(idx + marker.length) || "/");
  const base = upstreamBase();
  const target = new URL(base + (tail.startsWith("/") ? tail : `/${tail}`));
  target.search = url.search;
  return target;
}

function forwardHeaders(req) {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!HOP_BY_HOP.has(k)) out.set(key, value);
  });
  return out;
}

function responseHeaders(upstreamHeaders, cors) {
  const out = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  Object.entries(cors || {}).forEach(([k, v]) => out.set(k, v));
  return out;
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const base = upstreamBase();
  if (!base) {
    return json(500, {
      error: "Missing KAIXU_V1_UPSTREAM",
      hint: "Set KAIXU_V1_UPSTREAM to your worker base URL, e.g. https://your-gateway.workers.dev"
    }, cors);
  }

  const target = buildUpstreamUrl(req.url);
  const init = {
    method: req.method,
    headers: forwardHeaders(req),
    redirect: "manual"
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return json(502, { error: "Upstream unavailable", detail: String(err?.message || err) }, cors);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders(upstream.headers, cors)
  });
});
