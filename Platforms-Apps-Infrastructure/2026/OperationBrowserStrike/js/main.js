import { WORLD } from "./state.js";
import { Game } from "./game.js";
import { UI } from "./ui.js";
import { MultiplayerClient } from "./multiplayer.js";

const canvas = document.getElementById("gameCanvas");
canvas.width = WORLD.width;
canvas.height = WORLD.height;
const MULTIPLAYER_COMING_SOON = true;

const ui = new UI();
const game = new Game(canvas);
const multiplayer = new MultiplayerClient();
game.setBestScore(ui.getBestScore());
game.setSettings(ui.getSettings());

let muted = false;
const gamepadLatch = {
  dash: false,
  pause: false,
};
const gamepadSnapshot = {
  connected: false,
  id: "",
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  shoot: false,
  dash: false,
  pause: false,
};

game.setHooks({
  onHud: (hud) => ui.updateHud(hud),
  onUpgradePrompt: (choices) => {
    ui.showUpgrades(choices, (upgradeId) => {
      game.selectUpgrade(upgradeId);
      ui.hideUpgrades();
    });
  },
  onPause: (paused) => ui.showPause(paused),
  onGameOver: (summary) => ui.showGameOver(summary),
  onStart: () => ui.hideAllOverlays(),
  onFeedback: (feedback) => {
    if (feedback.damage) ui.damageFlash(feedback.damage);
    if (feedback.scorePulse) ui.pulseStat("score");
    if (feedback.shieldPulse) ui.pulseStat("shield");
  },
  onAnnounce: (packet) => {
    ui.announce(packet.message, packet.tone, packet.withVoice);
  },
});
game.pushHud();

multiplayer.setHooks({
  onStatus: (status) => ui.setMultiplayerStatus(status),
  onMessage: (packet) => {
    if (MULTIPLAYER_COMING_SOON) return;
    game.applyNetworkPacket(packet);
    if (packet && packet.type === "server_message" && packet.message) {
      ui.announce(packet.message, "info", false);
    }
  },
});

function bindButtons() {
    if (MULTIPLAYER_COMING_SOON) {
      ui.setMultiplayerStatus("Coming soon");
      ui.nodes.mpConnectBtn.disabled = true;
      ui.nodes.mpDisconnectBtn.disabled = true;
      ui.nodes.mpServerUrl.disabled = true;
      ui.nodes.mpRoom.disabled = true;
      ui.nodes.mpPlayerName.disabled = true;
      ui.nodes.mpToken.disabled = true;
    }

  ui.nodes.startBtn.addEventListener("click", () => game.startRun());
  ui.nodes.playAgainBtn.addEventListener("click", () => game.startRun());
  ui.nodes.restartBtn.addEventListener("click", () => game.startRun());

  ui.nodes.backToMenuBtn.addEventListener("click", () => {
    game.reset();
    ui.announce("Awaiting launch", "info", false);
    ui.showStart();
  });

  ui.nodes.pauseBtn.addEventListener("click", () => game.togglePause());
  ui.nodes.resumeBtn.addEventListener("click", () => game.forcePause(false));

  ui.nodes.muteBtn.addEventListener("click", () => {
    muted = !muted;
    game.setSfxEnabled(!muted);
    ui.setMuted(muted);
  });

  ui.nodes.resetBestBtn.addEventListener("click", () => {
    ui.resetBestScore();
    game.setBestScore(0);
  });

  ui.nodes.settingsBtn.addEventListener("click", () => ui.showSettings());
  ui.nodes.settingsCancelBtn.addEventListener("click", () => ui.hideSettings());
  ui.nodes.controllerMapBtn.addEventListener("click", () => {
    ui.hideSettings();
    ui.showControllerMapping();
  });
  ui.nodes.controllerMapCloseBtn.addEventListener("click", () => {
    ui.hideControllerMapping();
    ui.showSettings();
  });

  ui.nodes.settingStartHp.addEventListener("input", () => {
    ui.nodes.settingStartHpValue.textContent = ui.nodes.settingStartHp.value;
  });
  ui.nodes.settingExtraLives.addEventListener("input", () => {
    ui.nodes.settingExtraLivesValue.textContent = ui.nodes.settingExtraLives.value;
  });
  ui.nodes.settingEnemyIntensity.addEventListener("input", () => {
    ui.nodes.settingEnemyIntensityValue.textContent = Number(ui.nodes.settingEnemyIntensity.value).toFixed(2);
  });
  ui.nodes.settingGamepadDeadzone.addEventListener("input", () => {
    ui.nodes.settingGamepadDeadzoneValue.textContent = Number(ui.nodes.settingGamepadDeadzone.value).toFixed(2);
  });

  ui.nodes.settingsSaveBtn.addEventListener("click", () => {
    const settings = ui.saveSettingsFromControls();
    game.setSettings(settings);
    ui.hideSettings();
    ui.announce("Settings updated", "info", false);
  });

  ui.nodes.mpConnectBtn.addEventListener("click", () => {
    if (MULTIPLAYER_COMING_SOON) {
      ui.announce("Multiplayer is coming soon", "info", false);
      return;
    }
    const settings = ui.saveSettingsFromControls();
    game.setSettings(settings);
    multiplayer.connect({
      url: settings.mpServerUrl,
      room: settings.mpRoom,
      playerName: settings.mpPlayerName,
      token: settings.mpToken,
    });
  });

  ui.nodes.mpDisconnectBtn.addEventListener("click", () => {
    if (MULTIPLAYER_COMING_SOON) return;
    multiplayer.disconnect();
    ui.setMultiplayerStatus("Disconnected");
  });
}

function bindInput() {
  const keyMap = {
    KeyW: "up",
    ArrowUp: "up",
    KeyS: "down",
    ArrowDown: "down",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
  };

  window.addEventListener("keydown", (event) => {
    if (keyMap[event.code]) game.input[keyMap[event.code]] = true;

    if (event.code === "Space") {
      game.input.shooting = true;
      event.preventDefault();
    }

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      game.input.dash = true;
    }

    if (event.code === "Escape") {
      if (game.awaitingUpgrade || game.gameOver) return;
      game.togglePause();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (keyMap[event.code]) game.input[keyMap[event.code]] = false;
    if (event.code === "Space") game.input.shooting = false;
  });

  canvas.addEventListener("mousedown", () => {
    game.input.shooting = true;
  });

  window.addEventListener("mouseup", () => {
    game.input.shooting = false;
  });

  function updateAim(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD.width / rect.width;
    const scaleY = WORLD.height / rect.height;
    game.input.aimX = (clientX - rect.left) * scaleX;
    game.input.aimY = (clientY - rect.top) * scaleY;
  }

  canvas.addEventListener("mousemove", (event) => {
    updateAim(event.clientX, event.clientY);
  });

  canvas.addEventListener("touchstart", (event) => {
    game.input.shooting = true;
    const touch = event.touches[0];
    if (touch) updateAim(touch.clientX, touch.clientY);
  }, { passive: true });

  canvas.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (touch) updateAim(touch.clientX, touch.clientY);
  }, { passive: true });

  window.addEventListener("touchend", () => {
    game.input.shooting = false;
  }, { passive: true });
}

function applyGamepad() {
  const settings = ui.getSettings();
  if (!settings.gamepadEnabled || !navigator.getGamepads) {
    game.input.axisX = 0;
    game.input.axisY = 0;
    gamepadSnapshot.connected = false;
    ui.updateControllerMapping(gamepadSnapshot);
    return;
  }

  const pads = navigator.getGamepads();
  const pad = pads && Array.from(pads).find((p) => p && p.connected);
  if (!pad) {
    game.input.axisX = 0;
    game.input.axisY = 0;
    gamepadSnapshot.connected = false;
    ui.updateControllerMapping(gamepadSnapshot);
    return;
  }

  const deadzone = settings.gamepadDeadzone;
  const lx = Math.abs(pad.axes[0] || 0) > deadzone ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1] || 0) > deadzone ? pad.axes[1] : 0;
  game.input.axisX = lx;
  game.input.axisY = ly;

  const rx = Math.abs(pad.axes[2] || 0) > deadzone ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3] || 0) > deadzone ? pad.axes[3] : 0;
  if (rx !== 0 || ry !== 0) {
    game.input.aimX = game.player.x + rx * 300;
    game.input.aimY = game.player.y + ry * 300;
  }

  const rt = (pad.buttons[7] && pad.buttons[7].value) || 0;
  const rb = Boolean(pad.buttons[5] && pad.buttons[5].pressed);
  game.input.shooting = rt > 0.25 || rb;

  const dashPressed = Boolean((pad.buttons[4] && pad.buttons[4].pressed) || (pad.buttons[6] && pad.buttons[6].value > 0.25));
  if (dashPressed && !gamepadLatch.dash) {
    game.input.dash = true;
  }
  gamepadLatch.dash = dashPressed;

  const pausePressed = Boolean((pad.buttons[9] && pad.buttons[9].pressed) || (pad.buttons[8] && pad.buttons[8].pressed));
  if (pausePressed && !gamepadLatch.pause) {
    if (!game.awaitingUpgrade && !game.gameOver) game.togglePause();
  }
  gamepadLatch.pause = pausePressed;

  gamepadSnapshot.connected = true;
  gamepadSnapshot.id = pad.id || "Controller";
  gamepadSnapshot.moveX = lx;
  gamepadSnapshot.moveY = ly;
  gamepadSnapshot.aimX = rx;
  gamepadSnapshot.aimY = ry;
  gamepadSnapshot.shoot = rt > 0.25 || rb;
  gamepadSnapshot.dash = dashPressed;
  gamepadSnapshot.pause = pausePressed;
  ui.updateControllerMapping(gamepadSnapshot);
}

bindButtons();
bindInput();
ui.showStart();

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  applyGamepad();
  game.update(dt);

  if (!MULTIPLAYER_COMING_SOON && multiplayer.connected) {
    const settings = ui.getSettings();
    multiplayer.sendSnapshot({
      ...game.getNetworkSnapshot(),
      room: settings.mpRoom,
      playerName: settings.mpPlayerName,
    });
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      ui.setMultiplayerStatus("Offline cache unavailable");
    });
  });
}
