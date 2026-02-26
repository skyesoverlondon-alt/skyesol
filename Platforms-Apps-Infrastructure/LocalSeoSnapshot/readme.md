# README.md

Lord kAIxu, this must be deployed via Git or it will not be useful to you.

## What this is
**Local SEO Snapshot** is a static, Netlify-hosted web app that:
- takes Business + City inputs
- computes a real 0–100 score across 6 dimensions
- generates Top 10 Fixes + 30-day (week-by-week) plan
- computes competitor review targets + pace (if competitor counts provided)
- exports a branded PDF (jsPDF via CDN)
- captures leads via Netlify Forms with hidden `report_summary`
- includes a Diagnostics drawer + client error reporting (Netlify Function)
- supports PWA install + offline caching + “Load last report” from localStorage

## Why Git deploy is mandatory
This repo includes a Netlify Function:
- `/.netlify/functions/client-error-report`

Netlify **Drop/manual deploys are not reliable for Functions**. If you Drop it, you’ll likely get:
- ✅ the static site working
- ❌ the function endpoint 404’ing (Diagnostics → “Send test error” fails)

So: **deploy via Git**. No exceptions if you want “fully functional.”

---

## Repo structure (must stay like this)
At the repo root (same level):
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `netlify.toml`
- `_redirects` (recommended)
- `netlify/functions/client-error-report.js`
- `icons/`

If you accidentally nest these under a wrapper folder, you’ll deploy a 404.

---

## Environment variables
### Required env vars
**None.** This app runs without any environment variables.

### Optional env vars
Also **none are required**, but you can add optional controls later if you choose to enhance the function (rate limiting, auth, logging, etc). A template is included as `.env.example` to document future controls.

Important: Netlify does **not** automatically load `.env` files in production.
- In production you set env vars in: **Netlify → Site settings → Environment variables**
- `.env.example` is documentation + local dev convenience only.

---

## Deploy (Git) — the exact steps
### Option A: GitHub web upload (easy on Chromebook)
1) Create a new GitHub repo (public or private).
2) Upload the repo files so `index.html` is at the repo root (NOT inside a folder).
3) In Netlify:
   - **Add new site → Import from Git**
   - Select your repo
   - Build command: *(leave blank)*
   - Publish directory: `.`

Netlify will read `netlify.toml` and auto-publish the function from `netlify/functions`.

### Option B: Deploy from Codespace (more “developer”)
1) Open the folder in your GitHub Codespace
2) Commit + push to GitHub
3) Connect repo in Netlify (“Import from Git”) the same way

---

## Netlify Forms (lead capture)
This repo includes a form:

- `name="local-seo-snapshot-lead"`
- hidden `form-name` input
- honeypot field
- hidden `report_summary` input (auto-filled when you generate a snapshot)

After the first Git deploy:
1) Netlify Dashboard → **Forms**
2) You should see `local-seo-snapshot-lead`
3) Submissions will include `report_summary`

If you don’t see it, redeploy once (Netlify only detects forms from deployed HTML).

---

## Verify “fully functional” after deploy
Open your deployed site and run:

1) Click **Generate Snapshot**
   - Score should populate
   - Top fixes and 30-day plan should render
   - “Export PDF” becomes enabled

2) Click **Export PDF**
   - PDF downloads with watermark branding

3) Click **Diagnostics → Send test error**
   - Should succeed (no 404)
   - Netlify → **Functions → client-error-report** logs should show the payload

---

## Local development
### Static-only local test (no functions)
You can test the UI locally with any simple server:

- Python:
  - `python3 -m http.server 8888`
- Then open:
  - `http://localhost:8888`

This tests:
- UI, scoring logic, localStorage, PDF export, PWA caching basics
But it will NOT test:
- `/.netlify/functions/client-error-report`

### Full local test (with functions)
Use Netlify CLI (best inside a Codespace):
1) Install:
   - `npm i -g netlify-cli`
2) From repo root:
   - `netlify dev`
3) Open the local URL Netlify prints.
Now the function route works locally too.

---

## Troubleshooting (the common failures)
### “My site 404s”
Cause: `index.html` not at publish root.
Fix:
- Ensure repo root contains `index.html`
- Ensure Netlify publish directory is `.`

### “Function endpoint 404s”
Cause: you used Netlify Drop/manual deploy OR functions not enabled.
Fix:
- Deploy via Git
- Confirm Netlify is using `functions = "netlify/functions"` from `netlify.toml`

### “Form submissions not appearing”
Cause: Netlify didn’t detect the form yet.
Fix:
- Deploy via Git (not Drop)
- Redeploy once
- Ensure the form markup remains in `index.html`

---

## Security notes (what this function does)
`client-error-report`:
- accepts JSON
- logs the payload to Netlify function logs
- returns `{ ok: true }`

It does not store data in a database (by design, to stay drop-simple and cost-free).
If you want storage later (Neon/Supabase/etc), you can extend it.

---

## Versioning
Client constants (in `app.js`):
- `APP = "Local SEO Snapshot"`
- `BUILD = "2026.02.25.2"`

Headers sent to the function:
- `x-kaixu-app`
- `x-kaixu-build`