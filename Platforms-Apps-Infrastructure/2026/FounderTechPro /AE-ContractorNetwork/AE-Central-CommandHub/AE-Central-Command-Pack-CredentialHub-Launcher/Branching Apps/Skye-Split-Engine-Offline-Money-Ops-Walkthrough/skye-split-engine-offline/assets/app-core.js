import { exportAll, getAll, getOne, putOne } from './db.js';

const SETTINGS_ID = 'app-settings';
const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  companyName: 'Skyes Over London',
  appName: 'Skye Split Engine Ops',
  backgroundMode: 'default',
  backgroundDataUrl: '',
  glassOpacity: 0.52,
  glassBlur: 18,
  accentMode: 'gold-violet',
  currency: 'USD',
  autoSnapshot: true,
  snapshotIntervalMinutes: 20,
  lastSnapshotAt: null,
  updatedAt: new Date().toISOString()
};

export { exportAll };

export function uid(prefix = 'sk') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item';
}

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatCurrency(value, currency = 'USD') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toCSV(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const vals = headers.map((key) => {
      const raw = row[key] ?? '';
      const text = String(raw).replaceAll('"', '""');
      return /[",
]/.test(text) ? `"${text}"` : text;
    });
    lines.push(vals.join(','));
  });
  return lines.join('
');
}

export function parseCSV(text = '') {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '
' || char === '') && !inQuotes) {
      if (char === '' && next === '
') i += 1;
      row.push(current);
      if (row.some((item) => item !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current.length || row.length) {
    row.push(current);
    if (row.some((item) => item !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, idx) => [header, cols[idx] ?? ''])));
}

export function setActiveNav() {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

export async function getSettings() {
  const found = await getOne('settings', SETTINGS_ID);
  if (found) return { ...DEFAULT_SETTINGS, ...found };
  await putOne('settings', DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = {
    ...current,
    ...partial,
    id: SETTINGS_ID,
    updatedAt: new Date().toISOString()
  };
  await putOne('settings', next);
  return next;
}

export function applyTheme(settings) {
  const root = document.documentElement;
  const glassOpacity = Number(settings.glassOpacity ?? 0.52);
  const glassBlur = Number(settings.glassBlur ?? 18);
  root.style.setProperty('--glass-bg', `rgba(22, 14, 43, ${glassOpacity})`);
  root.style.setProperty('--glass-bg-strong', `rgba(18, 12, 35, ${Math.min(glassOpacity + 0.2, 0.9)})`);
  root.style.setProperty('--glass-blur', `${glassBlur}px`);

  if (settings.accentMode === 'ember') {
    root.style.setProperty('--accent', '#ffb27d');
    root.style.setProperty('--accent-2', '#ffd37b');
    root.style.setProperty('--accent-3', '#ff8d8d');
  } else if (settings.accentMode === 'ice') {
    root.style.setProperty('--accent', '#8fd8ff');
    root.style.setProperty('--accent-2', '#b4f0ff');
    root.style.setProperty('--accent-3', '#77a1ff');
  } else {
    root.style.setProperty('--accent', '#c999ff');
    root.style.setProperty('--accent-2', '#f3c96c');
    root.style.setProperty('--accent-3', '#7e5cff');
  }

  if (settings.backgroundMode === 'upload' && settings.backgroundDataUrl) {
    root.style.setProperty('--bg-image', `linear-gradient(180deg, rgba(7,7,13,0.18), rgba(7,7,13,0.62)), url(${settings.backgroundDataUrl})`);
  } else if (settings.backgroundMode === 'nebula') {
    root.style.setProperty('--bg-image', 'radial-gradient(circle at 10% 16%, rgba(201,153,255,0.32), transparent 26%), radial-gradient(circle at 86% 24%, rgba(243,201,108,0.18), transparent 18%), radial-gradient(circle at 50% 80%, rgba(126,92,255,0.18), transparent 22%), linear-gradient(180deg, #05050a, #130d22)');
  } else if (settings.backgroundMode === 'midnight-grid') {
    root.style.setProperty('--bg-image', 'linear-gradient(180deg, rgba(8,7,15,0.95), rgba(10,6,18,0.98)), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px)');
  } else {
    root.style.setProperty('--bg-image', 'radial-gradient(circle at top, rgba(126,92,255,0.35), transparent 30%), radial-gradient(circle at 80% 10%, rgba(243,201,108,0.24), transparent 24%), linear-gradient(180deg, #07070d, #120c1f)');
  }
}

export async function bootPage(pageName = 'Skye Split Engine Ops') {
  const settings = await getSettings();
  applyTheme(settings);
  setActiveNav();
  const titleNode = document.querySelector('[data-company-title]');
  if (titleNode) titleNode.textContent = pageName;
  const brandName = document.querySelector('[data-brand-name]');
  if (brandName) brandName.textContent = settings.appName || 'Skye Split Engine Ops';
  const brandSub = document.querySelector('[data-brand-sub]');
  if (brandSub) brandSub.textContent = `${settings.companyName || 'Skyes Over London'} · Offline money operations + backup vault`;
  const statusCurrency = document.querySelector('[data-status-currency]');
  if (statusCurrency) statusCurrency.textContent = settings.currency || 'USD';
  const lastSaved = document.querySelector('[data-last-sync]');
  if (lastSaved) lastSaved.textContent = 'Local only';
  return settings;
}

export function calcSplitPlan(plan) {
  const gross = Number(plan.gross || 0);
  const fees = Number(plan.fees || 0);
  const reserve = Number(plan.reserve || 0);
  const misc = Number(plan.misc || 0);
  const distributable = gross - fees - reserve - misc;
  const method = plan.method || 'equal';
  const participants = Array.isArray(plan.participants) ? plan.participants : [];
  let result = [];
  const warnings = [];

  if (!participants.length) {
    warnings.push('Add at least one participant to compute a split.');
    return { gross, fees, reserve, misc, distributable, result, warnings, assigned: 0, remainder: distributable };
  }

  if (method === 'equal') {
    const share = distributable / participants.length;
    result = participants.map((person) => ({
      name: person.name || 'Unnamed participant',
      input: 'Equal',
      amount: share
    }));
  }

  if (method === 'percent') {
    const totalPercent = participants.reduce((sum, person) => sum + Number(person.value || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.001) warnings.push(`Percent total is ${totalPercent.toFixed(2)}%. 100% is ideal.`);
    result = participants.map((person) => ({
      name: person.name || 'Unnamed participant',
      input: `${Number(person.value || 0).toFixed(2)}%`,
      amount: distributable * (Number(person.value || 0) / 100)
    }));
  }

  if (method === 'weight') {
    const totalWeight = participants.reduce((sum, person) => sum + Number(person.value || 0), 0);
    if (totalWeight <= 0) {
      warnings.push('Weight mode needs weights greater than zero.');
      result = participants.map((person) => ({ name: person.name || 'Unnamed participant', input: `${Number(person.value || 0)}`, amount: 0 }));
    } else {
      result = participants.map((person) => ({
        name: person.name || 'Unnamed participant',
        input: `${Number(person.value || 0)} weight`,
        amount: distributable * (Number(person.value || 0) / totalWeight)
      }));
    }
  }

  if (method === 'fixed') {
    result = participants.map((person) => ({
      name: person.name || 'Unnamed participant',
      input: formatCurrency(Number(person.value || 0), plan.currency || 'USD'),
      amount: Number(person.value || 0)
    }));
  }

  const assigned = result.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const remainder = distributable - assigned;
  if (distributable < 0) warnings.push('Distributable amount is negative. Check your deductions.');
  if (method === 'fixed' && remainder < 0) warnings.push('Fixed payouts exceed the distributable amount.');
  if (method !== 'fixed' && Math.abs(remainder) > 0.02) warnings.push(`Remainder after allocation: ${formatCurrency(remainder, plan.currency || 'USD')}`);

  return { gross, fees, reserve, misc, distributable, result, warnings, assigned, remainder };
}

export async function logActivity(message, detail = '') {
  const entry = {
    id: uid('act'),
    message,
    detail,
    createdAt: new Date().toISOString()
  };
  await putOne('activity', entry);
  return entry;
}

export async function getRecentActivity(limit = 8) {
  const items = await getAll('activity');
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

export async function maybeAutoSnapshot(reason = 'autosave') {
  const settings = await getSettings();
  if (!settings.autoSnapshot) return false;
  const last = settings.lastSnapshotAt ? new Date(settings.lastSnapshotAt).getTime() : 0;
  const now = Date.now();
  const waitMs = Number(settings.snapshotIntervalMinutes || 20) * 60 * 1000;
  if (now - last < waitMs) return false;

  const payload = await exportAll();
  const snapshot = {
    id: uid('snap'),
    label: `Auto snapshot · ${reason}`,
    createdAt: new Date().toISOString(),
    payload
  };
  await putOne('snapshots', snapshot);
  await saveSettings({ lastSnapshotAt: snapshot.createdAt });
  await logActivity('Auto snapshot created', reason);
  return snapshot;
}

function bytesToBase64(bytes) {
  const arr = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(arr);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupObject(object, passphrase) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(object));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    kind: 'skye-split-encrypted-backup',
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted))
  };
}

export async function decryptBackupObject(payload, passphrase) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function readFileAsText(file) {
  return file.text();
}

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function getCounts() {
  const [contacts, splits, snapshots, templates, deals, receipts] = await Promise.all([
    getAll('contacts'),
    getAll('splits'),
    getAll('snapshots'),
    getAll('templates'),
    getAll('deals'),
    getAll('receipts')
  ]);
  const totalPlanned = splits.reduce((sum, item) => sum + Number(item.summary?.distributable || 0), 0);
  const totalPipeline = deals.reduce((sum, item) => sum + Number(item.net || (Number(item.gross || 0) - Number(item.fees || 0) - Number(item.reserve || 0) - Number(item.misc || 0))), 0);
  return {
    contacts: contacts.length,
    splits: splits.length,
    snapshots: snapshots.length,
    templates: templates.length,
    deals: deals.length,
    receipts: receipts.length,
    totalPlanned,
    totalPipeline
  };
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  }
}
