export const STORAGE_KEY = "operation-browser-strike-best";
export const SETTINGS_KEY = "operation-browser-strike-settings";
export const CAREER_KEY = "operation-browser-strike-career";

export const WORLD = {
  width: 1280,
  height: 720,
};

export const COLORS = {
  player: "#7ec2ff",
  shield: "#55ffd3",
  bullet: "#d8f2ff",
  enemyBullet: "#ff7f8f",
  chaser: "#ff6d8a",
  shooter: "#ffb366",
  tank: "#a98aff",
  boss: "#ff3f64",
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function loadBestScore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function saveBestScore(score) {
  localStorage.setItem(STORAGE_KEY, String(Math.floor(score)));
}

export function defaultGameSettings() {
  return {
    startHp: 180,
    extraLives: 3,
    enemyIntensity: 0.9,
    gameMode: "survival",
    gamepadEnabled: true,
    gamepadDeadzone: 0.18,
    mpServerUrl: "",
    mpRoom: "alpha-squad",
    mpPlayerName: "SKYE-01",
    mpToken: "",
  };
}

export function loadGameSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaultGameSettings(), ...parsed };
  } catch {
    return defaultGameSettings();
  }
}

export function saveGameSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultGameSettings(), ...settings }));
}

export function defaultCareerProfile() {
  return {
    totalKills: 0,
    totalRuns: 0,
    totalDeaths: 0,
    bestWave: 1,
    totalPlaySeconds: 0,
    campaignUnlocked: 1,
    campaignCompleted: false,
  };
}

export function loadCareerProfile() {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaultCareerProfile(), ...parsed };
  } catch {
    return defaultCareerProfile();
  }
}

export function saveCareerProfile(profile) {
  localStorage.setItem(CAREER_KEY, JSON.stringify({ ...defaultCareerProfile(), ...profile }));
}

export function levelXpRequired(level) {
  return Math.floor(70 + level * 42 + level * level * 8);
}

export function buildUpgradePool() {
  return [
    {
      id: "damage",
      name: "High-Caliber Rounds",
      desc: "+20% bullet damage",
      apply: (game) => { game.player.damage *= 1.2; },
    },
    {
      id: "firerate",
      name: "Overclocked Trigger",
      desc: "+18% fire rate",
      apply: (game) => { game.player.fireInterval *= 0.82; },
    },
    {
      id: "multishot",
      name: "Forkshot",
      desc: "+1 projectile spread",
      apply: (game) => { game.player.projectiles += 1; },
    },
    {
      id: "movespeed",
      name: "Lightframe Boots",
      desc: "+14% movement speed",
      apply: (game) => { game.player.speed *= 1.14; },
    },
    {
      id: "maxhp",
      name: "Plated Core",
      desc: "+20 max HP and heal 20",
      apply: (game) => {
        game.player.maxHealth += 20;
        game.player.health = Math.min(game.player.maxHealth, game.player.health + 20);
      },
    },
    {
      id: "shield",
      name: "Shield Matrix",
      desc: "+30 shield",
      apply: (game) => { game.player.shield += 30; },
    },
    {
      id: "dash",
      name: "Blink Thrusters",
      desc: "Dash cooldown -20%",
      apply: (game) => { game.player.dashCooldown *= 0.8; },
    },
    {
      id: "lifesteal",
      name: "Nanite Leech",
      desc: "Heal 5% of bullet damage dealt",
      apply: (game) => { game.player.lifesteal += 0.05; },
    },
  ];
}
