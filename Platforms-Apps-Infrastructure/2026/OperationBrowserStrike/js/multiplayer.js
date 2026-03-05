export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.lastError = "";
    this.room = "alpha-squad";
    this.playerName = "SKYE-01";
    this.token = "";
    this.onStatus = () => {};
    this.onMessage = () => {};
  }

  setHooks({ onStatus, onMessage }) {
    this.onStatus = onStatus || this.onStatus;
    this.onMessage = onMessage || this.onMessage;
  }

  connect({ url, room, playerName, token }) {
    if (!url || !url.startsWith("ws")) {
      this.onStatus("Invalid server URL");
      return;
    }

    this.disconnect();

    try {
      this.socket = new WebSocket(url);
    } catch {
      this.onStatus("Connection failed");
      return;
    }

    this.room = room || "alpha-squad";
    this.playerName = playerName || "SKYE-01";
    this.token = token || "";

    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.onStatus("Connected");
      this.send({
        type: "join",
        room: this.room,
        playerName: this.playerName,
        token: this.token,
        client: "operation-browser-strike",
      });
    });

    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.onStatus("Disconnected");
    });

    this.socket.addEventListener("error", () => {
      this.connected = false;
      this.onStatus("Network error");
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const packet = JSON.parse(event.data);
        this.onMessage(packet);
      } catch {
        this.onMessage({ type: "raw", data: event.data });
      }
    });

    this.onStatus("Connecting...");
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  sendSnapshot(snapshot) {
    this.send({
      type: "snapshot",
      room: this.room,
      playerName: this.playerName,
      ...snapshot,
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }
}
