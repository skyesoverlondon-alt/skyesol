import {
  loadBestScore,
  saveBestScore,
  loadGameSettings,
  saveGameSettings,
  defaultGameSettings,
} from "./state.js";

export class UI {
  constructor() {
    this.nodes = {
      hpStat: document.getElementById("hpStat"),
      shieldStat: document.getElementById("shieldStat"),
      waveStat: document.getElementById("waveStat"),
      scoreStat: document.getElementById("scoreStat"),
      bestStat: document.getElementById("bestStat"),
      timerStat: document.getElementById("timerStat"),
      comboStat: document.getElementById("comboStat"),
      livesStat: document.getElementById("livesStat"),
      objectiveTicker: document.getElementById("objectiveTicker"),
      xpBar: document.getElementById("xpBar"),
      xpLabel: document.getElementById("xpLabel"),
      damageVignette: document.getElementById("damageVignette"),
      missionAnnouncer: document.getElementById("missionAnnouncer"),
      startScreen: document.getElementById("startScreen"),
      pauseScreen: document.getElementById("pauseScreen"),
      upgradeScreen: document.getElementById("upgradeScreen"),
      gameOverScreen: document.getElementById("gameOverScreen"),
      gameOverSummary: document.getElementById("gameOverSummary"),
      upgradeOptions: document.getElementById("upgradeOptions"),
      startBtn: document.getElementById("startBtn"),
      pauseBtn: document.getElementById("pauseBtn"),
      resumeBtn: document.getElementById("resumeBtn"),
      restartBtn: document.getElementById("restartBtn"),
      playAgainBtn: document.getElementById("playAgainBtn"),
      backToMenuBtn: document.getElementById("backToMenuBtn"),
      muteBtn: document.getElementById("muteBtn"),
      resetBestBtn: document.getElementById("resetBestBtn"),
      settingsBtn: document.getElementById("settingsBtn"),
      settingsScreen: document.getElementById("settingsScreen"),
      settingsCancelBtn: document.getElementById("settingsCancelBtn"),
      settingsSaveBtn: document.getElementById("settingsSaveBtn"),
      controllerMapBtn: document.getElementById("controllerMapBtn"),
      settingStartHp: document.getElementById("settingStartHp"),
      settingStartHpValue: document.getElementById("settingStartHpValue"),
      settingExtraLives: document.getElementById("settingExtraLives"),
      settingExtraLivesValue: document.getElementById("settingExtraLivesValue"),
      settingEnemyIntensity: document.getElementById("settingEnemyIntensity"),
      settingEnemyIntensityValue: document.getElementById("settingEnemyIntensityValue"),
      settingGameMode: document.getElementById("settingGameMode"),
      settingGamepadEnabled: document.getElementById("settingGamepadEnabled"),
      settingGamepadDeadzone: document.getElementById("settingGamepadDeadzone"),
      settingGamepadDeadzoneValue: document.getElementById("settingGamepadDeadzoneValue"),
      mpServerUrl: document.getElementById("mpServerUrl"),
      mpRoom: document.getElementById("mpRoom"),
      mpPlayerName: document.getElementById("mpPlayerName"),
      mpToken: document.getElementById("mpToken"),
      mpConnectBtn: document.getElementById("mpConnectBtn"),
      mpDisconnectBtn: document.getElementById("mpDisconnectBtn"),
      mpStatus: document.getElementById("mpStatus"),
      controllerMapScreen: document.getElementById("controllerMapScreen"),
      controllerMapCloseBtn: document.getElementById("controllerMapCloseBtn"),
      controllerStatus: document.getElementById("controllerStatus"),
      mapMoveAxis: document.getElementById("mapMoveAxis"),
      mapAimAxis: document.getElementById("mapAimAxis"),
      mapShootBtn: document.getElementById("mapShootBtn"),
      mapDashBtn: document.getElementById("mapDashBtn"),
      mapPauseBtn: document.getElementById("mapPauseBtn"),
      careerKills: document.getElementById("careerKills"),
      careerBestWave: document.getElementById("careerBestWave"),
      careerRuns: document.getElementById("careerRuns"),
      careerTime: document.getElementById("careerTime"),
    };

    this.bestScore = loadBestScore();
    this.settings = loadGameSettings();
    this.announceTimer = null;
    this.nodes.bestStat.textContent = String(this.bestScore);
    this.applySettingsToControls(this.settings);
  }

  formatClock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const rs = String(s % 60).padStart(2, "0");
    return `${m}:${rs}`;
  }

  applySettingsToControls(settings) {
    this.nodes.settingStartHp.value = String(settings.startHp);
    this.nodes.settingStartHpValue.textContent = String(settings.startHp);
    this.nodes.settingExtraLives.value = String(settings.extraLives);
    this.nodes.settingExtraLivesValue.textContent = String(settings.extraLives);
    this.nodes.settingEnemyIntensity.value = String(settings.enemyIntensity);
    this.nodes.settingEnemyIntensityValue.textContent = Number(settings.enemyIntensity).toFixed(2);
    this.nodes.settingGameMode.value = settings.gameMode || "survival";
    this.nodes.settingGamepadEnabled.checked = Boolean(settings.gamepadEnabled);
    this.nodes.settingGamepadDeadzone.value = String(settings.gamepadDeadzone);
    this.nodes.settingGamepadDeadzoneValue.textContent = Number(settings.gamepadDeadzone).toFixed(2);
    this.nodes.mpServerUrl.value = settings.mpServerUrl || "";
    this.nodes.mpRoom.value = settings.mpRoom || "alpha-squad";
    this.nodes.mpPlayerName.value = settings.mpPlayerName || "SKYE-01";
    this.nodes.mpToken.value = settings.mpToken || "";
  }

  getSettingsFromControls() {
    const defaults = defaultGameSettings();
    return {
      startHp: Number(this.nodes.settingStartHp.value || defaults.startHp),
      extraLives: Number(this.nodes.settingExtraLives.value || defaults.extraLives),
      enemyIntensity: Number(this.nodes.settingEnemyIntensity.value || defaults.enemyIntensity),
      gameMode: this.nodes.settingGameMode.value || defaults.gameMode,
      gamepadEnabled: Boolean(this.nodes.settingGamepadEnabled.checked),
      gamepadDeadzone: Number(this.nodes.settingGamepadDeadzone.value || defaults.gamepadDeadzone),
      mpServerUrl: String(this.nodes.mpServerUrl.value || defaults.mpServerUrl),
      mpRoom: String(this.nodes.mpRoom.value || defaults.mpRoom),
      mpPlayerName: String(this.nodes.mpPlayerName.value || defaults.mpPlayerName),
      mpToken: String(this.nodes.mpToken.value || defaults.mpToken),
    };
  }

  getSettings() {
    return { ...this.settings };
  }

  saveSettingsFromControls() {
    this.settings = this.getSettingsFromControls();
    saveGameSettings(this.settings);
    return this.getSettings();
  }

  getBestScore() {
    return this.bestScore;
  }

  resetBestScore() {
    this.bestScore = 0;
    saveBestScore(0);
    this.nodes.bestStat.textContent = "0";
  }

  updateHud(hud) {
    this.nodes.hpStat.textContent = `${hud.hp} / ${hud.maxHp}`;
    this.nodes.shieldStat.textContent = String(hud.shield);
    this.nodes.waveStat.textContent = String(hud.wave);
    this.nodes.scoreStat.textContent = String(hud.score);
    this.nodes.timerStat.textContent = this.formatClock(hud.timer || 0);
    this.nodes.comboStat.textContent = `x${Math.max(1, hud.combo || 0)}`;
    this.nodes.livesStat.textContent = String(hud.lives ?? 0);
    this.nodes.objectiveTicker.textContent = `Objective: ${hud.objective || "Hold position"}`;
    this.nodes.xpBar.style.width = `${Math.round(hud.xpRatio * 100)}%`;
    this.nodes.xpLabel.textContent = `Lv ${hud.level}`;
    this.nodes.hpStat.closest(".stat").classList.toggle("low", hud.hp / Math.max(1, hud.maxHp) <= 0.3);

    if (hud.score > this.bestScore) {
      this.bestScore = hud.score;
      saveBestScore(this.bestScore);
      this.nodes.bestStat.textContent = String(this.bestScore);
    }

    if (hud.career) {
      this.nodes.careerKills.textContent = String(hud.career.totalKills || 0);
      this.nodes.careerBestWave.textContent = String(hud.career.bestWave || 1);
      this.nodes.careerRuns.textContent = String(hud.career.totalRuns || 0);
      this.nodes.careerTime.textContent = this.formatClock(hud.career.totalPlaySeconds || 0);
    }
  }

  damageFlash(intensity) {
    if (!this.nodes.damageVignette) return;
    const alpha = Math.max(0.08, Math.min(0.72, intensity));
    this.nodes.damageVignette.style.opacity = String(alpha);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.nodes.damageVignette.style.opacity = "0";
    }, 120);
  }

  pulseStat(statName) {
    if (statName === "shield") {
      const el = this.nodes.shieldStat.closest(".stat");
      if (!el) return;
      el.classList.remove("shield-pop");
      void el.offsetWidth;
      el.classList.add("shield-pop");
      setTimeout(() => el.classList.remove("shield-pop"), 180);
      return;
    }
    if (statName === "score") {
      const el = this.nodes.scoreStat.closest(".stat");
      if (!el) return;
      el.classList.remove("score-pop");
      void el.offsetWidth;
      el.classList.add("score-pop");
      setTimeout(() => el.classList.remove("score-pop"), 180);
    }
  }

  announce(message, tone = "info", withVoice = false) {
    const el = this.nodes.missionAnnouncer;
    if (!el || !message) return;
    el.textContent = message;
    el.classList.remove("warn", "info", "show");
    if (tone === "warn") el.classList.add("warn");
    if (tone === "info") el.classList.add("info");
    void el.offsetWidth;
    el.classList.add("show");

    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 1800);

    if (withVoice && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(message);
      u.rate = 1.06;
      u.pitch = 0.9;
      u.volume = 0.45;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  showStart() {
    this.hideAllOverlays();
    this.nodes.startScreen.classList.add("show");
  }

  showPause(paused) {
    if (paused) {
      this.nodes.pauseScreen.classList.add("show");
    } else {
      this.nodes.pauseScreen.classList.remove("show");
    }
  }

  showSettings() {
    this.applySettingsToControls(this.settings);
    this.nodes.settingsScreen.classList.add("show");
  }

  hideSettings() {
    this.nodes.settingsScreen.classList.remove("show");
  }

  showControllerMapping() {
    this.nodes.controllerMapScreen.classList.add("show");
  }

  hideControllerMapping() {
    this.nodes.controllerMapScreen.classList.remove("show");
  }

  updateControllerMapping(snapshot) {
    if (!snapshot || !snapshot.connected) {
      this.nodes.controllerStatus.textContent = "No controller detected";
      this.nodes.mapMoveAxis.textContent = "0.00 / 0.00";
      this.nodes.mapAimAxis.textContent = "0.00 / 0.00";
      this.nodes.mapShootBtn.textContent = "Not pressed";
      this.nodes.mapDashBtn.textContent = "Not pressed";
      this.nodes.mapPauseBtn.textContent = "Not pressed";
      return;
    }

    this.nodes.controllerStatus.textContent = `${snapshot.id} detected`;
    this.nodes.mapMoveAxis.textContent = `${snapshot.moveX.toFixed(2)} / ${snapshot.moveY.toFixed(2)}`;
    this.nodes.mapAimAxis.textContent = `${snapshot.aimX.toFixed(2)} / ${snapshot.aimY.toFixed(2)}`;
    this.nodes.mapShootBtn.textContent = snapshot.shoot ? "Pressed" : "Not pressed";
    this.nodes.mapDashBtn.textContent = snapshot.dash ? "Pressed" : "Not pressed";
    this.nodes.mapPauseBtn.textContent = snapshot.pause ? "Pressed" : "Not pressed";
  }

  setMultiplayerStatus(text) {
    this.nodes.mpStatus.textContent = `Network status: ${text}`;
  }

  showUpgrades(choices, onPick) {
    this.nodes.upgradeOptions.innerHTML = "";
    choices.forEach((choice) => {
      const card = document.createElement("button");
      card.className = "upgrade-card";
      card.type = "button";
      card.innerHTML = `<h3>${choice.name}</h3><p>${choice.desc}</p>`;
      card.addEventListener("click", () => onPick(choice.id));
      this.nodes.upgradeOptions.appendChild(card);
    });

    this.nodes.upgradeScreen.classList.add("show");
  }

  hideUpgrades() {
    this.nodes.upgradeScreen.classList.remove("show");
  }

  showGameOver(summary) {
    if (summary.won && summary.result === "campaign-clear") {
      this.nodes.gameOverSummary.textContent = `Mission complete: ${summary.campaignMission} · Score: ${summary.score} · Wave: ${summary.wave}`;
    } else {
      this.nodes.gameOverSummary.textContent = `Score: ${summary.score} · Wave: ${summary.wave}`;
    }
    this.nodes.gameOverScreen.classList.add("show");
  }

  hideAllOverlays() {
    this.nodes.startScreen.classList.remove("show");
    this.nodes.pauseScreen.classList.remove("show");
    this.nodes.upgradeScreen.classList.remove("show");
    this.nodes.gameOverScreen.classList.remove("show");
    this.nodes.settingsScreen.classList.remove("show");
    this.nodes.controllerMapScreen.classList.remove("show");
  }

  setMuted(muted) {
    this.nodes.muteBtn.textContent = muted ? "SFX: Off" : "SFX: On";
  }
}
