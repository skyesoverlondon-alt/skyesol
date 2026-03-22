# SkyMail Mega Build

This monorepo combines the hosted-mail platform and the owner-operated database platform into one clean build.

It replaces:
- **Gmail / Google mailbox dependency** with **your own Stalwart mail authority**
- **SkyeDB dependency** with **your own SkyeDB / Hetzner PostgreSQL control plane**

## Repo layout

- `apps/skymail-web/` → the actual customer-facing mail product
- `apps/platform-admin/` → owner/operator database control dashboard
- `apps/platform-public/` → public onboarding surface for the control plane
- `workers/control-plane/` → Cloudflare Worker API for your own database platform
- `services/runner/` → privileged Hetzner runner for database create / rotate / backup / restore jobs
- `infra/hetzner/` → server bootstrap and docker-compose for the control-plane backend
- `database/control-schema.sql` → SkyeDB control-plane schema
- `database/mail-platform.sql` → SkyMail app schema
- `database/combined-control-and-mail.sql` → one combined bootstrap file

## What is already combined cleanly

The mail app now expects a PostgreSQL runtime that you control. Its database adapter supports `SKYMAIL_DATABASE_URL` so the app can run on a database instance provisioned by your own SkyeDB control plane instead of SkyeDB.

The mailbox product path is fully own-infrastructure:
- user claims address
- Stalwart principal is created
- mailbox is accessed over IMAP/SMTP
- app state is stored in your PostgreSQL runtime
- Netlify is only the UI/serverless shell, not the source of truth

## Clear integration methodology

### 1) Bring up your database platform
Deploy:
- `workers/control-plane/` to Cloudflare Workers
- `apps/platform-admin/` to Netlify
- `services/runner/` + `infra/hetzner/` on your Hetzner host

Apply:
- `database/control-schema.sql`

### 2) Provision the SkyMail app database on your own platform
From `apps/skymail-web/`:

```bash
npm install
node tools/bootstrap-skymail-db.js
```

That script talks to your SkyeDB control plane, creates/finds the org/project/environment/database, waits for the database to become ready, applies the mail schema, and prints the connection URI you should place into Netlify as `SKYMAIL_DATABASE_URL`.

### 3) Bring up your mail authority
Stand up Stalwart and real mail DNS:
- MX
- SPF
- DKIM
- DMARC

### 4) Deploy the customer-facing product
Deploy `apps/skymail-web/` to Netlify through Git with the env vars in `.env.template`.

## What this gives you

A real product where people can:
- come to SkyMail
- sign up
- create their own hosted email address
- log in to a real inbox/sent/drafts/spam/trash experience
- send and receive mail
- manage contacts, signatures, profile, and mailbox password

while the full data path stays on infrastructure you control.
