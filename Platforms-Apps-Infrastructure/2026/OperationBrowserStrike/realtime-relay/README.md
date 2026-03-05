# Realtime Relay (WebSocket)

This service powers live multiplayer rooms for Operation Browser Strike.

## Launch Checklist (Required)

1. Deploy this folder to a WebSocket-capable host:
  - `Platforms-Apps-Infrastructure/2026/OperationBrowserStrike/realtime-relay`
2. Set env vars from `env.template`:
  - `PORT`, `HOST`, `CORS_ORIGIN`, `MAX_CLIENTS_PER_ROOM`, `MAX_PACKETS_PER_SEC`, `ROOM_SECRET`
3. Use a real secure endpoint in game:
  - `wss://YOUR-RELAY-HOST/ws`
4. Ensure every player uses the same room + token.
5. Smoke test with 2+ clients before public launch.

Current UI status can be controlled independently from backend readiness; backend can be deployed now even if frontend multiplayer is temporarily marked "Coming Soon".

## Features

- Room-based relay over WebSocket (`/ws`)
- Optional room auth token (`ROOM_SECRET`)
- Rate limiting (`MAX_PACKETS_PER_SEC`)
- Room capacity limit (`MAX_CLIENTS_PER_ROOM`)
- Heartbeat + stale socket cleanup
- Health endpoint (`/health`)

## Local Run

1. Copy `env.template` to `.env` and set values.
2. Install dependencies and start:

npm install
npm run dev

3. WebSocket endpoint will be:

ws://localhost:8080/ws

4. In the game settings, set:

- Realtime Server URL: ws://localhost:8080/ws
- Room: alpha-squad
- Callsign: SKYE-01
- Room Token: (must match ROOM_SECRET if set)

If local test clients are in different origins, update `CORS_ORIGIN` accordingly.

## Production Deploy

Use any host supporting long-lived WebSockets (Fly, Render, Railway, Cloudflare Workers/Durable Objects).

### Required env vars

- PORT (usually provided by host)
- HOST (default 0.0.0.0)
- MAX_CLIENTS_PER_ROOM
- MAX_PACKETS_PER_SEC
- ROOM_SECRET (optional but recommended)
- CORS_ORIGIN

### Env var meanings

- `ROOM_SECRET`: shared room token for join authentication.
- `MAX_CLIENTS_PER_ROOM`: hard cap per room to prevent overload.
- `MAX_PACKETS_PER_SEC`: per-socket rate limiter.
- `CORS_ORIGIN`: browser origin allowed by HTTP endpoints.

### Minimal Render setup example

- Runtime: Node
- Build command: npm install
- Start command: npm start
- Root directory: Platforms-Apps-Infrastructure/2026/OperationBrowserStrike/realtime-relay
- Add env vars above

Then set game URL to:

wss://YOUR-RELAY-HOST/ws

## Protocol

### Join packet from client

{
  "type": "join",
  "room": "alpha-squad",
  "playerName": "SKYE-01",
  "token": "optional-room-secret"
}

### Snapshot packet from client

{
  "type": "snapshot",
  "x": 640,
  "y": 360,
  "hp": 120,
  "shield": 30,
  "wave": 4,
  "score": 1800,
  "ts": 1760000000000
}

Server relays snapshots to all other clients in the same room.
