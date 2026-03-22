# Skyes Over London LC — Growth Platform (Static + Blog/CMS + Gated Vault + Monitoring)

This project is a plain multi-page site **plus** a full “growth platform” layer:

- **Blog (CMS)** backed by **Netlify Blobs**
- **Gated Client Vault** backed by **Netlify Identity + Functions**
- **Portal inventory + Status page + Monitoring dashboard**

It is designed to keep working even if Functions are missing: public pages fall back to a friendly **read-only mode**.

## Folder layout

Core pages:
- `index.html`, `about.html`, `platforms.html`, `network.html`, `credibility.html`, `contact.html`
- `blog.html`, `post.html`
- `status.html`, `dashboard.html`
- `vault.html` (gated), `admin.html` (admin)
- `privacy.html`, `terms.html`

Platform components:
- `netlify/functions/*` (Blog API, Vault API, Portal inventory, Monitoring)
- `_headers` (security headers + CSP)
- `netlify.toml` (functions directory)

## Deploy modes

### Mode A — Quick static deploy (Netlify Drop)
This publishes the website immediately, but the growth platform APIs (Functions/Blobs/Identity) may not deploy.
In that case:
- Blog shows a seed post in read-only mode
- Status/Dashboard show “Functions not detected”
- Vault/Admin require Identity + Functions

### Mode B — Full Growth Platform deploy (recommended)
Use Netlify CLI so Functions ship correctly.

#### 1) Install prerequisites (one-time)
- Install Node.js (LTS)
- Install Netlify CLI:
  - `npm i -g netlify-cli`

#### 2) Configure Netlify (site settings)
1) Enable **Netlify Identity** for your site.
2) In Identity → Registration, decide if you want invite-only or open signup.
3) In Identity roles, use this Skyesol role set:
   - `president`
   - `vp`
   - `cfo`
   - `team_owner`
   - `player`
4) Set environment variables.

Minimum required database env:

```env
NEON_DATABASE_URL=postgres://...
```

Notes:
- `NEON_DATABASE_URL` is the only database env var you need for this build.
- `DATABASE_URL` and `NETLIFY_DATABASE_URL` are still accepted as fallbacks, but they are not the clean primary setup.
- Netlify Blobs does not require a manual env var in this build.
- Netlify Identity does not require an env var, but it must be enabled in Netlify site settings.
- `ADMIN_EMAILS` is optional. If you set it, matching emails are auto-granted the `president` role on Identity login.

Skyesol remains the single source of truth:
- shared Postgres tables live under the main Skyesol database
- Identity members and role grants sync into the same database
- intake submissions, vault data, and gateway/customer records stay in one backend instead of separate per-subsite stores

#### 3) Deploy
From this project folder:
1) `npm install`
2) `netlify login`
3) Link to your existing site (or create one):
   - `netlify init`
4) Deploy production:
   - `netlify deploy --prod`

## Notes
- Three.js is loaded from a CDN for the animated background.
- `404.html` redirects unknown routes to `/`.
- Blog/Vault content and monitoring results are stored in Netlify Blobs.
- Netlify Blobs is runtime-managed here; the default stores work without adding a manual blobs env var.



## Note on dependency installs
This project intentionally does **not** ship a package-lock.json to avoid lockfiles that reference non-public registries. Netlify will install @netlify/blobs from the public npm registry during deploy.
