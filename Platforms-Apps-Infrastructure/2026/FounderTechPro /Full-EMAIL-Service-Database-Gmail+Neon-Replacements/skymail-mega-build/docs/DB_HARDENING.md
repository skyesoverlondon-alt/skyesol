# Hardening Checklist

## Database host

- Use a dedicated Hetzner project for SkyeDB.
- Turn on Hetzner backups.
- Use separate volumes/snapshots for PostgreSQL data.
- Keep PostgreSQL on a recent major version.
- Enforce `ssl = on` and SCRAM auth.
- Restrict port exposure as tightly as possible.
- Rotate the superuser password after bootstrap.

## Cloudflare

- Use Hyperdrive for the Worker database path.
- Store Worker secrets with `wrangler secret put`.
- Put the Worker behind Cloudflare Access if the admin app is private.
- Add rate limiting and bot filtering before broader customer exposure.

## Netlify

- Enable Netlify Identity if you want browser-native login.
- Limit registration to invite-only for admin use.
- Set the admin app to only trust your Worker URL.

## Runner

- Run the runner on the same host or same private network as PostgreSQL.
- Mount a temporary backup directory with enough free disk.
- Limit shell access on the VM.
- Keep the R2 token scoped only to the required bucket.

## Expansion lane

When you are ready, add:

- pgBouncer
- WAL-G or pgBackRest
- object-versioned R2 bucket
- periodic restore test job
- customer API keys and quotas
- billing/export lane
