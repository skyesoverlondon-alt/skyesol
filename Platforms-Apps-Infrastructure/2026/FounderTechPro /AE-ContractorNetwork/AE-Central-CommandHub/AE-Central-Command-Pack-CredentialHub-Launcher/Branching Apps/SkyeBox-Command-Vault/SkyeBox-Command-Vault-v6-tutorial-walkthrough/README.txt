SkyeBox Command Vault v5

Offline-first utility vault built from the SkyeBox-2FA shell and upgraded into a broader command hub.

New in this pass:
- Skyes Over London branding added directly into the app shell
- Built-in tutorial walkthrough with first-run guide modal and replayable tutorial deck
- Official logo integrated into the hero, tutorial deck, and app icons
- Founder visual integrated into the tutorial lane

Core lanes:
- Authenticator accounts with TOTP generation, URI import, batch import, edit, favorite, copy, export
- Contacts hub with search, tags, vCard export, CSV export, quick email and phone actions
- Secure notes with pinning, tags, export, copy, edit, delete
- Locker file vault using IndexedDB for offline file storage and retrieval
- Plain JSON backups and encrypted .skyebox backups
- Rolling local restore points
- Optional PIN lock with encrypted local state
- Custom background upload and glass UI settings
- Installable PWA shell when served from localhost or a normal web origin

Usage notes:
- The app is self-contained and can be opened directly, but best PWA caching/install behavior happens on localhost or a deployed origin rather than raw file://.
- Encrypted backup import requires the same PIN/passphrase used when the backup was created.
- Locker files are stored locally in the browser profile for that device/browser.
- The tutorial guide will auto-open on a fresh device profile until it is completed once.
