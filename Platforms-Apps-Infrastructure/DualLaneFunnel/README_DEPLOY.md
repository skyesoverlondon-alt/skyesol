# Skyes Over London • Dual‑Lane Funnel System (Netlify‑Ready)

This project is a working website funnel with **two separate lanes**:
- **Job Seekers** (`/jobseekers.html`)
- **Employers** (`/employers.html`)

It is designed to be **conversion‑first** and **frictionless** (single‑page intake per lane).

## What works immediately (no code, no build)

✅ **Netlify Forms** capture submissions as soon as the site is deployed to Netlify.

### Drop deploy (fast test)
1. Zip the **/public** folder contents (or deploy the whole repo and set publish to `public`).
2. Drag‑and‑drop to Netlify.
3. After deploy, go to **Netlify → Forms** and you will see:
   - `jobseekers-intake`
   - `employers-intake`

That is a legitimate working intake system: submissions are stored in Netlify’s form storage.

## Full “enterprise” system (Forms + Blobs + Neon)

✅ **Netlify Forms** (always)
✅ **Netlify Functions** (API endpoints)
✅ **Netlify Blobs** (redundant JSON retention)
✅ **Neon Postgres** (real database)

### Important limitation
Netlify **Drop** deployments generally do *not* run a full dependency install for Functions.
To use **Neon + Blobs** (Functions), deploy via:
- **Git‑connected Netlify site**, or
- **Netlify CLI**.

## Deploy via Git (recommended)
1. Put this repo in GitHub (or your preferred Git).
2. In Netlify: **Add new site → Import an existing project**.
3. Build settings:
   - **Build command:** `npm install`
   - **Publish directory:** `public`
   - Functions directory is auto from `netlify.toml`.

## Environment Variables

Set one of these:
- `NEON_DATABASE_URL` (preferred)
- or `DATABASE_URL`

Use the Neon connection string format:

`postgres://USER:PASSWORD@HOST/DB?sslmode=require`

Optional:
- `NODE_VERSION` = `20`

## Diagnostics
Visit:
- `/diagnostics.html`

If Functions are deployed, it will show health JSON.
If not, it will say Functions aren’t available (that’s normal in Drop‑only).

## Files / Structure
- `public/` static site
- `netlify/functions/intake.js` writes to Blobs + Neon (optional)
- `netlify/functions/health.js` diagnostics

## Branding
Logo is embedded per your standard:
- floating
- no container
- glow
- slight pulse

Logo URL used:
`https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png`

