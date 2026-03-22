# Netlify Functions Env Allowlist (Gateway 13)

This site currently fails function deploys because total function env exceeds AWS Lambda 4KB limit.

Use this as a **keep-only** allowlist for function runtime env vars in Netlify UI.

## Keep (required for Gateway 13 login + core API)
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `DB_ENCRYPTION_KEY` (or rely on `JWT_SECRET` fallback)
- `NEON_DATABASE_URL`
- `DATABASE_URL` (optional fallback)
- `NETLIFY_DATABASE_URL` (optional fallback)
- `ALLOWED_ORIGINS`
- `KEY_PEPPER`
- internal provider credentials (if using external model lanes)

Netlify-specific notes:
- Netlify Blobs does not need a manual env var in this build.
- Netlify Identity does not need an env var, but it must be enabled in site settings.
- Identity roles for this site are `president`, `vp`, `cfo`, `team_owner`, `player`.

## Keep (if using Stripe billing)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_CURRENCY`

## Keep (if using push deploys to Netlify)
- `NETLIFY_AUTH_TOKEN`

## Keep (if using GitHub OAuth/push features)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL`
- `GITHUB_API_BASE` (optional; defaults in code)
- `GITHUB_API_VERSION` (optional; defaults in code)

## Keep (if using async job worker security)
- `JOB_WORKER_SECRET`

## Keep (if using Twilio voice)
- `TWILIO_AUTH_TOKEN`
- `VOICE_FALLBACK_TRANSFER_NUMBER` (optional)

## Safe to remove first (runtime)
These have in-code defaults or are non-critical for login/core API:
- `DEFAULT_CUSTOMER_CAP_CENTS`
- `DEFAULT_RPM_LIMIT`
- `DEFAULT_SELFSERVE_CAP_CENTS`
- `DEFAULT_SELFSERVE_MAX_DEVICES`
- `DEFAULT_SELFSERVE_PLAN`
- `DEFAULT_SELFSERVE_RPM`
- `CAP_WARN_PCT`
- `USER_SESSION_TTL_SECONDS`
- `MONITOR_RETENTION_DAYS`
- `MONITOR_HISTORY_CAP`
- `MONITOR_ARCHIVE_BATCH_SIZE`
- `MONITOR_ARCHIVE_MAX_BATCHES`
- `MONITOR_ARCHIVE_STORE`
- `PUSH_CHUNK_RETENTION_HOURS`
- `GITHUB_CHUNK_RETENTION_HOURS`
- `VOICE_AI_RELAY_USD_PER_MIN`
- `VOICE_TELEPHONY_USD_PER_MIN`
- `VOICE_RECORDING_USD_PER_MIN`
- `VOICE_MARKUP_PCT`
- `PUBLIC_APP_ORIGIN`
- `CLIENT_ERROR_TOKEN` (only needed if you actively validate client-error reports)

## Duplicate / suspicious keys to remove
- `Demonkey` (mixed-case duplicate style)
- `DEMONKEY` (remove unless intentionally used)

## Fast recovery procedure
1. Netlify UI -> Site configuration -> Environment variables.
2. Export current vars for backup.
3. Remove everything not in Keep sections above.
4. Re-run deploy.
5. If deploy succeeds, re-add optional vars one small group at a time.

## Why this works
AWS Lambda enforces a hard 4KB env payload per function. Netlify function creation fails if the merged function env exceeds that limit.
