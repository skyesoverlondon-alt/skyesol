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
3) Set environment variables:

ENV TEMPLATE:
```
ADMIN_EMAILS=you@domain.com,another@domain.com
BLOBS_STORE=sol_growth
MONITOR_HISTORY_CAP=120
```

`ADMIN_EMAILS` assigns the `admin` role automatically on login.

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



## Note on dependency installs
This project intentionally does **not** ship a package-lock.json to avoid lockfiles that reference non-public registries. Netlify will install @netlify/blobs from the public npm registry during deploy.
