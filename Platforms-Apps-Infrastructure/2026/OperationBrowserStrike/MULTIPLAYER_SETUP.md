# Operation Browser Strike Multiplayer Setup

## What You Need To Do For Multiplayer

This is the exact operator checklist for turning multiplayer on in production:

1. Deploy the relay folder to a WebSocket-capable host:
  - `Platforms-Apps-Infrastructure/2026/OperationBrowserStrike/realtime-relay`
  - Recommended hosts: Render, Fly.io, Railway, Cloudflare Workers/Durable Objects.
2. Set environment variables from `env.template` on that host:
  - `PORT`, `HOST`, `CORS_ORIGIN`, `MAX_CLIENTS_PER_ROOM`, `MAX_PACKETS_PER_SEC`, and especially `ROOM_SECRET`.
3. In the game UI, enter your deployed endpoint and shared room credentials:
  - `Realtime Server URL`: `wss://YOUR-RELAY-HOST/ws`
  - `Room`: same room value for all players in that session
  - `Room Token`: must match `ROOM_SECRET` when auth is enabled
4. Confirm all clients use the same room + token before launch.
5. Validate with at least two clients and verify position updates both ways.

Current repo state in this workflow:

- All changes are staged.
- No commit has been created.
- No push has been performed.

## What is already done in the client

The game now includes:

- Multiplayer connection UI (server URL, room, callsign)
- WebSocket client module (`js/multiplayer.js`)
- Snapshot broadcasting from gameplay loop
- Incoming snapshot rendering as teammate markers

This means the browser client is ready. You only need a realtime relay service.

## Required backend (minimum)

Host a WebSocket service that:

1. Accepts JSON packets
2. Handles `join` packets (`room`, `playerName`)
3. Broadcasts `snapshot` packets to other clients in the same room
4. Optionally sends `server_message` packets for announcements

Packet shape expected by client:

```json
{
  "type": "snapshot",
  "room": "alpha-squad",
  "playerName": "SKYE-01",
  "x": 640,
  "y": 360,
  "hp": 120,
  "shield": 25,
  "wave": 4,
  "score": 2100,
  "ts": 1760000000000
}
```

## Netlify deployment model

Netlify static hosting serves the game frontend, but persistent WebSocket sessions should run on a separate realtime host.

A ready relay implementation is included at:

- `Platforms-Apps-Infrastructure/2026/OperationBrowserStrike/realtime-relay`

Run locally:

1. `cd Platforms-Apps-Infrastructure/2026/OperationBrowserStrike/realtime-relay`
2. `cp env.template .env`
3. `npm install`
4. `npm run dev`

Then in game settings set `Realtime Server URL` to `ws://localhost:8080/ws`.

### Critical note

Netlify static hosting does **not** replace the realtime relay. Multiplayer still requires a separate WebSocket process.

Recommended options:

- Fly.io (Node + `ws`)
- Render (WebSocket-enabled service)
- Railway (Node realtime service)
- Cloudflare Durable Objects / Workers WebSocket

Then set the URL in-game:

- `Realtime Server URL`: `wss://your-host/ws`
- `Room`: e.g. `alpha-squad`
- `Callsign`: per player
- `Room Token`: must match relay `ROOM_SECRET` if configured

## Security and production hardening

Before public rollout, add:

- Basic auth token in join payload
- Rate limiting per IP and per room
- Input validation and max room size
- Idle connection cleanup
- Server-side clock skew/packet throttling

Recommended production defaults:

- `MAX_CLIENTS_PER_ROOM=12` to start
- `MAX_PACKETS_PER_SEC=30` for reduced abuse surface
- Non-empty `ROOM_SECRET`
- Strict `CORS_ORIGIN` matching your deployed game domain

## Testing checklist

1. Open game in two browsers/devices
2. Connect both to same room
3. Move/shoot on device A
4. Confirm teammate marker updates on device B
5. Disconnect one device and confirm marker disappears after timeout
