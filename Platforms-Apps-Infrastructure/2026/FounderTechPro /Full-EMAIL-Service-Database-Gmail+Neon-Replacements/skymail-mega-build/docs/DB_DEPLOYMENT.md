# Deployment

## 1. PostgreSQL on Hetzner

Bring up the VM with the files in `infra/hetzner/`.

The VM still runs:

- PostgreSQL
- the privileged runner service

Apply:

- `database/control-schema.sql`
- optionally `database/sample-seed.sql`

## 2. Cloudflare Worker

Copy `workers/control-plane/wrangler.toml.example` to `wrangler.toml` and set:

- `CORS_ORIGIN`
- `PUBLIC_DB_HOST`
- `PUBLIC_DB_PORT`
- `PUBLIC_DB_SSLMODE`
- `SUPERADMIN_EMAILS`

Secrets to set:

- `BOOTSTRAP_ADMIN_TOKEN`
- `NETLIFY_IDENTITY_JWT_SECRET`
- `APP_ENCRYPTION_KEY`
- `DATABASE_URL` or Hyperdrive binding

## 3. Netlify admin app

Deploy `apps/admin/` as a static site.

Turn on Netlify Identity if you want real member login.

The dashboard stores:

- Worker API base URL
- optional bootstrap token

locally in browser storage.

## 4. First bootstrap

1. Open the dashboard
2. Set the Worker API URL
3. Use either bootstrap token or Netlify Identity login
4. Click **Sync account**
5. If needed, click **Sync + create personal workspace**
6. Create orgs, members, projects, environments, and databases

## 5. Recommended operator settings

- populate `SUPERADMIN_EMAILS` with your operator emails
- use bootstrap token only for initial recovery / bring-up
- invite clients through Netlify Identity or create memberships manually first
- rotate the bootstrap token after first successful operator login


## Public onboarding app

Deploy `apps/public/` as a Netlify static site or serve it from the same frontend host as the admin app. Point it at the Worker API base. The page stores the pending signup token in localStorage and forwards it into `apps/admin/` so first auth sync activates the workspace.
