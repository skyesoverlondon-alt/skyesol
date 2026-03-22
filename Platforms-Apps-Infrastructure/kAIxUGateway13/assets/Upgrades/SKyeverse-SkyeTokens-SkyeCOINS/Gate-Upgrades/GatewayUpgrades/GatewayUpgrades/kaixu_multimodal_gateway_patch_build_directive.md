# Kaixu Multimodal Gateway Hardened Patch — Build Directive

## Identity

This ZIP is **not** a frontend app, a launcher, or a sales site.

It is a **Cloudflare Worker gateway patch pack** intended to harden an existing Kaixu gate into a **lane-aware multimodal sovereign gateway**.

The pack adds or expands these responsibilities:

- public Kaixu API lanes for chat, stream, images, videos, speech, transcriptions, realtime, usage, and jobs
- app-token auth and admin-token auth
- D1-backed wallet, pricing, routing, trace, and job persistence
- OpenAI lane adapters split by task instead of one fake universal handler
- provider abstraction for OpenAI, Gemini, and Anthropic
- normalized public-safe responses that hide upstream vendor/model truth from non-admin callers

In plain English: this is a **backend gate brain patch**.

---

## What gate/auth model it is using

### App auth

This pack uses its **own app-token gate**.

Primary file:
- `src/auth/verifyAppToken.ts`

Behavior:
- expects `Authorization: Bearer <token>`
- SHA-256 hashes the presented token
- looks up the hash in `app_tokens`
- loads app/org/wallet/allowed-alias context from D1

So this is **not** Netlify Identity and **not** browser-only fake auth.

### Admin auth

This pack uses its **own admin bearer token gate**.

Primary file:
- `src/auth/verifyAdminToken.ts`

Behavior:
- expects `Authorization: Bearer <KAIXU_ADMIN_TOKEN>`
- compares directly to `KAIXU_ADMIN_TOKEN` or `ADMIN_MASTER_TOKEN`

---

## Is the gate self-contained?

## Short verdict

**Yes as source code. No as live infrastructure.**

### Self-contained in the ZIP as code

Included here:
- Cloudflare Worker entrypoint: `src/index.ts`
- request router: `src/router.ts`
- auth logic: `src/auth/*`
- provider logic: `src/providers/*`
- adapters: `src/adapters/*`
- routing logic: `src/routing/*`
- ledger logic: `src/ledger/*`
- D1 schema + migrations + seed: `src/db/*`
- deployment config: `wrangler.jsonc`
- environment guidance: `docs/env-example.md`

### Not self-running by itself

Still required outside the ZIP:
- deployed Cloudflare Worker
- bound D1 database
- worker secrets such as:
  - `KAIXU_ADMIN_TOKEN`
  - `OPENAI_API_KEY` and/or lane-specific keys
  - optional provider/model overrides
- D1 migration execution / seed execution

So the code is here, but the living dragon still needs its cave, keys, and food.

---

## Repo shape

Top-level working package:
- `sky-currency-additive-pack/`

Core files:
- `src/index.ts`
- `src/router.ts`
- `src/types.ts`
- `src/env.ts`
- `wrangler.jsonc`
- `package.json`

Routes:
- `src/routes/health.ts`
- `src/routes/models.ts`
- `src/routes/chat.ts`
- `src/routes/stream.ts`
- `src/routes/images.ts`
- `src/routes/videos.ts`
- `src/routes/audio-speech.ts`
- `src/routes/audio-transcriptions.ts`
- `src/routes/realtime-session.ts`
- `src/routes/usage.ts`
- `src/routes/jobs.ts`
- `src/routes/admin-traces.ts`
- `src/routes/admin-jobs.ts`
- `src/routes/admin-upstream.ts`
- `src/routes/admin-job-actions.ts`

Extra routes present in the repo but **not currently wired in `src/router.ts`**:
- `src/routes/embeddings.ts`
- `src/routes/wallet-balance.ts`
- `src/routes/admin-providers.ts`
- `src/routes/admin-aliases.ts`
- `src/routes/admin-routing.ts`
- `src/routes/admin-wallets.ts`

Auth:
- `src/auth/verifyAppToken.ts`
- `src/auth/verifyAdminToken.ts`
- `src/auth/policyGuard.ts`

Providers:
- `src/providers/openai.ts`
- `src/providers/gemini.ts`
- `src/providers/anthropic.ts`

OpenAI lane adapters:
- `src/adapters/openaiChat.ts`
- `src/adapters/openaiStream.ts`
- `src/adapters/openaiImages.ts`
- `src/adapters/openaiVideos.ts`
- `src/adapters/openaiAudioSpeech.ts`
- `src/adapters/openaiAudioTranscriptions.ts`
- `src/adapters/openaiRealtime.ts`

Database:
- `src/db/schema.sql`
- `src/db/seed.sql`
- `src/db/migrations/0001_init.sql`
- `src/db/migrations/0002_multimodal_hardening.sql`
- `src/db/queries.ts`

Docs:
- `docs/api-contract.md`
- `docs/env-example.md`
- `docs/routing-rules.md`
- `docs/wallet-model.md`
- `docs/acceptance-checklist.md`
- `docs/integration-readme.md`

---

## What is already solid

### 1. Real gateway structure

This is a real Worker-first gateway layout, not a browser toy.

### 2. Auth is server-side and database-backed for apps

`verifyAppToken.ts` is doing a real token-hash lookup against D1.

### 3. The pack is lane-aware

The code stops pretending one endpoint can do text, images, audio, video, and realtime the same way.

### 4. Public/admin separation exists

The docs and handlers are designed so public callers see Kaixu-safe envelopes while admin routes can inspect upstream truth.

### 5. Wallet / trace / jobs model is here

This is important because it turns the gate into a metered control plane instead of a dumb API proxy.

---

## What is unfinished or mismatched

### 1. Route files exist that are not wired into the router

Current router file:
- `src/router.ts`

Currently wired public routes:
- `/v1/health`
- `/v1/models`
- `/v1/chat`
- `/v1/stream`
- `/v1/images`
- `/v1/videos`
- `/v1/audio/speech`
- `/v1/audio/transcriptions`
- `/v1/realtime/session`
- `/v1/usage`
- `/v1/jobs/:job_id`

Currently wired admin routes:
- `/admin/traces/:trace_id`
- `/admin/jobs/:job_id`
- `/admin/upstream/:trace_id`
- `/admin/retry/:job_id`
- `/admin/cancel/:job_id`

Present in repo but **not wired**:
- embeddings lane
- wallet balance lane
- admin providers
- admin aliases
- admin routing
- admin wallets

That means the repo contains more capability than the active router exposes.

### 2. Embeddings exists in types and route code, but is not actually live

Signals:
- `KaixuEngineAlias` includes `kaixu/embed`
- `SkyEmbeddingsRequest` exists in `src/types.ts`
- `handleEmbeddings` exists in `src/routes/embeddings.ts`
- router does not expose a `/v1/embeddings` endpoint

So embeddings is **half-present**.

### 3. Documentation and live route exposure are not fully aligned

`docs/api-contract.md` focuses on the currently wired public contract.

But the codebase contains additional route files and capabilities not mentioned as live in the contract.

### 4. The package name and naming are misaligned with purpose

Current package/worker naming:
- package name: `kaixu-super-gate`
- Wrangler name: `kaixu-super-gate`
- root folder: `sky-currency-additive-pack`

This repo is doing more than currency. The folder name undersells and confuses the actual system role.

### 5. Multi-provider posture is structurally present but likely OpenAI-first in reality

Provider support exists for:
- OpenAI
- Gemini
- Anthropic

But the env model and adapter depth are clearly strongest on the OpenAI lane split. Treat Gemini and Anthropic as secondary until proven with acceptance tests.

---

## Build classification

This asset should be treated as:

**Kaixu Sovereign Multimodal Gateway Patch / Worker Brain Additive Pack**

Not as:
- a frontend app
- a complete admin UI
- a customer portal
- a self-booting full product by itself

---

## Immediate patch goals

If you are adjusting this in your codebase, do these first.

### Goal 1: Decide the public contract

Choose one of these paths:

#### Path A — Minimal hardening release
Keep only the currently wired routes and treat extra route files as future work.

#### Path B — Full lane release
Wire in the missing routes now and update the contract/docs to match.

If you want the pack to behave like a serious sovereign gate, **Path B is the stronger move**.

### Goal 2: Normalize naming

Rename the root package/folder so it reflects gateway reality, not only currency.

Suggested direction:
- `kaixu-super-gate/`
- or `kaixu-multimodal-gateway/`

### Goal 3: Align docs, router, and acceptance checklist

Right now the code knows things the router hides, and the docs present only part of the truth.

That is exactly how weird little future bugs breed.

---

## Recommended router patch plan

Add imports for the unwired route files in `src/router.ts`.

Suggested additions:

```ts
import { handleEmbeddings } from './routes/embeddings'
import { handleWalletBalance } from './routes/wallet-balance'
import { handleAdminProviders } from './routes/admin-providers'
import { handleAdminAliases } from './routes/admin-aliases'
import { handleAdminRouting } from './routes/admin-routing'
import { handleAdminWallets } from './routes/admin-wallets'
```

Suggested public route additions:

```ts
if (path === '/v1/embeddings' && method === 'POST') return await handleEmbeddings(request, env)
if (path === '/v1/wallet' && method === 'GET') return await handleWalletBalance(request, env)
```

Suggested admin route additions:

```ts
if (path === '/admin/providers' && method === 'GET') return await handleAdminProviders(request, env)
if (path === '/admin/aliases' && method === 'GET') return await handleAdminAliases(request, env)
if (path === '/admin/routing' && method === 'GET') return await handleAdminRouting(request, env)
if (path === '/admin/wallets' && method === 'GET') return await handleAdminWallets(request, env)
```

Use the actual handler names from each file if they differ. Verify before paste.

---

## Patch order

### Phase 1 — Make the current pack truthful

1. Verify `src/router.ts` against all files in `src/routes/`
2. Decide which extra routes are real release routes vs dormant stubs
3. Update `docs/api-contract.md`
4. Update `docs/acceptance-checklist.md`

### Phase 2 — Make deployments predictable

1. confirm `wrangler.jsonc` D1 binding
2. set all required secrets
3. run migrations in order:
   - `0001_init.sql`
   - `0002_multimodal_hardening.sql`
4. seed baseline provider / alias / pricing data if needed

### Phase 3 — Make the gate coherent

1. normalize package/folder naming
2. normalize branding vars:
   - `KAIXU_PUBLIC_BRAND`
   - `KAIXU_GATE_NAME`
3. ensure every frontend app calls Kaixu routes only
4. remove any direct vendor calls from app surfaces

### Phase 4 — Prove it actually lives

Run acceptance tests for:
- health
- models
- chat
- stream
- images
- videos create + poll
- speech
- transcription
- realtime session
- usage
- jobs poll
- admin trace inspection
- admin job inspection
- admin retry/cancel
- embeddings if you expose it
- wallet route if you expose it

---

## Environment expectations

Core required secrets/vars:
- `KAIXU_ADMIN_TOKEN`
- `OPENAI_API_KEY` or lane-specific keys
- D1 binding: `DB`

Optional lane-separated keys:
- `OPENAI_TEXT_KEY`
- `OPENAI_IMAGES_KEY`
- `OPENAI_VIDEOS_KEY`
- `OPENAI_AUDIO_KEY`
- `OPENAI_REALTIME_KEY`

Optional model overrides:
- `OPENAI_TEXT_MODEL`
- `OPENAI_DEEP_MODEL`
- `OPENAI_CODE_MODEL`
- `OPENAI_VISION_MODEL`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_VIDEO_MODEL`
- `OPENAI_SPEECH_MODEL`
- `OPENAI_TRANSCRIBE_MODEL`
- `OPENAI_REALTIME_MODEL`

Feature switches:
- `ENABLE_CHAT`
- `ENABLE_STREAM`
- `ENABLE_IMAGES`
- `ENABLE_VIDEOS`
- `ENABLE_AUDIO_SPEECH`
- `ENABLE_AUDIO_TRANSCRIPTIONS`
- `ENABLE_REALTIME`

Branding/runtime vars:
- `KAIXU_PUBLIC_BRAND`
- `KAIXU_GATE_NAME`
- `APP_NAME`
- `APP_ENV`
- `DEFAULT_CURRENCY`
- `ENABLE_FALLBACKS`
- `DEFAULT_MAX_SKYFUEL_PER_CALL`

---

## What to inspect first in the codebase

If you are cutting into the code directly, start here in this exact order:

1. `src/router.ts`
2. `src/types.ts`
3. `src/env.ts`
4. `src/auth/verifyAppToken.ts`
5. `src/auth/verifyAdminToken.ts`
6. `src/db/schema.sql`
7. `src/db/migrations/0002_multimodal_hardening.sql`
8. `src/db/seed.sql`
9. `src/routes/embeddings.ts`
10. `src/routes/wallet-balance.ts`
11. `src/routes/admin-providers.ts`
12. `src/routes/admin-aliases.ts`
13. `src/routes/admin-routing.ts`
14. `src/routes/admin-wallets.ts`
15. `docs/api-contract.md`
16. `docs/acceptance-checklist.md`

---

## Truthful final verdict

### What this is

A **Kaixu multimodal sovereign gateway backend patch pack** for Cloudflare Workers + D1.

### What auth/gate it uses

- **App callers:** Bearer app token checked against hashed `app_tokens` in D1
- **Admin callers:** Bearer admin token checked against `KAIXU_ADMIN_TOKEN`

### Is the gate self-contained?

- **As source code:** yes, mostly
- **As live deployed infrastructure:** no, it still needs Worker deployment, D1 binding, secrets, migrations, and seed data

### Main weakness right now

The pack contains more functionality than the active router exposes. In other words, the beast has extra limbs folded behind its back.

### Main action

Normalize the contract, wire the missing routes you actually want live, and deploy it as the real Kaixu multimodal gate instead of letting it live as a half-awake patch goblin.
