# Control Plane Worker

This Worker is the public API for SkyeDB.

## Environment

Required secrets / vars:

- `BOOTSTRAP_ADMIN_TOKEN`
- `APP_ENCRYPTION_KEY`
- `NETLIFY_IDENTITY_JWT_SECRET` (optional if you use bootstrap token only)
- `PUBLIC_DB_HOST`
- `PUBLIC_DB_PORT`
- `PUBLIC_DB_SSLMODE`
- Hyperdrive binding named `HYPERDRIVE`

## Commands

```bash
npm install
cp wrangler.toml.example wrangler.toml
npx wrangler deploy
```
