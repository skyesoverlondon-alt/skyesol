// netlify/functions/neon-lead-upsert.js
// P13.1 — Store lead + report_summary + checklist progress in Neon (via Neon Data API)
//
// Env required:
//  - NEON_DATA_API_URL (Data API base, e.g. https://your-data-api-endpoint)
//  - NEON_DATA_API_JWT (Bearer JWT; should include "sub" claim if using RLS policies)
//
// Payload (JSON):
//  {
//    lead: {name,email,phone,company,message},
//    inputs: {businessName,city,industry,ownersCount,hireEmployees},
//    report_summary: "string",
//    checklist: { ... },
//    app: {buildId,version,ua,href}
//  }

function mkHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,authorization,x-kaixu-app,x-kaixu-build",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };
}

function json(statusCode, body) {
  return { statusCode, headers: mkHeaders(), body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: mkHeaders(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  const base = process.env.NEON_DATA_API_URL;
  const jwt = process.env.NEON_DATA_API_JWT;

  if (!base || !jwt) {
    return json(500, {
      ok: false,
      error: "Missing Neon env vars",
      required: ["NEON_DATA_API_URL", "NEON_DATA_API_JWT"]
    });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const lead = payload.lead || {};
  const inputs = payload.inputs || {};
  const checklist = payload.checklist || {};
  const report = String(payload.report_summary || "");
  const app = payload.app || {};

  const row = {
    lead_name: lead.name || null,
    lead_email: lead.email || null,
    lead_phone: lead.phone || null,
    lead_company: lead.company || null,
    lead_message: lead.message || null,

    business_name: inputs.businessName || "Unnamed Business",
    city: inputs.city || "Phoenix",
    industry: inputs.industry || "General",
    owners_count: Number(inputs.ownersCount || 1),
    hire_employees: !!inputs.hireEmployees,

    report_summary: report || null,
    checklist: checklist || {},

    app_build_id: app.buildId || null,
    app_version: app.version || null,
    user_agent: app.ua || null,
    page_href: app.href || null
  };

  const url = `${base.replace(/\/$/, "")}/rest/v1/blkaz_leads`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(row)
    });

    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    if (!res.ok) return json(res.status, { ok: false, status: res.status, endpoint: url, error: parsed });

    return json(200, { ok: true, inserted: parsed });
  } catch (err) {
    return json(500, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}
