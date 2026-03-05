import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MAX_CLIENTS_PER_ROOM = Number(process.env.MAX_CLIENTS_PER_ROOM || 16);
const MAX_PACKETS_PER_SEC = Number(process.env.MAX_PACKETS_PER_SEC || 45);
const ROOM_SECRET = process.env.ROOM_SECRET || "";

const rooms = new Map();

function getRoom(roomName) {
  if (!rooms.has(roomName)) rooms.set(roomName, new Set());
  return rooms.get(roomName);
}

function cleanEmptyRoom(roomName) {
  const members = rooms.get(roomName);
  if (!members || members.size === 0) rooms.delete(roomName);
}

function send(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(roomName, payload, exceptSocket = null) {
  const members = rooms.get(roomName);
  if (!members) return;
  const encoded = JSON.stringify(payload);
  for (const socket of members) {
    if (socket === exceptSocket) continue;
    if (socket.readyState === socket.OPEN) socket.send(encoded);
  }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    const roomStats = {};
    for (const [name, members] of rooms.entries()) roomStats[name] = members.size;
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
    });
    res.end(JSON.stringify({ ok: true, rooms: roomStats }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
  });
  res.end("Operation Browser Strike realtime relay online\n");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket, req) => {
  socket.isAlive = true;
  socket.room = "";
  socket.playerName = "Unknown";
  socket.lastTick = nowSec();
  socket.tickCount = 0;

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (raw) => {
    let packet;
    try {
      packet = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: "server_message", message: "Invalid JSON packet" });
      return;
    }

    const thisTick = nowSec();
    if (thisTick !== socket.lastTick) {
      socket.lastTick = thisTick;
      socket.tickCount = 0;
    }
    socket.tickCount += 1;
    if (socket.tickCount > MAX_PACKETS_PER_SEC) {
      send(socket, { type: "server_message", message: "Rate limit exceeded" });
      return;
    }

    if (packet.type === "join") {
      const room = String(packet.room || "alpha-squad").slice(0, 64);
      const playerName = String(packet.playerName || "SKYE-01").slice(0, 32);
      const token = String(packet.token || "");

      if (ROOM_SECRET && token !== ROOM_SECRET) {
        send(socket, { type: "server_message", message: "Auth failed" });
        return;
      }

      const members = getRoom(room);
      if (!socket.room && members.size >= MAX_CLIENTS_PER_ROOM) {
        send(socket, { type: "server_message", message: "Room is full" });
        return;
      }

      if (socket.room) {
        const oldRoomMembers = rooms.get(socket.room);
        if (oldRoomMembers) {
          oldRoomMembers.delete(socket);
          cleanEmptyRoom(socket.room);
        }
      }

      socket.room = room;
      socket.playerName = playerName;
      members.add(socket);

      send(socket, { type: "server_message", message: `Joined ${room} as ${playerName}` });
      broadcast(room, { type: "server_message", message: `${playerName} joined ${room}` }, socket);
      return;
    }

    if (packet.type === "snapshot") {
      if (!socket.room) return;

      const payload = {
        type: "snapshot",
        room: socket.room,
        playerName: socket.playerName,
        x: Number(packet.x) || 0,
        y: Number(packet.y) || 0,
        hp: Number(packet.hp) || 0,
        shield: Number(packet.shield) || 0,
        wave: Number(packet.wave) || 1,
        score: Number(packet.score) || 0,
        ts: Number(packet.ts) || Date.now(),
      };

      broadcast(socket.room, payload, socket);
      return;
    }

    if (packet.type === "leave") {
      if (!socket.room) return;
      const room = socket.room;
      const members = rooms.get(room);
      if (members) {
        members.delete(socket);
        cleanEmptyRoom(room);
      }
      socket.room = "";
      send(socket, { type: "server_message", message: "Disconnected from room" });
      return;
    }
  });

  socket.on("close", () => {
    if (!socket.room) return;
    const room = socket.room;
    const members = rooms.get(room);
    if (!members) return;
    members.delete(socket);
    cleanEmptyRoom(room);
    broadcast(room, { type: "server_message", message: `${socket.playerName} disconnected` });
  });

  send(socket, { type: "server_message", message: "Connected to relay. Send join packet." });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 15000);

wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  console.log(`[relay] listening on http://${HOST}:${PORT}`);
  console.log("[relay] websocket endpoint /ws");
});
