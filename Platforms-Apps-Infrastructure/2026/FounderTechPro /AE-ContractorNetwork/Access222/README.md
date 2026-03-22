# Skyesol Access 222™ — Deploy-Ready Site (Netlify)

This folder is **deploy-ready** for Netlify and includes:

- `/services/access-222/` service page + **Netlify intake form**
- `/routing/` Account Executive routing + qualification gate
- `/ae/` internal AE portal + SOP behind a **simple client-side access gate**
- Redirects via `/_redirects`

---

## 1) Deploy to Netlify

### Option A — Netlify Drop
1. Zip the folder or drag the folder contents into Netlify Drop.
2. Confirm the site builds (this is a static site; no build step required).

### Option B — Git Deploy
1. Push this folder to a GitHub repo.
2. Create a new Netlify site from the repo.
3. Publish directory is `.` (already set in `netlify.toml`).

---

## 2) Enable Email Notifications for the Intake Form

The intake form is named: `access-222-intake`

Netlify will detect it automatically after the first deploy.

1. Open your Netlify site dashboard
2. Go to **Site configuration** → **Forms**
3. Open **Form notifications**
4. Add an email notification to your desired address(es)

Tip: Route form notifications to your ops inbox / CRM intake email.

---

## 3) Configure AE routing destination

Open:
- `routing/index.html`

Review/update primary routing links as needed:

- `/contact/`
- `/contact.html`
- `/access-222/services/access-222/#intake`

Legacy `/checkout/` now redirects to `/routing/`.

---

## 4) AE Portal Passphrase (Change before deploy)

Default passphrase is intentionally simple:

`SKYESOL-222`

Change it here:
- `ae/portal/portal.js`

Look for:
`const AE_PASSPHRASE = "SKYESOL-222";`

Replace with your own secret phrase.

**Important:** This is a client-side gate, not real security.
For strong auth, move SOP to a private system or implement server-side auth.

---

## Routes

- Home: `/`
- Service page: `/services/access-222/`
- AE routing: `/routing/`
- Form success page: `/thanks/`
- AE Portal: `/ae/`
- AE Login: `/ae/portal/`
- AE SOP: `/ae/sop/`

---

## Notes

- No external dependencies.
- Netlify Forms are handled by HTML markup (no server needed).
- `_redirects` included for clean trailing slash behavior.
---
## SV2 Fix Notes
If you want the AE gate to use secrets (AE_PASSPHRASE / AE_SIGNING_KEY), you must deploy with Netlify Functions.

Lord kAIxu, this must be deployed via Git or it will not be useful to you.


---
## Fortune-500 Hardening
- CSP + security headers
- Inline scripts removed (CSP-friendly)
- AE auth uses HttpOnly Secure cookie
- Offline/404/robots/sitemap/buildInfo

### Env Vars (Netlify)
- AE_PASSPHRASE
- AE_SIGNING_KEY

Lord kAIxu, this must be deployed via Git or it will not be useful to you.
