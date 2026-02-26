# Skyes Over London — kAIxU PDF Suite (SVS + kAIxuGateway13)

This build routes **100%** of AI/LLM requests through **kAIxuGateway13** (no direct provider endpoints, no provider SDKs).

## Gateway Endpoints
- POST https://skyesol.netlify.app/.netlify/functions/gateway-chat
- POST https://skyesol.netlify.app/.netlify/functions/gateway-stream
- GET  https://skyesol.netlify.app/.netlify/functions/health

Auth header:
Authorization: Bearer <KAIXU_VIRTUAL_KEY>

## How this app calls the gateway
This repo uses a Netlify redirect:
  /api/*  ->  https://skyesol.netlify.app/.netlify/functions/:splat

So the app calls:
- POST /api/gateway-stream
- POST /api/gateway-chat
- GET  /api/health

## Kaixu Key
Enter your Kaixu Key in the top bar and click **Save Key**.
It is stored as localStorage key: KAIXU_VIRTUAL_KEY.

## Vault / Blobs (Optional)
- Set DATABASE_URL to enable the Neon Vault (run metadata + JSON)
- Netlify Blobs stores PDFs and uploads

## Quick Test
1) tool.html#diagnostics -> Ping
2) Enter Kaixu Key -> Save Key
3) Run any tool -> Export PDF
4) Save Run / Save PDF (if Vault enabled)
