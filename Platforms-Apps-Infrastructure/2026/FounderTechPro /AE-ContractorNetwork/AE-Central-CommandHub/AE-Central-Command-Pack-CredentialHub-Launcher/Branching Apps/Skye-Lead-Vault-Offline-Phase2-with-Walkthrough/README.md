# Skye Lead Vault — Offline Phase 2

This pass upgrades the vault into a fuller offline field app.

Implemented in this build:
- Smart duplicate detection by business/email/phone/location
- Local lead scoring engine with rescore-all
- Follow-up scheduling with due/overdue queue
- Activity timeline per lead
- Contact relationship mapping inside each lead dossier
- Quick capture mode for field work
- Offline route and territory planning
- Local document vault per lead
- Encrypted backup export (AES-GCM passphrase)
- Restore preview with merge restore or replace restore
- Saved views / filter presets
- Offer and quote builder templates
- Script pack generator
- Dead-lead recovery lane
- Multiple record layouts: table, cards, dossier
- Voice notes when browser support exists
- Mini analytics dashboard
- Daily command center
- App lock / privacy mode
- Portable lead pack export

Important limits for the static offline build:
- Notifications depend on browser support and permission, and are most reliable while the app is open or installed.
- The document vault is designed for lightweight field files, not giant archives. Large files can exhaust browser storage.
- This package is fully static and drop-ready. No backend, no keys, no cloud sync required.

Open `index.html` and install it as a PWA where supported.
