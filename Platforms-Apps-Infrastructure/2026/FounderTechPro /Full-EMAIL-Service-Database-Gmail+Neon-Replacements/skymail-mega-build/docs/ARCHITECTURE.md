# Architecture

## Control plane
The database control plane stays as:
- Cloudflare Worker API
- Hetzner PostgreSQL cluster
- privileged runner for create / branch / rotate / backup / restore
- Netlify admin dashboard for operator control

## Mail plane
The mail plane is:
- Netlify customer-facing app
- Stalwart as mailbox authority
- IMAP / SMTP for mailbox operations
- PostgreSQL for app metadata, contacts, settings, account records, and mailbox linkage

## Separation of concerns
The database platform provisions and governs the PostgreSQL runtime.
The mail platform provisions and governs the mailbox runtime.

That means:
- SkyeDB owns PostgreSQL lifecycle
- Stalwart owns mailbox lifecycle
- SkyMail web app stitches them together into the sellable product surface
