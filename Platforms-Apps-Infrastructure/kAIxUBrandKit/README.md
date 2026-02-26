# SkyesOverLondon Brand Kit + kAIxU (Netlify)

This repo deploys a single-page Brand Identity Kit (two export cards) with a **kAIxU Studio** panel.
Your kAIxU key stays server-side using Netlify Functions.

## Deploy (required)
This project uses Netlify Functions. Deploy via Git (Netlify connected to your repo). Drag-and-drop will not run functions.

## Netlify Environment Variables
Set in Netlify:
- `KAIXU_VIRTUAL_KEY` = your kAIxU key (server-side only)
- `KAIXU_GATEWAY_BASE` = your Gateway13 site origin (example: `https://skyesol.netlify.app`)

Back-compat:
- `KAIXU_API_KEY` is accepted if `KAIXU_VIRTUAL_KEY` is not set.

Optional:
- `KAIXU_MODEL` = override server-side model selection

## File layout
- `index.html`
- `netlify.toml`
- `netlify/functions/kaixu-generate.js`
- `netlify/functions/client-error-report.js`

## Notes
- If logo URL export has cross-origin issues, upload the logo file instead (best).
- Client-side errors are posted to `/.netlify/functions/client-error-report` for logging.
