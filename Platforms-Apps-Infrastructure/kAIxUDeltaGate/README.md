# kAIxu Neural Landing (V2) — Updated Implementation Directives

This folder is **Netlify Drop-ready** and contains:
- `index.html` — Three.js neural landing page (fully branded) with the directive visible on-page.
- `kAIxu_Gateway_Implementation_Directives_2026.pdf` — Branded, word-for-word PDF generated from `Implementation Directives.txt`.

## Deploy
1) Drag-and-drop this folder into Netlify Drop (or deploy via Git).
2) Keep the PDF in the same directory as `index.html` so the embed works.

## Notes
- The health badge attempts `GET https://kaixu67.skyesoverlondon.workers.dev/v1/health` from the browser.
  If it shows **CORS blocked**, that's normal when the gateway doesn't allow cross-origin browser calls.
  Use the curl examples inside the directive for validation instead.

*kAIxu Gateway — Skyes Over London LC — 2026*
