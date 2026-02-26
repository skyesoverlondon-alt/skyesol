# Skyes Over London • Dual‑Lane Funnel System (Netlify Drop + Full Stack)

This is the **working website** you asked for: a conversion‑first funnel with **two separate lanes** and real intake capture.

- **Job Seekers**: `/jobseekers.html` → Netlify Form `jobseekers-intake`
- **Employers**: `/employers.html` → Netlify Form `employers-intake`

It supports two modes:

1) **Drop‑ready (fast, legit intake):** Netlify Forms only ✅  
2) **Enterprise mode (legit backend):** Netlify Forms + Functions + Netlify Blobs + Neon Postgres ✅

---

## 1) Codespace quickstart (local test)

In a GitHub Codespace terminal:

```bash
npm install
```

Optional: run a local Netlify emulation (recommended so Functions can run locally):

```bash
npm i -g netlify-cli
cp .env.example .env
# edit .env and paste your Neon connection string
netlify dev
```

Then open the forwarded port shown by `netlify dev`.

Notes:
- Netlify Forms are primarily processed when deployed on Netlify. Local testing focuses on UI + Functions.
- Netlify Blobs work best in a deployed Netlify environment; locally they may not persist.

---

## 2) Netlify deploy (NO backend, Forms-only, cheapest test)

This is the “drop it in Netlify” path.

1. Deploy the repo to Netlify (Git deploy) **or** Drop deploy the `/public` folder contents.
2. Visit the site and submit either form.
3. Netlify dashboard → **Forms**:
   - `jobseekers-intake`
   - `employers-intake`

This is already a legitimate intake system: submissions are stored in Netlify.

---

## 3) Full legit system (Forms + Blobs + Neon)

Deploy via **Git-connected Netlify site** (recommended). This ensures Functions bundle with dependencies.

### Netlify settings
- **Publish directory:** `public`
- **Functions directory:** `netlify/functions` (already configured in `netlify.toml`)
- **Build command:** no-op (configured), Netlify still bundles Functions

### Required environment variables (Netlify → Site configuration → Environment variables)
- `NEON_DATABASE_URL` (preferred)  
  or `DATABASE_URL`

Format:
`postgres://USER:PASSWORD@HOST/DB?sslmode=require`

Optional:
- `NODE_VERSION=20`

### What happens on submit
1) Netlify Forms stores the submission  
2) JS posts the same payload to `/.netlify/functions/intake`
3) The function:
   - writes JSON to **Netlify Blobs** store `sol-intake`
   - writes a row into Neon table `intake_submissions` (auto-created)

---

## 4) Diagnostics

After deploy, visit:

- `/diagnostics.html`

It calls `/.netlify/functions/health` and shows:
- Functions availability
- DB connection state (if env var set)
- Blobs availability

---

## Files
- `public/` → website pages, CSS, JS, assets
- `netlify/functions/intake.js` → writes to Blobs + Neon
- `netlify/functions/health.js` → health check
- `.env.example` → env template for Codespace/local

---

## Branding
- Uses your logo URL:
  `https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png`
- Floating, subtle glow, slight pulse + watermark
