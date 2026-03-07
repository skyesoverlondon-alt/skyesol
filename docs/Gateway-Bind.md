# Gateway Bind

Version: 2026-03-06
Owner: Skyes Over London LC
Scope: AI integration contract for all new and existing apps in this repository.

This document is intentionally strict. If an implementation conflicts with this file, this file wins.

## 1) Executive Reality (No Ambiguity)

- Active AI gate on this site: `kAIxUGateway13`.
- Canonical dashboard URL: `https://skyesol.netlify.app/gateway`.
- Canonical gateway implementation page: `https://skyesol.netlify.app/Platforms-Apps-Infrastructure/kAIxUGateway13/index.html`.
- Active AI function lanes are under root Netlify Functions: `/.netlify/functions/*`.

Important naming clarification:

- You will see references to other gate names (example: `0megaGate`) in docs, strategy pages, or compatibility notes.
- That does not mean a second independent live gate stack is serving app traffic in this repo.
- New app AI traffic must bind to Gateway13 contract endpoints listed in this file.

## 2) Hard Rules (Zero Tolerance)

### 2.1 Forbidden

- No direct calls to provider endpoints from browser or app server code:
  - `https://api.openai.com/...`
  - `https://api.anthropic.com/...`
  - `https://generativelanguage.googleapis.com/...`
- No provider SDK usage in app code paths intended for this repo integration.
- No provider API keys stored in browser storage, app config, or client env vars.

### 2.2 Required

- Route all AI calls through `/.netlify/functions/*` gateway lanes.
- Use gateway key auth only: `Authorization: Bearer <kx_live_...>`.
- Include gateway telemetry headers on every AI call:
  - `x-kaixu-app`
  - `x-kaixu-build`
  - `x-kaixu-install-id` (required where seat/device policy enforces it)

## 3) Endpoint Contract (Authoritative)

## 3.1 AI Lanes (Use These)

- `POST /.netlify/functions/gateway-chat`
- `POST /.netlify/functions/gateway-stream`
- `POST /.netlify/functions/gateway-embed`
- `POST /.netlify/functions/gateway-embed-search`
- `GET /.netlify/functions/gateway-embed-collections?name=<collection>`
- `DELETE /.netlify/functions/gateway-embed-collections?name=<collection>`

Compatibility lane:

- `ANY /.netlify/functions/v1-proxy/*`
  - Exists for `/v1/*` upstream contract forwarding when configured.
  - Do not treat this as a separate production gate identity.

Health/smoke lane:

- `GET /.netlify/functions/health`

## 3.2 Gateway Base Links

For this repo/site:

- Dashboard: `https://skyesol.netlify.app/gateway`
- Functions base: `https://skyesol.netlify.app/.netlify/functions`
- Chat: `https://skyesol.netlify.app/.netlify/functions/gateway-chat`
- Stream: `https://skyesol.netlify.app/.netlify/functions/gateway-stream`
- Embed: `https://skyesol.netlify.app/.netlify/functions/gateway-embed`

## 4) CORS + Routing Architecture (Critical)

Browser apps must not send cross-origin authenticated requests directly to `skyesol.netlify.app`.

Reason:

- Authenticated browser requests trigger CORS preflight (`OPTIONS`).
- If the target origin does not return the required CORS headers for that app origin, browser blocks before request is sent.

Mandatory app architecture:

1. Each app deploys same-origin proxy functions in its own Netlify site:
   - `netlify/functions/gateway-chat.js`
   - `netlify/functions/gateway-stream.js`
   - `netlify/functions/gateway-embed.js`
2. Browser fetches own-site function URLs:
   - `/.netlify/functions/gateway-chat`
   - `/.netlify/functions/gateway-stream`
   - `/.netlify/functions/gateway-embed`
3. Those local app functions forward server-side to `https://skyesol.netlify.app/.netlify/functions/*`.

Local dev pattern (app repos):

```toml
[[redirects]]
  from = "/api/*"
  to = "https://skyesol.netlify.app/.netlify/functions/:splat"
  status = 200
  force = true
```

Client app constant pattern:

```js
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const GATEWAY_PRIMARY = IS_LOCAL ? "/api" : "";
// fetch(`${GATEWAY_PRIMARY}/.netlify/functions/gateway-chat`, ...)
```

## 5) Request Contracts (Copy Exactly)

## 5.1 Chat Request (`gateway-chat`)

```json
{
  "provider": "openai|anthropic|gemini",
  "model": "string",
  "messages": [
    { "role": "system|user|assistant", "content": "text" }
  ],
  "max_tokens": 900,
  "temperature": 0.7
}
```

Headers:

- `Authorization: Bearer <kx_live_...>`
- `Content-Type: application/json`
- `x-kaixu-app: <app-name>`
- `x-kaixu-build: <build-id>`
- `x-kaixu-install-id: <stable-install-id>` (when device binding is enabled)

## 5.2 Stream Request (`gateway-stream`)

Payload is same shape as `gateway-chat`.

Important:

- Must use `fetch` + `ReadableStream` parsing.
- Do not use `EventSource` for gateway stream POST.

## 5.3 Embed Request (`gateway-embed`)

```json
{
  "provider": "kaixu",
  "model": "kaixu-embed-standard",
  "input": "text to embed or array",
  "taskType": "RETRIEVAL_QUERY|RETRIEVAL_DOCUMENT",
  "title": "optional title",
  "outputDimensionality": 1536
}
```

Operational recommendation:

- Prefer `outputDimensionality: 1536` for storage/cost efficiency.

## 5.4 Embed Search Request (`gateway-embed-search`)

```json
{
  "collection": "my-docs",
  "query": "find references to topic x",
  "provider": "kaixu",
  "model": "kaixu-embed-standard",
  "top_k": 8
}
```

## 6) Response Contracts + UI Behavior

## 6.1 Non-Stream Success (`gateway-chat`)

```json
{
  "output_text": "string",
  "usage": { "input_tokens": 0, "output_tokens": 0, "cost_cents": 0 },
  "month": { "month": "YYYY-MM", "cap_cents": 0, "spent_cents": 0 }
}
```

UI must compute and show remaining budget if budget is shown:

- `remaining = cap_cents - spent_cents`

## 6.2 Stream Events (`gateway-stream`)

Expected event types:

- `meta` -> provider/model/month budget info
- `delta` -> incremental text chunks
- `done` -> final usage + month info
- `error` -> terminal error payload

## 6.3 Embed Success (`gateway-embed`)

```json
{
  "provider": "Skyes Over London",
  "model": "skAIxU Flow6.7",
  "embeddings": [[0.1, -0.2]],
  "dimensions": 1536,
  "usage": { "input_tokens": 42, "cost_cents": 0 },
  "month": { "month": "YYYY-MM", "cap_cents": 0, "spent_cents": 0 },
  "telemetry": { "install_id": "..." }
}
```

## 6.4 Required Error Mapping (User Visible)

- `401` -> invalid/missing key; prompt for valid Kaixu key
- `402` -> monthly cap reached; block further requests until top-up/upgrade
- `403` -> access policy block (disabled customer/device/model/provider)
- `409` -> unpriced model/provider mismatch
- `429` -> rate limit; show retry guidance
- `500`/`502` -> gateway/upstream error; show safe retry state

## 7) Dev Mode vs Chat Mode Requirements

If app supports both conversation and code/dev workflows:

- Chat mode:
  - stream tokens into chat bubble
- Develop mode:
  - do not stream tokens into chat UI
  - apply result to editor/preview pane
  - show explicit status (`Thinking...`, `Applying...`)

No mode should bypass gateway lanes.

## 8) Drop-In Implementation Templates

## 8.1 Browser Client (Same Origin)

```js
export async function kaixuChat({ key, payload, app = "my-app", build = "dev", installId = "" }) {
  const res = await fetch("/.netlify/functions/gateway-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`,
      "x-kaixu-app": app,
      "x-kaixu-build": build,
      ...(installId ? { "x-kaixu-install-id": installId } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gateway error ${res.status}: ${detail}`);
  }
  return res.json();
}
```

## 8.2 App-Side Netlify Proxy Function (for external app repos)

`netlify/functions/gateway-chat.js`:

```js
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const upstream = "https://skyesol.netlify.app/.netlify/functions/gateway-chat";
  const resp = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": event.headers.authorization || event.headers.Authorization || "",
      "x-kaixu-app": event.headers["x-kaixu-app"] || "external-app",
      "x-kaixu-build": event.headers["x-kaixu-build"] || "unknown",
      "x-kaixu-install-id": event.headers["x-kaixu-install-id"] || ""
    },
    body: event.body || "{}"
  });

  const text = await resp.text();
  return {
    statusCode: resp.status,
    headers: { "content-type": resp.headers.get("content-type") || "application/json" },
    body: text
  };
}
```

Repeat same forwarding pattern for `gateway-stream` and `gateway-embed`.

## 9) Environment Variables

## 9.1 Gateway Site Required (this repo)

- `NETLIFY_DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- internal lane credentials configured server-side

Strongly recommended:

- `KEY_PEPPER`
- `DB_ENCRYPTION_KEY`
- `ALLOWED_ORIGINS`
- `KAIXU_V1_UPSTREAM` (if using `v1-proxy`)

## 9.2 App Repos (clients)

- `KAIXU_VIRTUAL_KEY` (server-side where possible)
- Optional app metadata constants:
  - app name
  - build id
  - stable install id strategy

## 10) Gate Status Matrix (For Humans + AI Agents)

- `kAIxUGateway13`: ACTIVE contract and runtime path for this repository.
- `v1-proxy`: ACTIVE compatibility function; forwards to configured upstream.
- `0megaGate` naming: DOCUMENTATION/CONTRACT CONTEXT unless explicitly deployed/routed as runtime lane.
- Any new gate name in content: treat as non-runtime until function lanes and routing are implemented and audited.

## 11) Verification Commands (Must Pass)

From repo root:

```bash
npm run functions:audit
npm run functions:map
npm run --silent functions:map:json
```

Generated reports:

- `docs/functions-endpoints-map.json`
- `docs/ai-endpoints-usage.json`

## 12) Pre-Merge Enforcement Checklist

Every dev (or AI coding agent) must confirm all true:

- No direct provider URL call sites in app code.
- AI calls target only approved gateway lanes: `/.netlify/functions/gateway-chat`, `/.netlify/functions/gateway-stream`, `/.netlify/functions/gateway-embed`, `/.netlify/functions/gateway-embed-search`, `/.netlify/functions/gateway-embed-collections`.
- Required headers are present.
- Error mapping implemented for `401/402/403/429/500`.
- `functions:audit` passes.
- For new app repos, same-origin proxy functions exist.
- UX mode behavior (chat vs develop) implemented correctly.

## 13) Quick Anti-Drift Scans

Run these in app repos before handoff:

```bash
grep -R "api.openai.com\|api.anthropic.com\|generativelanguage.googleapis.com" -n src netlify functions || true
grep -R "gateway-chat\|gateway-stream\|gateway-embed" -n src netlify functions || true
```

## 14) Final Binding Statement

If a feature ships with direct provider calls, missing gateway headers, or bypassed gateway lanes, it is non-compliant and must not be deployed.

Gateway13 contract is mandatory for AI integration in this repo.

## 15) Junior Dev Mode (Step-by-Step, No Guessing)

Use this section if you are integrating AI into an app in this repo for the first time.

### 15.1 What To Build

You must call these endpoints only:

- `POST /.netlify/functions/gateway-chat`
- `POST /.netlify/functions/gateway-stream`
- `POST /.netlify/functions/gateway-embed` (only if your feature needs embeddings)

Do not call direct vendor URLs directly.

### 15.2 Required Headers

Every AI request must include:

- `Authorization: Bearer <kx_live_...>`
- `Content-Type: application/json`
- `x-kaixu-app: <your-app-name>`
- `x-kaixu-build: <your-version-or-commit>`

Include when available or required by seat policy:

- `x-kaixu-install-id: <stable-install-id>`

### 15.3 Build Checklist

1. Create one shared gateway client module in your app.
2. Replace all legacy provider call sites with gateway calls.
3. Map gateway errors to user-visible messages.
4. Confirm no provider keys exist in frontend code.
5. Run audit commands before PR.

### 15.4 Minimal Working Chat Example

```js
async function sendChat({ key, messages }) {
  const payload = {
    provider: "kaixu",
    model: "kaixu-chat",
    messages,
    max_tokens: 900,
    temperature: 0.7
  };

  const res = await fetch("/.netlify/functions/gateway-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`,
      "x-kaixu-app": "my-app",
      "x-kaixu-build": "v1.0.0"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gateway-chat failed ${res.status}: ${text}`);
  }

  return res.json();
}
```

### 15.5 Error Mapping You Must Implement

- `401`: "Your Kaixu key is missing or invalid."
- `402`: "Monthly cap reached. Upgrade or top up to continue."
- `403`: "Access blocked by policy/device restrictions."
- `429`: "Rate limit reached. Please retry shortly."
- `500/502`: "Gateway temporarily unavailable. Retry in a moment."

### 15.6 Pre-PR Commands

```bash
npm run functions:audit
npm run functions:map
npm run --silent functions:map:json
```

### 15.7 Definition Of Done

- Feature works with `gateway-chat` or `gateway-stream` only.
- No direct provider URL calls remain.
- Headers and error mapping are implemented.
- Audit commands pass.

## 16) AI Agent Mode (Direct Execution Contract)

Use this section verbatim as instruction context for coding agents.

### 16.1 Objective

Implement AI features in this repository using only Gateway13 function lanes under `/.netlify/functions/*`.

### 16.2 Constraints

- Never introduce direct calls to provider APIs.
- Never add provider SDK usage in app call paths.
- Never store provider keys in client code.
- Keep `[functions].directory = "netlify/functions"` unchanged.

### 16.3 Mandatory Endpoints

- `/.netlify/functions/gateway-chat`
- `/.netlify/functions/gateway-stream`
- `/.netlify/functions/gateway-embed` (if embeddings required)
- `/.netlify/functions/gateway-embed-search` (if retrieval required)

### 16.4 Mandatory Request Envelope

```json
{
  "provider": "openai|anthropic|gemini",
  "model": "string",
  "messages": [{"role":"system|user|assistant","content":"text"}],
  "max_tokens": 900,
  "temperature": 0.7
}
```

### 16.5 Mandatory Headers

- `Authorization: Bearer <kx_live_...>`
- `x-kaixu-app`
- `x-kaixu-build`
- `x-kaixu-install-id` when seat/device controls apply

### 16.6 Mandatory Error Handling

- Handle `401`, `402`, `403`, `429`, `500/502` explicitly with user-facing states.
- If `402`, block subsequent AI calls until user upgrades/tops up.

### 16.7 Output Requirements For Agent Tasks

When agent completes work, it must provide:

1. List of edited files.
2. Confirmation that no provider direct calls were added.
3. Commands run and pass/fail outcome.
4. Which gateway endpoint(s) feature uses.
5. Any env vars required for the feature.

### 16.8 Agent Verification Commands

```bash
npm run functions:audit
npm run functions:map
npm run --silent functions:map:json
grep -R "api.openai.com\|api.anthropic.com\|generativelanguage.googleapis.com" -n . || true
```

### 16.9 Fail Conditions

Mark task as failed if any are true:

- Direct provider URL appears in app call paths.
- AI feature bypasses gateway endpoints.
- Required headers are missing.
- Audit command fails.
- Endpoint references are missing corresponding root function handlers.
