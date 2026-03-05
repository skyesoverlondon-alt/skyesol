import {
  WORLD,
  COLORS,
  clamp,
  rand,
  pick,
  distance,
  levelXpRequired,
  buildUpgradePool,
  loadGameSettings,
  loadCareerProfile,
  saveCareerProfile,
} from "./state.js";

function normalize(x, y) {
  const mag = Math.hypot(x, y) || 1;
  return { x: x / mag, y: y / mag };
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

const CAMPAIGN_MISSIONS = [
  { id: "m1", title: "Perimeter Sweep", targetWave: 3, targetKills: 24, intensity: 0.9 },
  { id: "m2", title: "Relay Breach", targetWave: 5, targetKills: 48, intensity: 1.0 },
  { id: "m3", title: "Airlock Collapse", targetWave: 7, targetKills: 76, intensity: 1.08 },
  { id: "m4", title: "Overwatch Siege", targetWave: 9, targetKills: 108, intensity: 1.16 },
  { id: "m5", title: "Strike Core", targetWave: 10, targetKills: 132, intensity: 1.25 },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audioCtx = null;
    this.ambientNodes = null;
    this.sfxEnabled = true;
    this.bestScore = 0;
    this.onHud = () => {};
    this.onUpgradePrompt = () => {};
    this.onPause = () => {};
    this.onGameOver = () => {};
    this.onStart = () => {};
    this.onFeedback = () => {};
    this.onAnnounce = () => {};
    this.trauma = 0;
    this.lastLowHpAlert = 0;
    this.settings = loadGameSettings();
    this.career = loadCareerProfile();
    this.missionElapsed = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.killsThisRun = 0;
    this.remotePlayers = new Map();
    this.runWon = false;
    this.runResult = "death";
    this.campaign = null;

    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      axisX: 0,
      axisY: 0,
      shooting: false,
      dash: false,
      aimX: WORLD.width / 2,
      aimY: WORLD.height / 2,
    };

    this.upgradePool = buildUpgradePool();
    this.currentChoices = [];
    this.reset();
  }

  setBestScore(value) {
    this.bestScore = value;
  }

  setSettings(nextSettings) {
    this.settings = { ...this.settings, ...nextSettings };
  }

  getCareerSnapshot() {
    return { ...this.career };
  }

  setHooks(hooks) {
    this.onHud = hooks.onHud || this.onHud;
    this.onUpgradePrompt = hooks.onUpgradePrompt || this.onUpgradePrompt;
    this.onPause = hooks.onPause || this.onPause;
    this.onGameOver = hooks.onGameOver || this.onGameOver;
    this.onStart = hooks.onStart || this.onStart;
    this.onFeedback = hooks.onFeedback || this.onFeedback;
    this.onAnnounce = hooks.onAnnounce || this.onAnnounce;
  }

  reset() {
    this.stopAmbience();
    this.running = false;
    this.paused = false;
    this.awaitingUpgrade = false;
    this.gameOver = false;
    this.score = 0;
    this.wave = 1;
    this.waveSpawnBudget = 0;
    this.spawnClock = 0;
    this.enemyFireClock = 0;
    this.enemyBullets = [];
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];
    const startHp = Number(this.settings.startHp || 180);
    this.missionElapsed = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.killsThisRun = 0;
    this.runWon = false;
    this.runResult = "death";
    this.remotePlayers.clear();
    this.livesRemaining = Number(this.settings.extraLives || 0);
    this.enemyIntensity = Number(this.settings.enemyIntensity || 1);
    if (this.settings.gameMode === "campaign") {
      const unlocked = Math.max(1, Math.floor(this.career.campaignUnlocked || 1));
      const missionIndex = clamp(unlocked - 1, 0, CAMPAIGN_MISSIONS.length - 1);
      this.campaign = {
        missionIndex,
        mission: CAMPAIGN_MISSIONS[missionIndex],
      };
      this.enemyIntensity = this.campaign.mission.intensity;
    } else {
      this.campaign = null;
    }
    this.player = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      radius: 15,
      speed: 310,
      health: startHp,
      maxHealth: startHp,
      shield: 0,
      damage: 18,
      fireInterval: 0.16,
      fireClock: 0,
      projectiles: 1,
      xp: 0,
      level: 1,
      dashForce: 420,
      dashCooldown: 1.35,
      dashClock: 0,
      invuln: 0,
      lifesteal: 0,
    };
    this.configureWave(this.wave);
    this.pushHud();
  }

  startRun() {
    this.reset();
    this.running = true;
    this.startAmbience();
    this.career.totalRuns += 1;
    saveCareerProfile(this.career);
    if (this.campaign) {
      this.onAnnounce({ message: `${this.campaign.mission.title} online`, tone: "info", withVoice: true });
    } else {
      this.onAnnounce({ message: "Mission online", tone: "info", withVoice: true });
    }
    this.onStart();
  }

  togglePause() {
    if (!this.running || this.awaitingUpgrade || this.gameOver) return;
    this.paused = !this.paused;
    this.onPause(this.paused);
  }

  forcePause(state) {
    this.paused = state;
    this.onPause(this.paused);
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = enabled;
    if (!enabled) {
      this.stopAmbience();
      return;
    }
    if (this.running && !this.gameOver) this.startAmbience();
  }

  ensureAudioContext() {
    if (!this.audioCtx) this.audioCtx = new window.AudioContext();
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
  }

  startAmbience() {
    if (!this.sfxEnabled) return;
    try {
      this.ensureAudioContext();
      if (this.ambientNodes) return;

      const now = this.audioCtx.currentTime;
      const drone = this.audioCtx.createOscillator();
      const pulse = this.audioCtx.createOscillator();
      const mix = this.audioCtx.createGain();

      drone.type = "sawtooth";
      drone.frequency.setValueAtTime(54, now);
      pulse.type = "triangle";
      pulse.frequency.setValueAtTime(82, now);

      mix.gain.setValueAtTime(0.0001, now);
      mix.gain.exponentialRampToValueAtTime(0.015, now + 0.35);

      drone.connect(mix);
      pulse.connect(mix);
      mix.connect(this.audioCtx.destination);

      drone.start();
      pulse.start();

      this.ambientNodes = { drone, pulse, mix };
    } catch {
      this.ambientNodes = null;
    }
  }

  stopAmbience() {
    if (!this.ambientNodes || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.ambientNodes.mix.gain.cancelScheduledValues(now);
    this.ambientNodes.mix.gain.setValueAtTime(this.ambientNodes.mix.gain.value || 0.01, now);
    this.ambientNodes.mix.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    this.ambientNodes.drone.stop(now + 0.2);
    this.ambientNodes.pulse.stop(now + 0.2);
    this.ambientNodes = null;
  }

  tryDash() {
    if (this.player.dashClock > 0) return;
    const moveX = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const moveY = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    const dashDir = normalize(moveX || Math.cos(angleTo(this.player, { x: this.input.aimX, y: this.input.aimY })), moveY || Math.sin(angleTo(this.player, { x: this.input.aimX, y: this.input.aimY })));
    this.player.x += dashDir.x * this.player.dashForce;
    this.player.y += dashDir.y * this.player.dashForce;
    this.player.x = clamp(this.player.x, this.player.radius, WORLD.width - this.player.radius);
    this.player.y = clamp(this.player.y, this.player.radius, WORLD.height - this.player.radius);
    this.player.dashClock = this.player.dashCooldown;
    this.player.invuln = Math.max(this.player.invuln, 0.15);
    this.sfx(220, 0.05, "square", 0.03);
  }

  update(dt) {
    if (!this.running || this.paused || this.awaitingUpgrade || this.gameOver) {
      this.render();
      return;
    }

    this.missionElapsed += dt;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;

    this.player.fireClock = Math.max(0, this.player.fireClock - dt);
    this.player.dashClock = Math.max(0, this.player.dashClock - dt);
    this.player.invuln = Math.max(0, this.player.invuln - dt);

    this.movePlayer(dt);
    this.handlePlayerCombat();
    this.spawnEnemies(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.resolveWaveProgression();
    this.updateCampaignProgress();
    this.pruneRemotePlayers();

    if (this.player.health <= 0) {
      if (this.livesRemaining > 0) {
        this.livesRemaining -= 1;
        this.player.health = Math.floor(this.player.maxHealth * 0.65);
        this.player.shield = Math.max(this.player.shield, 30);
        this.player.invuln = 1.2;
        this.onAnnounce({ message: "Operator redeployed", tone: "warn", withVoice: true });
      } else {
        this.player.health = 0;
        this.endRun("death");
        return;
      }
    }

    this.pushHud();
    this.render();
  }

  movePlayer(dt) {
    const analogX = Math.abs(this.input.axisX) > 0.01 ? this.input.axisX : 0;
    const analogY = Math.abs(this.input.axisY) > 0.01 ? this.input.axisY : 0;
    const dirX = analogX || (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const dirY = analogY || (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    const dir = normalize(dirX, dirY);
    this.player.x += dir.x * this.player.speed * dt;
    this.player.y += dir.y * this.player.speed * dt;
    this.player.x = clamp(this.player.x, this.player.radius, WORLD.width - this.player.radius);
    this.player.y = clamp(this.player.y, this.player.radius, WORLD.height - this.player.radius);

    if (this.input.dash) {
      this.tryDash();
      this.input.dash = false;
    }
  }

  handlePlayerCombat() {
    if (!this.input.shooting || this.player.fireClock > 0) return;
    this.player.fireClock = this.player.fireInterval;
    const baseAngle = angleTo(this.player, { x: this.input.aimX, y: this.input.aimY });
    const spreadStep = 0.12;
    const start = -((this.player.projectiles - 1) * spreadStep) / 2;

    for (let i = 0; i < this.player.projectiles; i += 1) {
      const ang = baseAngle + start + i * spreadStep;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(ang) * 760,
        vy: Math.sin(ang) * 760,
        radius: 4,
        damage: this.player.damage,
        ttl: 1.2,
      });
    }

    this.sfx(560, 0.03, "triangle", 0.02);
  }

  spawnEnemies(dt) {
    this.spawnClock -= dt;
    if (this.spawnClock > 0 || this.waveSpawnBudget <= 0) return;
    this.spawnClock = clamp(0.8 - this.wave * 0.035, 0.2, 0.85);

    let type = "chaser";
    const roll = Math.random();
    if (this.wave >= 2 && roll > 0.5) type = "shooter";
    if (this.wave >= 4 && roll > 0.82) type = "tank";

    if (this.wave % 5 === 0 && this.waveSpawnBudget === 1) {
      type = "boss";
    }

    this.enemies.push(this.makeEnemy(type));
    this.waveSpawnBudget -= 1;
  }

  makeEnemy(type) {
    const side = Math.floor(rand(0, 4));
    let x = 0;
    let y = 0;
    if (side === 0) { x = rand(0, WORLD.width); y = -40; }
    if (side === 1) { x = WORLD.width + 40; y = rand(0, WORLD.height); }
    if (side === 2) { x = rand(0, WORLD.width); y = WORLD.height + 40; }
    if (side === 3) { x = -40; y = rand(0, WORLD.height); }

    if (type === "chaser") {
      return { type, x, y, radius: 15, hp: 40 + this.wave * 5, speed: 120 + this.wave * 5, contact: 16, xp: 24, score: 34, color: COLORS.chaser };
    }
    if (type === "shooter") {
      return { type, x, y, radius: 16, hp: 52 + this.wave * 7, speed: 90 + this.wave * 4, contact: 18, shootClock: rand(0.8, 1.5), xp: 34, score: 48, color: COLORS.shooter };
    }
    if (type === "tank") {
      return { type, x, y, radius: 22, hp: 120 + this.wave * 12, speed: 66 + this.wave * 2, contact: 24, xp: 58, score: 82, color: COLORS.tank };
    }
    return {
      type: "boss",
      x,
      y,
      radius: 38,
      hp: 560 + this.wave * 45,
      speed: 74 + this.wave * 2,
      contact: 34,
      shootClock: 0.65,
      burst: 0,
      xp: 180,
      score: 320,
      color: COLORS.boss,
    };
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      const dir = normalize(this.player.x - enemy.x, this.player.y - enemy.y);
      enemy.x += dir.x * enemy.speed * dt;
      enemy.y += dir.y * enemy.speed * dt;

      if (enemy.type === "shooter" || enemy.type === "boss") {
        enemy.shootClock -= dt;
        if (enemy.shootClock <= 0) {
          if (enemy.type === "boss") {
            this.bossFire(enemy);
            enemy.shootClock = 0.7;
          } else {
            this.enemyShoot(enemy, 260 + this.wave * 4, 8);
            enemy.shootClock = rand(0.9, 1.6);
          }
        }
      }

      if (distance(enemy, this.player) < enemy.radius + this.player.radius) {
        this.applyPlayerDamage(enemy.contact * dt);
      }
    }
  }

  bossFire(enemy) {
    const base = angleTo(enemy, this.player);
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = base + (Math.PI * 2 * i) / count + rand(-0.06, 0.06);
      this.enemyBullets.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 260,
        vy: Math.sin(angle) * 260,
        radius: 5,
        damage: 12,
        ttl: 2.6,
      });
    }
    this.sfx(145, 0.06, "sawtooth", 0.03);
  }

  enemyShoot(enemy, speed, damage) {
    const ang = angleTo(enemy, this.player);
    this.enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      radius: 5,
      damage,
      ttl: 2,
    });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.ttl -= dt;

      let removed = bullet.ttl <= 0 || bullet.x < -20 || bullet.x > WORLD.width + 20 || bullet.y < -20 || bullet.y > WORLD.height + 20;
      if (!removed) {
        for (let e = this.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = this.enemies[e];
          if (distance(bullet, enemy) <= bullet.radius + enemy.radius) {
            enemy.hp -= bullet.damage;
            removed = true;
            this.hitBurst(enemy.x, enemy.y, 4, enemy.color);
            if (enemy.hp <= 0) {
              this.killEnemy(e, enemy);
            }
            if (this.player.lifesteal > 0) {
              this.player.health = Math.min(this.player.maxHealth, this.player.health + bullet.damage * this.player.lifesteal);
            }
            break;
          }
        }
      }
      if (removed) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemyBullets(dt) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.ttl -= dt;

      if (distance(bullet, this.player) <= bullet.radius + this.player.radius) {
        this.applyPlayerDamage(bullet.damage);
        this.hitBurst(bullet.x, bullet.y, 3, COLORS.enemyBullet);
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (bullet.ttl <= 0 || bullet.x < -24 || bullet.x > WORLD.width + 24 || bullet.y < -24 || bullet.y > WORLD.height + 24) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.ttl -= dt;
      pickup.pulse += dt;

      if (distance(pickup, this.player) <= pickup.radius + this.player.radius) {
        if (pickup.kind === "heal") {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 24);
          this.onAnnounce({ message: "Repair kit secured", tone: "info", withVoice: false });
        } else {
          this.player.shield += 20;
          this.onFeedback({ shieldPulse: true });
          this.onAnnounce({ message: "Shield boosted", tone: "info", withVoice: false });
        }
        this.sfx(740, 0.08, "triangle", 0.03);
        this.pickups.splice(i, 1);
        continue;
      }

      if (pickup.ttl <= 0) this.pickups.splice(i, 1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;
      if (p.ttl <= 0) this.particles.splice(i, 1);
    }
  }

  applyPlayerDamage(amount) {
    if (this.player.invuln > 0) return;
    let remaining = amount;
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining);
      this.player.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.player.health -= remaining;
    }
    this.player.invuln = 0.09;
    this.trauma = clamp(this.trauma + Math.min(0.35, amount / 50), 0, 0.9);
    const hpRatio = this.player.health / Math.max(1, this.player.maxHealth);
    this.onFeedback({
      damage: Math.max(0.1, Math.min(0.85, remaining / 24)),
      hpRatio,
    });
    const now = performance.now();
    if (hpRatio <= 0.28 && now - this.lastLowHpAlert > 2800) {
      this.lastLowHpAlert = now;
      this.onAnnounce({ message: "Hull critical", tone: "warn", withVoice: true });
    }
    this.sfx(120, 0.05, "square", 0.03);
  }

  killEnemy(index, enemy) {
    this.enemies.splice(index, 1);
    this.killsThisRun += 1;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 2.6;
    const comboMultiplier = 1 + Math.min(2, (this.combo - 1) * 0.12);
    this.score += Math.floor(enemy.score * comboMultiplier);
    this.gainXp(enemy.xp);
    this.hitBurst(enemy.x, enemy.y, 14, enemy.color);
    this.onFeedback({ scorePulse: true });
    this.sfx(260, 0.05, "triangle", 0.03);

    if (this.combo > 0 && this.combo % 5 === 0) {
      this.onAnnounce({ message: `Combo x${this.combo}`, tone: "info", withVoice: false });
    }

    if (Math.random() < 0.13) {
      this.pickups.push({
        x: enemy.x,
        y: enemy.y,
        radius: 10,
        kind: Math.random() < 0.6 ? "heal" : "shield",
        ttl: 10,
        pulse: 0,
      });
      this.onAnnounce({ message: "Supply drop available", tone: "info", withVoice: false });
    }
  }

  updateCampaignProgress() {
    if (!this.campaign) return;
    const mission = this.campaign.mission;
    if (this.wave >= mission.targetWave && this.killsThisRun >= mission.targetKills) {
      const currentUnlock = Math.max(1, Math.floor(this.career.campaignUnlocked || 1));
      const nextUnlock = Math.min(CAMPAIGN_MISSIONS.length, Math.max(currentUnlock, this.campaign.missionIndex + 2));
      this.career.campaignUnlocked = nextUnlock;
      this.career.campaignCompleted = nextUnlock >= CAMPAIGN_MISSIONS.length;
      saveCareerProfile(this.career);
      this.runWon = true;
      this.endRun("campaign-clear");
    }
  }

  gainXp(amount) {
    this.player.xp += amount;
    const needed = levelXpRequired(this.player.level);
    if (this.player.xp >= needed) {
      this.player.xp -= needed;
      this.player.level += 1;
      this.awaitingUpgrade = true;
      this.currentChoices = this.rollUpgradeChoices();
      this.onUpgradePrompt(this.currentChoices);
      this.sfx(900, 0.1, "sine", 0.04);
    }
  }

  rollUpgradeChoices() {
    const pool = [...this.upgradePool];
    const options = [];
    while (options.length < 3 && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      options.push(pool[index]);
      pool.splice(index, 1);
    }
    return options;
  }

  selectUpgrade(upgradeId) {
    const found = this.currentChoices.find((item) => item.id === upgradeId);
    if (!found) return;
    found.apply(this);
    this.awaitingUpgrade = false;
    this.currentChoices = [];
    this.pushHud();
  }

  configureWave(wave) {
    const baseCount = Math.max(6, Math.floor((7 + wave * 2.4) * this.enemyIntensity));
    this.waveSpawnBudget = wave % 5 === 0 ? baseCount + 2 : baseCount;
  }

  resolveWaveProgression() {
    if (this.waveSpawnBudget > 0 || this.enemies.length > 0) return;
    this.wave += 1;
    this.configureWave(this.wave);
    this.hitBurst(this.player.x, this.player.y, 22, "#55ffd3");
    this.onAnnounce({ message: `Wave ${this.wave} engaged`, tone: "info", withVoice: this.wave % 3 === 0 });
    if (this.wave % 5 === 0) {
      this.onAnnounce({ message: "Boss wave incoming", tone: "warn", withVoice: true });
    }
  }

  endRun(reason = "death") {
    this.gameOver = true;
    this.running = false;
    this.runResult = reason;
    this.stopAmbience();
    this.career.totalKills += this.killsThisRun;
    if (reason === "death") this.career.totalDeaths += 1;
    this.career.bestWave = Math.max(this.career.bestWave || 1, this.wave);
    this.career.totalPlaySeconds += Math.floor(this.missionElapsed);
    saveCareerProfile(this.career);
    this.onGameOver({
      score: Math.floor(this.score),
      wave: this.wave,
      result: this.runResult,
      won: this.runWon,
      campaignMission: this.campaign ? this.campaign.mission.title : "",
    });
  }

  getNetworkSnapshot() {
    return {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      hp: Math.max(0, Math.floor(this.player.health)),
      shield: Math.max(0, Math.floor(this.player.shield)),
      wave: this.wave,
      score: Math.floor(this.score),
      ts: Date.now(),
    };
  }

  applyNetworkPacket(packet) {
    if (!packet || packet.type !== "snapshot") return;
    if (!packet.playerName) return;
    this.remotePlayers.set(packet.playerName, {
      x: Number(packet.x) || 0,
      y: Number(packet.y) || 0,
      hp: Number(packet.hp) || 0,
      score: Number(packet.score) || 0,
      wave: Number(packet.wave) || 1,
      updatedAt: Date.now(),
    });
  }

  pruneRemotePlayers() {
    const now = Date.now();
    for (const [name, peer] of this.remotePlayers.entries()) {
      if (now - peer.updatedAt > 3000) this.remotePlayers.delete(name);
    }
  }

  hitBurst(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 260);
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ttl: rand(0.2, 0.6), color });
    }
  }

  sfx(freq, duration, type, gainValue) {
    if (!this.sfxEnabled) return;
    try {
      this.ensureAudioContext();
      const now = this.audioCtx.currentTime;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.72), now + duration);
      gain.gain.setValueAtTime(Math.max(0.0001, gainValue), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + duration);
    } catch {
      // no-op when audio context is unavailable
    }
  }

  pushHud() {
    const totalHostiles = this.waveSpawnBudget + this.enemies.length;
    let objective = totalHostiles > 0 ? `Survive wave ${this.wave} · hostiles ${totalHostiles}` : `Advance to wave ${this.wave + 1}`;
    if (this.campaign) {
      const mission = this.campaign.mission;
      objective = `${mission.title} · wave ${this.wave}/${mission.targetWave} · kills ${this.killsThisRun}/${mission.targetKills}`;
    }
    this.onHud({
      hp: Math.floor(this.player.health),
      maxHp: Math.floor(this.player.maxHealth),
      shield: Math.floor(this.player.shield),
      score: Math.floor(this.score),
      wave: this.wave,
      level: this.player.level,
      xpRatio: clamp(this.player.xp / levelXpRequired(this.player.level), 0, 1),
      timer: this.missionElapsed,
      objective,
      combo: this.combo,
      lives: this.livesRemaining,
      career: this.getCareerSnapshot(),
    });
  }

  renderGrid() {
    const { ctx } = this;
    ctx.strokeStyle = "rgba(98, 137, 220, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
  }

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);

    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const sx = rand(-1, 1) * 8 * shake;
      const sy = rand(-1, 1) * 8 * shake;
      ctx.save();
      ctx.translate(sx, sy);
      this.trauma = Math.max(0, this.trauma - 0.04);
    }

    this.renderGrid();

    for (const pickup of this.pickups) {
      const glow = 1 + Math.sin(pickup.pulse * 7) * 0.2;
      ctx.beginPath();
      ctx.fillStyle = pickup.kind === "heal" ? "#5cff89" : "#55ffd3";
      ctx.arc(pickup.x, pickup.y, pickup.radius * glow, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.ttl * 2.2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.fillStyle = COLORS.bullet;
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const bullet of this.enemyBullets) {
      ctx.beginPath();
      ctx.fillStyle = COLORS.enemyBullet;
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const enemy of this.enemies) {
      ctx.beginPath();
      ctx.fillStyle = enemy.color;
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (enemy.type === "boss") {
        const hpRatio = clamp(enemy.hp / (560 + this.wave * 45), 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(enemy.x - 40, enemy.y - enemy.radius - 14, 80, 7);
        ctx.fillStyle = "#ff5d7a";
        ctx.fillRect(enemy.x - 40, enemy.y - enemy.radius - 14, 80 * hpRatio, 7);
      }
    }

    for (const [name, peer] of this.remotePlayers.entries()) {
      ctx.beginPath();
      ctx.fillStyle = "#55ffd3";
      ctx.arc(peer.x, peer.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(216,242,255,0.95)";
      ctx.font = "600 11px system-ui";
      ctx.fillText(name, peer.x - 22, peer.y - 20);
    }

    const aim = angleTo(this.player, { x: this.input.aimX, y: this.input.aimY });
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(aim);

    if (this.player.shield > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(85,255,211,0.35)";
      ctx.lineWidth = 4;
      ctx.arc(0, 0, this.player.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = COLORS.player;
    ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#11244f";
    ctx.beginPath();
    ctx.moveTo(2, -4);
    ctx.lineTo(this.player.radius + 11, 0);
    ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.wave % 5 === 0) {
      ctx.fillStyle = "rgba(255,93,122,0.9)";
      ctx.font = "700 16px system-ui";
      ctx.fillText("BOSS WAVE", WORLD.width / 2 - 48, 40);
    }

    if (shake > 0.0001) {
      ctx.restore();
    }
  }
}
