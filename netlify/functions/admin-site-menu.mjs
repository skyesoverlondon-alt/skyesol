import crypto from "node:crypto";
import { SITE_MENU } from "./_generated/site-menu-data.mjs";

function safeEqual(a, b) {
  const aa = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const expected = process.env.DEMONKEY || process.env.Demonkey;
  if (!expected) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Server misconfigured: DEMONKEY not set" }),
    };
  }

  let provided = "";
  try {
    const parsed = JSON.parse(event.body || "{}");
    provided = parsed?.demonkey ?? parsed?.key ?? "";
  } catch {
    provided = "";
  }

  if (!safeEqual(provided, expected)) {
    return {
      statusCode: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(SITE_MENU),
  };
}
