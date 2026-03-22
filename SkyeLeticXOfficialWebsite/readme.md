# SkyeLeticX — Real Dashboard Build (Netlify Identity + Blobs + Neon)

Lord kAIxu, this must be deployed via Git or it will not be useful to you.

This package now includes actual working dashboard surfaces and Netlify Functions.
It is no longer a Netlify Drop-only static bundle.

## Included dashboards
- `owner-dashboard.html` — command hub
- `league-office-dashboard.html` — president / VP control surface
- `vp-operations-dashboard.html` — combines, rankings, player status
- `cfo-dashboard.html` — fees, payouts, ledger
- `team-owner-dashboard.html` — linked team owner board
- `player-portal-dashboard.html` — linked player portal
- `draft-war-room.html` — live draft board

## Included intake pages
- `player-combine-intake.html` — live Netlify Form + Neon sync
- `players.html` — original public player page now wired into the same Netlify Form + Neon backend
- `expansion-interest.html` — live Netlify Form + Neon sync

## Stack used
- **Netlify Identity** for login / role-aware dashboards
- **Netlify Blobs** for persistent dashboard notes and cached summary state
- **Neon / Postgres** for teams, players, combines, finance entries, draft picks, expansion interest, and profile links
- **Netlify Forms** for player combine intake, expansion interest capture, and the original public `players.html` page

## Files added
- `netlify.toml`
- `package.json`
- `assets/skx-dashboard.css`
- `assets/skx-dashboard.js`
- `netlify/functions/skx-portal.js`
- `netlify/functions/_lib/*`

## Required environment variables
Set these in Netlify Site Configuration:

- `NEON_DATABASE_URL` — your Neon Postgres connection string

Netlify Blobs runs from Netlify runtime context. Netlify Identity must be enabled on the site.

## Identity roles
Use these role names in Netlify Identity or through the linked `profiles` table:
- `president`
- `vp`
- `cfo`
- `team_owner`
- `player`

## First boot flow
1. Enable **Netlify Identity**.
2. Add `NEON_DATABASE_URL`.
3. Deploy via **Git**.
4. Visit `/dashboard`.
5. Login with a president or vp role.
6. Open **League Office**.
7. Click **Seed 26 founding slots**.
8. Link real user emails to roles and optional `team_id` / `player_id` values.
9. Start creating combines, players, finance entries, and draft picks.

## Data model created automatically
The function auto-creates these tables if missing:
- `teams`
- `players`
- `combines`
- `finance_entries`
- `draft_picks`
- `expansion_interest`
- `profiles`

## Clean URLs
- `/dashboard`
- `/dashboard/league-office`
- `/dashboard/vp-ops`
- `/dashboard/cfo`
- `/dashboard/team-owner`
- `/dashboard/player`
- `/dashboard/draft`
- `/player-intake`
- `/expansion-interest`

## Notes
- Role-specific dashboards remain `noindex` on purpose. The command hub plus the two public intake pages are indexable and included in the XML sitemap.
- Public dashboard actions are protected server-side inside `skx-portal.js`.
- The older `players.html` page now writes to the same backend used by the dashboards, so public intake and internal league ops stay in one system.
- Team owner / player access can come from either Netlify Identity roles or the linked `profiles` table.
