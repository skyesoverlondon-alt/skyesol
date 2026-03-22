# SkyMail Web App

This app is the hosted-mail customer surface. It no longer depends on Gmail or SkyeDB.

What it does:
- lets a client sign up and claim a real mailbox on your hosted domains
- provisions the mailbox against Stalwart through the management API
- stores app/account/contact metadata in your own PostgreSQL runtime
- uses IMAP/SMTP for inbox, sent, drafts, trash, spam, thread view, and attachments
- runs cleanly against a SkyeDB-provisioned PostgreSQL instance on your own infrastructure

## Clean integration methodology

1. Bring up the SkyeDB control plane in this monorepo.
2. Provision a dedicated PostgreSQL instance for the mail app.
3. Apply `sql/schema.sql` to that instance.
4. Set `SKYMAIL_DATABASE_URL` in Netlify to the provisioned connection URI.
5. Set the Stalwart and domain env vars from `.env.template`.
6. Deploy this app directory through Git as its own Netlify site.

## Fastest bootstrap

From this app directory:

```bash
npm install
node tools/bootstrap-skymail-db.js
```

That script can:
- talk to your SkyeDB control plane
- create/find the org, project, environment, and database
- wait for the database job to become ready
- apply the SkyMail schema automatically

## Repo deploy target

Deploy `apps/skymail-web/` as the Netlify base directory.

## Important operating truth

This app is only live mail when all of the following are real:
- Stalwart server
- hosted mailbox domain(s)
- MX / SPF / DKIM / DMARC
- working `SKYMAIL_DATABASE_URL`
- Netlify Functions installed through Git deployment
