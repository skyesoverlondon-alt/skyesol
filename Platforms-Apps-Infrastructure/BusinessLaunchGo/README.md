# Business Launch Kit (AZ) Pack — Netlify Drop Repo (P13.1)

This repo is a Netlify-ready static app that generates an Arizona launch ZIP pack + branded PDF, with optional Neon + Blobs server integrations.

## Why the “database” wasn’t inside the original ZIP
A database is an external service (Neon / Postgres). What *can* live in the repo is:
- the **schema** (`schema.sql`)
- the **server endpoints** (Netlify Functions) that write to the DB
- the **client** that calls those endpoints

P13.1 includes all of that.

## Deploy paths
### A) Static-only (Drag & Drop / ZIP deploy)
- The app UI works.
- Netlify Forms works (AJAX submission).
- ZIP/PDF downloads work.
- Functions may not bundle in this mode (Netlify doesn’t run a build on manual deploys).

### B) Full stack (recommended): Git or Netlify CLI deploy
- Functions deploy and run
- Neon upsert + health ping work
- Optional Netlify Blobs storage endpoint can work (if dependencies are bundled/available)

## Neon setup (Data API)
1. Create a Neon project.
2. Run `schema.sql` in Neon (SQL Editor).
3. Enable Neon **Data API** on the branch.
4. Set env vars (see `.env.example`) in Netlify:
   - `NEON_DATA_API_URL`
   - `NEON_DATA_API_JWT`

## What’s included
- `/netlify/functions/neon-lead-upsert.js`
- `/netlify/functions/neon-health.js`
- `schema.sql`
- `.env.example`
- Optional: `/netlify/functions/blob-store-pack.js`

Build: BLK-AZ-P13.1 • Version: 1.1.0 • Generated: 2026-02-26T06:13:07Z
