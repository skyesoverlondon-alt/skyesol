# Skye-OfferForge — SkyDexia Offline Upgrade

This build is self-contained and drop-ready as a static offline-first app.

What changed:
- multi-page shell with physical nav on every page
- SkyDexia logo + founder image integrated locally
- updated PWA icon set using the Skyes Over London deity logo
- contact vault
- offer studio with pricing, taxes, discounts, deposits, milestones
- local attachment vault for contacts and offers
- support for screenshots, images, PDFs, ZIP proof packs, and general files
- attachment manifest export per contact or offer
- proof pack builder that turns selected local files plus notes/metadata into one self-contained downloadable HTML case file
- template forge
- follow-up desk
- document output with print/download HTML
- backup center with JSON export, AES-GCM encrypted export, restore, CSV export, rolling snapshots
- full backup packages now include local attachments
- visual settings with custom background image and glass controls
- built-in walkthrough tutorial page with local checklist progress
- service worker + manifest for installable PWA use

How to use:
1. Open `index.html` in a browser, or deploy the folder as a static site.
2. For best offline/PWA behavior, serve it from a local/static web server or deploy it.
3. Open Settings to set your business defaults and background image.
4. Save a contact or offer once, then use its attachment vault to add local files.
5. Use the Proof Pack Builder inside any saved contact or offer to bundle selected evidence into one offline HTML case file.
6. Open Walkthrough to follow the built-in onboarding lane and check off each completed step.
7. Use Backup Center to create a JSON or locked backup before major edits.

Notes:
- There are no remote APIs or third-party CDNs in this build.
- Background image is stored locally in the browser workspace.
- Attachments are stored locally in IndexedDB inside the browser.
- Proof pack case files can also be saved back into the record vault as local HTML evidence files.
- Encrypted backup uses browser Web Crypto. Keep the passphrase safe.
- Rolling snapshots protect workspace data, while full JSON/locked backups protect workspace data plus attachment files.
