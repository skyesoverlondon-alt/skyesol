# Project Guidelines

## No-Memory Quick Commands
- Menu fix request: `Follow nav-menu-safety and fix top-right header MENU only.`
- Redirect edits: `/safe-redirect-edit <exact route change>`
- Release checks: `@Release Guard pre-release check`
- Local server: `netlify dev`

## Build and Test
- Install dependencies: `npm install`
- Build (generates site menu): `npm run build`
- Generate sitemap: `npm run gen-sitemap`
- Internal link checks: `npm run link-check` and `npm run link-check:fix`
- Internal link audit: `npm run audit:internal-links`
- Meta template apply/check: `npm run meta:apply` and `npm run meta:check`
- Local dev with Functions: `netlify dev`

### Mandatory Netlify Function Preflight (Do Not Skip)
- Before any commit/push that touches functions, gateway docs, or endpoint references, run: `npm run build`.
- `npm run build` must pass with: `[functions-audit] OK` and no missing endpoints.
- If any function imports a package (example: `bcryptjs`, `jsonwebtoken`, `cookie`, `pg`, `yauzl`), that package must exist in root `package.json` dependencies and `package-lock.json`.
- For deploy errors from Netlify, do read-only diagnosis first, identify all blockers, then apply minimal fixes in one batch to avoid repeated failed deploys.
- Never ship after a partial fix when there are known unresolved blockers.

## Architecture
- Root is a multi-page static site with shared assets in `assets/` and `css/`.
- Serverless backend lives in `netlify/functions/` with shared helpers in `netlify/functions/_lib/` and `_common.mjs`.
- Main product layers:
  - Blog/CMS via Netlify Blobs
  - Vault/admin APIs via Netlify Functions + auth
  - Monitoring/status APIs
- Multiple subapps live under `Platforms-Apps-Infrastructure/` and may have their own local conventions.

## Conventions
- Prefer existing function wrapper/util patterns before adding new endpoint plumbing:
  - Error/response wrappers from `_lib/wrap.js`
  - CORS/JSON helpers from `_lib/http.js`
- Use environment variables from `env.template`; do not hardcode secrets.
- Keep changes minimal and scoped; avoid broad structural rewrites unless requested.
- For menu/nav behavior changes, validate JS and authored HTML interaction before editing multiple files.

## Deployment and Runtime Guardrails
- Critical: `netlify.toml` must keep `[functions].directory = "netlify/functions"`.
- Many APIs depend on `/.netlify/functions/*`; changing function directory breaks auth and gateway routes.
- Service worker and manifest headers in `netlify.toml`/`_headers` are intentional; do not relax caching casually.

## Redirect and URL Pitfalls
- `_redirects` includes many encoded and case-sensitive paths (`%20`, folder names with spaces).
- Preserve 200 rewrites vs 301 redirects semantics when editing routing rules.

## Useful References
- Root docs: `README.md`
- Runtime config: `netlify.toml`, `_headers`, `_redirects`
- Shared function utilities: `netlify/functions/_common.mjs`, `netlify/functions/_lib/http.js`, `netlify/functions/_lib/wrap.js`
- Build scripts: `scripts/`
