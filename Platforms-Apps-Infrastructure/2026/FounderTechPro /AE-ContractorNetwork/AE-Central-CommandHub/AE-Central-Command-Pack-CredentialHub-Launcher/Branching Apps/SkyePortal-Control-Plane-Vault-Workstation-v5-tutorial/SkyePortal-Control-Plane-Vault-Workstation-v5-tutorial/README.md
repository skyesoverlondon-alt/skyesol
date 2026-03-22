# SkyePortal Control Plane — Vault Workstation

This pass hardens the vault into a more serious offline workstation.

What changed:
- Encrypted offline documents lane with folders, status, tags, pinning, export, and starter templates
- Encrypted local file locker using IndexedDB + WebCrypto, with preview/download/edit metadata flows
- Device inventory lane for owner, serial, asset tag, OS, IP, location, warranty, and linked files
- Search now covers documents, files, devices, contacts, notes, tasks, env profiles, apps, and projects
- Recovery bundle now includes the encrypted vault, snapshot history, and encrypted file store
- Dashboard now surfaces document counts, file counts, device counts, storage usage, and quick watchlists

## Core reality
The vault core works offline:
- documents
- files and attachments
- device inventory
- contacts
- notes
- tasks
- search
- snapshots
- restore flow
- recovery bundle export/import

The Broker lane still requires the Netlify Functions in this repo to be deployed online.

## Storage model
Structured workstation data stays in one encrypted vault payload.
Local file attachments are stored in a separate encrypted IndexedDB store so they can be downloaded and previewed without exposing them in plain text storage.

## Recovery bundle format
The export button now creates an encrypted recovery bundle with:
- current vault meta/sealed payload
- local snapshots
- encrypted file store records
- bundle metadata and stats

The payload stays encrypted. Import restores the workstation without exposing secrets.

## Deploy notes
### Static / offline core
You can open this as a local/static app or deploy it as a normal static site and still use the offline-first workstation features.

### Broker / rules deployment lane
To use these server-side features you still need the functions deployed:
- `/.netlify/functions/mint`
- `/.netlify/functions/config`
- `/.netlify/functions/deployRules`

Required env vars remain:
- `VAULT_SIGNING_SECRET`
- `VAULT_APP_SECRETS`
- `VAULT_GOOGLE_SA_JSON`

Optional:
- `VAULT_TOKEN_TTL_SECONDS`
- `VAULT_PUBLIC_CONFIG_JSON`

## Local dev
```bash
npm install
npx netlify dev
```

If you only care about the offline workstation surface, any static server is enough.


## Tutorial Walkthrough

This build includes a guided in-app walkthrough available from the topbar, dashboard, and settings. The tour moves through the dashboard, documents, files, devices, projects, search, backups, and settings lanes and can auto-open on unlock until the user finishes it.
