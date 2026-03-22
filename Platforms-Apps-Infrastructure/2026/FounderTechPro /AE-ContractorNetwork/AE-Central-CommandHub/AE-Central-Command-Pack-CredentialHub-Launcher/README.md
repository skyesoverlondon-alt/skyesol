# AE Central Command Pack featuring the Credential Hub Launcher

Offline-first AE command shell with:
- Credential Hub Launcher landing page that links the built-in credential lanes, the AE Central Command Pack guide, the Connected Ops Pack guide, and bundled branch apps
- AE Command Pack page that merges the free field stack, intake stack, event stack, and closer-upgrade overview
- royal-blue-and-gold glass UI shell separated from the background stage
- custom background upload
- bundled founder + SkyDexia art presets
- contacts hub with CSV import/export
- relationship timeline per contact
- credentials vault
- projects
- notes
- backup / restore
- optional local access-code lock
- installable PWA
- dedicated Tutorial page + guided walkthrough overlay
- sitemap page for the full package layout

## Run locally for proper offline/PWA behavior
Use a real local server instead of opening `index.html` with `file://`.

### Python
```bash
python3 -m http.server 8080
```

Then open:
`http://localhost:8080`

## Files
- `index.html` — main app shell
- `pages/` — injected page partials, including Launcher, AE Command Pack, and Sitemap
- `assets/styles.css` — royal-blue-and-gold glass UI and layout styles
- `assets/app.js` — app logic
- `manifest.json` — PWA manifest
- `sw.js` — offline cache worker
- `assets/` — founder/logo artwork

- Connected Ops Pack editorial page for Skye Lead Vault and Skye Split Engine Ops
- Bundled connected apps: Skye Lead Vault and Skye Split Engine Ops

- Service Master Pack guide page for payment methodology, recurring revenue, AI-usage uplift, and offer selection
- Bundled Service Master Pack under Branching Apps/ae-service-pack-master
