
const STORAGE_KEY = 'cohortCommandCenterV2';
const REMOTE_SYNC_DELAY_MS = 500;
const STUDENT_REMOTE_SESSION_KEY = '0s_cohort_student_remote_session';

const defaultState = {
  founder: { code: '', session: false },
  studentSession: { id: '', active: false },
  cohort: {
    name: '0s Founder Cohort',
    term: 'Founder-led elite open invitation lane',
    location: 'Phoenix · Chicago · Houston · Denver',
    startDate: '',
    promise: 'This is a founder-led build room. Students leave with a branded product direction, a real working lane, an AI or automation lane, and a monetization path.'
  },
  letters: {
    subject: 'Welcome to the 0s Founder Cohort',
    signature: 'Skyes Over London',
    intro: 'Welcome to the cohort. This room is founder-led, build-first, and built around clarity, discipline, and a real product outcome.',
    body: 'Over the next 7 days you are expected to build daily, tighten daily, and leave with a product you can explain clearly. This is not a passive class. This is a serious build environment.'
  },
  instructor: {
    resetNotes: '',
    notes: {
      'day-1': '', 'day-2': '', 'day-3': '', 'day-4': '', 'day-5': '', 'day-6': '', 'day-7': ''
    }
  },
  students: [],
  wiring: {
    identity: '', founderRole: 'founder_admin', forms: '', welcomeWebhook: '', blobs: '', exports: '', neon: '', neonTable: 'cohort_students'
  },
  generatedPreviewId: '',
  lastSaved: ''
};

let remoteSyncTimer = 0;
let studentRemoteSyncTimer = 0;
let founderConfigDraft = {};

let state = loadState();
let currentGeneratedStudentId = state.generatedPreviewId || '';

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw);
    return deepMerge(clone(defaultState), parsed);
  } catch {
    return clone(defaultState);
  }
}

function adminToken() {
  try {
    return sessionStorage.getItem('KAIXU_ADMIN_TOKEN') || '';
  } catch {
    return '';
  }
}

function readStudentRemoteSession() {
  try {
    const raw = sessionStorage.getItem(STUDENT_REMOTE_SESSION_KEY) || '';
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    return {
      id: String(parsed.id || '').trim(),
      email: String(parsed.email || '').trim()
    };
  } catch {
    return null;
  }
}

function writeStudentRemoteSession(session) {
  try {
    if (!session || !session.id) {
      sessionStorage.removeItem(STUDENT_REMOTE_SESSION_KEY);
      return null;
    }
    const next = {
      id: String(session.id || '').trim(),
      email: String(session.email || '').trim()
    };
    sessionStorage.setItem(STUDENT_REMOTE_SESSION_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function clearStudentRemoteSession() {
  try {
    sessionStorage.removeItem(STUDENT_REMOTE_SESSION_KEY);
  } catch {}
}

function canUseRemoteState() {
  return !!String(adminToken()).trim();
}

function normalizeLoadedState(next, preserveLocalSessions = false) {
  const merged = deepMerge(clone(defaultState), next || {});
  merged.students = (merged.students || []).map(ensureStudentShape);
  if (preserveLocalSessions) {
    merged.founder = {
      ...merged.founder,
      code: state?.founder?.code || '',
      session: !!state?.founder?.session
    };
    merged.studentSession = state?.studentSession || { id: '', active: false };
  }
  return merged;
}

function remotePayload() {
  const snapshot = normalizeLoadedState(state);
  snapshot.founder = {
    ...snapshot.founder,
    code: '',
    session: false
  };
  snapshot.studentSession = { id: '', active: false };
  return snapshot;
}

async function requestFounderConfig(method = 'GET', body) {
  const token = adminToken().trim();
  if (!token) return null;

  const response = await fetch('/.netlify/functions/admin-cohort-command', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Remote state request failed (${response.status})`);
  }

  return await response.json().catch(() => null);
}

async function requestFounderStudents(method = 'GET', body) {
  const token = adminToken().trim();
  if (!token) return null;

  const response = await fetch('/.netlify/functions/admin-cohort-command-students', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Founder student request failed (${response.status})`);
  }

  return await response.json().catch(() => null);
}

function applyFounderRemoteState(nextState) {
  if (!nextState) return false;
  state = normalizeLoadedState(nextState, true);
  currentGeneratedStudentId = state.generatedPreviewId || currentGeneratedStudentId || '';
  saveState({ skipRemote: true });
  return true;
}

function buildConfigPatchForPath(path, value) {
  const patch = {};
  setPath(patch, path, value);
  return patch;
}

function queueFounderConfigSync(patch = {}) {
  if (!canUseRemoteState()) return;
  founderConfigDraft = deepMerge(founderConfigDraft, patch || {});
  clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(async () => {
    const payload = founderConfigDraft;
    founderConfigDraft = {};
    try {
      const saved = await requestFounderConfig('PUT', payload);
      if (saved?.state) {
        applyFounderRemoteState(saved.state);
        renderAll();
      }
    } catch (error) {
      console.warn('cohort founder config sync failed:', error?.message || error);
    }
  }, REMOTE_SYNC_DELAY_MS);
}

async function hydrateRemoteState() {
  if (!canUseRemoteState()) return false;

  try {
    const payload = await requestFounderConfig('GET');
    if (!payload?.state) return false;
    return applyFounderRemoteState(payload.state);
  } catch (error) {
    console.warn('cohort remote hydrate failed:', error?.message || error);
    return false;
  }
}

async function requestStudentLane(method = 'GET', payload = null) {
  const query = payload && method === 'GET'
    ? `?student_id=${encodeURIComponent(payload.student_id || '')}&email=${encodeURIComponent(payload.email || '')}`
    : '';

  const response = await fetch(`/.netlify/functions/cohort-command-student${query}`, {
    method,
    headers: payload && method !== 'GET' ? { 'content-type': 'application/json' } : undefined,
    body: payload && method !== 'GET' ? JSON.stringify(payload) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Student lane request failed (${response.status})`);
  }
  return data;
}

function applyRemoteStudentLane(lane, options = {}) {
  if (!lane?.student) return false;
  const preserveSessions = options.preserveSessions !== false;
  const localStudentSession = preserveSessions ? state.studentSession : { id: '', active: false };
  const nextState = deepMerge(clone(defaultState), {
    ...state,
    cohort: lane.cohort || state.cohort,
    letters: lane.letters || state.letters,
    students: [ensureStudentShape(lane.student)]
  });
  nextState.students = (nextState.students || []).map(ensureStudentShape);
  nextState.studentSession = localStudentSession;
  state = nextState;
  saveState({ skipRemote: true });
  return true;
}

async function hydrateStudentRemoteSession() {
  const session = readStudentRemoteSession();
  if (!session?.id) return false;

  try {
    const payload = await requestStudentLane('GET', { student_id: session.id, email: session.email || '' });
    if (!payload?.lane?.student) return false;
    state.studentSession = { id: payload.lane.student.id, active: true };
    applyRemoteStudentLane(payload.lane);
    return true;
  } catch (error) {
    console.warn('cohort student hydrate failed:', error?.message || error);
    return false;
  }
}

function queueStudentRemoteSync() {
  const session = readStudentRemoteSession();
  const student = currentStudent();
  if (!session?.id || !student) return;
  clearTimeout(studentRemoteSyncTimer);
  studentRemoteSyncTimer = setTimeout(async () => {
    try {
      const payload = await requestStudentLane('POST', {
        student_id: session.id,
        email: session.email || '',
        patch: {
          name: student.name,
          email: student.email,
          profile: student.profile,
          workbook: student.workbook,
          demo: student.demo,
          selfScore: student.selfScore
        }
      });
      if (payload?.lane) {
        state.studentSession = { id: payload.lane.student.id, active: true };
        applyRemoteStudentLane(payload.lane);
      }
    } catch (error) {
      console.warn('cohort student sync failed:', error?.message || error);
    }
  }, REMOTE_SYNC_DELAY_MS);
}

function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    Object.keys(extra || {}).forEach((key) => {
      if (key in base) out[key] = deepMerge(base[key], extra[key]);
      else out[key] = extra[key];
    });
    return out;
  }
  return extra === undefined ? base : extra;
}
function saveState(options = {}) {
  state.lastSaved = new Date().toLocaleString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateGlobalIndicators();
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let target = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
    target = target[key];
  }
  target[parts[0]] = value;
}
function getPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : '', obj);
}
function qs(sel, scope = document) { return scope.querySelector(sel); }
function qsa(sel, scope = document) { return Array.from(scope.querySelectorAll(sel)); }
function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
function generateStudentId() {
  const year = new Date().getFullYear();
  let id;
  do {
    id = `0S-${year}-${randomCode()}`;
  } while (state.students.some((s) => s.id === id));
  return id;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
function updateText(sel, text, scope = document) { qsa(sel, scope).forEach((el) => el.textContent = text); }
function updateHtml(sel, html, scope = document) { qsa(sel, scope).forEach((el) => el.innerHTML = html); }
function activeStudents() { return state.students.filter((s) => s.status === 'active'); }
function currentStudent() { return state.students.find((s) => s.id === state.studentSession.id) || null; }
function ensureStudentShape(student) {
  student.attendance = student.attendance || { day1:false, day2:false, day3:false, day4:false, day5:false, day6:false, day7:false };
  student.profile = student.profile || { productName:'', industry:'', vision:'' };
  student.workbook = student.workbook || {};
  student.demo = student.demo || { name:'', user:'', feature:'', ai:'', offer:'', next:'', reflection:'' };
  student.selfScore = student.selfScore || { clarity:'', coherence:'', feature:'', ai:'', money:'', trust:'', presentation:'', overall:'' };
  student.founderScore = student.founderScore || { clarity:'', coherence:'', feature:'', ai:'', money:'', trust:'', presentation:'', overall:'', notes:'' };
  ['day-1','day-2','day-3','day-4','day-5','day-6','day-7'].forEach((d) => {
    student.workbook[d] = student.workbook[d] || { output:'', questions:'', notes:'', homework:'', done:false, needsHelp:false };
  });
  return student;
}
state.students = state.students.map(ensureStudentShape);

function updateGlobalIndicators() {
  updateText('[data-last-saved]', state.lastSaved || 'Not saved');
  updateText('[data-student-count]', String(state.students.length));
  updateText('[data-active-student-count]', String(activeStudents().length));
  updateText('[data-founder-session-label]', state.founder.session ? 'Unlocked' : 'Locked');
  updateText('[data-founder-session-status]', state.founder.session ? 'Unlocked' : 'Locked');
  updateText('[data-student-session-label]', state.studentSession.active ? 'Unlocked' : 'Locked');
  updateText('[data-student-session-status]', state.studentSession.active ? 'Unlocked' : 'Locked');
  updateText('[data-founder-code-status]', state.founder.code ? 'Set on this device' : 'Not set on this device');
  const student = currentStudent();
  updateText('[data-student-name]', student ? student.name : 'Unknown');
  updateText('[data-student-id-label]', student ? student.id : 'Locked');
  updateText('[data-student-id-card]', student ? student.id : '0S-LOCKED');
  updateText('[data-student-track]', student ? student.track : 'Unknown');
  updateText('[data-student-seat]', student ? (student.seat || 'Seat not set') : 'Seat');
  updateText('[data-student-org]', student ? (student.org || 'Independent') : 'Organization');
  updateText('[data-student-status]', student ? student.status : 'Status');
}

function bindSavedInputs() {
  qsa('[data-bind]').forEach((el) => {
    const path = el.dataset.bind;
    const value = getPath(state, path);
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value || '';
    if (el.dataset.boundBind === '1') return;
    el.dataset.boundBind = '1';
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const next = el.type === 'checkbox' ? el.checked : el.value;
      setPath(state, path, next);
      saveState();
      if (!['founder', 'studentSession', 'students', 'lastSaved'].some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) {
        queueFounderConfigSync(buildConfigPatchForPath(path, next));
      }
      renderAll();
    });
  });
}

function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtml(title, html) {
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#111;line-height:1.6}h1,h2,h3{margin:0 0 12px} .muted{color:#444} .card{border:1px solid #ccc;border-radius:18px;padding:16px;margin-bottom:16px} .id{font-size:32px;font-weight:800;letter-spacing:.12em} a{color:#111} </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function setupGlobalActions() {
  qsa('[data-action="print"]').forEach((btn) => btn.addEventListener('click', () => window.print()));
  qsa('[data-action="export-app"]').forEach((btn) => btn.addEventListener('click', () => downloadFile('0s-cohort-command-data.json', JSON.stringify(state, null, 2), 'application/json')));
  qsa('[data-action="import-app"]').forEach((btn) => btn.addEventListener('click', () => qs('[data-action="import-input"]')?.click()));
  const input = qs('[data-action="import-input"]');
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      state = deepMerge(clone(defaultState), imported);
      state.students = (state.students || []).map(ensureStudentShape);
      saveState();
      renderAll();
      alert('App data imported.');
    } catch {
      alert('That file could not be imported.');
    }
    e.target.value = '';
  });
}

function setupFounderAuth() {
  const code = qs('[data-founder-code]');
  const confirm = qs('[data-founder-code-confirm]');
  qs('[data-founder-setup]')?.addEventListener('click', () => {
    if (!code?.value.trim()) return alert('Enter a founder code first.');
    if (code.value !== confirm?.value) return alert('Founder code and confirmation do not match.');
    state.founder.code = code.value.trim();
    state.founder.session = true;
    saveState();
    renderAll();
    location.href = 'founder-dashboard.html';
  });
  qs('[data-founder-login]')?.addEventListener('click', () => {
    if (!state.founder.code) return alert('Set the founder code on this device first.');
    if (code?.value.trim() !== state.founder.code) return alert('Founder code did not match.');
    state.founder.session = true;
    saveState();
    renderAll();
    location.href = 'founder-dashboard.html';
  });
  qsa('[data-founder-logout]').forEach((btn) => btn.addEventListener('click', () => {
    state.founder.session = false;
    saveState();
    renderAll();
  }));
}

function setupStudentAuth() {
  const idInput = qs('[data-student-login-id]');
  const emailInput = qs('[data-student-login-email]');
  qs('[data-student-login]')?.addEventListener('click', async () => {
    const id = idInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    if (!id) return alert('Enter the student ID first.');

    try {
      const payload = await requestStudentLane('GET', { student_id: id, email });
      if (payload?.lane?.student) {
        state.studentSession = { id: payload.lane.student.id, active: true };
        writeStudentRemoteSession({ id: payload.lane.student.id, email });
        applyRemoteStudentLane(payload.lane);
        renderAll();
        location.href = 'student-portal.html';
        return;
      }
    } catch (error) {
      console.warn('cohort student remote login failed:', error?.message || error);
    }

    const student = state.students.find((s) => s.id === id);
    if (!student) return alert('That student ID does not exist in the current app data.');
    if (student.status !== 'active') return alert('That student seat is not active yet.');
    if (email && student.email && student.email.toLowerCase() !== email) return alert('That email does not match the generated student record.');
    state.studentSession = { id: student.id, active: true };
    writeStudentRemoteSession({ id: student.id, email });
    saveState();
    renderAll();
    location.href = 'student-portal.html';
  });
  qsa('[data-student-logout]').forEach((btn) => btn.addEventListener('click', () => {
    state.studentSession = { id: '', active: false };
    clearStudentRemoteSession();
    saveState();
    renderAll();
  }));
}

function setupRouteGuards() {
  const route = document.body.dataset.route;
  if (['founder-dashboard','instructor-book'].includes(route)) {
    qsa('[data-guard="founder"]').forEach((el) => el.style.display = state.founder.session ? 'block' : 'none');
    qsa('[data-guard-fail="founder"]').forEach((el) => el.style.display = state.founder.session ? 'none' : 'block');
  }
  if (route === 'student-portal') {
    const ok = state.studentSession.active && !!currentStudent();
    qsa('[data-guard="student"]').forEach((el) => el.style.display = ok ? 'block' : 'none');
    qsa('[data-guard-fail="student"]').forEach((el) => el.style.display = ok ? 'none' : 'block');
  }
}

function renderTabs() {
  const tabs = qsa('[data-tab-target]');
  if (!tabs.length) return;
  const panels = qsa('.tab-panel');
  const activate = (id) => {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tabTarget === id));
    panels.forEach((p) => p.classList.toggle('active', p.id === id));
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.tabTarget)));
  activate(tabs[0].dataset.tabTarget);
}

function renderCurrentGeneratedCard() {
  const student = state.students.find((s) => s.id === currentGeneratedStudentId) || state.students[state.students.length - 1] || null;
  if (!student) return;
  updateText('[data-generated-id]', student.id);
  updateText('[data-generated-name]', student.name || 'Unnamed student');
  updateText('[data-generated-track]', student.track || 'Track');
  updateText('[data-generated-status]', student.status || 'Status');
  updateText('[data-generated-summary]', `${student.name || 'Student'} is now ${student.status}. This ID is live inside the current app data set.`);
}

function clearGeneratorInputs() {
  qsa('[data-generator]').forEach((el) => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
}

function setupGenerator() {
  qs('[data-generate-student]')?.addEventListener('click', async () => {
    const get = (name) => qs(`[data-generator="${name}"]`)?.value.trim() || '';
    const name = get('name');
    if (!name) return alert('Enter the student name first.');
    const student = ensureStudentShape({
      id: generateStudentId(),
      name,
      email: get('email'),
      org: get('org'),
      track: get('track') || 'Founder Cohort',
      seat: get('seat'),
      status: get('status') || 'active',
      notes: get('notes'),
      createdAt: new Date().toLocaleString()
    });
    state.students.unshift(student);
    currentGeneratedStudentId = student.id;
    state.generatedPreviewId = student.id;
    saveState();
    if (canUseRemoteState()) {
      try {
        const saved = await requestFounderStudents('POST', { student });
        if (saved?.state) applyFounderRemoteState(saved.state);
        queueFounderConfigSync({ generatedPreviewId: student.id });
      } catch (error) {
        console.warn('cohort founder student create failed:', error?.message || error);
      }
    }
    renderAll();
  });
  qs('[data-clear-generator]')?.addEventListener('click', clearGeneratorInputs);
  qs('[data-copy-id]')?.addEventListener('click', async () => {
    const student = state.students.find((s) => s.id === currentGeneratedStudentId) || state.students[0];
    if (!student) return alert('No generated ID to copy yet.');
    try { await navigator.clipboard.writeText(student.id); alert('Student ID copied.'); } catch { alert(student.id); }
  });
  qs('[data-print-id-card]')?.addEventListener('click', () => {
    const student = state.students.find((s) => s.id === currentGeneratedStudentId) || state.students[0];
    if (!student) return alert('Generate a student first.');
    printHtml('Student ID Card', `<div class="card"><h1>${escapeHtml(student.name)}</h1><div class="id">${escapeHtml(student.id)}</div><p>${escapeHtml(student.track || '')} · ${escapeHtml(student.org || 'Independent')}</p><p>Status: ${escapeHtml(student.status)}</p><p>Seat: ${escapeHtml(student.seat || 'Not set')}</p></div>`);
  });
}

function fillSelect(select, students) {
  if (!select) return;
  const current = select.value;
  const options = students.length ? students.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} · ${escapeHtml(s.id)}</option>`).join('') : '<option value="">No students generated yet</option>';
  select.innerHTML = options;
  if (students.some((s) => s.id === current)) select.value = current;
}

function renderLetter(student) {
  if (!student) return '<p class="muted">Generate a student seat or select a student record to build the letter.</p>';
  const cohortName = state.cohort.name || '0s Founder Cohort';
  const start = state.cohort.startDate ? new Date(state.cohort.startDate).toLocaleDateString() : 'TBD';
  return `
    <h2>${escapeHtml(state.letters.subject)}</h2>
    <p><strong>To:</strong> ${escapeHtml(student.name)}${student.email ? ` · ${escapeHtml(student.email)}` : ''}</p>
    <p>${escapeHtml(state.letters.intro)}</p>
    <p>${escapeHtml(state.letters.body)}</p>
    <p><strong>Your issued cohort ID:</strong> ${escapeHtml(student.id)}</p>
    <p><strong>Cohort:</strong> ${escapeHtml(cohortName)}<br><strong>Track:</strong> ${escapeHtml(student.track || 'Founder Cohort')}<br><strong>Start:</strong> ${escapeHtml(start)}</p>
    <p>Use your generated ID inside the student access lane to enter your class materials, notes, and workbook.</p>
    <p>Sincerely,<br>${escapeHtml(state.letters.signature)}</p>
  `;
}

function setupLetters() {
  const select = qs('[data-letter-student]');
  fillSelect(select, state.students);
  const chosen = () => state.students.find((s) => s.id === (select?.value || currentGeneratedStudentId)) || state.students[0] || null;
  function draw() { updateHtml('[data-letter-preview]', renderLetter(chosen())); }
  select?.addEventListener('change', draw);
  qs('[data-render-letter]')?.addEventListener('click', draw);
  qs('[data-open-letter]')?.addEventListener('click', () => {
    if (!state.students.length) return alert('Generate a student first.');
    location.hash = '#letters';
    fillSelect(select, state.students);
    if (currentGeneratedStudentId) select.value = currentGeneratedStudentId;
    draw();
  });
  qs('[data-print-letter]')?.addEventListener('click', () => {
    const student = chosen();
    if (!student) return alert('No student selected.');
    printHtml('Welcome Letter', renderLetter(student));
  });
  qs('[data-export-letter]')?.addEventListener('click', () => {
    const student = chosen();
    if (!student) return alert('No student selected.');
    downloadFile(`${slugify(student.name || 'student')}-welcome-letter.html`, renderLetter(student), 'text/html');
  });
  draw();
}

function renderStudentTable() {
  const tbody = qs('[data-student-table]');
  if (!tbody) return;
  if (!state.students.length) {
    tbody.innerHTML = '<tr><td colspan="13"><div class="empty-state">No students generated yet.</div></td></tr>';
    return;
  }
  tbody.innerHTML = state.students.map((student) => {
    ensureStudentShape(student);
    const days = [1,2,3,4,5,6,7].map((d) => `<td><input type="checkbox" data-attendance-id="${student.id}" data-day="day${d}" ${student.attendance[`day${d}`] ? 'checked' : ''}></td>`).join('');
    return `
      <tr>
        <td><span class="student-badge">${escapeHtml(student.id)}</span></td>
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.email)}</td>
        <td>${escapeHtml(student.track)}</td>
        <td>
          <select data-status-id="${student.id}">
            <option value="active" ${student.status === 'active' ? 'selected' : ''}>active</option>
            <option value="pending" ${student.status === 'pending' ? 'selected' : ''}>pending</option>
            <option value="hold" ${student.status === 'hold' ? 'selected' : ''}>hold</option>
          </select>
        </td>
        ${days}
        <td><textarea data-notes-id="${student.id}">${escapeHtml(student.notes || '')}</textarea></td>
      </tr>`;
  }).join('');
  qsa('[data-attendance-id]').forEach((el) => el.addEventListener('change', () => {
    const student = state.students.find((s) => s.id === el.dataset.attendanceId);
    if (!student) return;
    student.attendance[el.dataset.day] = el.checked;
    saveState();
    if (canUseRemoteState()) {
      requestFounderStudents('PATCH', {
        student_id: student.id,
        patch: { attendance: student.attendance }
      }).then((saved) => {
        if (saved?.state) {
          applyFounderRemoteState(saved.state);
          renderAll();
        }
      }).catch((error) => console.warn('cohort attendance patch failed:', error?.message || error));
    }
  }));
  qsa('[data-status-id]').forEach((el) => el.addEventListener('change', () => {
    const student = state.students.find((s) => s.id === el.dataset.statusId);
    if (!student) return;
    student.status = el.value;
    saveState(); renderAll();
    if (canUseRemoteState()) {
      requestFounderStudents('PATCH', {
        student_id: student.id,
        patch: { status: student.status }
      }).then((saved) => {
        if (saved?.state) {
          applyFounderRemoteState(saved.state);
          renderAll();
        }
      }).catch((error) => console.warn('cohort status patch failed:', error?.message || error));
    }
  }));
  qsa('[data-notes-id]').forEach((el) => el.addEventListener('input', () => {
    const student = state.students.find((s) => s.id === el.dataset.notesId);
    if (!student) return;
    student.notes = el.value;
    saveState();
    if (canUseRemoteState()) {
      requestFounderStudents('PATCH', {
        student_id: student.id,
        patch: { notes: student.notes }
      }).then((saved) => {
        if (saved?.state) {
          applyFounderRemoteState(saved.state);
          renderAll();
        }
      }).catch((error) => console.warn('cohort notes patch failed:', error?.message || error));
    }
  }));
}

function setupRosterActions() {
  qs('[data-export-roster-csv]')?.addEventListener('click', () => {
    const header = ['id','name','email','org','track','seat','status','day1','day2','day3','day4','day5','day6','day7','notes'];
    const lines = [header.join(',')];
    state.students.forEach((s) => {
      ensureStudentShape(s);
      lines.push([
        s.id,s.name,s.email,s.org,s.track,s.seat,s.status,
        s.attendance.day1,s.attendance.day2,s.attendance.day3,s.attendance.day4,s.attendance.day5,s.attendance.day6,s.attendance.day7,
        JSON.stringify(s.notes || '')
      ].map((x) => `"${String(x ?? '').replace(/"/g,'""')}"`).join(','));
    });
    downloadFile('cohort-roster.csv', lines.join('\n'), 'text/csv');
  });
  qs('[data-clear-students]')?.addEventListener('click', async () => {
    if (!confirm('Clear all generated students from this device data set?')) return;
    state.students = [];
    state.studentSession = { id:'', active:false };
    currentGeneratedStudentId = '';
    saveState(); renderAll();
    if (canUseRemoteState()) {
      try {
        const cleared = await requestFounderStudents('DELETE', { clear_all: true });
        if (cleared?.state) applyFounderRemoteState(cleared.state);
        queueFounderConfigSync({ generatedPreviewId: '' });
        renderAll();
      } catch (error) {
        console.warn('cohort clear students failed:', error?.message || error);
      }
    }
  });
}

function setupScoring() {
  const select = qs('[data-score-student]');
  fillSelect(select, state.students);
  function loadStudentScore() {
    const student = state.students.find((s) => s.id === select?.value) || state.students[0];
    qsa('[data-score-field]').forEach((input) => input.value = student?.founderScore?.[input.dataset.scoreField] || '');
    const notes = qs('[data-score-notes]');
    if (notes) notes.value = student?.founderScore?.notes || '';
  }
  select?.addEventListener('change', loadStudentScore);
  qs('[data-save-score]')?.addEventListener('click', async () => {
    const student = state.students.find((s) => s.id === select?.value) || state.students[0];
    if (!student) return alert('No student selected.');
    qsa('[data-score-field]').forEach((input) => { student.founderScore[input.dataset.scoreField] = input.value; });
    const notes = qs('[data-score-notes]');
    student.founderScore.notes = notes?.value || '';
    saveState();
    if (canUseRemoteState()) {
      try {
        const saved = await requestFounderStudents('PATCH', {
          student_id: student.id,
          patch: { founderScore: student.founderScore }
        });
        if (saved?.state) applyFounderRemoteState(saved.state);
      } catch (error) {
        console.warn('cohort founder score patch failed:', error?.message || error);
      }
    }
    alert('Founder score saved.');
  });
  qs('[data-print-score]')?.addEventListener('click', () => {
    const student = state.students.find((s) => s.id === select?.value) || state.students[0];
    if (!student) return alert('No student selected.');
    const score = student.founderScore;
    printHtml('Founder Score Sheet', `<div class="card"><h1>${escapeHtml(student.name)}</h1><p><strong>ID:</strong> ${escapeHtml(student.id)}</p><ul>${['clarity','coherence','feature','ai','money','trust','presentation','overall'].map((k)=>`<li><strong>${k}:</strong> ${escapeHtml(score[k] || '')}</li>`).join('')}</ul><p>${escapeHtml(score.notes || '')}</p></div>`);
  });
  loadStudentScore();
}

function setupWiring() {
  qs('[data-export-wiring]')?.addEventListener('click', () => downloadFile('cohort-wiring-map.json', JSON.stringify(state.wiring, null, 2), 'application/json'));
}

function bindStudentPortal() {
  const student = currentStudent();
  if (!student) return;
  ensureStudentShape(student);
  updateHtml('[data-student-letter]', renderLetter(student));
  qsa('[data-student-profile]').forEach((input) => {
    const field = input.dataset.studentProfile;
    const value = field === 'name' ? student.name : field === 'email' ? student.email : student.profile[field] || '';
    input.value = value;
    if (input.dataset.boundStudentProfile === '1') return;
    input.dataset.boundStudentProfile = '1';
    input.addEventListener('input', () => {
      if (field === 'name') student.name = input.value;
      else if (field === 'email') student.email = input.value;
      else student.profile[field] = input.value;
      saveState(); renderAll();
      queueStudentRemoteSync();
    });
  });
  qsa('[data-student-bind]').forEach((input) => {
    const [day, field] = input.dataset.studentBind.split('.');
    input.value = student.workbook[day]?.[field] || '';
    if (input.dataset.boundStudentBind === '1') return;
    input.dataset.boundStudentBind = '1';
    input.addEventListener('input', () => {
      student.workbook[day][field] = input.value;
      saveState();
      queueStudentRemoteSync();
    });
  });
  qsa('[data-student-check]').forEach((input) => {
    const [day, field] = input.dataset.studentCheck.split('.');
    input.checked = !!student.workbook[day]?.[field];
    if (input.dataset.boundStudentCheck === '1') return;
    input.dataset.boundStudentCheck = '1';
    input.addEventListener('change', () => {
      student.workbook[day][field] = input.checked;
      saveState();
      queueStudentRemoteSync();
    });
  });
  qsa('[data-student-demo]').forEach((input) => {
    const key = input.dataset.studentDemo;
    input.value = student.demo[key] || '';
    if (input.dataset.boundStudentDemo === '1') return;
    input.dataset.boundStudentDemo = '1';
    input.addEventListener('input', () => {
      student.demo[key] = input.value;
      saveState();
      queueStudentRemoteSync();
    });
  });
  qsa('[data-student-score]').forEach((input) => {
    const key = input.dataset.studentScore;
    input.value = student.selfScore[key] || '';
    if (input.dataset.boundStudentScore === '1') return;
    input.dataset.boundStudentScore = '1';
    input.addEventListener('input', () => {
      student.selfScore[key] = input.value;
      saveState();
      queueStudentRemoteSync();
    });
  });
  qs('[data-student-export]')?.addEventListener('click', () => {
    const payload = { student: student.id, name: student.name, workbook: student.workbook, demo: student.demo, selfScore: student.selfScore, profile: student.profile };
    downloadFile(`${slugify(student.name || 'student')}-notes.json`, JSON.stringify(payload, null, 2), 'application/json');
  });
}

function renderLandingCounters() { updateGlobalIndicators(); }

function setupMisc() {
  qsa('.sidebar a').forEach((link) => link.addEventListener('click', () => {
    qsa('.sidebar a').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
  }));
}

function renderAll() {
  bindSavedInputs();
  updateGlobalIndicators();
  setupRouteGuards();
  renderCurrentGeneratedCard();
  fillSelect(qs('[data-letter-student]'), state.students);
  fillSelect(qs('[data-score-student]'), state.students);
  renderStudentTable();
  renderLandingCounters();
  if (qs('[data-letter-preview]')) {
    const select = qs('[data-letter-student]');
    const student = state.students.find((s) => s.id === select?.value) || state.students.find((s) => s.id === currentGeneratedStudentId) || state.students[0];
    updateHtml('[data-letter-preview]', renderLetter(student));
  }
  bindStudentPortal();
}

async function init() {
  registerSW();
  await hydrateRemoteState();
  await hydrateStudentRemoteSession();
  bindSavedInputs();
  updateGlobalIndicators();
  setupGlobalActions();
  setupFounderAuth();
  setupStudentAuth();
  setupRouteGuards();
  renderTabs();
  setupGenerator();
  setupLetters();
  setupRosterActions();
  setupScoring();
  setupWiring();
  setupMisc();
  renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error('cohort init failed:', error);
  });
});
