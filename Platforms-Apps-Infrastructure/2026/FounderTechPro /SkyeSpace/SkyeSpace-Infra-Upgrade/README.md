# SkyeSpace Infra Upgrade

This pass converts the MVP shell into a real platform starter with a live data spine:

- Neon / Postgres database
- Netlify Functions API
- shared profile + feed + market + signal + messaging tables
- front-end API client with graceful local fallback
- browser shell that shows whether live infra is connected

## What changed

The original package was a presentation shell with hard-coded demo records and localStorage-only actions.
This upgrade adds:

- `netlify/functions/health.js`
- `netlify/functions/feed.js`
- `netlify/functions/market.js`
- `netlify/functions/signal.js`
- `netlify/functions/districts.js`
- `netlify/functions/profile.js`
- `netlify/functions/messages.js`
- `netlify/functions/metrics.js`
- shared database helpers under `netlify/functions/_shared/`
- SQL schema and seed files under `db/`
- `js/api.js` front-end client

## Required environment variables

Use `.env.example` as the template.

## Database setup

Run `db/schema.sql` against Neon first. Then run `db/seed.sql` if you want seeded launch data.

## Local development

```bash
npm install
netlify dev
```

## Deployment note

This project uses Netlify Functions. Deploy through Git-connected Netlify so the functions and environment variables actually exist.

## Live lanes in this pass

- home feed
- market listings
- signal alerts
- districts
- profile save/load
- unified messages lane
- studio KPI pull
- quick compose routed to the live API when available

## Remaining lanes

Forge, Stage, Muse, Vaults, Council, and Academy still need second-pass back-end depth if you want them fully multi-tenant and monetized. In this pass, their non-functional fake buttons were stripped or converted to working local actions.
