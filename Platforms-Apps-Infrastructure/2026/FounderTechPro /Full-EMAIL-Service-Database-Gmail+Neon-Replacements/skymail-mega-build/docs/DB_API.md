# API Surface

All endpoints are rooted at `/v1`.

## Public / bootstrap

- `GET /v1/health`
- `GET /v1/plans`
- `POST /v1/auth/sync`

## Organizations

- `GET /v1/orgs`
- `GET /v1/orgs/:id`
- `POST /v1/orgs`
- `POST /v1/orgs/:id/members`

## Projects and environments

- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/environments`
- `POST /v1/environments`

## Databases

- `GET /v1/databases`
- `GET /v1/databases/:id`
- `POST /v1/databases`
- `POST /v1/databases/:id/branch`
- `POST /v1/databases/:id/rotate-password`
- `POST /v1/databases/:id/backup`
- `POST /v1/databases/:id/restore`

## API keys

- `GET /v1/projects/:id/api-keys`
- `POST /v1/projects/:id/api-keys`

## Operations and reporting

- `GET /v1/jobs`
- `GET /v1/jobs/:id`
- `GET /v1/backups`
- `GET /v1/restores`
- `GET /v1/usage`
- `GET /v1/audit`

## Auth

Send one of these headers:

- `Authorization: Bearer <bootstrap-admin-token>`
- `Authorization: Bearer <netlify-identity-jwt>`

The Netlify Identity JWT path requires `NETLIFY_IDENTITY_JWT_SECRET` in the Worker.

## First-login flow

Call `POST /v1/auth/sync` after login.

If the user has no memberships yet, that route can auto-create:

- an org/workspace
- an owner membership
- a starter or internal plan subscription
- a default project
- a default production environment


## Billing + Public Onboarding Routes

- `GET /v1/public/plans`
- `POST /v1/public/signup`
- `GET /v1/public/signup/:token`
- `GET /v1/signups`
- `GET /v1/orgs/:id/billing`
- `POST /v1/orgs/:id/billing/subscription`
- `POST /v1/orgs/:id/billing/checkout-sessions`
- `POST /v1/orgs/:id/billing/invoices/:invoiceId/pay`
