# WebPile Pro Enterprise — Fortune 500 Neon Edition (Netlify + Neon)

This is the Neon/Postgres-backed version of WebPile Pro Enterprise.

What you get (Fortune-500 baseline controls):
- Cloud persistence (multi-device) via **Neon Postgres**
- Netlify Functions API router (`/api/*`)
- Org + user accounts (email/password) with RBAC (`owner/admin/member`)
- **HttpOnly** session cookies (JWT) + **CSRF** token (double-submit)
- **Distributed rate limiting** (Postgres-backed) with auth-specific tighter limits
- **Account hardening**: login lockout after repeated failures, global session revocation via `token_version`
- **Email verification + password reset** (tokens stored hashed; delivery via DB `email_outbox` integration point)
- Project CRUD + file sync (upsert + delete missing paths) — **org-scoped write hotfix**
- Snapshots stored server-side (`snapshots` table)
- Immutable audit log trail (`audit_logs` table)
- SPA 404 fallback + security headers via `netlify.toml`

---

## 1) Create Neon DB + run schema

1. Create a Neon project + database.
2. Copy your connection string.
3. Open Neon **SQL Editor** and run: `schema.sql`

Notes:
- `schema.sql` is safe to re-run: it contains `ALTER TABLE ... IF NOT EXISTS` upgrades and creates the new token/rate-limit/outbox tables.

---

## 2) Deploy on Netlify (Drop)

Project root contains:
- `index.html`
- `netlify.toml`
- `schema.sql`
- `netlify/functions/api.mjs`
- `package.json`
- `.env.example`

Deploy:
1. Unzip into a folder.
2. Netlify → Add new site → Deploy manually (or Netlify Drop) → upload the folder.

---

## 3) Set Netlify Environment Variables

In Netlify → Site settings → Environment variables, add:

Required:
- `NEON_DATABASE_URL` — Neon connection string
- `APP_JWT_SECRET` — long random secret

Strongly recommended:
- `ORIGIN_ALLOWLIST` — comma-separated allowed origins (supports `https://*.netlify.app`)
- `RATE_LIMIT_MODE=db`
- `RATE_LIMIT_PER_MINUTE=120`
- `AUTH_RATE_LIMIT_PER_MINUTE=30`
- `LOGIN_MAX_ATTEMPTS=10`
- `LOGIN_LOCK_MINUTES=15`
- `MAIL_MODE=outbox` (prod-friendly) or `MAIL_MODE=dev` (returns tokens in API responses for faster testing)
- `APP_BASE_URL=https://YOUR-SITE.netlify.app` (used to construct email links)

Optional:
- `REQUIRE_EMAIL_VERIFICATION=true` (blocks project writes until verified)
- `COOKIE_SECURE=true` (set `false` only for localhost HTTP testing)

Use `.env.example` as a template.

---

## 4) Email verification + password reset

This build does **not** send emails directly (that’s a vendor choice). It queues messages into Neon:

- Table: `email_outbox`

Production wiring:
- Connect `email_outbox` to SES/SendGrid/Postmark/etc. (a separate worker/function can read pending rows and send).

Dev workflow:
- Set `MAIL_MODE=dev` → API responses include `dev.verifyUrl` or `dev.resetUrl`.

Outbox workflow:
- Keep `MAIL_MODE=outbox`
- After register/resend/reset requests, open Neon SQL Editor and run:
  - `SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 20;`
- Copy the link from the `body` field.

---

## 5) Org switching

- Endpoint: `POST /api/auth/switch-org`
- UI: Account modal shows org selector and switches your session cookie to the selected org.

---

## 6) Security notes

- Sessions are JWTs stored in **HttpOnly** cookies with CSRF protection.
- `token_version` is checked on every authenticated request (password reset revokes all sessions).
- Project file sync is org-scoped (prevents cross-tenant writes).
- Netlify adds baseline security headers (CSP, HSTS, nosniff, etc.) via `netlify.toml`.

---

## API Routes (quick list)

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/me`
- `GET  /api/auth/orgs`
- `POST /api/auth/switch-org`
- `POST /api/auth/resend-verification`
- `POST /api/auth/verify-email`
- `POST /api/auth/request-reset`
- `POST /api/auth/reset`

Projects:
- `GET  /api/projects`
- `POST /api/projects`
- `GET  /api/projects/:id`
- `PUT  /api/projects/:id`
- `DELETE /api/projects/:id`

Snapshots:
- `GET  /api/projects/:id/snapshots`
- `POST /api/projects/:id/snapshots`
- `GET  /api/snapshots/:id`
- `DELETE /api/snapshots/:id`

Audit (admin/owner):
- `GET /api/audit?limit=50`

---

## Next hardening (true enterprise buyers)

- OIDC SSO (Entra/Okta) + SAML (optional) + SCIM provisioning
- MFA (IdP-driven is preferred)
- CI + tests + CodeQL + secret scanning + lockfile + SBOM
- Observability: structured logs, metrics, alerts (e.g., Logtail/Sentry/Datadog)

## CI & Supply Chain (Fortune-500 baseline)

This repo includes:
- `package-lock.json` for deterministic installs (`npm ci`).
- GitHub Actions workflows: CI, CodeQL, and secret scanning (Gitleaks).
- SBOM generator (`npm run sbom`) producing `sbom.cdx.json` (CycloneDX 1.5).

If you use a different CI provider, mirror these checks there.



## CI / Supply-chain (Fortune-500 gate)
This repo ships with:

- Deterministic installs: `package-lock.json` + `npm ci`
- CI workflow: `.github/workflows/ci.yml`
- CodeQL SAST: `.github/workflows/codeql.yml`
- Secret scanning (Gitleaks): `.github/workflows/secret-scan.yml`
- Dependabot: `.github/dependabot.yml`
- SBOM generator: `tools/sbom.mjs` (CycloneDX JSON -> `sbom.cdx.json` + `sbom.cdx.json.sha256`)
- SBOM signing + verification: `tools/sbom-sign.mjs` / `tools/sbom-verify.mjs`

### SBOM signing keys (required in CI)
Set GitHub secrets:

- `SBOM_SIGNING_PRIVATE_KEY_PEM` (Ed25519 private key PEM)
- `SBOM_SIGNING_PUBLIC_KEY_PEM`  (Ed25519 public key PEM)

CI will fail on `main` if these keys are missing (hard gate).

Generate keys (example):
```bash
# Ed25519 keypair
openssl genpkey -algorithm ed25519 -out sbom_signing_private.pem
openssl pkey -in sbom_signing_private.pem -pubout -out sbom_signing_public.pem
```

## SSO (OIDC) — minimal enterprise baseline
Owners/Admins can configure OIDC per org via API:

- `GET /api/admin/oidc`
- `PUT /api/admin/oidc` body: `{ issuerUrl, clientId, clientSecret, scopes }`

SSO flow:
- Start: `GET /api/oidc/start?orgId=<ORG_UUID>&next=/`
- Callback: `/api/oidc/callback` (handled by the function)

Note: this implementation uses the OIDC **userinfo endpoint** to retrieve email. Signature verification of `id_token` is not performed in this minimal build; for regulated buyers, add JWKS verification.

## SCIM 2.0 — minimal provisioning
Create a SCIM bearer token (owner/admin):
- `POST /api/admin/scim/tokens` body: `{ name }` → returns one-time `token`
- List tokens: `GET /api/admin/scim/tokens`

SCIM endpoints (bearer token):
- `GET /api/scim/v2/ServiceProviderConfig`
- `GET/POST /api/scim/v2/Users`
- `GET/PATCH/PUT/DELETE /api/scim/v2/Users/:id`

Deprovision behavior:
- `active=false` sets membership inactive and increments `users.token_version` to revoke sessions.


## Staging / Production split (recommended)
Enterprises expect separate environments.

- Production: `APP_ENV=production` and a dedicated Neon DB (`NEON_DATABASE_URL`)
- Staging: `APP_ENV=staging` and a dedicated Neon DB (`NEON_DATABASE_URL_STAGING`)
- Preview: `APP_ENV=preview` and optional dedicated Neon DB (`NEON_DATABASE_URL_PREVIEW`)

### Netlify setup
Use **Netlify UI** to set different env var values per context:
- Production context: set `NEON_DATABASE_URL` to your prod Neon connection string.
- Branch deploy (staging): set `NEON_DATABASE_URL_STAGING` to your staging Neon string.
- Deploy preview: set `NEON_DATABASE_URL_PREVIEW` (or omit; preview can run in-memory rate-limit mode).

The code selects the correct DB URL based on `APP_ENV`.


## SCIM Groups + ETags
This build adds SCIM Groups:

- `GET/POST /api/scim/v2/Groups`
- `GET/PATCH/PUT/DELETE /api/scim/v2/Groups/:id`

ETags:
- User and Group read responses return `ETag: W/"..."` and `meta.version`.
- Update/Delete support `If-Match` for optimistic concurrency. If the ETag doesn't match, the API returns `412` (SCIM error).

## OIDC nonce + JWKS cache hardening
- The OIDC auth request includes `nonce`, stored in `oidc_states`.
- Callback verifies the `id_token` nonce matches (prevents token replay across auth flows).
- JWKS is cached in DB (`jwks_cache`) with ETag + expiry and has key-rotation retry logic:
  - if `kid` isn't found or signature fails, the server forces a JWKS refresh and retries once.


## SCIM Bulk
Some IdPs probe Bulk even when `ServiceProviderConfig.bulk.supported=false`.

This build implements a **minimal Bulk** endpoint:
- `POST /api/scim/v2/Bulk`

Supported operations:
- `POST /Users`, `PATCH/PUT/DELETE /Users/:id`
- `POST /Groups`, `PATCH/PUT/DELETE /Groups/:id`

Unsupported operations return per-operation `501` inside `BulkResponse`.

## SCIM Group filter: members.value
Groups list supports:
- `filter=members.value eq "<USER_UUID>"`

This returns groups containing that user, which fixes common IdP behaviors.


## SCIM advanced filters
This build supports SCIM filters with:
- operators: `eq`, `co` (contains), `sw` (startsWith), `ew` (endsWith), `pr` (present)
- boolean: `active eq true|false`
- logic: `and`, `or`
- grouping: parentheses

## Group member pagination
- `GET /api/scim/v2/Groups/<GROUP_UUID>?startIndex=1&count=200` (paginates the embedded members array)
- `GET /api/scim/v2/Groups/<GROUP_UUID>/members?startIndex=1&count=200` (ListResponse of members)


## SCIM sortBy / sortOrder
List endpoints accept optional sorting:

- Users: `sortBy=userName|id|meta.lastModified|meta.created`, `sortOrder=ascending|descending`
- Groups: `sortBy=displayName|id|meta.lastModified|meta.created`, `sortOrder=ascending|descending`

Sorting is allowlisted (no arbitrary SQL).

## Bracket filter comparisons (emails[...])
This app stores a single email. For compatibility:

Accepted:
- `emails[value <op> "..."]` where `<op>` is `eq|ne|co|sw|ew|pr`
- `emails[type eq "work" and value <op> "..."]` (type is treated as a no-op constraint)

Rejected (honest behavior):
- `emails[type ne "work" ...]` and other type comparisons that cannot be modeled with a single stored email
- OR/not inside `emails[...]` bracket filters


## Multi-email storage (RFC7644 accurate)
This build adds `user_emails` so SCIM filters like:
- `emails[type ne "work" and value co "example.com"]`
can be evaluated truthfully.

Rules:
- `users.email` remains the canonical login identifier.
- `user_emails` stores all SCIM emails with `primary_email=true` for the canonical email.
- SCIM PATCH/PUT maintains consistency: primary selection syncs `users.email`.


## SCIM user emails pagination (for picky IdPs)
- `GET /api/scim/v2/Users/<USER_UUID>/emails?startIndex=1&count=50`

## SCIM user list optional emails arrays
Enable per-user paginated `emails` arrays in `/Users` list:
- `GET /api/scim/v2/Users?includeEmails=1&emailsStartIndex=1&emailsCount=10`


## RLS (Row-Level Security)
This repo includes `rls.sql` (optional). When enabled, Postgres enforces org isolation even if app code has a bug.

To enable:
1) Set `ENABLE_RLS=true`
2) Apply `rls.sql` to your Neon DB
3) Confirm the app sets `app.org_id` via `set_config()` per request (this build does).

## SAML (minimal enterprise SSO)
This build includes minimal SAML endpoints and config storage:
- Admin: `GET/PUT /api/admin/saml`
- SSO start: `GET /api/saml/start?orgId=<ORG_UUID>&next=/`
- ACS: `POST /api/saml/acs` (SAMLResponse)
- Metadata: `GET /api/saml/metadata?orgId=<ORG_UUID>`

Note: the implementation focuses on secure defaults (RSA-SHA256, strict issuer/audience/time checks). If you need full algorithm coverage
and complex transform chains, add dedicated XML canonicalization tooling.

## SIEM outbox (durable delivery)
Config:
- Admin: `GET/PUT /api/admin/siem`
Delivery:
- Scheduled function: `/.netlify/functions/siem_deliver` (processes due events)
- Manual: `POST /api/siem/deliver` (admin)

Outbox is durable in Neon and designed for retries + idempotency.

## Signed releases
- SBOM signing is already enforced in CI.
- This build adds signed release manifests + release workflow on tags (`.github/workflows/release.yml`).

GitHub secrets required:
- `RELEASE_SIGNING_PRIVATE_KEY_PEM`
- `RELEASE_SIGNING_PUBLIC_KEY_PEM`


## External metrics exporter (Prometheus)
- `GET /api/metrics/prometheus` returns Prometheus exposition format for `metrics_counters`.

## SAML signature transforms (expanded)
SAML signature verification now includes:
- Reference digest validation (URI="#...") with common transforms:
  - enveloped-signature removal
  - canonicalization (best-effort, dependency-free)
- SignatureValue verification over canonical SignedInfo with algorithm allowlist.
