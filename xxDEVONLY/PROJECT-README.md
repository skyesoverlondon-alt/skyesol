# Project SkyeSol — Developer & Operator Reference

> **Skyes Over London LC · SOLEnterprises Ecosystem**
> Live: [https://skyesol.netlify.app](https://skyesol.netlify.app)
> Repo: `skyesoverlondon-alt/skyesol` · Branch: `main`

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Tech Stack](#tech-stack)
3. [Folder Map](#folder-map)
4. [Local Development](#local-development)
5. [NPM Scripts](#npm-scripts)
6. [Netlify Config](#netlify-config)
7. [Environment Variables](#environment-variables)
8. [Netlify Functions (Serverless)](#netlify-functions-serverless)
9. [Shared Function Libraries](#shared-function-libraries)
10. [Client-Side JS](#client-side-js)
11. [Build & Maintenance Scripts](#build--maintenance-scripts)
12. [Gateway (kAIxUGateway13)](#gateway-kaixugateway13)
13. [Skye Suite Apps](#skye-suite-apps)
14. [Platform Tools](#platform-tools)
15. [Blog & CMS](#blog--cms)
16. [Status Board & Dashboard (Portals)](#status-board--dashboard-portals)
17. [Vault (Gated Content)](#vault-gated-content)
18. [PWA / Service Worker](#pwa--service-worker)
19. [Redirects & Routing](#redirects--routing)
20. [Security Headers](#security-headers)
21. [Admin Menu (Demonkey)](#admin-menu-demonkey)
22. [Three.js Backgrounds](#threejs-backgrounds)
23. [CSS Architecture](#css-architecture)
24. [Deployment Workflow](#deployment-workflow)
25. [Troubleshooting](#troubleshooting)

---

## What This Is

SkyeSol is the **monorepo** for the entire SOLEnterprises digital ecosystem. It's a static multi-page site enhanced with Netlify Functions (serverless), Netlify Blobs (key-value storage), Neon Postgres (relational DB), and Netlify Identity (auth). The site is designed to work **even without Functions deployed** — public pages gracefully fall back to read-only mode.

**Core verticals:**
- **kAIxuGateway13** — Governed AI gateway (metered API keys, multi-provider routing, billing)
- **Skye Suite** — 8 operator-grade apps (Ops, Flow, Ledger, Slides, Sheets, Collab, Drive, Archive) all streaming through the Gateway
- **SkyeDocx** — Offline-first document PWA
- **Blog/CMS** — Netlify Blobs-backed with static fallback (50+ posts)
- **Case Studies** — 68+ HTML pages across verticals
- **Valley Verified** — Trust/verification platform
- **Portal Monitoring** — Uptime status board + dashboard

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Hosting | Netlify (static + Functions) |
| Database | Neon Postgres via `@netlify/neon` |
| Key-Value Store | Netlify Blobs via `@netlify/blobs` |
| Auth | Netlify Identity |
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| 3D Background | Three.js r128 (CDN) |
| Payments | Stripe (optional) |
| Voice | Twilio (optional) |
| AI Providers | OpenAI, Anthropic, Google Gemini |
| PWA | Service workers, Web App Manifest |
| Package Type | ES Modules (`"type": "module"` in package.json) |

---

## Folder Map

```
skyesol/
├── index.html, about.html, blog.html, post.html     ← Core pages
├── status.html, dashboard.html                        ← Portal monitoring
├── vault.html, admin.html                             ← Gated / admin
├── contact.html, privacy.html, terms.html             ← Legal & contact
├── 404.html                                           ← Fallback
│
├── css/
│   ├── style.css                                      ← Main site stylesheet
│   └── sol-intro.css                                  ← Cinematic intro styles
│
├── js/
│   ├── main.js                                        ← Nav, scroll-reveal, counters
│   ├── growth.js                                      ← Blog engine, status, vault, admin
│   ├── three-bg.js                                    ← Aurora particle background
│   ├── sol-intro.js                                   ← Full-screen cinematic intro
│   ├── partials.js                                    ← HTML partial injection
│   ├── admin-menu-triggers.js                         ← Hidden admin menu triggers
│   └── netlify-identity-init.js                       ← Identity bootstrap (placeholder)
│
├── scripts/                                           ← Build & maintenance (Node.js)
│   ├── generate-site-menu.mjs                         ← Auto-gen admin menu HTML
│   ├── generate-sitemap.js                            ← Generate sitemap.xml
│   ├── audit-internal-links.mjs                       ← Find broken internal links
│   ├── link-guardian.js                               ← Enforce noreferrer on ext links
│   ├── meta-templater.js                              ← Inject/update meta tags
│   ├── sync-blogs-manifest.js                         ← Scan Blogs/ → blog-manifest.json
│   └── sync-case-studies-index.js                     ← Rebuild Case Studies index
│
├── netlify/
│   └── functions/                                     ← Serverless API (90+ files)
│       ├── _common.mjs                                ← Shared Blobs store, helpers, seed
│       ├── _lib/                                      ← 27 shared modules (DB, auth, crypto…)
│       ├── _generated/                                ← Auto-generated data files
│       ├── admin-*.js                                 ← Admin API endpoints
│       ├── blog-*.mjs                                 ← Blog CMS API
│       ├── vault-*.mjs                                ← Vault API
│       ├── portal-status.mjs                          ← Uptime checker
│       ├── portals-*.mjs                              ← Portal CRUD
│       ├── gateway-*.js                               ← AI gateway streaming/jobs
│       ├── push-*.js                                  ← Netlify deploy push system
│       ├── gh-*.js                                    ← GitHub push integration
│       ├── stripe-*.js                                ← Payments
│       ├── voice-*.js                                 ← Twilio voice
│       └── request-key.mjs                            ← Self-service API key requests
│
├── Platforms-Apps-Infrastructure/                      ← Platform tools & apps
│   ├── kAIxUGateway13/                                ← ★ Core AI gateway admin
│   ├── GateProofx/                                    ← Gateway data explorer
│   ├── kAIxU-PDF-Pro/                                 ← PDF suite (18 tools)
│   ├── kAIxUBrandKit/                                 ← Brand kit generator
│   ├── kAIxUCHat/                                     ← AI chat (Gemini-backed)
│   ├── BusinessLaunchGo/                              ← AZ business launch docs
│   ├── BrandID-Offline-PWA/                           ← Brand identity offline PWA
│   ├── DualLaneFunnel/                                ← Two-lane agency funnel
│   ├── LocalSeoSnapshot/                              ← Local SEO audit tool
│   └── JWTSecretGenerator.html                        ← JWT secret generator
│
├── Skye Suite (each has index.html):
│   ├── SkyeDocx/          ← Document PWA (offline-first)
│   ├── SkyeOps/           ← Mission Control
│   ├── SkyeFlow/          ← Automation Hub
│   ├── SkyeLedger/        ← Executive Intelligence
│   ├── SkyeSlides/        ← Deck Orchestration
│   ├── SkyeSheets/        ← Data Canvas
│   ├── SkyeCollab/        ← Lockstep Collaboration
│   ├── SkyeDrive/         ← Fortune 500 Vault
│   └── SkyeArchive/       ← Compliance Vault
│
├── Blogs/                 ← 50+ blog posts (5 verticals)
├── Case Studies/          ← 68+ case study HTML pages
├── Valley Verified /      ← Trust/verification listings
├── Services/              ← Service offering pages
├── kAIxu/                 ← kAIxu public-facing pages
├── gateway/               ← Gateway public dashboard
│
├── _redirects             ← Netlify URL rewrites/redirects
├── _headers               ← Netlify security headers
├── netlify.toml           ← Netlify build config
├── env.template           ← Complete env var reference (194 lines)
├── manifest.json          ← PWA manifest
├── sw.js                  ← Service worker
├── sitemap.xml            ← Generated sitemap
├── robots.txt             ← Crawler instructions
└── package.json           ← NPM config (ES modules)
```

---

## Local Development

### Prerequisites
- **Node.js** (LTS) — for scripts and Netlify CLI
- **Netlify CLI** — `npm i -g netlify-cli`

### First-time setup
```bash
git clone https://github.com/skyesoverlondon-alt/skyesol.git
cd skyesol
npm install
netlify login
netlify link        # Link to site ID: cbcc48c2-deee-41b7-bb12-ca7c348d23c1
```

### Start local dev server (with Functions)
```bash
netlify dev
```
This starts a local server (typically port 8888) that serves the static site AND proxies `/.netlify/functions/*` to local function runners.

### Start without Functions (static only)
Any static file server works:
```bash
npx serve .
# or
python3 -m http.server 8080
```
The site will show "read-only mode" for blog/status/vault since Functions aren't running.

---

## NPM Scripts

| Command | What it does |
|---------|-------------|
| `npm run build` | Runs `generate-site-menu.mjs` — regenerates admin menu data |
| `npm run gen-sitemap` | Regenerates `sitemap.xml` from all HTML pages |
| `npm run link-check` | Audits all external links for missing `noreferrer` |
| `npm run link-check:fix` | Same as above but auto-fixes missing `noreferrer` |
| `npm run audit:internal-links` | Crawls all HTML, finds broken internal links |
| `npm run meta:check` | Checks meta tags across all pages (dry run) |
| `npm run meta:apply` | Injects/updates meta tags from central config |

---

## Netlify Config

**`netlify.toml`:**
- `publish = "."` — serves from repo root (no build output folder)
- `functions.directory = "netlify/functions"` — serverless function location
- Headers for PWA service worker and manifest caching

**`_headers`:**
- Applied to all routes (`/*`)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- Full CSP with allowlisted CDN sources

---

## Environment Variables

See `env.template` for the complete 194-line reference. Key sections:

### Required (gateway won't boot without these)
| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | Obtain admin JWT via `/admin-login` |
| `JWT_SECRET` | Signs all admin + user JWTs (64+ chars) |
| `ALLOWED_ORIGINS` | CORS allowlist (comma-separated) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | AI provider keys (set at least one) |

### Growth Platform (Blobs-based)
| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAILS` | Auto-assigns `admin` role on Identity login |
| `BLOBS_STORE` | Blob store name (default: `sol_growth`) |
| `MONITOR_HISTORY_CAP` | Max monitoring history entries (default: 120) |

### Auto-injected by Netlify (do NOT set manually)
- `NETLIFY_DATABASE_URL` — Neon Postgres connection
- `URL`, `DEPLOY_URL`, `DEPLOY_PRIME_URL` — Site URLs

### Optional sections
- **Governance/Billing** — `DEFAULT_CUSTOMER_CAP_CENTS`, `DEFAULT_RPM_LIMIT`, `CAP_WARN_PCT`
- **Security** — `DB_ENCRYPTION_KEY`, `KEY_PEPPER`, `DEMONKEY`
- **Rate Limiting** — `UPSTASH_REDIS_REST_URL/TOKEN`
- **Push/Deploy** — `NETLIFY_AUTH_TOKEN`, chunk retention, retry settings
- **GitHub** — `GITHUB_CLIENT_ID/SECRET` for OAuth
- **Stripe** — `STRIPE_SECRET_KEY/WEBHOOK_SECRET`
- **Twilio** — `TWILIO_ACCOUNT_SID/AUTH_TOKEN`
- **Monitoring** — `MONITOR_ARCHIVE_STORE`, retention days

---

## Netlify Functions (Serverless)

90+ functions in `netlify/functions/`. All use ES module syntax. Key groups:

### Blog CMS (Blobs-backed)
| Function | Method | Purpose |
|----------|--------|---------|
| `blog-list` | GET | List all published posts |
| `blog-get` | GET | Fetch single post by slug |
| `blog-upsert` | POST | Create/update post (admin) |
| `blog-delete` | POST | Delete post (admin) |

### Portal Monitoring (Blobs-backed)
| Function | Method | Purpose |
|----------|--------|---------|
| `portal-status` | GET | Ping all portals, return health |
| `portals-list` | GET | List configured portals |
| `portals-upsert` | POST | Add/update portal (admin) |
| `portals-delete` | POST | Remove portal (admin) |
| `monitor-cron` | scheduled | Periodic background check |
| `monitor-archive-*` | various | Archive/prune monitoring data |

### Vault (Blobs-backed, gated)
| Function | Method | Purpose |
|----------|--------|---------|
| `vault-list` | GET | List vault documents |
| `vault-get` | GET | Fetch single vault doc |
| `vault-upsert` | POST | Create/update vault doc (admin) |
| `vault-delete` | POST | Delete vault doc (admin) |

### Gateway (Neon DB-backed)
| Function | Method | Purpose |
|----------|--------|---------|
| `admin-login` | POST | Get admin JWT |
| `admin-keys` | various | API key management |
| `admin-customers` | various | Customer CRUD |
| `admin-usage` | GET | Usage analytics |
| `admin-invoices` | various | Invoice generation |
| `gateway-chat` | POST | AI chat (streaming SSE) |
| `gateway-stream` | POST | Raw AI streaming |
| `gateway-job-*` | various | Async job system |
| `request-key` | POST | Self-service key requests |
| `session-token` | POST | User session tokens |

### Push/Deploy System (Neon DB-backed)
| Function | Method | Purpose |
|----------|--------|---------|
| `push-init` | POST | Start a deploy job |
| `push-upload-chunk` | POST | Upload file chunks |
| `push-complete` | POST | Finalize deploy |
| `push-status` | GET | Check deploy status |
| `gh-push-*` | various | GitHub push variant |

### Other
| Function | Purpose |
|----------|---------|
| `stripe-*` | Stripe checkout + webhooks |
| `voice-twilio-*` | Twilio voice calls |
| `user-*` | User-facing account endpoints |
| `health` | Simple health check |
| `identity-login` | Netlify Identity hook |
| `client-error-report` | Client-side error logging |

---

## Shared Function Libraries

`netlify/functions/_lib/` contains 27 modules:

| Module | Purpose |
|--------|---------|
| `db.js` | Neon Postgres connection, queries, schema bootstrap (489 lines) |
| `authz.js` | API key verification, JWT auth (179 lines) |
| `crypto.js` | Hashing, JWT sign/verify, encrypt/decrypt (155 lines) |
| `http.js` | CORS builder, JSON responses (110 lines) |
| `wrap.js` | Request wrapper with error normalization (105 lines) |
| `providers.js` | AI provider routing + streaming logic (386 lines) |
| `ratelimit.js` | Rate limiting via DB + optional Upstash Redis (103 lines) |
| `invoices.js` | Monthly invoice generation (149 lines) |
| `monitor.js` | Event emission, request IDs, audit logging (142 lines) |
| `pricing.js` | Pricing config loader (40 lines) |
| `devices.js` | Device/install binding + seat limits (99 lines) |
| `github.js` | GitHub API client (122 lines) |
| `twilio.js` | Twilio API integration (94 lines) |
| `voice.js` | Voice billing + number lookup (83 lines) |
| `pushNetlify.js` | Netlify Deploy API (139 lines) |
| `pushCaps.js` | Push budget/cap tracking (130 lines) |
| `alerts.js` | Budget alerts (84 lines) |
| `allowlist.js` | Allowlist utilities (57 lines) |
| `kaixu.js` | Schema version constants (25 lines) |
| Others | `admin.js`, `audit.js`, `csv.js`, `githubTokens.js`, `netlifyTokens.js`, `voice_pricing.js`, `pushPath.js`, `pushPathNormalize.js` |

`netlify/functions/_common.mjs` — Shared Blobs store wrapper with seed logic for blog, portals, and vault.

---

## Client-Side JS

| File | Lines | What it does |
|------|-------|-------------|
| `js/growth.js` | 887 | **Main engine.** Blog rendering (with static fallback), portal status board, dashboard, vault browsing, admin console (blog/portal/vault CRUD). Falls back gracefully when Functions aren't deployed. |
| `js/main.js` | 354 | Nav toggle, mobile menu, scroll-reveal animations, stat counter animations. Service worker registration. |
| `js/three-bg.js` | 176 | Three.js aurora particle background — 2800 gold/purple particles with flowing waves, mouse parallax, scroll response. Used on main site pages. |
| `js/sol-intro.js` | 121 | Full-screen cinematic intro — canvas particles, lightning effects, fog, "Skyes Over London / Eminence In Motion" title animation. |
| `js/admin-menu-triggers.js` | 166 | Hidden admin menu activation. Triggers: simultaneous 6+7 held three times, or typing `444666`, or logo click combo. Navigates to `/admin-menu.html`. |
| `js/partials.js` | 60 | Fetches and injects HTML partials (header/footer) via `fetch()`. |
| `js/netlify-identity-init.js` | — | Placeholder for Netlify Identity bootstrap. |

### Gateway-specific JS
| File | Lines | What it does |
|------|-------|-------------|
| `Platforms-Apps-Infrastructure/kAIxUGateway13/assets/app.js` | 1539 | Gateway admin dashboard — login, 12-tab admin panel (customers, keys, billing, monitoring, exports, GitHub push). |
| `Platforms-Apps-Infrastructure/kAIxUGateway13/assets/three-bg-gate.js` | ~260 | Neural constellation background — 120 floating nodes (gold/purple), dynamic connection lines, 400 dust particles, pulse rings. |
| `Platforms-Apps-Infrastructure/GateProofx/app.js` | 368 | GateProofx data explorer — file parsing (CSV/NDJSON), filtering, charting, archive access. |

---

## Build & Maintenance Scripts

Run with `node scripts/<name>` or via NPM script aliases:

| Script | NPM alias | What it does |
|--------|-----------|-------------|
| `generate-site-menu.mjs` | `npm run build` | Walks the project tree, builds `_generated/site-menu-data.mjs` with every navigable page for the admin menu. |
| `generate-sitemap.js` | `npm run gen-sitemap` | Scans all HTML files, generates `sitemap.xml` with per-page changefreq and priority. |
| `audit-internal-links.mjs` | `npm run audit:internal-links` | Crawls all HTML, extracts `<a href>` / `<link>` / `<script src>`, checks if targets exist. Reports broken links. |
| `link-guardian.js` | `npm run link-check` | Finds external links missing `rel="noreferrer"`. `--fix` flag auto-patches them. |
| `meta-templater.js` | `npm run meta:apply` | Injects/updates `<title>`, `<meta description>`, OG/Twitter tags from a central config. `--check` for dry run. |
| `sync-blogs-manifest.js` | — | Scans `Blogs/` for HTML files, extracts metadata, writes `Blogs/blog-manifest.json`. |
| `sync-case-studies-index.js` | — | Scans `Case Studies/` for HTML files, regenerates `Case Studies/index.html`. |

### When to run what
- **After adding/editing blog posts:** `node scripts/sync-blogs-manifest.js`
- **After adding/editing case studies:** `node scripts/sync-case-studies-index.js`
- **After adding new pages:** `npm run build && npm run gen-sitemap`
- **Before deploying:** `npm run audit:internal-links` (catch broken links)
- **After adding external links:** `npm run link-check:fix`

---

## Gateway (kAIxUGateway13)

**Location:** `Platforms-Apps-Infrastructure/kAIxUGateway13/`
**Live URL:** `https://skyesol.netlify.app/gateway` (via `_redirects`)

The AI gateway lets you:
- Issue metered API keys to customers
- Route traffic to OpenAI / Anthropic / Gemini
- Set per-customer spend caps and RPM limits
- Track token usage and generate invoices
- Push code deployments to Netlify/GitHub
- Monitor voice calls (Twilio)

### Gateway file structure
```
kAIxUGateway13/
├── index.html              ← Admin dashboard (login + 12-tab panel)
├── assets/
│   ├── app.js              ← Dashboard logic (1539 lines)
│   ├── style.css           ← Glassmorphism theme
│   ├── three-bg-gate.js    ← Neural constellation background
│   └── user.js             ← User-facing dashboard
├── Its-kAIxU/              ← kAIxU intro/landing pages
├── pricing/                ← Pricing configs
├── sql/                    ← Database schema
├── docs/                   ← Gateway documentation
└── smoketests/             ← API smoke tests
```

### Gateway admin tabs
1. Overview — KPIs and quick actions
2. Customers — CRUD customer accounts
3. Keys — API key management (create, revoke, view)
4. Billing — Usage caps, invoices, Stripe top-ups
5. Usage — Token analytics and charts
6. Monitor — Real-time event stream
7. Exports — Download data (CSV/JSON)
8. Devices — Install/device management
9. Voice — Twilio call logs
10. Push — Deploy to Netlify from browser
11. GitHub — Push to GitHub repos
12. Settings — Gateway configuration

### Login
- Navigate to `/gateway`
- Enter admin password → gets JWT → stored in localStorage
- JWT signs all subsequent API calls

---

## Skye Suite Apps

8 gateway-powered apps, each in its own folder with `index.html`:

| App | Folder | Purpose |
|-----|--------|---------|
| SkyeOps | `SkyeOps/` | Mission Control — streams from SkyeDocx templates through gateway |
| SkyeFlow | `SkyeFlow/` | Automation Hub — turns drafts into governed workflows |
| SkyeLedger | `SkyeLedger/` | Executive Intelligence — Fortune 500 narratives + regulatory insights |
| SkyeSlides | `SkyeSlides/` | Deck Orchestration — replace Google Slides |
| SkyeSheets | `SkyeSheets/` | Data Canvas — replace spreadsheet suites |
| SkyeCollab | `SkyeCollab/` | Lockstep Studio — collaborative QA + development |
| SkyeDrive | `SkyeDrive/` | Fortune 500 Vault — replace Google Drive |
| SkyeArchive | `SkyeArchive/` | Compliance Vault — re-classify via gateway streaming |

All apps use `kaixuStreamChat()` helper and BroadcastChannel for cross-app communication. They share the gateway's usage ledger for budget-aware controls.

---

## Platform Tools

| Tool | Location | Purpose |
|------|----------|---------|
| GateProofx | `Platforms-Apps-Infrastructure/GateProofx/` | Gateway data explorer — load CSV/NDJSON exports, filter, chart, re-export |
| kAIxU-PDF-Pro | `Platforms-Apps-Infrastructure/kAIxU-PDF-Pro/` | 18-tool PDF suite (valuations, contracts, invoices, brand books, etc.) |
| kAIxUBrandKit | `Platforms-Apps-Infrastructure/kAIxUBrandKit/` | Brand kit generator with build reports |
| kAIxUChat | `Platforms-Apps-Infrastructure/kAIxUCHat/` | AI chat (Gemini-backed, white-labeled) |
| BusinessLaunchGo | `Platforms-Apps-Infrastructure/BusinessLaunchGo/` | AZ business launch kit → ZIP + PDF |
| BrandID | `Platforms-Apps-Infrastructure/BrandID-Offline-PWA/` | Brand identity kit (offline PWA) |
| DualLaneFunnel | `Platforms-Apps-Infrastructure/DualLaneFunnel/` | Two-lane agency funnel (jobseekers + employers) |
| LocalSeoSnapshot | `Platforms-Apps-Infrastructure/LocalSeoSnapshot/` | Local SEO audit → checklist + 30-day plan |
| JWT Generator | `Platforms-Apps-Infrastructure/JWTSecretGenerator.html` | Browser-based JWT secret generator |
| SkyeDocx | `SkyeDocx/` | Offline-first document PWA (standalone) |

---

## Blog & CMS

**Pages:** `blog.html` (listing), `post.html` (single post)
**Engine:** `js/growth.js` → calls `blog-list` / `blog-get` Functions
**Storage:** Netlify Blobs (key: `blog:index`, `blog:post:<slug>`)
**Fallback:** 50+ static posts hardcoded in `growth.js` as `staticPosts[]`

### How blog posts work
1. **Dynamic posts** — stored in Netlify Blobs, managed via `admin.html`
2. **Static posts** — HTML files in `Blogs/` with metadata in `growth.js`
3. Growth.js merges both lists, deduplicates by slug, sorts by date

### Blog verticals (in `Blogs/`)
- `Phoenix Arizona/` — 10-part Phoenix business playbook
- `Skaixu/` — 13-part SkAIxu IDE blog series
- `Houston Texas Devs & AI/` — 13 Houston tech company spotlights
- `Editorials/` — 15+ editorials spanning dev/AI, techwear, club scene
- `13th Sole Promotions/` — Event spotlights

### Adding a blog post
Option A — **Via Admin Panel** (dynamic):
1. Go to `admin.html` → log in → Blog tab → New Post
2. Fill in title, slug, excerpt, tags, markdown content
3. Save — stored in Blobs, immediately live

Option B — **Static HTML** (no Functions needed):
1. Create HTML file in `Blogs/`
2. Add entry to `staticPosts[]` in `js/growth.js`
3. Run `node scripts/sync-blogs-manifest.js`

---

## Status Board & Dashboard (Portals)

**Pages:** `status.html` (public), `dashboard.html` (monitoring)
**Engine:** `js/growth.js` → calls `portal-status` Function
**Storage:** Netlify Blobs (key: `portals:list`)

### What portals are
Each portal is a website/service you want to monitor for uptime:
```json
{
  "id": "sol-gateway",
  "name": "SOLEnterprises.org",
  "url": "https://solenterprises.org",
  "path": "/",
  "category": "Gateway",
  "public": true
}
```

### How monitoring works
1. `portal-status` function reads `portals:list` from Blobs
2. Pings each portal URL (6.5s timeout, concurrent with limit)
3. Returns `{ checked_at, results: [{id, name, url, ok, status, ms, error}] }`
4. Status page renders green/red cards with latency
5. History saved to `monitor:history` (capped at `MONITOR_HISTORY_CAP`)

### Managing portals
1. Go to `admin.html` → log in → Portals section
2. Add/edit/delete portals
3. Changes saved to Blobs via `portals-upsert` / `portals-delete`

### Seed data
If `portals:list` doesn't exist or is empty, `ensureSeed()` in `_common.mjs` auto-creates 3 starter portals: SOLEnterprises.org, SOL NexusConnect, Kaixu AI Division.

---

## Vault (Gated Content)

**Page:** `vault.html`
**Storage:** Netlify Blobs (key: `vault:index`, `vault:doc:<id>`)
**Access:** Requires Netlify Identity login

Documents stored: proposals, SOWs, architecture notes, evidence packs, operational playbooks.

---

## PWA / Service Worker

**Manifest:** `manifest.json`
- App name: "SOLEnterprises — Skyes Over London LC"
- Display: standalone
- Theme: `#05050a` (dark)
- Icons: 72–512px including maskable
- Shortcuts: Blog, Dashboard, SkyeDocx

**Service Worker:** `sw.js` (87 lines)
- Static assets → Cache First
- HTML pages → Network First (offline fallback → `/404.html`)
- API calls (`/.netlify/`) → Network Only
- Precaches core pages on install

**SkyeDocx has its own PWA** with separate `service-worker.js`, `sw.js`, and `manifest.webmanifest`.

---

## Redirects & Routing

`_redirects` file handles URL mapping. Key routes:

| Clean URL | Real path |
|-----------|-----------|
| `/gateway` | `/Platforms-Apps-Infrastructure/kAIxUGateway13/index.html` |
| `/request-key` | `/kAIxu/RequestKaixuAPIKey.html` |
| `/gate-proofx.html` | `/Platforms-Apps-Infrastructure/GateProofx/index.html` |
| `/editorials` | `/Blogs/Editorials/index.html` |
| `/editorials/*` | Various editorial subdirs |
| `/services/*` | `/Services/:splat` |
| `/case-studies` | `/Case Studies/index.html` |
| `/jobseekers.html` | DualLaneFunnel public page |
| `/employers.html` | DualLaneFunnel public page |

Redirects use `200` (rewrite, no URL change) or `301` (permanent redirect).

---

## Security Headers

Applied globally via `_headers`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self' https: data: blob:;
  script-src 'self' https://cdnjs.cloudflare.com https://identity.netlify.com 'unsafe-inline' 'unsafe-eval';
  style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' https: data: blob:;
  connect-src 'self' https:;
  frame-ancestors 'none';
```

---

## Admin Menu (Demonkey)

Hidden admin navigation accessible from any page that loads `js/admin-menu-triggers.js`.

### Triggers
1. **Keyboard combo:** Hold 6 + 7 simultaneously, release, repeat 3 times
2. **Digit sequence:** Type `444666` anywhere on page
3. **Logo click combo:** (configured in script)

### What it opens
Navigates to `/admin-menu.html` — a full site path inventory showing every page in the project.

### Where it's loaded
- Main site pages (via `main.js`)
- Gateway admin (`kAIxUGateway13/index.html`)
- GateProofx (`GateProofx/index.html`)

### Env var
`DEMONKEY` in Netlify env — the secret value is `444666`.

---

## Three.js Backgrounds

Two distinct Three.js backgrounds:

### Main site — Aurora Particles (`js/three-bg.js`)
- 2800 particles (gold 55%, purple 45%)
- Flowing wave motion
- Mouse parallax + scroll response
- Canvas: `<canvas id="three-bg">`

### Gateway — Neural Constellation (`kAIxUGateway13/assets/three-bg-gate.js`)
- 120 floating nodes (gold 55%, purple 45%)
- Dynamic connection lines between nearby nodes (`CONNECT_DIST = 5.8`)
- 400 ambient dust particles (soft purple)
- Pulse rings spawn every 3.5s on random nodes
- Mouse parallax + scroll response
- Background: `#07070f`
- Canvas: `<canvas id="three-bg">`

Both use Three.js r128 from CDN: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`

---

## CSS Architecture

### Main site — `css/style.css`
- CSS custom properties for theming
- Dark theme: `--bg: #05050a`, `--text: #e2e0d8`
- Accent colors: `--accent-gold`, `--accent-purple`, `--accent-cyan`
- Responsive grid layouts
- Scroll-reveal animations

### Gateway — `kAIxUGateway13/assets/style.css`
- Glassmorphism: `backdrop-filter: blur(18px) saturate(1.4)`
- Vars: `--bg0: #07070f`, `--gold: #f6c14b`, `--purple: #7c4dff`, `--cyan: #27f2ff`
- Glass cards, topbar, modals, toast notifications

### GateProofx — `GateProofx/style.css`
- Space Grotesk font
- Accent: `--accent: #5cf4d3`

### Intro animation — `css/sol-intro.css`
- Full-screen overlay styles for cinematic intro

---

## Deployment Workflow

### You deploy via GitHub (git push)
```bash
git add -A
git commit -m "description of changes"
git push origin main
```
Netlify auto-builds on push. Functions deploy automatically from `netlify/functions/`.

### Pre-deploy checklist
1. `npm run audit:internal-links` — catch broken links
2. `npm run link-check:fix` — fix missing noreferrer
3. `npm run build` — regenerate admin menu data
4. `npm run gen-sitemap` — update sitemap

### Staging vs Production
- Stage changes: `git add <files>`
- Commit when ready: `git commit -m "..."`
- Push to deploy: `git push origin main`
- Branch deploys: push to any branch → Netlify creates a preview URL

---

## Troubleshooting

### "Status is in read-only mode"
**Cause:** The `portal-status` function call failed. This happens when:
- Viewing from codespace/localhost (no Functions runtime)
- Function has a runtime error
- Network issue reaching `/.netlify/functions/portal-status`

**Fix:** Deploy via git push. The function works on the deployed site.

### "No portals configured yet"
**Cause:** `portals:list` exists in Blobs but has an empty array (all portals were deleted).

**Fix:** The `ensureSeed()` function now re-seeds when the array is empty (fix staged). After push, the seed portals will auto-populate. Or add portals manually via `admin.html`.

### Blog shows only static posts
**Cause:** Functions aren't deployed or Blobs store is empty.

**Fix:** Deploy via `git push` or `netlify deploy --prod`. The seed function will auto-create a welcome post.

### Gateway login fails
**Cause:** `ADMIN_PASSWORD` or `JWT_SECRET` not set in Netlify environment variables.

**Fix:** Set both in Netlify Dashboard → Site → Configuration → Environment Variables.

### Three.js not rendering
**Cause:** CDN blocked or `<canvas id="three-bg">` missing from HTML.

**Fix:** Check browser console for Three.js load errors. Verify canvas element exists.

### "Functions not detected" / 404 on function calls
**Cause:** Functions directory not recognized by Netlify.

**Fix:** Ensure `netlify.toml` has `[functions] directory = "netlify/functions"`. Push and redeploy.

### Broken internal links
Run: `npm run audit:internal-links`
This crawls every HTML file and reports any `<a href>` pointing to non-existent files.

---

*Last updated: February 2026*
*Maintainer: Skyes Over London LC*
