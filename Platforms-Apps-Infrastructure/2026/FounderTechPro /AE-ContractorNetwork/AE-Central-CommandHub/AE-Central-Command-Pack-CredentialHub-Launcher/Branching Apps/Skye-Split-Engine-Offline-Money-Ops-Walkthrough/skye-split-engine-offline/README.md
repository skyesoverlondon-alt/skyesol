# Skye Split Engine Ops

Offline-first money operations app for Skyes Over London.

Core lanes inside this build:
- Split Engine for payout math
- Recurring payout templates
- Deal ledger
- Settlement receipts
- Backup vault with plain JSON and encrypted exports
- CSV batch import/export for deals, templates, contacts, receipts, and split plans
- Theme/background controls with separate glass UI layer

Run locally:
1. Unzip the package.
2. Open `index.html` directly for normal offline use.
3. For service-worker install caching, serve the folder over a simple local server or deploy it as static hosting.

Data is stored in the browser with IndexedDB. Use Backup Vault regularly.


Walkthrough tutorial: open `walkthrough.html` for the guided setup and operational flow.
