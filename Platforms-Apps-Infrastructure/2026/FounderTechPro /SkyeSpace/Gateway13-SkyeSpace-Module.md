# Gateway 13 + SkyeSpace Module

## Current Integration State

- SkyeSpace now has a friendly public route at `/skyespace/`.
- SkyeSpace API calls are intended to run through root Netlify functions, not the extracted package's private function folder.
- The active auth contract is Gateway 13 bearer auth using the same session minting flow as the rest of the site.
- The active data contract is the main Skyesol shared Neon database, not a second Postgres island.

## What Was Wrong Before

- The extracted SkyeSpace package expected its own `DATABASE_URL` and `pg` pool.
- The extracted auth helper trusted Netlify Identity or a guest actor header.
- The main account page minted a Gateway session token, but the user dashboard and other apps were not consistently reading the same storage key.
- That meant the site was drifting toward parallel auth stacks and duplicate SQL contracts.

## Shared Contract Going Forward

### Auth

- `/.netlify/functions/session-token` remains the minting point for short-lived Gateway user sessions.
- The client-side canonical storage key is `KAIXU_VIRTUAL_KEY`.
- Legacy `kaixu_session` values should be migrated into that same key.
- Any client-facing app that requires identity should read from the shared Gateway session first.

### Data

- SkyeSpace data must live on the same shared Neon contract used by Gateway 13 and related usage tables.
- No new standalone SQL pool should be introduced unless the project is explicitly being split into a different deployment unit.
- If a feature needs its own tables, add them to the shared DB contract and track the dependency in Gateway 13.

### Backup Brain Tracking

- Sitewide backup-brain behavior should be visible in Gateway 13 as an operational surface, not hidden in isolated apps.
- Any autonomous or background feature should emit state to a Gateway-observable table or monitor event.
- Current code still needs a dedicated backup-brain event model in Gateway 13; that is still open work.

## Immediate Open Work

1. Add a visible sitewide sign-in status chip outside SkyeSpace as well, not only inside nested apps.
2. Expand Gateway 13 so it shows SkyeSpace activity, not just generic usage and the current SkyeFuelStation overview.
3. Add a first-class onboarding hub that links Account -> Gateway 13 -> SkyeFuelStation -> SkyeSpace -> Kaixu platform tools.
4. Add explicit monitor events for backup-brain actions, onboarding completions, and app handoffs.
5. Decide which surfaces should be previewable while logged out versus fully locked.

## Initial Surface Inventory To Review

These are real surfaces or product-like areas that exist in the repo and should be reviewed for discoverability and auth alignment.

- `/skyefuelstation/`
- `/skyespace/`
- `/gateway/`
- `/Operating-Systems/s0l26-0s/kaixu-0s-founder-cohort-platform/index.html`
- `/Platforms-Apps-Infrastructure/DualLaneFunnel/public/jobseekers.html`
- `/Platforms-Apps-Infrastructure/DualLaneFunnel/public/employers.html`
- `/Platforms-Apps-Infrastructure/BusinessLaunchGo/`
- `/Platforms-Apps-Infrastructure/Access222/`
- `/Platforms-Apps-Infrastructure/BrandID-Offline-PWA/`
- `/Platforms-Apps-Infrastructure/GateProofx/`
- `/Platforms-Apps-Infrastructure/LocalSeoSnapshot/`
- `/Platforms-Apps-Infrastructure/NeuralSpacePro/`
- `/Platforms-Apps-Infrastructure/QR-Code-Generator/`
- `/Platforms-Apps-Infrastructure/SkyeProfitConsole/`
- `/Platforms-Apps-Infrastructure/kAIxU-PDF-Pro/`
- `/Platforms-Apps-Infrastructure/kAIxUBrandKit/`
- `/Platforms-Apps-Infrastructure/kAIxUDeltaGate/`
- `/skyeleticx-portal.html`

## Sitewide Gaps Still Likely

- Some older standalone apps still appear to use their own local storage conventions and no shared Gateway session check.
- Some apps are only reachable by deep path and do not have homepage, account, or central navigation exposure.
- The current dashboard does not yet behave like a universal cross-product launcher.
- Sitewide persistent login is stronger after the shared session fix, but not every standalone app has been refit to honor it yet.

## Rule For Future Platform Work

Before shipping any new product surface, verify four things:

1. It uses the shared Gateway session or intentionally declares why it does not.
2. It uses the shared database contract or intentionally declares why it does not.
3. It is reachable from a client-facing navigation path.
4. Its operational state is visible from Gateway 13.