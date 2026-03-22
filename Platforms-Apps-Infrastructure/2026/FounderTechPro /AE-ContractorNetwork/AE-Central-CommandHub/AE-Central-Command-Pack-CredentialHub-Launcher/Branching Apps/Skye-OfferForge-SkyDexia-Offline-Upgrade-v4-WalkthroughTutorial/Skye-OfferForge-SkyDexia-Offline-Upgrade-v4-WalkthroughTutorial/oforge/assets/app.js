
const APP_KEY = 'skye-offerforge-workspace';
const DB_NAME = 'skyeOfferForgeDB';
const DB_VERSION = 2;
const WORKSPACE_STORE = 'workspace';
const SNAPSHOT_STORE = 'snapshots';
const ATTACHMENT_STORE = 'attachments';
const BACKUP_MIME = 'application/json';
const LOGO_PATH = 'assets/media/skydexia-logo.png';
const FOUNDER_PATH = 'assets/media/founder.png';
const AUTO_SNAPSHOT_MS = 1000 * 60 * 15;
const MAX_SNAPSHOTS = 18;
const PAGE_META = {
  dashboard: {
    title: 'Offline command room for offers, contacts, pricing, and backups.',
    desc: 'Skye-OfferForge is now a real offline workspace: contact vault, offer builder, task desk, reusable templates, polished document output, encrypted backup export, and rolling restore points.'
  },
  contacts: {
    title: 'Contact vault',
    desc: 'Store people, companies, tags, notes, and now local files, screenshots, PDFs, and proof packs offline so every offer starts from a real client record instead of loose scraps.'
  },
  offers: {
    title: 'Offer studio',
    desc: 'Build offers with line items, deposits, taxes, validity windows, scope notes, terms, milestone plans, and local attachments. Duplicate fast, price cleanly, and keep everything local.'
  },
  templates: {
    title: 'Template forge',
    desc: 'Turn good offers into reusable templates. Seed fast packages, services, and contract language so you are not rewriting the same thing every time.'
  },
  tasks: {
    title: 'Follow-up desk',
    desc: 'Track deadlines, reminders, calls, edits, payment follow-ups, and signature nudges. Useful beats flashy every time.'
  },
  docs: {
    title: 'Document output',
    desc: 'Generate a polished offline proposal, quote, and contract view from any saved offer. Print it, download the HTML, or use it live from the app.'
  },
  backup: {
    title: 'Backup center',
    desc: 'Create plain JSON backups, export locked encrypted backups with attachments, restore from file, and roll back to saved snapshots when you need your workspace back.'
  },
  settings: {
    title: 'Visual + workspace settings',
    desc: 'Swap your background, tune the glass, adjust business defaults, and keep the UI layer separated from the background so visual changes are easy.'
  },
  tutorial: {
    title: 'Walkthrough tutorial',
    desc: 'A built-in guided lane for learning the workspace: set your defaults, save a contact, build an offer, attach proof, generate a pack, export a document, and protect the whole workspace with backups.'
  },
  about: {
    title: 'Founder + product notes',
    desc: 'This build carries the SkyDexia identity, runs offline-first, and keeps the founder visible inside the product instead of hiding the brand.'
  }
};

const DemoSeed = {
  settings: {
    workspaceName: 'Skye-OfferForge',
    companyName: 'Skyes Over London',
    founderName: 'Skyes Over London',
    email: 'SkyesOverLondonLC@SOLEnterprises.org',
    phone: '(480) 469-5416',
    website: 'SOLEnterprises.org',
    city: 'Phoenix, AZ',
    currency: 'USD',
    defaultTaxRate: 8.6,
    defaultDepositPercent: 35,
    backgroundImage: null,
    backgroundOpacity: 0.36,
    backgroundDim: 0.45,
    backgroundBlur: 0,
    glassLevel: 0.72,
    cardGlassLevel: 0.76,
    accent: '#8a4dff',
    secondAccent: '#f2c54b'
  },
  contacts: [
    {
      id: uid('ct'),
      fullName: 'Avery Monroe',
      company: 'Monroe Fitness Lab',
      role: 'Owner',
      email: 'avery@example.com',
      phone: '(602) 555-0182',
      city: 'Phoenix',
      state: 'AZ',
      tags: 'fitness, landing page, follow-up',
      notes: 'Wants a cleaner offer with setup fee + monthly support broken out separately.',
      status: 'warm',
      createdAt: Date.now() - 1000 * 60 * 60 * 36,
      updatedAt: Date.now() - 1000 * 60 * 45
    },
    {
      id: uid('ct'),
      fullName: 'Darian Fields',
      company: 'Fields Auto Repair',
      role: 'Manager',
      email: 'darian@example.com',
      phone: '(623) 555-0171',
      city: 'Glendale',
      state: 'AZ',
      tags: 'auto, local seo, quote sent',
      notes: 'Needs quick turnaround and easy payment milestones.',
      status: 'proposal-sent',
      createdAt: Date.now() - 1000 * 60 * 60 * 84,
      updatedAt: Date.now() - 1000 * 60 * 60 * 5
    }
  ],
  offers: [],
  templates: [],
  tasks: []
};

DemoSeed.templates = [
  {
    id: uid('tpl'),
    name: 'Starter service package',
    type: 'offer',
    intro: 'This package is built to get your business live fast with clean design, a strong trust layer, and a simple monthly support lane.',
    scope: 'Launch package includes branded landing page, contact capture, local SEO basics, and one revision cycle.',
    terms: 'Deposit is due up front. Final balance is due before handoff. Monthly support renews every 30 days until cancelled.',
    lineItems: [
      { id: uid('li'), name: 'Launch setup', qty: 1, unitPrice: 1400 },
      { id: uid('li'), name: 'Monthly support', qty: 1, unitPrice: 149 }
    ],
    milestones: [
      { id: uid('ms'), name: 'Deposit', amount: 490, dueLabel: 'At approval' },
      { id: uid('ms'), name: 'Final', amount: 1059, dueLabel: 'Before handoff' }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12
  },
  {
    id: uid('tpl'),
    name: 'Retainer + build hybrid',
    type: 'offer',
    intro: 'This structure keeps the upfront build clear while also showing the ongoing support lane.',
    scope: 'Build, revisions, asset organization, plus recurring optimization support.',
    terms: 'Invoices are due on receipt. Work pauses when payment milestones are missed.',
    lineItems: [
      { id: uid('li'), name: 'Build fee', qty: 1, unitPrice: 2400 },
      { id: uid('li'), name: 'Optimization retainer', qty: 1, unitPrice: 444 }
    ],
    milestones: [
      { id: uid('ms'), name: 'Half down', amount: 1200, dueLabel: 'At approval' },
      { id: uid('ms'), name: 'Completion', amount: 1200, dueLabel: 'At launch' }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2
  }
];

DemoSeed.offers = [
  {
    id: uid('of'),
    title: 'Monroe Fitness Lab Launch Offer',
    clientId: DemoSeed.contacts[0].id,
    status: 'draft',
    validUntil: isoDateOffset(14),
    intro: DemoSeed.templates[0].intro,
    scope: DemoSeed.templates[0].scope,
    terms: DemoSeed.templates[0].terms,
    notes: 'Client wants the pricing easy to follow and monthly support clearly separated.',
    discountType: 'percent',
    discountValue: 0,
    taxRate: 8.6,
    depositPercent: 35,
    lineItems: JSON.parse(JSON.stringify(DemoSeed.templates[0].lineItems)),
    milestones: JSON.parse(JSON.stringify(DemoSeed.templates[0].milestones)),
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 35
  },
  {
    id: uid('of'),
    title: 'Fields Auto Repair Visibility Package',
    clientId: DemoSeed.contacts[1].id,
    status: 'sent',
    validUntil: isoDateOffset(7),
    intro: 'This package is designed to make your offer easy to approve: one clean build fee, one recurring support lane, and simple deliverables.',
    scope: 'Service page system, review request flow, lead capture, and local search structure.',
    terms: 'Deposit confirms the slot. Final amount is due at completion. Monthly support starts 30 days after launch.',
    notes: 'Needs print-ready proposal and contract language.',
    discountType: 'flat',
    discountValue: 100,
    taxRate: 8.6,
    depositPercent: 40,
    lineItems: [
      { id: uid('li'), name: 'Service page system', qty: 1, unitPrice: 1650 },
      { id: uid('li'), name: 'Review automation setup', qty: 1, unitPrice: 495 },
      { id: uid('li'), name: 'Monthly support', qty: 1, unitPrice: 199 }
    ],
    milestones: [
      { id: uid('ms'), name: 'Deposit', amount: 878, dueLabel: 'Today' },
      { id: uid('ms'), name: 'Final', amount: 1366, dueLabel: 'Launch week' }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 9
  }
];

DemoSeed.tasks = [
  {
    id: uid('tk'),
    title: 'Call Monroe Fitness about scope edits',
    dueDate: isoDateOffset(1),
    priority: 'high',
    status: 'open',
    relatedType: 'offer',
    relatedId: DemoSeed.offers[0].id,
    note: 'Confirm monthly support wording and ask if they want a second package option.',
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2
  },
  {
    id: uid('tk'),
    title: 'Send reminder to Fields Auto Repair',
    dueDate: isoDateOffset(2),
    priority: 'medium',
    status: 'open',
    relatedType: 'contact',
    relatedId: DemoSeed.contacts[1].id,
    note: 'Push them toward approval before the validity window closes.',
    createdAt: Date.now() - 1000 * 60 * 60 * 16,
    updatedAt: Date.now() - 1000 * 60 * 60 * 4
  }
];

let appState = null;
let channel = null;
let pageName = 'dashboard';
let deferredPrompt = null;
let logoDataUrlCache = null;

function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;
}
function isoDateOffset(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function htmlizeMultiline(value){
  return escapeHtml(value).replace(/\n/g, '<br/>');
}
function fmtCurrency(n){
  const cur = appState?.settings?.currency || 'USD';
  return new Intl.NumberFormat('en-US', { style:'currency', currency:cur, maximumFractionDigits:2 }).format(Number(n || 0));
}
function fmtDate(ts){
  if(!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}
function fmtShortDate(v){
  if(!v) return '—';
  return new Date(v + 'T00:00:00').toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
}
function slugify(s){
  return String(s||'document').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'document';
}
function byId(id){ return document.getElementById(id); }
function toast(message){
  const wrap = byId('toastWrap') || document.body.appendChild(Object.assign(document.createElement('div'), { id:'toastWrap', className:'toast-wrap' }));
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 240);
  }, 2800);
}

const DB = {
  open(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(WORKSPACE_STORE)){
          db.createObjectStore(WORKSPACE_STORE, { keyPath:'key' });
        }
        if(!db.objectStoreNames.contains(SNAPSHOT_STORE)){
          const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath:'id' });
          store.createIndex('createdAt', 'createdAt', { unique:false });
        }
        if(!db.objectStoreNames.contains(ATTACHMENT_STORE)){
          const store = db.createObjectStore(ATTACHMENT_STORE, { keyPath:'id' });
          store.createIndex('ownerKey', 'ownerKey', { unique:false });
          store.createIndex('createdAt', 'createdAt', { unique:false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getWorkspace(){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readonly');
      const req = tx.objectStore(WORKSPACE_STORE).get(APP_KEY);
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => reject(req.error);
    });
  },
  async saveWorkspace(value){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_STORE).put({ key:APP_KEY, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async listSnapshots(){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(SNAPSHOT_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  },
  async saveSnapshot(record){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteSnapshot(id){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async clearSnapshots(){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async listAllAttachments(){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_STORE, 'readonly');
      const req = tx.objectStore(ATTACHMENT_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  },
  async listAttachmentsByOwner(ownerType, ownerId){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_STORE, 'readonly');
      const idx = tx.objectStore(ATTACHMENT_STORE).index('ownerKey');
      const req = idx.getAll(`${ownerType}:${ownerId}`);
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  },
  async saveAttachment(value){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
      tx.objectStore(ATTACHMENT_STORE).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteAttachment(id){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
      tx.objectStore(ATTACHMENT_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteAttachmentsByOwner(ownerType, ownerId){
    const items = await DB.listAttachmentsByOwner(ownerType, ownerId);
    for(const item of items){
      await DB.deleteAttachment(item.id);
    }
  },
  async clearAttachments(){
    const db = await DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
      tx.objectStore(ATTACHMENT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

function defaultWorkspace(){
  return {
    meta: {
      version: '2.2.0-offline',
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      lastSnapshotAt: 0
    },
    settings: JSON.parse(JSON.stringify(DemoSeed.settings)),
    contacts: JSON.parse(JSON.stringify(DemoSeed.contacts)),
    offers: JSON.parse(JSON.stringify(DemoSeed.offers)),
    templates: JSON.parse(JSON.stringify(DemoSeed.templates)),
    tasks: JSON.parse(JSON.stringify(DemoSeed.tasks))
  };
}

function normalizeWorkspace(state){
  const fresh = defaultWorkspace();
  if(!state) return fresh;
  return {
    meta: { ...fresh.meta, ...(state.meta || {}) },
    settings: { ...fresh.settings, ...(state.settings || {}) },
    contacts: Array.isArray(state.contacts) ? state.contacts : fresh.contacts,
    offers: Array.isArray(state.offers) ? state.offers : fresh.offers,
    templates: Array.isArray(state.templates) ? state.templates : fresh.templates,
    tasks: Array.isArray(state.tasks) ? state.tasks : fresh.tasks
  };
}

async function loadWorkspace(){
  const stored = await DB.getWorkspace();
  appState = normalizeWorkspace(stored);
  applyVisualSettings();
}

async function maybeAutoSnapshot(reason='manual-save'){
  const now = Date.now();
  if(now - (appState.meta.lastSnapshotAt || 0) < AUTO_SNAPSHOT_MS) return;
  const record = {
    id: uid('snap'),
    createdAt: now,
    reason,
    value: JSON.parse(JSON.stringify(appState))
  };
  await DB.saveSnapshot(record);
  appState.meta.lastSnapshotAt = now;
  const snaps = await DB.listSnapshots();
  for(const extra of snaps.slice(MAX_SNAPSHOTS)){
    await DB.deleteSnapshot(extra.id);
  }
}

async function saveWorkspace(reason='saved'){
  appState.meta.lastSavedAt = Date.now();
  await maybeAutoSnapshot(reason);
  await DB.saveWorkspace(appState);
  applyVisualSettings();
  updateShellStats();
  if(channel){ channel.postMessage({ type:'workspace-updated', at: Date.now() }); }
}

function applyVisualSettings(){
  if(!appState) return;
  const s = appState.settings;
  document.documentElement.style.setProperty('--bg-image', s.backgroundImage ? `url(${s.backgroundImage})` : 'none');
  document.documentElement.style.setProperty('--bg-image-opacity', String(Number(s.backgroundOpacity ?? .36)));
  document.documentElement.style.setProperty('--bg-dim', String(Number(s.backgroundDim ?? .45)));
  document.documentElement.style.setProperty('--bg-image-blur', `${Number(s.backgroundBlur ?? 0)}px`);
  document.documentElement.style.setProperty('--ui-glass', String(Number(s.glassLevel ?? .72)));
  document.documentElement.style.setProperty('--card-glass', String(Number(s.cardGlassLevel ?? .76)));
}

function getContact(id){ return appState.contacts.find(x => x.id === id) || null; }
function getOffer(id){ return appState.offers.find(x => x.id === id) || null; }
function getTemplate(id){ return appState.templates.find(x => x.id === id) || null; }
function getTask(id){ return appState.tasks.find(x => x.id === id) || null; }
function relatedLabel(type, id){
  if(type === 'contact'){
    const c = getContact(id);
    return c ? `${c.fullName} · ${c.company || 'No company'}` : 'Detached contact';
  }
  if(type === 'offer'){
    const o = getOffer(id);
    return o ? o.title : 'Detached offer';
  }
  return 'No linked record';
}
function offerFinancials(offer){
  const subtotal = (offer.lineItems || []).reduce((sum, item) => sum + (Number(item.qty||0) * Number(item.unitPrice||0)), 0);
  const discountType = offer.discountType || 'flat';
  let discount = Number(offer.discountValue || 0);
  if(discountType === 'percent') discount = subtotal * (discount / 100);
  discount = Math.min(Math.max(discount, 0), subtotal);
  const taxable = subtotal - discount;
  const tax = taxable * (Number(offer.taxRate || 0) / 100);
  const total = taxable + tax;
  const deposit = total * (Number(offer.depositPercent || 0) / 100);
  return { subtotal, discount, taxable, tax, total, deposit };
}
function countByStatus(items, key, value){ return items.filter(x => x[key] === value).length; }


const WALKTHROUGH_STEPS = [
  {
    id: 'personalize',
    title: 'Set your workspace defaults',
    desc: 'Open Settings and lock in your company name, founder name, phone, email, website, and your preferred background.',
    href: 'settings.html',
    btn: 'Open settings'
  },
  {
    id: 'contact',
    title: 'Save your first real contact',
    desc: 'Create a contact record with the person, company, notes, tags, and any details you need for quoting and follow-up.',
    href: 'contacts.html',
    btn: 'Open contacts'
  },
  {
    id: 'offer',
    title: 'Build an offer from the studio',
    desc: 'Create an offer with line items, pricing, deposit math, terms, milestones, and a linked contact.',
    href: 'offers.html',
    btn: 'Open offers'
  },
  {
    id: 'attachments',
    title: 'Attach proof locally',
    desc: 'After you save a contact or offer once, use the local vault to add screenshots, PDFs, ZIPs, photos, or signed files.',
    href: 'offers.html',
    btn: 'Open vault-ready record'
  },
  {
    id: 'proofpack',
    title: 'Generate a proof pack',
    desc: 'Use the Proof Pack Builder inside a saved record to bundle selected evidence, metadata, notes, and previews into one case file.',
    href: 'offers.html',
    btn: 'Build proof pack'
  },
  {
    id: 'docs',
    title: 'Export the polished document',
    desc: 'Open Docs to preview the generated proposal, print it cleanly, or export the HTML for delivery and review.',
    href: 'docs.html',
    btn: 'Open docs'
  },
  {
    id: 'backup',
    title: 'Protect the workspace',
    desc: 'Go to Backup Center for JSON export, locked encrypted export, restore, CSV export, and rolling snapshots.',
    href: 'backup.html',
    btn: 'Open backup center'
  }
];

function walkthroughProgress(){
  if(!appState.meta.walkthroughProgress || typeof appState.meta.walkthroughProgress !== 'object') appState.meta.walkthroughProgress = {};
  return appState.meta.walkthroughProgress;
}
function walkthroughCompletedCount(){
  const progress = walkthroughProgress();
  return WALKTHROUGH_STEPS.filter(step => !!progress[step.id]).length;
}
function walkthroughPercent(){
  return Math.round((walkthroughCompletedCount() / WALKTHROUGH_STEPS.length) * 100) || 0;
}
function attachmentVaultTargetHref(){
  const offerId = appState.offers[0]?.id;
  if(offerId) return `offers.html?id=${encodeURIComponent(offerId)}`;
  const contactId = appState.contacts[0]?.id;
  if(contactId) return `contacts.html?id=${encodeURIComponent(contactId)}`;
  return 'offers.html';
}
function walkthroughHrefForStep(step){
  if(step.id === 'attachments' || step.id === 'proofpack') return attachmentVaultTargetHref();
  return step.href;
}

function updateShellStats(){
  if(!appState) return;
  const totalOpenValue = appState.offers.filter(o => ['draft','sent','review'].includes(o.status)).reduce((sum, o) => sum + offerFinancials(o).total, 0);
  const dueTasks = appState.tasks.filter(t => t.status !== 'done').length;
  const contactsEl = byId('statContacts');
  const offersEl = byId('statOffers');
  const valueEl = byId('statValue');
  const tasksEl = byId('statTasks');
  const savedEl = byId('lastSavedStamp');
  if(contactsEl) contactsEl.textContent = String(appState.contacts.length);
  if(offersEl) offersEl.textContent = String(appState.offers.length);
  if(valueEl) valueEl.textContent = fmtCurrency(totalOpenValue);
  if(tasksEl) tasksEl.textContent = String(dueTasks);
  if(savedEl) savedEl.textContent = fmtDate(appState.meta.lastSavedAt);
}

function setPageMeta(){
  const meta = PAGE_META[pageName] || PAGE_META.dashboard;
  const h1 = byId('pageTitle');
  const p = byId('pageDescription');
  if(h1) h1.textContent = meta.title;
  if(p) p.textContent = meta.desc;
}

function parseQuery(){
  return new URLSearchParams(window.location.search);
}

function activeIdFromQuery(param='id'){
  return parseQuery().get(param);
}

function updateQuery(id, param='id'){
  const url = new URL(window.location.href);
  if(id) url.searchParams.set(param, id);
  else url.searchParams.delete(param);
  history.replaceState({}, '', url.toString());
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function fileToText(file){
  return await file.text();
}

async function ensureLogoDataUrl(){
  if(logoDataUrlCache) return logoDataUrlCache;
  const res = await fetch(LOGO_PATH);
  const blob = await res.blob();
  logoDataUrlCache = await blobToDataURL(blob);
  return logoDataUrlCache;
}

function blobToDataURL(blob){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl){
  const parts = String(dataUrl || '').split(',');
  const meta = parts[0] || 'data:application/octet-stream;base64';
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
  const bin = atob(parts[1] || '');
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type:mime });
}

function getFileExt(name=''){
  const parts = String(name).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function humanFileSize(bytes){
  const num = Number(bytes || 0);
  if(num < 1024) return `${num} B`;
  if(num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if(num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function guessAttachmentKind(fileOrRecord, override='auto'){
  if(override && override !== 'auto') return override;
  const type = String(fileOrRecord?.type || fileOrRecord?.mimeType || '').toLowerCase();
  const ext = getFileExt(fileOrRecord?.name || '');
  if(type.startsWith('image/')) return 'image';
  if(['zip','json','pdf'].includes(ext)) return 'proof-pack';
  if(['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'image';
  return 'file';
}

function normalizeAttachment(record){
  return {
    id: record.id || uid('att'),
    ownerType: record.ownerType || 'contact',
    ownerId: record.ownerId || '',
    ownerKey: record.ownerKey || `${record.ownerType || 'contact'}:${record.ownerId || ''}`,
    name: record.name || 'attachment',
    mimeType: record.mimeType || 'application/octet-stream',
    size: Number(record.size || 0),
    kind: record.kind || guessAttachmentKind(record),
    dataUrl: record.dataUrl || '',
    createdAt: Number(record.createdAt || Date.now()),
    updatedAt: Number(record.updatedAt || Date.now())
  };
}

async function saveLocalAttachment(ownerType, ownerId, file, kindOverride='auto'){
  if(!ownerId) throw new Error('Save the record first, then add local files.');
  if(file.size > 30 * 1024 * 1024) throw new Error(`${file.name} is over 30 MB. Keep local proof packs lean for browser storage.`);
  const record = normalizeAttachment({
    id: uid('att'),
    ownerType,
    ownerId,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size || 0,
    kind: guessAttachmentKind(file, kindOverride),
    dataUrl: await blobToDataURL(file),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  await DB.saveAttachment(record);
  return record;
}

function downloadAttachment(record){
  downloadBlob(dataURLToBlob(record.dataUrl), record.name || 'attachment');
}

function attachmentIcon(kind){
  if(kind === 'image') return '🖼️';
  if(kind === 'proof-pack') return '🧾';
  return '📎';
}

async function downloadAttachmentManifest(ownerType, ownerId){
  const items = await DB.listAttachmentsByOwner(ownerType, ownerId);
  const payload = {
    type: 'skye-offerforge-attachment-manifest',
    ownerType,
    ownerId,
    exportedAt: new Date().toISOString(),
    count: items.length,
    attachments: items.map(item => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
      createdAt: item.createdAt
    }))
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: BACKUP_MIME }), `${ownerType}-${ownerId}-attachment-manifest.json`);
}

function ownerProofPackDefaults(ownerType, ownerId){
  const owner = ownerType === 'contact' ? getContact(ownerId) : getOffer(ownerId);
  const nameBase = ownerType === 'contact'
    ? (owner?.fullName || owner?.company || 'Contact')
    : (owner?.title || 'Offer');
  const defaultStage = ownerType === 'contact'
    ? (owner?.status || 'lead')
    : (owner?.status || 'draft');
  const defaultNotes = ownerType === 'contact'
    ? (owner?.notes || '')
    : [owner?.intro, owner?.scope, owner?.scopeNotes, owner?.terms].filter(Boolean).join('\n\n');
  return {
    title: `${nameBase} proof pack`,
    caseTag: slugify(nameBase),
    stage: defaultStage,
    preparedBy: appState?.settings?.companyName || appState?.settings?.founderName || 'Skye-OfferForge',
    notes: defaultNotes
  };
}

function ownerProofPackStageOptions(ownerType, selected=''){
  const options = ownerType === 'contact'
    ? ['lead','warm','proposal-sent','active','won','archived']
    : ['draft','sent','review','approved','paid','archived'];
  const list = options.includes(selected) ? options : [selected || options[0], ...options.filter(x => x !== selected)];
  return list.map(v => `<option value="${escapeHtml(v)}" ${v === selected ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
}

function attachmentRecordForPack(item){
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    kind: item.kind,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    dataUrl: item.dataUrl
  };
}

function buildProofPackHtml(payload){
  const title = payload.title || 'Proof pack';
  const attachments = payload.attachments || [];
  const images = attachments.filter(item => item.kind === 'image');
  const owner = payload.ownerSnapshot || {};
  const linkedContact = payload.linkedContactSnapshot || null;
  const relatedOffers = payload.relatedOffers || [];
  const offerTotals = payload.offerTotals || null;
  const embeddedJson = JSON.stringify(payload, null, 2).replace(/</g, '\u003c');
  const imageGallery = images.length ? `
    <section class="section">
      <h2>Embedded image evidence</h2>
      <div class="gallery">
        ${images.map(item => `
          <figure class="gallery-card">
            <img src="${item.dataUrl}" alt="${escapeHtml(item.name)}" />
            <figcaption>
              <strong>${escapeHtml(item.name)}</strong>
              <div>${escapeHtml(item.kind)} · ${humanFileSize(item.size)} · ${fmtDate(item.createdAt)}</div>
            </figcaption>
          </figure>
        `).join('')}
      </div>
    </section>
  ` : '';
  const attachmentRows = attachments.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.kind)}</td>
      <td>${humanFileSize(item.size)}</td>
      <td>${fmtDate(item.createdAt)}</td>
      <td><a href="${item.dataUrl}" download="${escapeHtml(item.name)}">Download</a></td>
    </tr>
  `).join('');
  const relatedBlock = payload.ownerType === 'contact'
    ? `
      <div class="meta-card wide">
        <div class="label">Linked offers</div>
        ${relatedOffers.length ? `<ul class="bullets">${relatedOffers.map(item => `<li><strong>${escapeHtml(item.title || 'Offer')}</strong> · ${escapeHtml(item.status || 'draft')} · ${fmtCurrency(item.total || 0)}</li>`).join('')}</ul>` : '<div class="muted">No offers are linked to this contact yet.</div>'}
      </div>
    `
    : `
      <div class="meta-card wide">
        <div class="label">Linked contact</div>
        <div class="value">${linkedContact ? `${escapeHtml(linkedContact.fullName || 'Unnamed contact')} · ${escapeHtml(linkedContact.company || 'No company')}` : 'No linked contact'}</div>
        <div class="muted">${linkedContact ? `${escapeHtml(linkedContact.email || 'No email')} · ${escapeHtml(linkedContact.phone || 'No phone')}` : 'This offer is not currently tied to a contact record.'}</div>
      </div>
    `;
  const totalsBlock = payload.ownerType === 'offer' && offerTotals ? `
    <div class="totals-grid">
      <div class="meta-card"><div class="label">Subtotal</div><div class="value">${fmtCurrency(offerTotals.subtotal)}</div></div>
      <div class="meta-card"><div class="label">Tax</div><div class="value">${fmtCurrency(offerTotals.taxAmount)}</div></div>
      <div class="meta-card"><div class="label">Total</div><div class="value">${fmtCurrency(offerTotals.total)}</div></div>
      <div class="meta-card"><div class="label">Deposit due</div><div class="value">${fmtCurrency(offerTotals.depositAmount)}</div></div>
    </div>
  ` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--bg:#090511;--panel:rgba(18,12,30,.9);--panel2:rgba(255,255,255,.05);--line:rgba(255,255,255,.12);--text:#f7f2ff;--muted:#c2b9d9;--purple:#8a4dff;--gold:#f2c54b;}
    *{box-sizing:border-box} body{margin:0;font-family:Inter,Arial,sans-serif;background:radial-gradient(circle at top, rgba(138,77,255,.18), transparent 35%), radial-gradient(circle at bottom right, rgba(242,197,75,.16), transparent 28%), var(--bg);color:var(--text);padding:28px} a{color:#ffd875} .wrap{max-width:1120px;margin:0 auto;display:grid;gap:18px}
    .hero,.section,.meta-card{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(12px);border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.28)}
    .hero{padding:24px;display:grid;grid-template-columns:120px 1fr;gap:20px;align-items:center} .hero img{width:100%;height:auto;display:block;filter:drop-shadow(0 0 18px rgba(138,77,255,.28))}
    .kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d7c6ff;margin-bottom:8px}.title{font-size:34px;font-weight:900;line-height:1.06;margin:0 0 10px}.sub{color:var(--muted);line-height:1.65}
    .meta-grid,.totals-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.section{padding:20px}.section h2{margin:0 0 14px;font-size:20px}.meta-card{padding:16px;background:var(--panel2)}.wide{grid-column:1/-1}.label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ccbde8;margin-bottom:8px}.value{font-size:18px;font-weight:800}.muted{color:var(--muted);line-height:1.6}
    table{width:100%;border-collapse:collapse} th,td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top} th{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#d8caef}
    .notes{padding:16px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid var(--line);line-height:1.72}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.gallery-card{margin:0;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.04)}.gallery-card img{display:block;width:100%;height:180px;object-fit:cover}.gallery-card figcaption{padding:12px;color:var(--muted);line-height:1.55}.footer{display:grid;gap:8px;color:var(--muted);font-size:13px}.bullets{margin:0;padding-left:18px;display:grid;gap:10px;line-height:1.6}
    @media (max-width:900px){.hero{grid-template-columns:1fr}.meta-grid,.totals-grid{grid-template-columns:1fr 1fr}} @media (max-width:620px){body{padding:16px}.meta-grid,.totals-grid{grid-template-columns:1fr}.title{font-size:28px}}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div>${payload.brand?.logoDataUrl ? `<img src="${payload.brand.logoDataUrl}" alt="${escapeHtml(payload.brand.companyName || 'Logo')}" />` : ''}</div>
      <div>
        <div class="kicker">Skye-OfferForge case file</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="sub">Bundled offline from ${escapeHtml(payload.brand?.companyName || 'Skye-OfferForge')} with ${attachments.length} embedded attachment${attachments.length === 1 ? '' : 's'} and a live record snapshot.</div>
      </div>
    </section>

    <section class="section">
      <h2>Case metadata</h2>
      <div class="meta-grid">
        <div class="meta-card"><div class="label">Record type</div><div class="value">${escapeHtml(payload.ownerType)}</div></div>
        <div class="meta-card"><div class="label">Stage</div><div class="value">${escapeHtml(payload.metadata?.stage || '—')}</div></div>
        <div class="meta-card"><div class="label">Case tag</div><div class="value">${escapeHtml(payload.metadata?.caseTag || '—')}</div></div>
        <div class="meta-card"><div class="label">Prepared by</div><div class="value">${escapeHtml(payload.metadata?.preparedBy || '—')}</div></div>
        <div class="meta-card"><div class="label">Generated</div><div class="value">${fmtDate(payload.generatedAt)}</div></div>
        <div class="meta-card"><div class="label">Attachments</div><div class="value">${attachments.length}</div><div class="muted">${humanFileSize(payload.metadata?.attachmentBytes || 0)}</div></div>
        <div class="meta-card"><div class="label">Workspace</div><div class="value">${escapeHtml(payload.brand?.workspaceName || 'Skye-OfferForge')}</div></div>
        <div class="meta-card"><div class="label">Company</div><div class="value">${escapeHtml(payload.brand?.companyName || 'Skyes Over London')}</div></div>
        <div class="meta-card wide"><div class="label">Record snapshot</div><div class="value">${escapeHtml(payload.ownerType === 'contact' ? (owner.fullName || owner.company || 'Contact') : (owner.title || 'Offer'))}</div><div class="muted">${payload.ownerType === 'contact' ? `${escapeHtml(owner.company || 'No company')} · ${escapeHtml(owner.email || 'No email')} · ${escapeHtml(owner.phone || 'No phone')}` : `${escapeHtml(owner.status || 'draft')} · Valid until ${escapeHtml(owner.validUntil || 'Not set')}`}</div></div>
        ${relatedBlock}
      </div>
      ${totalsBlock}
    </section>

    <section class="section">
      <h2>Notes</h2>
      <div class="notes">${payload.metadata?.notes ? htmlizeMultiline(payload.metadata.notes) : 'No extra notes were added when this case file was built.'}</div>
    </section>

    <section class="section">
      <h2>Embedded attachment manifest</h2>
      <table>
        <thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Added</th><th>Access</th></tr></thead>
        <tbody>${attachmentRows}</tbody>
      </table>
    </section>

    ${imageGallery}

    <section class="section footer">
      <div><strong>Contact</strong> · ${escapeHtml(payload.brand?.companyName || 'Skyes Over London')} · ${escapeHtml(payload.brand?.email || 'SkyesOverLondonLC@SOLEnterprises.org')} · ${escapeHtml(payload.brand?.phone || '(480) 469-5416')} · ${escapeHtml(payload.brand?.website || 'SOLEnterprises.org')}</div>
      <div>This file is self-contained for offline review. All listed downloads are embedded into this single HTML case file.</div>
    </section>
  </div>
  <script id="proof-pack-data" type="application/json">${embeddedJson}</script>
</body>
</html>`;
}

async function createProofPackBundle(ownerType, ownerId, selectedIds=[], meta={}){
  const ownerRecord = ownerType === 'contact' ? getContact(ownerId) : getOffer(ownerId);
  if(!ownerRecord) throw new Error('This record no longer exists. Refresh the page and try again.');
  const items = await DB.listAttachmentsByOwner(ownerType, ownerId);
  const picked = items.filter(item => selectedIds.includes(item.id));
  if(!picked.length) throw new Error('Pick at least one local file for the proof pack.');
  const totalBytes = picked.reduce((sum, item) => sum + Number(item.size || 0), 0);
  if(totalBytes > 60 * 1024 * 1024) throw new Error('Selected files exceed 60 MB. Split this into smaller proof packs.');
  const defaults = ownerProofPackDefaults(ownerType, ownerId);
  const title = String(meta.title || defaults.title || 'Proof pack').trim();
  const linkedContact = ownerType === 'offer' && ownerRecord?.clientId ? getContact(ownerRecord.clientId) : null;
  const relatedOffers = ownerType === 'contact'
    ? appState.offers.filter(offer => offer.clientId === ownerId).map(offer => ({ id: offer.id, title: offer.title, status: offer.status, total: offerFinancials(offer).total }))
    : [];
  const payload = {
    type: 'skye-offerforge-proof-pack',
    version: appState.meta.version,
    generatedAt: new Date().toISOString(),
    title,
    ownerType,
    ownerId,
    brand: {
      workspaceName: appState.settings.workspaceName,
      companyName: appState.settings.companyName,
      founderName: appState.settings.founderName,
      email: appState.settings.email,
      phone: appState.settings.phone,
      website: appState.settings.website,
      logoDataUrl: await ensureLogoDataUrl()
    },
    metadata: {
      stage: meta.stage || defaults.stage,
      caseTag: meta.caseTag || defaults.caseTag,
      preparedBy: meta.preparedBy || defaults.preparedBy,
      notes: meta.notes || defaults.notes || '',
      attachmentCount: picked.length,
      attachmentBytes: totalBytes
    },
    ownerSnapshot: ownerRecord,
    linkedContactSnapshot: linkedContact,
    relatedOffers,
    offerTotals: ownerType === 'offer' ? offerFinancials(ownerRecord) : null,
    manifest: picked.map(item => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
      createdAt: item.createdAt
    })),
    attachments: picked.map(attachmentRecordForPack)
  };
  const html = buildProofPackHtml(payload);
  const filename = `${ownerType}-${slugify(title)}-case-file-${new Date().toISOString().slice(0,10)}.html`;
  return {
    payload,
    html,
    filename,
    blob: new Blob([html], { type: 'text/html' })
  };
}

async function saveGeneratedAttachment(ownerType, ownerId, blob, fileName, kind='proof-pack'){
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  return await saveLocalAttachment(ownerType, ownerId, file, kind);
}

async function renderAttachmentHub(ownerType, ownerId, targetId){
  const wrap = byId(targetId);
  if(!wrap) return;
  if(!ownerId){
    wrap.innerHTML = '<div class="empty">Save this record once, then add screenshots, PDFs, images, ZIP proof packs, and other local files directly into the workspace.</div>';
    return;
  }
  const items = await DB.listAttachmentsByOwner(ownerType, ownerId);
  const prefix = `${ownerType}Attachment`;
  const defaults = ownerProofPackDefaults(ownerType, ownerId);
  const stageOptions = ownerProofPackStageOptions(ownerType, defaults.stage);
  wrap.innerHTML = `
    <div class="attachment-toolbar row spread">
      <div class="row">
        <label class="field compact-field">Type
          <select id="${prefix}Kind">
            <option value="auto">Auto-detect</option>
            <option value="image">Image</option>
            <option value="file">File</option>
            <option value="proof-pack">Proof pack</option>
          </select>
        </label>
        <label class="btn primary file-btn">Add local files<input type="file" id="${prefix}Input" multiple hidden /></label>
        <button class="btn" id="${prefix}ManifestBtn" type="button">Download manifest</button>
      </div>
      <span class="tag ok">${items.length} stored</span>
    </div>
    <div class="small">Stored in this browser through IndexedDB. Good for screenshots, drafts, PDFs, ZIP proof packs, and client files while fully offline.</div>
    <div class="attachment-grid ${items.length ? '' : 'empty-grid'}">
      ${items.length ? items.map(item => `
        <div class="attachment-card">
          <div class="row spread attachment-pick-row">
            <label class="checkline"><input type="checkbox" class="proof-pack-check" data-id="${item.id}" checked /> <span>Include in case file</span></label>
            <span class="tag">${escapeHtml(item.kind)}</span>
          </div>
          <div class="attachment-preview ${item.kind === 'image' ? 'image' : ''}">${item.kind === 'image' ? `<img src="${item.dataUrl}" alt="${escapeHtml(item.name)}" />` : `<span>${attachmentIcon(item.kind)}</span>`}</div>
          <div class="attachment-meta">
            <div class="attachment-name">${escapeHtml(item.name)}</div>
            <div class="attachment-sub">${escapeHtml(item.kind)} · ${humanFileSize(item.size)} · ${fmtDate(item.createdAt)}</div>
          </div>
          <div class="row attachment-actions">
            <button class="btn ghost download-attachment" data-id="${item.id}" type="button">Download</button>
            <button class="btn danger remove-attachment" data-id="${item.id}" type="button">Remove</button>
          </div>
        </div>
      `).join('') : '<div class="empty">No local files stored yet for this record.</div>'}
    </div>
    ${items.length ? `
      <div class="proof-pack-builder">
        <div class="row spread">
          <div>
            <strong>Proof pack builder</strong>
            <div class="small">Bundle selected attachments plus notes and metadata into one downloadable offline case file. You can also save that case file back into the same record vault.</div>
          </div>
          <span class="tag gold" id="${prefix}SelectedCount">${items.length} selected</span>
        </div>
        <div class="row">
          <button class="btn ghost" id="${prefix}SelectAllBtn" type="button">Select all</button>
          <button class="btn ghost" id="${prefix}ClearAllBtn" type="button">Clear</button>
        </div>
        <div class="proof-pack-grid">
          <label class="field">Pack title<input class="input" id="${prefix}ProofTitle" value="${escapeHtml(defaults.title)}" /></label>
          <label class="field">Case tag<input class="input" id="${prefix}ProofTag" value="${escapeHtml(defaults.caseTag)}" /></label>
          <label class="field">Stage<select id="${prefix}ProofStage">${stageOptions}</select></label>
          <label class="field">Prepared by<input class="input" id="${prefix}ProofPreparedBy" value="${escapeHtml(defaults.preparedBy)}" /></label>
          <label class="field" style="grid-column:1/-1">Pack notes<textarea id="${prefix}ProofNotes" rows="5" placeholder="What this case file proves, why it matters, and any context the reviewer should keep in mind.">${escapeHtml(defaults.notes)}</textarea></label>
        </div>
        <div class="row">
          <button class="btn gold" id="${prefix}DownloadProofPackBtn" type="button">Download case file</button>
          <button class="btn" id="${prefix}SaveProofPackBtn" type="button">Save case file to vault</button>
        </div>
      </div>
    ` : ''}
  `;
  byId(`${prefix}Input`)?.addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if(!files.length) return;
    try{
      const kind = byId(`${prefix}Kind`)?.value || 'auto';
      for(const file of files){
        await saveLocalAttachment(ownerType, ownerId, file, kind);
      }
      toast(`${files.length} file${files.length === 1 ? '' : 's'} stored locally.`);
      await renderAttachmentHub(ownerType, ownerId, targetId);
    }catch(err){
      toast(err.message || 'Could not store local files.');
    } finally {
      e.target.value = '';
    }
  });
  byId(`${prefix}ManifestBtn`)?.addEventListener('click', async () => {
    await downloadAttachmentManifest(ownerType, ownerId);
    toast('Attachment manifest downloaded.');
  });
  wrap.querySelectorAll('.download-attachment').forEach(btn => btn.addEventListener('click', async () => {
    const itemsNow = await DB.listAttachmentsByOwner(ownerType, ownerId);
    const found = itemsNow.find(x => x.id === btn.dataset.id);
    if(found) downloadAttachment(found);
  }));
  wrap.querySelectorAll('.remove-attachment').forEach(btn => btn.addEventListener('click', async () => {
    if(!confirm('Remove this local file from the workspace?')) return;
    await DB.deleteAttachment(btn.dataset.id);
    toast('Local file removed.');
    await renderAttachmentHub(ownerType, ownerId, targetId);
  }));
  const getSelectedIds = () => [...wrap.querySelectorAll('.proof-pack-check:checked')].map(el => el.dataset.id);
  const updateSelectedCount = () => {
    const count = getSelectedIds().length;
    const badge = byId(`${prefix}SelectedCount`);
    if(badge) badge.textContent = `${count} selected`;
  };
  wrap.querySelectorAll('.proof-pack-check').forEach(el => el.addEventListener('change', updateSelectedCount));
  byId(`${prefix}SelectAllBtn`)?.addEventListener('click', () => {
    wrap.querySelectorAll('.proof-pack-check').forEach(el => { el.checked = true; });
    updateSelectedCount();
  });
  byId(`${prefix}ClearAllBtn`)?.addEventListener('click', () => {
    wrap.querySelectorAll('.proof-pack-check').forEach(el => { el.checked = false; });
    updateSelectedCount();
  });
  const collectProofMeta = () => ({
    title: byId(`${prefix}ProofTitle`)?.value?.trim() || defaults.title,
    caseTag: byId(`${prefix}ProofTag`)?.value?.trim() || defaults.caseTag,
    stage: byId(`${prefix}ProofStage`)?.value || defaults.stage,
    preparedBy: byId(`${prefix}ProofPreparedBy`)?.value?.trim() || defaults.preparedBy,
    notes: byId(`${prefix}ProofNotes`)?.value?.trim() || ''
  });
  byId(`${prefix}DownloadProofPackBtn`)?.addEventListener('click', async () => {
    try{
      const bundle = await createProofPackBundle(ownerType, ownerId, getSelectedIds(), collectProofMeta());
      downloadBlob(bundle.blob, bundle.filename);
      toast('Proof pack case file downloaded.');
    }catch(err){
      toast(err.message || 'Could not build the proof pack.');
    }
  });
  byId(`${prefix}SaveProofPackBtn`)?.addEventListener('click', async () => {
    try{
      const bundle = await createProofPackBundle(ownerType, ownerId, getSelectedIds(), collectProofMeta());
      await saveGeneratedAttachment(ownerType, ownerId, bundle.blob, bundle.filename, 'proof-pack');
      toast('Proof pack saved into this record vault.');
      await renderAttachmentHub(ownerType, ownerId, targetId);
    }catch(err){
      toast(err.message || 'Could not save the proof pack into the vault.');
    }
  });
}


async function exportJsonBackup(){
  const payload = {
    type: 'skye-offerforge-backup',
    version: appState.meta.version,
    exportedAt: new Date().toISOString(),
    workspace: appState,
    attachments: await DB.listAllAttachments()
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: BACKUP_MIME }), `skye-offerforge-backup-${new Date().toISOString().slice(0,10)}.json`);
}

async function deriveKey(passphrase, salt){
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name:'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations: 200000, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

async function exportEncryptedBackup(passphrase){
  if(!passphrase || passphrase.length < 6) throw new Error('Use a passphrase with at least 6 characters.');
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const payload = JSON.stringify({
    type:'skye-offerforge-encrypted-backup',
    exportedAt:new Date().toISOString(),
    workspace: appState,
    attachments: await DB.listAllAttachments()
  });
  const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(payload));
  const exportObj = {
    type: 'skye-offerforge-encrypted-package',
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 200000,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipher))
  };
  downloadBlob(new Blob([JSON.stringify(exportObj)], { type: BACKUP_MIME }), `skye-offerforge-locked-backup-${new Date().toISOString().slice(0,10)}.skyevault`);
}

async function restoreBackupFromText(text, passphrase=''){
  const parsed = JSON.parse(text);
  const applyRestorePayload = async (payloadWorkspace, payloadAttachments=[]) => {
    appState = normalizeWorkspace(payloadWorkspace);
    await DB.clearAttachments();
    for(const attachment of (payloadAttachments || [])){
      await DB.saveAttachment(normalizeAttachment(attachment));
    }
    await saveWorkspace('restore-import');
  };
  if(parsed.type === 'skye-offerforge-backup'){
    await applyRestorePayload(parsed.workspace, parsed.attachments || []);
    return 'Plain backup restored.';
  }
  if(parsed.type === 'skye-offerforge-encrypted-package'){
    if(!passphrase) throw new Error('Passphrase required for encrypted backup.');
    const salt = new Uint8Array(parsed.salt);
    const iv = new Uint8Array(parsed.iv);
    const data = new Uint8Array(parsed.data);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
    const payload = JSON.parse(new TextDecoder().decode(plain));
    await applyRestorePayload(payload.workspace, payload.attachments || []);
    return 'Encrypted backup restored.';
  }
  throw new Error('This file is not a valid Skye-OfferForge backup.');
}

function exportCsvContacts(){
  const rows = [['Name','Company','Role','Email','Phone','City','State','Tags','Status','Notes']];
  appState.contacts.forEach(c => rows.push([c.fullName,c.company,c.role,c.email,c.phone,c.city,c.state,c.tags,c.status,c.notes].map(v => String(v || ''))));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type:'text/csv' }), 'skye-offerforge-contacts.csv');
}
function exportCsvOffers(){
  const rows = [['Offer','Client','Status','Valid Until','Subtotal','Discount','Tax','Total']];
  appState.offers.forEach(o => {
    const client = getContact(o.clientId);
    const totals = offerFinancials(o);
    rows.push([
      o.title,
      client ? `${client.fullName} / ${client.company || ''}` : '',
      o.status,
      o.validUntil,
      totals.subtotal,
      totals.discount,
      totals.tax,
      totals.total
    ].map(v => String(v ?? '')));
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type:'text/csv' }), 'skye-offerforge-offers.csv');
}

function renderDashboard(){
  const recentOffers = [...appState.offers].sort((a,b) => b.updatedAt - a.updatedAt).slice(0,4);
  const recentTasks = [...appState.tasks].sort((a,b) => (a.status === 'done') - (b.status === 'done') || new Date(a.dueDate) - new Date(b.dueDate)).slice(0,5);
  const totalOfferValue = appState.offers.reduce((sum, offer) => sum + offerFinancials(offer).total, 0);
  const sentValue = appState.offers.filter(o => o.status === 'sent').reduce((sum, offer) => sum + offerFinancials(offer).total, 0);
  const activeContacts = appState.contacts.filter(c => ['warm','proposal-sent','active'].includes(c.status)).length;
  return `
    <div class="grid four">
      <section class="card"><div class="stat-value">${appState.contacts.length}</div><div class="stat-label">Contacts in your offline vault</div></section>
      <section class="card"><div class="stat-value">${appState.offers.length}</div><div class="stat-label">Saved offers and quotes</div></section>
      <section class="card"><div class="stat-value">${fmtCurrency(totalOfferValue)}</div><div class="stat-label">Total pipeline value stored locally</div></section>
      <section class="card"><div class="stat-value">${appState.tasks.filter(t => t.status !== 'done').length}</div><div class="stat-label">Open follow-ups and deadlines</div></section>
    </div>

    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Quick launch</h2><div class="card-sub">Go straight to the parts that make the app actually useful.</div></div><span class="tag ok">Offline-ready</span></div>
        <div class="quick-links">
          <a class="btn primary" href="offers.html">Create offer</a>
          <a class="btn" href="contacts.html">Open contacts</a>
          <a class="btn" href="tutorial.html">Walkthrough</a>
          <a class="btn" href="docs.html">Generate document</a>
          <a class="btn" href="backup.html">Open backups</a>
        </div>
        <div class="notice">Need the clean fastest start? Use the walkthrough page and check steps off as you go. It gives this workspace its own built-in onboarding lane.</div>
        <div class="grid two-even">
          <div class="mini-card"><div class="k">Sent value</div><div class="v">${fmtCurrency(sentValue)}</div></div>
          <div class="mini-card"><div class="k">Warm contacts</div><div class="v">${activeContacts}</div></div>
        </div>
        <div class="notice">This build is not pretending to be a fake cloud SaaS. It is a practical offline workstation: local records, reusable offer logic, printable docs, background customization, and real restore tools.</div>
      </section>

      <section class="card stack">
        <div class="card-title"><div><h2>Workspace status</h2><div class="card-sub">The basics you actually care about.</div></div><span class="tag">v${escapeHtml(appState.meta.version)}</span></div>
        <div class="kv">
          <div>Last save</div><div>${fmtDate(appState.meta.lastSavedAt)}</div>
          <div>Last snapshot</div><div>${appState.meta.lastSnapshotAt ? fmtDate(appState.meta.lastSnapshotAt) : 'Not yet'}</div>
          <div>Background mode</div><div>${appState.settings.backgroundImage ? 'Custom image' : 'Gradient system'}</div>
          <div>Encrypted export</div><div>Available from Backup Center</div>
          <div>Installable</div><div>PWA manifest + service worker included</div>
        </div>
        <hr class="sep" />
        <div class="small">Founder contact: ${escapeHtml(appState.settings.email)} · ${escapeHtml(appState.settings.phone)} · ${escapeHtml(appState.settings.website)}</div>
      </section>
    </div>

    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Recent offers</h2><div class="card-sub">The most recently touched deals.</div></div><a class="btn ghost" href="offers.html">Manage all</a></div>
        ${recentOffers.length ? `<div class="list">${recentOffers.map(offer => {
          const client = getContact(offer.clientId);
          const totals = offerFinancials(offer);
          return `<a class="list-item" href="offers.html?id=${encodeURIComponent(offer.id)}">
            <div class="row spread"><div class="list-title">${escapeHtml(offer.title)}</div><span class="tag ${offer.status === 'sent' ? 'warn' : offer.status === 'accepted' ? 'ok' : ''}">${escapeHtml(offer.status || 'draft')}</span></div>
            <div class="list-meta">${escapeHtml(client ? `${client.fullName} · ${client.company || 'No company'}` : 'No client linked')}<br/>${fmtCurrency(totals.total)} · valid ${fmtShortDate(offer.validUntil)}</div>
          </a>`;
        }).join('')}</div>` : `<div class="empty">No offers yet. Build one from the Offer Studio and it will show up here.</div>`}
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>Upcoming follow-ups</h2><div class="card-sub">Keep momentum without leaving the app.</div></div><a class="btn ghost" href="tasks.html">Open desk</a></div>
        ${recentTasks.length ? `<div class="list">${recentTasks.map(task => `<a class="list-item" href="tasks.html?id=${encodeURIComponent(task.id)}">
          <div class="row spread"><div class="list-title">${escapeHtml(task.title)}</div><span class="tag ${task.priority === 'high' ? 'bad' : task.priority === 'medium' ? 'warn' : ''}">${escapeHtml(task.priority || 'normal')}</span></div>
          <div class="list-meta">Due ${fmtShortDate(task.dueDate)} · ${escapeHtml(relatedLabel(task.relatedType, task.relatedId))}<br/>${escapeHtml(task.note || '')}</div>
        </a>`).join('')}</div>` : `<div class="empty">No follow-up items yet. Add one from the Follow-Up Desk.</div>`}
      </section>
    </div>

    <section class="card">
      <div class="hero-founder">
        <img src="${FOUNDER_PATH}" alt="Founder image" />
        <div class="stack">
          <div class="card-title"><div><h2>SkyDexia identity built into the app</h2><div class="card-sub">Founder visible. Brand visible. Logo visible. Not hidden behind generic filler.</div></div><span class="tag ok">SkyDexia</span></div>
          <p class="small">Skye-OfferForge now carries the SkyDexia logo, a founder-forward offline shell, customizable glass UI, and a separated background system so visual changes do not break the actual workspace.</p>
          <div class="quick-links">
            <a class="btn primary" href="about.html">Founder page</a>
            <a class="btn" href="settings.html">Customize visuals</a>
            <a class="btn" href="backup.html">Protect your data</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderContacts(){
  const activeId = activeIdFromQuery('id') || appState.contacts[0]?.id || '';
  const selected = getContact(activeId) || {
    id:'', fullName:'', company:'', role:'', email:'', phone:'', city:'', state:'', tags:'', notes:'', status:'lead'
  };
  const search = parseQuery().get('q') || '';
  const filtered = appState.contacts.filter(contact => {
    const blob = `${contact.fullName} ${contact.company} ${contact.email} ${contact.phone} ${contact.tags} ${contact.notes}`.toLowerCase();
    return blob.includes(search.toLowerCase());
  }).sort((a,b) => b.updatedAt - a.updatedAt);
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>People + companies</h2><div class="card-sub">Searchable offline contact records.</div></div><span class="tag">${filtered.length} visible</span></div>
        <div class="row">
          <input class="input" id="contactSearch" placeholder="Search contacts, company, tags, notes" value="${escapeHtml(search)}" />
          <button class="btn" id="newContactBtn">New contact</button>
        </div>
        ${filtered.length ? `<div class="list">${filtered.map(contact => `<a class="list-item ${contact.id === activeId ? 'active' : ''}" href="contacts.html?id=${encodeURIComponent(contact.id)}${search ? `&q=${encodeURIComponent(search)}` : ''}">
          <div class="row spread"><div class="list-title">${escapeHtml(contact.fullName)}</div><span class="tag ${contact.status === 'proposal-sent' ? 'warn' : contact.status === 'active' ? 'ok' : ''}">${escapeHtml(contact.status || 'lead')}</span></div>
          <div class="list-meta">${escapeHtml(contact.company || 'No company')} · ${escapeHtml(contact.role || 'No role')}<br/>${escapeHtml(contact.email || 'No email')} · ${escapeHtml(contact.phone || 'No phone')}</div>
        </a>`).join('')}</div>` : `<div class="empty">No contacts match this search.</div>`}
      </section>

      <section class="card stack">
        <div class="card-title"><div><h2>${selected.id ? 'Edit contact' : 'Create contact'}</h2><div class="card-sub">Useful notes and local files now save right with the record.</div></div>${selected.id ? `<span class="tag">${escapeHtml(selected.id)}</span>` : ''}</div>
        <form id="contactForm" class="stack">
          <input type="hidden" name="id" value="${escapeHtml(selected.id || '')}" />
          <div class="grid two-even">
            <label class="field">Full name<input class="input" name="fullName" required value="${escapeHtml(selected.fullName || '')}" /></label>
            <label class="field">Company<input class="input" name="company" value="${escapeHtml(selected.company || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">Role<input class="input" name="role" value="${escapeHtml(selected.role || '')}" /></label>
            <label class="field">Status<select name="status">
              ${['lead','warm','proposal-sent','active','closed'].map(v => `<option value="${v}" ${selected.status === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select></label>
          </div>
          <div class="grid two-even">
            <label class="field">Email<input class="input" name="email" type="email" value="${escapeHtml(selected.email || '')}" /></label>
            <label class="field">Phone<input class="input" name="phone" value="${escapeHtml(selected.phone || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">City<input class="input" name="city" value="${escapeHtml(selected.city || '')}" /></label>
            <label class="field">State<input class="input" name="state" value="${escapeHtml(selected.state || '')}" /></label>
          </div>
          <label class="field">Tags<input class="input" name="tags" placeholder="comma separated tags" value="${escapeHtml(selected.tags || '')}" /></label>
          <label class="field">Notes<textarea name="notes">${escapeHtml(selected.notes || '')}</textarea></label>
          <div class="row">
            <button class="btn primary" type="submit">Save contact</button>
            <a class="btn" href="offers.html?clientId=${encodeURIComponent(selected.id || '')}">Create offer for this contact</a>
            ${selected.id ? `<button class="btn danger" type="button" id="deleteContactBtn">Delete</button>` : ''}
          </div>
        </form>
        <section class="stack attachment-section">
          <div class="row spread"><h3 style="margin:0">Local attachment vault</h3><span class="tag ${selected.id ? 'ok' : ''}">${selected.id ? 'Ready' : 'Save first'}</span></div>
          <div class="card-sub">Attach screenshots, client files, images, PDFs, and offline proof packs right to this contact.</div>
          <div id="contactAttachmentsWrap" class="stack">${selected.id ? '<div class="empty">Loading local files…</div>' : '<div class="empty">Save the contact once, then add local files directly into the same workspace.</div>'}</div>
        </section>
      </section>
    </div>
  `;
}

function blankOffer(clientId=''){
  return {
    id:'',
    title:'',
    clientId: clientId || '',
    status:'draft',
    validUntil: isoDateOffset(14),
    intro:'',
    scope:'',
    terms:'',
    notes:'',
    discountType:'flat',
    discountValue:0,
    taxRate: Number(appState.settings.defaultTaxRate || 0),
    depositPercent: Number(appState.settings.defaultDepositPercent || 0),
    lineItems:[{ id:uid('li'), name:'', qty:1, unitPrice:0 }],
    milestones:[{ id:uid('ms'), name:'Deposit', amount:0, dueLabel:'At approval' }]
  };
}

function renderOffers(){
  const query = parseQuery();
  const selectedId = query.get('id');
  const selectedTemplateId = query.get('templateId');
  const clientId = query.get('clientId') || '';
  let selected = getOffer(selectedId);
  if(!selected && selectedTemplateId){
    const tpl = getTemplate(selectedTemplateId);
    if(tpl){
      selected = {
        ...blankOffer(clientId),
        title: `${tpl.name} Offer`,
        intro: tpl.intro,
        scope: tpl.scope,
        terms: tpl.terms,
        lineItems: tpl.lineItems.map(item => ({ ...item, id:uid('li') })),
        milestones: tpl.milestones.map(item => ({ ...item, id:uid('ms') }))
      };
    }
  }
  if(!selected) selected = blankOffer(clientId);
  const totals = offerFinancials(selected);
  const offers = [...appState.offers].sort((a,b) => b.updatedAt - a.updatedAt);
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Offer list</h2><div class="card-sub">Quotes, proposals, and contract-ready offers.</div></div><span class="tag">${offers.length} saved</span></div>
        <div class="row">
          <a class="btn" href="offers.html">New offer</a>
          <a class="btn" href="templates.html">Open templates</a>
          <a class="btn" href="docs.html${selected.id ? `?offerId=${encodeURIComponent(selected.id)}` : ''}">Open doc output</a>
        </div>
        ${offers.length ? `<div class="list">${offers.map(offer => {
          const contact = getContact(offer.clientId);
          const fin = offerFinancials(offer);
          return `<a class="list-item ${offer.id === selectedId ? 'active' : ''}" href="offers.html?id=${encodeURIComponent(offer.id)}">
            <div class="row spread"><div class="list-title">${escapeHtml(offer.title)}</div><span class="tag ${offer.status === 'accepted' ? 'ok' : offer.status === 'sent' ? 'warn' : ''}">${escapeHtml(offer.status)}</span></div>
            <div class="list-meta">${escapeHtml(contact ? contact.fullName : 'No contact linked')} · ${fmtCurrency(fin.total)}<br/>${escapeHtml((offer.lineItems || []).length)} line items · valid ${fmtShortDate(offer.validUntil)}</div>
          </a>`;
        }).join('')}</div>` : `<div class="empty">No offers saved yet.</div>`}
      </section>

      <section class="card stack">
        <div class="card-title"><div><h2>${selected.id ? 'Edit offer' : 'Create offer'}</h2><div class="card-sub">Build the price, then let the docs page render it cleanly.</div></div>${selected.id ? `<span class="tag">${escapeHtml(selected.id)}</span>` : ''}</div>
        <form id="offerForm" class="stack">
          <input type="hidden" name="id" value="${escapeHtml(selected.id || '')}" />
          <div class="grid two-even">
            <label class="field">Offer title<input class="input" name="title" required value="${escapeHtml(selected.title || '')}" /></label>
            <label class="field">Client<select name="clientId"><option value="">No linked contact</option>${appState.contacts.map(c => `<option value="${c.id}" ${selected.clientId === c.id ? 'selected' : ''}>${escapeHtml(c.fullName)} · ${escapeHtml(c.company || 'No company')}</option>`).join('')}</select></label>
          </div>
          <div class="grid two-even">
            <label class="field">Status<select name="status">${['draft','review','sent','accepted','closed'].map(v => `<option value="${v}" ${selected.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
            <label class="field">Valid until<input class="input" type="date" name="validUntil" value="${escapeHtml(selected.validUntil || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">Discount type<select name="discountType">${['flat','percent'].map(v => `<option value="${v}" ${selected.discountType===v?'selected':''}>${v}</option>`).join('')}</select></label>
            <label class="field">Discount value<input class="input" type="number" step="0.01" name="discountValue" value="${escapeHtml(selected.discountValue || 0)}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">Tax rate %<input class="input" type="number" step="0.01" name="taxRate" value="${escapeHtml(selected.taxRate || 0)}" /></label>
            <label class="field">Deposit %<input class="input" type="number" step="0.01" name="depositPercent" value="${escapeHtml(selected.depositPercent || 0)}" /></label>
          </div>
          <label class="field">Intro<textarea name="intro">${escapeHtml(selected.intro || '')}</textarea></label>
          <label class="field">Scope<textarea name="scope">${escapeHtml(selected.scope || '')}</textarea></label>
          <label class="field">Terms<textarea name="terms">${escapeHtml(selected.terms || '')}</textarea></label>
          <label class="field">Internal notes<textarea name="notes">${escapeHtml(selected.notes || '')}</textarea></label>

          <section class="stack">
            <div class="row spread"><h3 style="margin:0">Line items</h3><button class="btn" type="button" id="addLineItemBtn">Add line</button></div>
            <div id="lineItemsWrap" class="stack">${(selected.lineItems || []).map(item => `
              <div class="grid three line-item-row" data-line-id="${item.id}">
                <label class="field">Item<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
                <label class="field">Qty<input class="input" type="number" step="0.01" data-field="qty" value="${escapeHtml(item.qty || 0)}" /></label>
                <div class="row"><label class="field" style="flex:1">Unit price<input class="input" type="number" step="0.01" data-field="unitPrice" value="${escapeHtml(item.unitPrice || 0)}" /></label><button class="btn danger remove-line" type="button">Remove</button></div>
              </div>`).join('')}</div>
          </section>

          <section class="stack">
            <div class="row spread"><h3 style="margin:0">Milestones</h3><button class="btn" type="button" id="addMilestoneBtn">Add milestone</button></div>
            <div id="milestonesWrap" class="stack">${(selected.milestones || []).map(item => `
              <div class="grid three milestone-row" data-ms-id="${item.id}">
                <label class="field">Name<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
                <label class="field">Amount<input class="input" type="number" step="0.01" data-field="amount" value="${escapeHtml(item.amount || 0)}" /></label>
                <div class="row"><label class="field" style="flex:1">Due label<input class="input" data-field="dueLabel" value="${escapeHtml(item.dueLabel || '')}" /></label><button class="btn danger remove-ms" type="button">Remove</button></div>
              </div>`).join('')}</div>
          </section>

          <section class="card">
            <div class="grid two-even">
              <div><div class="small">Subtotal</div><div class="stat-value" style="font-size:24px">${fmtCurrency(totals.subtotal)}</div></div>
              <div><div class="small">Discount</div><div class="stat-value" style="font-size:24px">${fmtCurrency(totals.discount)}</div></div>
              <div><div class="small">Tax</div><div class="stat-value" style="font-size:24px">${fmtCurrency(totals.tax)}</div></div>
              <div><div class="small">Total</div><div class="stat-value" style="font-size:24px">${fmtCurrency(totals.total)}</div></div>
            </div>
            <div class="small" style="margin-top:8px">Estimated deposit: ${fmtCurrency(totals.deposit)}</div>
          </section>

          <div class="row">
            <button class="btn primary" type="submit">Save offer</button>
            <button class="btn" type="button" id="duplicateOfferBtn">Duplicate</button>
            <a class="btn gold" href="docs.html${selected.id ? `?offerId=${encodeURIComponent(selected.id)}` : ''}">Open document output</a>
            ${selected.id ? `<button class="btn danger" type="button" id="deleteOfferBtn">Delete</button>` : ''}
          </div>
        </form>
        <section class="stack attachment-section">
          <div class="row spread"><h3 style="margin:0">Offer attachment vault</h3><span class="tag ${selected.id ? 'ok' : ''}">${selected.id ? 'Ready' : 'Save first'}</span></div>
          <div class="card-sub">Keep proposals, screenshots, signed proof, PDFs, images, and ZIP packs attached to the offer itself while fully offline.</div>
          <div id="offerAttachmentsWrap" class="stack">${selected.id ? '<div class="empty">Loading local files…</div>' : '<div class="empty">Save the offer once, then add local files directly into this offer workspace.</div>'}</div>
        </section>
      </section>
    </div>
  `;
}

function renderTemplates(){
  const selectedId = activeIdFromQuery('id') || appState.templates[0]?.id || '';
  const selected = getTemplate(selectedId) || { id:'', name:'', type:'offer', intro:'', scope:'', terms:'', lineItems:[{id:uid('li'), name:'', qty:1, unitPrice:0}], milestones:[{id:uid('ms'), name:'Deposit', amount:0, dueLabel:'At approval'}] };
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Reusable packages</h2><div class="card-sub">Save a strong structure once, reuse it fast.</div></div><span class="tag">${appState.templates.length} templates</span></div>
        <div class="row">
          <button class="btn" id="newTemplateBtn">New template</button>
          <button class="btn" id="seedTemplatesBtn">Reseed starters</button>
        </div>
        ${appState.templates.length ? `<div class="list">${appState.templates.map(tpl => `<a class="list-item ${tpl.id === selectedId ? 'active' : ''}" href="templates.html?id=${encodeURIComponent(tpl.id)}">
          <div class="row spread"><div class="list-title">${escapeHtml(tpl.name)}</div><span class="tag">${escapeHtml(tpl.type)}</span></div>
          <div class="list-meta">${escapeHtml((tpl.lineItems || []).length)} line items · ${escapeHtml((tpl.milestones || []).length)} milestones</div>
        </a>`).join('')}</div>` : `<div class="empty">No templates yet.</div>`}
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>${selected.id ? 'Edit template' : 'Create template'}</h2><div class="card-sub">Template logic is a real time saver in a paid workflow.</div></div>${selected.id ? `<span class="tag">${escapeHtml(selected.id)}</span>` : ''}</div>
        <form id="templateForm" class="stack">
          <input type="hidden" name="id" value="${escapeHtml(selected.id || '')}" />
          <div class="grid two-even">
            <label class="field">Template name<input class="input" name="name" required value="${escapeHtml(selected.name || '')}" /></label>
            <label class="field">Type<select name="type">${['offer','contract'].map(v => `<option value="${v}" ${selected.type===v?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
          <label class="field">Intro<textarea name="intro">${escapeHtml(selected.intro || '')}</textarea></label>
          <label class="field">Scope<textarea name="scope">${escapeHtml(selected.scope || '')}</textarea></label>
          <label class="field">Terms<textarea name="terms">${escapeHtml(selected.terms || '')}</textarea></label>
          <section class="stack">
            <div class="row spread"><h3 style="margin:0">Line items</h3><button class="btn" type="button" id="addTemplateLineBtn">Add line</button></div>
            <div id="templateLinesWrap" class="stack">${(selected.lineItems || []).map(item => `
              <div class="grid three tpl-line-row" data-line-id="${item.id}">
                <label class="field">Item<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
                <label class="field">Qty<input class="input" type="number" step="0.01" data-field="qty" value="${escapeHtml(item.qty || 0)}" /></label>
                <div class="row"><label class="field" style="flex:1">Unit price<input class="input" type="number" step="0.01" data-field="unitPrice" value="${escapeHtml(item.unitPrice || 0)}" /></label><button class="btn danger remove-tpl-line" type="button">Remove</button></div>
              </div>`).join('')}</div>
          </section>
          <section class="stack">
            <div class="row spread"><h3 style="margin:0">Milestones</h3><button class="btn" type="button" id="addTemplateMsBtn">Add milestone</button></div>
            <div id="templateMsWrap" class="stack">${(selected.milestones || []).map(item => `
              <div class="grid three tpl-ms-row" data-ms-id="${item.id}">
                <label class="field">Name<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
                <label class="field">Amount<input class="input" type="number" step="0.01" data-field="amount" value="${escapeHtml(item.amount || 0)}" /></label>
                <div class="row"><label class="field" style="flex:1">Due label<input class="input" data-field="dueLabel" value="${escapeHtml(item.dueLabel || '')}" /></label><button class="btn danger remove-tpl-ms" type="button">Remove</button></div>
              </div>`).join('')}</div>
          </section>
          <div class="row">
            <button class="btn primary" type="submit">Save template</button>
            <a class="btn gold" href="offers.html?templateId=${encodeURIComponent(selected.id || '')}">Use in offer</a>
            ${selected.id ? `<button class="btn danger" type="button" id="deleteTemplateBtn">Delete</button>` : ''}
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderTasks(){
  const selectedId = activeIdFromQuery('id') || appState.tasks[0]?.id || '';
  const selected = getTask(selectedId) || { id:'', title:'', dueDate:isoDateOffset(1), priority:'medium', status:'open', relatedType:'offer', relatedId:'', note:'' };
  const tasks = [...appState.tasks].sort((a,b) => (a.status === 'done') - (b.status === 'done') || new Date(a.dueDate) - new Date(b.dueDate));
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Task board</h2><div class="card-sub">Deadlines, callbacks, edits, reminders.</div></div><span class="tag">${tasks.length} tasks</span></div>
        <div class="row">
          <button class="btn" id="newTaskBtn">New task</button>
          <a class="btn" href="offers.html">Open offers</a>
        </div>
        ${tasks.length ? `<div class="list">${tasks.map(task => `<a class="list-item ${task.id === selectedId ? 'active' : ''}" href="tasks.html?id=${encodeURIComponent(task.id)}">
          <div class="row spread"><div class="list-title">${escapeHtml(task.title)}</div><span class="tag ${task.status === 'done' ? 'ok' : task.priority === 'high' ? 'bad' : task.priority === 'medium' ? 'warn' : ''}">${escapeHtml(task.status)}</span></div>
          <div class="list-meta">Due ${fmtShortDate(task.dueDate)} · ${escapeHtml(relatedLabel(task.relatedType, task.relatedId))}<br/>${escapeHtml(task.note || '')}</div>
        </a>`).join('')}</div>` : `<div class="empty">No tasks yet.</div>`}
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>${selected.id ? 'Edit task' : 'Create task'}</h2><div class="card-sub">Tie reminders to a contact or offer.</div></div>${selected.id ? `<span class="tag">${escapeHtml(selected.id)}</span>` : ''}</div>
        <form id="taskForm" class="stack">
          <input type="hidden" name="id" value="${escapeHtml(selected.id || '')}" />
          <label class="field">Task title<input class="input" name="title" required value="${escapeHtml(selected.title || '')}" /></label>
          <div class="grid two-even">
            <label class="field">Due date<input class="input" type="date" name="dueDate" value="${escapeHtml(selected.dueDate || '')}" /></label>
            <label class="field">Status<select name="status">${['open','waiting','done'].map(v => `<option value="${v}" ${selected.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
          <div class="grid two-even">
            <label class="field">Priority<select name="priority">${['low','medium','high'].map(v => `<option value="${v}" ${selected.priority===v?'selected':''}>${v}</option>`).join('')}</select></label>
            <label class="field">Related type<select name="relatedType">${['offer','contact','none'].map(v => `<option value="${v}" ${selected.relatedType===v?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
          <label class="field">Linked record<select name="relatedId"><option value="">No linked record</option>
            ${(selected.relatedType === 'contact' ? appState.contacts.map(c => `<option value="${c.id}" ${selected.relatedId===c.id?'selected':''}>${escapeHtml(c.fullName)} · ${escapeHtml(c.company || '')}</option>`).join('') : appState.offers.map(o => `<option value="${o.id}" ${selected.relatedId===o.id?'selected':''}>${escapeHtml(o.title)}</option>`).join(''))}
          </select></label>
          <label class="field">Notes<textarea name="note">${escapeHtml(selected.note || '')}</textarea></label>
          <div class="row">
            <button class="btn primary" type="submit">Save task</button>
            ${selected.id ? `<button class="btn danger" type="button" id="deleteTaskBtn">Delete</button>` : ''}
          </div>
        </form>
      </section>
    </div>
  `;
}

function buildOfferPaperHtml(offer){
  const client = getContact(offer.clientId);
  const totals = offerFinancials(offer);
  const companyName = appState.settings.companyName || 'Skyes Over London';
  const founderName = appState.settings.founderName || 'Skyes Over London';
  const today = new Date().toLocaleDateString([], { year:'numeric', month:'long', day:'numeric' });
  const logo = logoDataUrlCache || LOGO_PATH;
  return `<!doctype html>
  <html><head><meta charset="utf-8" /><title>${escapeHtml(offer.title)}</title>
  <style>
    body{margin:0;padding:28px;background:#eee6ff;font-family:Inter,Arial,sans-serif;color:#1c1630}
    .page{max-width:980px;margin:0 auto;background:#fff;padding:36px;border-radius:26px;box-shadow:0 20px 60px rgba(0,0,0,.18)}
    .head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid rgba(138,77,255,.18)}
    .logo{width:150px;height:auto;display:block}
    h1,h2,h3{margin:0 0 10px;color:#21143a}
    p,li{line-height:1.65}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .box{padding:16px;border-radius:18px;background:#f8f2ff;border:1px solid rgba(138,77,255,.16)}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{padding:12px 10px;border-bottom:1px solid #e6dcff;text-align:left;vertical-align:top}
    th{text-transform:uppercase;font-size:11px;letter-spacing:.16em;color:#7b67b9}
    .totals{margin-top:18px;display:grid;gap:10px;max-width:360px;margin-left:auto}
    .total-row{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:#f8f2ff}
    .final{background:#241543;color:#fff}
    .fine{font-size:13px;color:#6b5e93}
  </style></head><body>
  <div class="page">
    <div class="head">
      <div>
        <img class="logo" src="${logo}" alt="SkyDexia logo" />
        <h1>${escapeHtml(offer.title)}</h1>
        <p class="fine">Prepared by ${escapeHtml(companyName)} · ${escapeHtml(founderName)}<br/>Date: ${today} · Valid through ${fmtShortDate(offer.validUntil)}</p>
      </div>
      <div class="box">
        <strong>Prepared for</strong>
        <p style="margin:10px 0 0">${escapeHtml(client?.fullName || 'No contact linked')}<br/>${escapeHtml(client?.company || '')}<br/>${escapeHtml(client?.email || '')}<br/>${escapeHtml(client?.phone || '')}</p>
      </div>
    </div>

    <div class="grid" style="margin-top:22px">
      <div class="box"><h3>Intro</h3><p>${escapeHtml(offer.intro || '—').replace(/\n/g,'<br/>')}</p></div>
      <div class="box"><h3>Scope</h3><p>${escapeHtml(offer.scope || '—').replace(/\n/g,'<br/>')}</p></div>
    </div>

    <h2 style="margin-top:26px">Pricing</h2>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
      <tbody>
        ${(offer.lineItems || []).map(item => `<tr><td>${escapeHtml(item.name || '')}</td><td>${escapeHtml(item.qty || 0)}</td><td>${fmtCurrency(item.unitPrice || 0)}</td><td>${fmtCurrency((Number(item.qty || 0) * Number(item.unitPrice || 0)))}</td></tr>`).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><strong>${fmtCurrency(totals.subtotal)}</strong></div>
      <div class="total-row"><span>Discount</span><strong>${fmtCurrency(totals.discount)}</strong></div>
      <div class="total-row"><span>Tax</span><strong>${fmtCurrency(totals.tax)}</strong></div>
      <div class="total-row final"><span>Total</span><strong>${fmtCurrency(totals.total)}</strong></div>
    </div>

    <div class="grid" style="margin-top:26px">
      <div class="box"><h3>Milestones</h3><ul>${(offer.milestones || []).map(m => `<li><strong>${escapeHtml(m.name || '')}</strong> · ${fmtCurrency(m.amount || 0)} · ${escapeHtml(m.dueLabel || '')}</li>`).join('')}</ul></div>
      <div class="box"><h3>Terms</h3><p>${escapeHtml(offer.terms || '—').replace(/\n/g,'<br/>')}</p></div>
    </div>

    <div class="box" style="margin-top:26px"><h3>Internal notes surfaced for prep</h3><p>${escapeHtml(offer.notes || 'No internal notes.').replace(/\n/g,'<br/>')}</p></div>
    <p class="fine" style="margin-top:20px">Contact: ${escapeHtml(appState.settings.email)} · ${escapeHtml(appState.settings.phone)} · ${escapeHtml(appState.settings.website)}</p>
  </div></body></html>`;
}

function renderDocs(){
  const offerId = parseQuery().get('offerId') || appState.offers[0]?.id || '';
  const offer = getOffer(offerId);
  if(!offer){
    return `<section class="card"><div class="empty">You need at least one saved offer before document output can render anything useful. Build an offer first.</div></section>`;
  }
  const client = getContact(offer.clientId);
  const totals = offerFinancials(offer);
  const paperPreview = buildOfferPaperHtml(offer);
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Document source</h2><div class="card-sub">Choose an offer and export a polished HTML document.</div></div><span class="tag ok">Proposal + quote + terms</span></div>
        <label class="field">Offer<select id="docOfferSelect">${appState.offers.map(o => `<option value="${o.id}" ${o.id === offerId ? 'selected' : ''}>${escapeHtml(o.title)}</option>`).join('')}</select></label>
        <div class="kv">
          <div>Client</div><div>${escapeHtml(client ? `${client.fullName} · ${client.company || ''}` : 'No linked contact')}</div>
          <div>Status</div><div>${escapeHtml(offer.status)}</div>
          <div>Total</div><div>${fmtCurrency(totals.total)}</div>
          <div>Deposit</div><div>${fmtCurrency(totals.deposit)}</div>
          <div>Valid through</div><div>${fmtShortDate(offer.validUntil)}</div>
        </div>
        <div class="row">
          <button class="btn primary" id="printDocBtn">Print / save PDF</button>
          <button class="btn gold" id="downloadHtmlBtn">Download HTML</button>
          <a class="btn" href="offers.html?id=${encodeURIComponent(offer.id)}">Back to offer</a>
        </div>
        <div class="small">Because the output is HTML first, it stays useful offline and is easy to keep branded without any third-party dependency.</div>
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>Offer summary</h2><div class="card-sub">Quick read before you export.</div></div><span class="tag">${fmtCurrency(totals.total)}</span></div>
        <div class="notice">${escapeHtml(offer.intro || 'No intro yet.')}</div>
        <div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
          ${(offer.lineItems || []).map(item => `<tr><td>${escapeHtml(item.name || '')}</td><td>${escapeHtml(item.qty || 0)}</td><td>${fmtCurrency(item.unitPrice || 0)}</td><td>${fmtCurrency((Number(item.qty || 0) * Number(item.unitPrice || 0)))}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
    </div>
    <section class="card">
      <div class="card-title"><div><h2>Live preview</h2><div class="card-sub">This is the exact offline document surface generated from your saved offer.</div></div></div>
      <iframe id="docPreviewFrame" title="Offer preview" style="width:100%;height:920px;border:none;border-radius:20px;background:#fff"></iframe>
      <template id="docHtmlTemplate">${escapeHtml(paperPreview)}</template>
    </section>
  `;
}

function renderBackup(){
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Backup export</h2><div class="card-sub">Plain JSON when you want portability. Locked export when you want a passphrase layer. Both now carry local attachments too.</div></div><span class="tag ok">Local-first</span></div>
        <div class="notice" id="backupAttachmentStats">Scanning local attachment vault…</div>
        <div class="row">
          <button class="btn primary" id="jsonBackupBtn">Download JSON backup</button>
          <button class="btn gold" id="encryptedBackupBtn">Download locked backup</button>
        </div>
        <label class="field">Passphrase for locked backup<input class="input" type="password" id="backupPassphrase" placeholder="enter at least 6 characters" /></label>
        <div class="small">Locked backups use AES-GCM with PBKDF2 inside the browser. No server. No cloud dependency.</div>
        <hr class="sep" />
        <div class="row">
          <button class="btn" id="contactsCsvBtn">Export contacts CSV</button>
          <button class="btn" id="offersCsvBtn">Export offers CSV</button>
          <button class="btn" id="snapshotNowBtn">Save snapshot now</button>
        </div>
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>Restore</h2><div class="card-sub">Bring your workspace back from JSON, locked package, or a saved restore point.</div></div><span class="tag warn">Careful</span></div>
        <label class="field">Backup file<input class="input" type="file" id="restoreFile" accept=".json,.skyevault,application/json" /></label>
        <label class="field">Passphrase for locked restore<input class="input" type="password" id="restorePassphrase" placeholder="only needed for encrypted backups" /></label>
        <div class="row">
          <button class="btn primary" id="restoreBtn">Restore from file</button>
          <button class="btn danger" id="factoryResetBtn">Factory reset workspace</button>
        </div>
        <div class="small">Factory reset rebuilds the workspace from the starter seed, clears local attachments, and keeps the app shell intact.</div>
      </section>
    </div>

    <section class="card stack">
      <div class="card-title"><div><h2>Rolling snapshots</h2><div class="card-sub">Auto snapshots help you recover from bad edits without importing a file.</div></div><span class="tag">Auto + manual</span></div>
      <div id="snapshotListWrap" class="list"><div class="empty">Loading snapshots…</div></div>
    </section>
  `;
}

function renderSettings(){
  const s = appState.settings;
  return `
    <div class="grid two">
      <section class="card stack">
        <div class="card-title"><div><h2>Brand + business defaults</h2><div class="card-sub">Defaults that flow into the workspace and document output.</div></div><span class="tag">Persistent</span></div>
        <form id="settingsForm" class="stack">
          <div class="grid two-even">
            <label class="field">Workspace name<input class="input" name="workspaceName" value="${escapeHtml(s.workspaceName || '')}" /></label>
            <label class="field">Company name<input class="input" name="companyName" value="${escapeHtml(s.companyName || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">Founder name<input class="input" name="founderName" value="${escapeHtml(s.founderName || '')}" /></label>
            <label class="field">Website<input class="input" name="website" value="${escapeHtml(s.website || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">Email<input class="input" name="email" value="${escapeHtml(s.email || '')}" /></label>
            <label class="field">Phone<input class="input" name="phone" value="${escapeHtml(s.phone || '')}" /></label>
          </div>
          <div class="grid two-even">
            <label class="field">City<input class="input" name="city" value="${escapeHtml(s.city || '')}" /></label>
            <label class="field">Currency<select name="currency">${['USD','EUR','GBP','CAD'].map(v => `<option value="${v}" ${s.currency===v?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
          <div class="grid two-even">
            <label class="field">Default tax rate %<input class="input" type="number" step="0.01" name="defaultTaxRate" value="${escapeHtml(s.defaultTaxRate || 0)}" /></label>
            <label class="field">Default deposit %<input class="input" type="number" step="0.01" name="defaultDepositPercent" value="${escapeHtml(s.defaultDepositPercent || 0)}" /></label>
          </div>
          <div class="row"><button class="btn primary" type="submit">Save defaults</button></div>
        </form>
      </section>
      <section class="card stack">
        <div class="card-title"><div><h2>Visual control</h2><div class="card-sub">Background stays separate from the glass UI, so styling changes do not break the app structure.</div></div><span class="tag ok">Glass shell</span></div>
        <label class="field">Custom background image<input class="input" type="file" id="bgUpload" accept="image/*" /></label>
        <div class="grid two-even">
          <label class="field slider-row">Background opacity <input type="range" min="0" max="0.85" step="0.01" id="bgOpacity" value="${Number(s.backgroundOpacity || 0)}" /><span class="small" id="bgOpacityVal">${Number(s.backgroundOpacity || 0).toFixed(2)}</span></label>
          <label class="field slider-row">Background dim <input type="range" min="0" max="0.85" step="0.01" id="bgDim" value="${Number(s.backgroundDim || 0)}" /><span class="small" id="bgDimVal">${Number(s.backgroundDim || 0).toFixed(2)}</span></label>
          <label class="field slider-row">Background blur <input type="range" min="0" max="20" step="1" id="bgBlur" value="${Number(s.backgroundBlur || 0)}" /><span class="small" id="bgBlurVal">${Number(s.backgroundBlur || 0)}px</span></label>
          <label class="field slider-row">Shell glass <input type="range" min="0.45" max="0.92" step="0.01" id="glassLevel" value="${Number(s.glassLevel || 0)}" /><span class="small" id="glassLevelVal">${Number(s.glassLevel || 0).toFixed(2)}</span></label>
        </div>
        <div class="row">
          <button class="btn" id="clearBgBtn">Remove background image</button>
          <button class="btn gold" id="installAppBtn2">Install app</button>
        </div>
        <div class="small">Custom image is stored locally in the browser workspace so the app stays personalized offline.</div>
      </section>
    </div>
  `;
}


function renderTutorial(){
  const completed = walkthroughCompletedCount();
  const percent = walkthroughPercent();
  const progress = walkthroughProgress();
  const recordReadyCount = appState.contacts.length + appState.offers.length;
  const attachmentReady = appState.contacts.length || appState.offers.length;
  return `
    <section class="card stack">
      <div class="card-title"><div><h2>Built-in walkthrough lane</h2><div class="card-sub">Use this page as the operator guide inside the app itself. Check steps off as you finish them so the workspace doubles as its own onboarding lane.</div></div><span class="tag ok">${completed}/${WALKTHROUGH_STEPS.length} complete</span></div>
      <div class="progress-meter"><span style="width:${percent}%"></span></div>
      <div class="row spread">
        <div class="small">Progress: ${percent}% complete. This tutorial is local to the workspace, so progress stays with the app on this device.</div>
        <div class="quick-links">
          <a class="btn primary" href="index.html">Open dashboard</a>
          <button class="btn" id="resetTutorialBtn" type="button">Reset tutorial checks</button>
        </div>
      </div>
      <div class="notice">Fast path: Settings → Contacts → Offers → Attachments → Proof Pack Builder → Docs → Backup Center.</div>
    </section>

    <section class="step-grid">
      ${WALKTHROUGH_STEPS.map((step, idx) => `
        <article class="card tutorial-step-card ${progress[step.id] ? 'tutorial-step-done' : ''}">
          <div class="row spread tutorial-step-head">
            <div class="row tutorial-step-label"><span class="tutorial-step-num">${idx + 1}</span><div><div class="list-title">${escapeHtml(step.title)}</div><div class="list-meta">${escapeHtml(step.desc)}</div></div></div>
            <span class="tag ${progress[step.id] ? 'ok' : ''}">${progress[step.id] ? 'Done' : 'Open'}</span>
          </div>
          <div class="row spread tutorial-step-actions">
            <a class="btn ${idx === 0 ? 'primary' : ''}" href="${escapeHtml(walkthroughHrefForStep(step))}">${escapeHtml(step.btn)}</a>
            <label class="checkline tutorial-check"><input class="tutorial-step-check" type="checkbox" data-step="${escapeHtml(step.id)}" ${progress[step.id] ? 'checked' : ''}/> Mark this step complete</label>
          </div>
        </article>
      `).join('')}
    </section>

    <section class="grid two">
      <div class="card stack">
        <div class="card-title"><div><h2>What each lane is for</h2><div class="card-sub">This is the shortest clean explanation of how to move through the app without guessing.</div></div></div>
        <div class="kv">
          <div>Overview</div><div>Live counts, recent offers, follow-ups, and the command-room summary.</div>
          <div>Contacts</div><div>Create the record first. Tags, notes, and local file vaults all anchor here.</div>
          <div>Offers</div><div>Build pricing, terms, milestones, attachments, and the proof pack from one saved record.</div>
          <div>Templates</div><div>Turn a strong structure into a reusable package so you are not rebuilding every time.</div>
          <div>Tasks</div><div>Keep callbacks, edits, reminders, and payment follow-ups in one place.</div>
          <div>Docs</div><div>Preview the finished offer as a polished deliverable, then print or export the HTML.</div>
          <div>Backup</div><div>Protect the whole workspace, including local attachments and proof-pack files.</div>
        </div>
      </div>
      <div class="card stack">
        <div class="card-title"><div><h2>Readiness indicators</h2><div class="card-sub">Quick checks so you know whether the workspace is ready for real use.</div></div></div>
        <div class="kv">
          <div>Saved contacts + offers</div><div>${recordReadyCount} total saved records</div>
          <div>Attachment-ready</div><div>${attachmentReady ? 'Yes — save into any record vault now.' : 'Save one contact or one offer first.'}</div>
          <div>Proof-pack lane</div><div>${attachmentReady ? 'Available inside saved contact/offer records.' : 'Unlocks after a record is saved.'}</div>
          <div>Docs lane</div><div>${appState.offers.length ? 'Ready — at least one offer is available.' : 'Create one offer first for full document output.'}</div>
          <div>Backup lane</div><div>Always ready. Use it before heavy edits.</div>
          <div>PWA install</div><div>Available when supported by the current browser.</div>
        </div>
        <div class="success">Operator tip: save early, then attach files to the record instead of keeping loose evidence outside the app.</div>
      </div>
    </section>

    <section class="grid two">
      <div class="card stack">
        <div class="card-title"><div><h2>Proof pack workflow</h2><div class="card-sub">This is the clean offline chain for building a case file.</div></div></div>
        <ol class="tutorial-list">
          <li>Save a contact or offer.</li>
          <li>Add local files inside that record vault.</li>
          <li>Select the evidence you want included.</li>
          <li>Set the pack title, case tag, stage, and notes.</li>
          <li>Generate the proof pack HTML.</li>
          <li>Download it or save it back into the same record vault as a proof-pack attachment.</li>
        </ol>
      </div>
      <div class="card stack">
        <div class="card-title"><div><h2>Backup discipline</h2><div class="card-sub">The habit that keeps the app useful instead of fragile.</div></div></div>
        <ol class="tutorial-list">
          <li>Use a JSON backup for quick readable exports.</li>
          <li>Use a locked backup when you want local encryption.</li>
          <li>Create a manual snapshot before major cleanup or imports.</li>
          <li>Restore from file only when you are sure you want to overwrite the current workspace.</li>
        </ol>
      </div>
    </section>
  `;
}

function renderAbout(){
  return `
    <section class="card">
      <div class="hero-founder">
        <img src="${FOUNDER_PATH}" alt="Founder image" />
        <div class="stack">
          <div class="card-title"><div><h2>SkyDexia / Skyes Over London inside the product</h2><div class="card-sub">No generic shell. No anonymous branding. The founder image and SkyDexia logo are part of the shipped app.</div></div><span class="tag ok">Founder-forward</span></div>
          <div class="notice">Skye-OfferForge was upgraded into a stronger offline app with an actual contact vault, offer system, document renderer, follow-up desk, template forge, visual controls, and backup tooling that does not depend on a remote service.</div>
          <div class="kv">
            <div>Founder</div><div>${escapeHtml(appState.settings.founderName)}</div>
            <div>Company</div><div>${escapeHtml(appState.settings.companyName)}</div>
            <div>Email</div><div>${escapeHtml(appState.settings.email)}</div>
            <div>Phone</div><div>${escapeHtml(appState.settings.phone)}</div>
            <div>Website</div><div>${escapeHtml(appState.settings.website)}</div>
            <div>Mode</div><div>Offline-first PWA</div>
            <div>Useful upgrades</div><div>Encrypted backup export, rolling snapshots, contacts, offers, templates, tasks, docs, background lab</div>
          </div>
          <div class="quick-links">
            <a class="btn primary" href="offers.html">Open offer studio</a>
            <a class="btn" href="backup.html">Protect workspace</a>
            <a class="btn" href="settings.html">Adjust visuals</a>
          </div>
        </div>
      </div>
    </section>

    <section class="grid two">
      <div class="card stack">
        <div class="card-title"><div><h2>What was added</h2><div class="card-sub">Functional value, not fake enterprise theater.</div></div></div>
        <ul class="small" style="margin:0 0 0 18px">
          <li>Real contact storage with tags, notes, company context, and fast offer linking.</li>
          <li>Offer builder with pricing logic, taxes, discounts, deposit math, and milestones.</li>
          <li>Reusable templates that cut repeat work.</li>
          <li>Document output with print and HTML export.</li>
          <li>Backup center with plain JSON export, locked encrypted export, restore, and snapshots.</li>
          <li>Visual controls with separate background image layer and glass shell tuning.</li>
        </ul>
      </div>
      <div class="card stack">
        <div class="card-title"><div><h2>Contact details</h2><div class="card-sub">Kept present inside the app where appropriate.</div></div></div>
        <div class="success">${escapeHtml(appState.settings.companyName)}<br/>${escapeHtml(appState.settings.founderName)}<br/>${escapeHtml(appState.settings.email)}<br/>${escapeHtml(appState.settings.phone)}<br/>${escapeHtml(appState.settings.website)}</div>
      </div>
    </section>
  `;
}

function renderPage(){
  const root = byId('pageContent');
  if(!root) return;
  if(pageName === 'dashboard') root.innerHTML = renderDashboard();
  else if(pageName === 'contacts') root.innerHTML = renderContacts();
  else if(pageName === 'offers') root.innerHTML = renderOffers();
  else if(pageName === 'templates') root.innerHTML = renderTemplates();
  else if(pageName === 'tasks') root.innerHTML = renderTasks();
  else if(pageName === 'docs') root.innerHTML = renderDocs();
  else if(pageName === 'backup') root.innerHTML = renderBackup();
  else if(pageName === 'settings') root.innerHTML = renderSettings();
  else if(pageName === 'tutorial') root.innerHTML = renderTutorial();
  else if(pageName === 'about') root.innerHTML = renderAbout();
  bindPageEvents();
}

function bindPageEvents(){
  if(pageName === 'contacts') bindContactsPage();
  if(pageName === 'offers') bindOffersPage();
  if(pageName === 'templates') bindTemplatesPage();
  if(pageName === 'tasks') bindTasksPage();
  if(pageName === 'docs') bindDocsPage();
  if(pageName === 'backup') bindBackupPage();
  if(pageName === 'settings') bindSettingsPage();
  if(pageName === 'tutorial') bindTutorialPage();
}

function bindContactsPage(){
  const searchInput = byId('contactSearch');
  const currentId = activeIdFromQuery('id');
  renderAttachmentHub('contact', currentId, 'contactAttachmentsWrap');
  if(searchInput){
    searchInput.addEventListener('input', () => {
      const url = new URL(window.location.href);
      if(searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
      else url.searchParams.delete('q');
      history.replaceState({}, '', url.toString());
      renderPage();
    });
  }
  byId('newContactBtn')?.addEventListener('click', () => {
    updateQuery('', 'id');
    window.location.href = 'contacts.html';
  });
  byId('contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    const record = {
      id: data.id || uid('ct'),
      fullName: String(data.fullName || '').trim(),
      company: String(data.company || '').trim(),
      role: String(data.role || '').trim(),
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      city: String(data.city || '').trim(),
      state: String(data.state || '').trim(),
      tags: String(data.tags || '').trim(),
      notes: String(data.notes || '').trim(),
      status: String(data.status || 'lead'),
      createdAt: data.id ? (getContact(data.id)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    const idx = appState.contacts.findIndex(x => x.id === record.id);
    if(idx >= 0) appState.contacts[idx] = record; else appState.contacts.unshift(record);
    await saveWorkspace('contact-save');
    updateQuery(record.id, 'id');
    toast('Contact saved.');
    window.location.href = `contacts.html?id=${encodeURIComponent(record.id)}`;
  });
  byId('deleteContactBtn')?.addEventListener('click', async () => {
    const id = activeIdFromQuery('id');
    if(!id) return;
    if(!confirm('Delete this contact? Linked offers will remain but lose the contact link. Local files tied to this contact will also be removed.')) return;
    appState.contacts = appState.contacts.filter(x => x.id !== id);
    appState.offers = appState.offers.map(o => o.clientId === id ? { ...o, clientId:'' } : o);
    await DB.deleteAttachmentsByOwner('contact', id);
    await saveWorkspace('contact-delete');
    toast('Contact deleted.');
    window.location.href = 'contacts.html';
  });
}

function captureLineItems(containerSelector, rowSelector){
  return [...document.querySelectorAll(`${containerSelector} ${rowSelector}`)].map(row => ({
    id: row.dataset.lineId || row.dataset.msId || uid('row'),
    name: row.querySelector('[data-field="name"]')?.value?.trim() || '',
    qty: Number(row.querySelector('[data-field="qty"]')?.value || 0),
    unitPrice: Number(row.querySelector('[data-field="unitPrice"]')?.value || 0),
    amount: Number(row.querySelector('[data-field="amount"]')?.value || 0),
    dueLabel: row.querySelector('[data-field="dueLabel"]')?.value?.trim() || ''
  }));
}

function lineItemRow(item){
  return `<div class="grid three line-item-row" data-line-id="${item.id}">
    <label class="field">Item<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
    <label class="field">Qty<input class="input" type="number" step="0.01" data-field="qty" value="${escapeHtml(item.qty || 0)}" /></label>
    <div class="row"><label class="field" style="flex:1">Unit price<input class="input" type="number" step="0.01" data-field="unitPrice" value="${escapeHtml(item.unitPrice || 0)}" /></label><button class="btn danger remove-line" type="button">Remove</button></div>
  </div>`;
}
function milestoneRow(item){
  return `<div class="grid three milestone-row" data-ms-id="${item.id}">
    <label class="field">Name<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
    <label class="field">Amount<input class="input" type="number" step="0.01" data-field="amount" value="${escapeHtml(item.amount || 0)}" /></label>
    <div class="row"><label class="field" style="flex:1">Due label<input class="input" data-field="dueLabel" value="${escapeHtml(item.dueLabel || '')}" /></label><button class="btn danger remove-ms" type="button">Remove</button></div>
  </div>`;
}

function bindOffersPage(){
  const currentId = activeIdFromQuery('id');
  renderAttachmentHub('offer', currentId, 'offerAttachmentsWrap');
  byId('addLineItemBtn')?.addEventListener('click', () => {
    const wrap = byId('lineItemsWrap');
    wrap.insertAdjacentHTML('beforeend', lineItemRow({ id:uid('li'), name:'', qty:1, unitPrice:0 }));
    bindDynamicOfferButtons();
  });
  byId('addMilestoneBtn')?.addEventListener('click', () => {
    const wrap = byId('milestonesWrap');
    wrap.insertAdjacentHTML('beforeend', milestoneRow({ id:uid('ms'), name:'Milestone', amount:0, dueLabel:'When due' }));
    bindDynamicOfferButtons();
  });
  bindDynamicOfferButtons();
  byId('offerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    const record = {
      id: data.id || uid('of'),
      title: String(data.title || '').trim(),
      clientId: String(data.clientId || ''),
      status: String(data.status || 'draft'),
      validUntil: String(data.validUntil || isoDateOffset(14)),
      intro: String(data.intro || '').trim(),
      scope: String(data.scope || '').trim(),
      terms: String(data.terms || '').trim(),
      notes: String(data.notes || '').trim(),
      discountType: String(data.discountType || 'flat'),
      discountValue: Number(data.discountValue || 0),
      taxRate: Number(data.taxRate || 0),
      depositPercent: Number(data.depositPercent || 0),
      lineItems: captureLineItems('#lineItemsWrap', '.line-item-row').map(x => ({ id:x.id, name:x.name, qty:x.qty, unitPrice:x.unitPrice })),
      milestones: captureLineItems('#milestonesWrap', '.milestone-row').map(x => ({ id:x.id, name:x.name, amount:x.amount, dueLabel:x.dueLabel })),
      createdAt: data.id ? (getOffer(data.id)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    const idx = appState.offers.findIndex(x => x.id === record.id);
    if(idx >= 0) appState.offers[idx] = record; else appState.offers.unshift(record);
    await saveWorkspace('offer-save');
    toast('Offer saved.');
    window.location.href = `offers.html?id=${encodeURIComponent(record.id)}`;
  });
  byId('duplicateOfferBtn')?.addEventListener('click', async () => {
    const id = activeIdFromQuery('id');
    const source = getOffer(id);
    if(!source) return toast('Save the offer first, then duplicate it.');
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = uid('of');
    copy.title = `${copy.title} Copy`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.lineItems = copy.lineItems.map(item => ({ ...item, id:uid('li') }));
    copy.milestones = copy.milestones.map(item => ({ ...item, id:uid('ms') }));
    appState.offers.unshift(copy);
    await saveWorkspace('offer-duplicate');
    toast('Offer duplicated.');
    window.location.href = `offers.html?id=${encodeURIComponent(copy.id)}`;
  });
  byId('deleteOfferBtn')?.addEventListener('click', async () => {
    const id = activeIdFromQuery('id');
    if(!id) return;
    if(!confirm('Delete this offer? Local files tied to this offer will also be removed.')) return;
    appState.offers = appState.offers.filter(x => x.id !== id);
    appState.tasks = appState.tasks.map(t => (t.relatedType === 'offer' && t.relatedId === id) ? { ...t, relatedId:'' } : t);
    await DB.deleteAttachmentsByOwner('offer', id);
    await saveWorkspace('offer-delete');
    toast('Offer deleted.');
    window.location.href = 'offers.html';
  });
}

function bindDynamicOfferButtons(){
  document.querySelectorAll('.remove-line').forEach(btn => btn.onclick = () => {
    btn.closest('.line-item-row')?.remove();
  });
  document.querySelectorAll('.remove-ms').forEach(btn => btn.onclick = () => {
    btn.closest('.milestone-row')?.remove();
  });
}

function bindTemplatesPage(){
  const lineRow = item => `<div class="grid three tpl-line-row" data-line-id="${item.id}">
      <label class="field">Item<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
      <label class="field">Qty<input class="input" type="number" step="0.01" data-field="qty" value="${escapeHtml(item.qty || 0)}" /></label>
      <div class="row"><label class="field" style="flex:1">Unit price<input class="input" type="number" step="0.01" data-field="unitPrice" value="${escapeHtml(item.unitPrice || 0)}" /></label><button class="btn danger remove-tpl-line" type="button">Remove</button></div>
    </div>`;
  const msRow = item => `<div class="grid three tpl-ms-row" data-ms-id="${item.id}">
      <label class="field">Name<input class="input" data-field="name" value="${escapeHtml(item.name || '')}" /></label>
      <label class="field">Amount<input class="input" type="number" step="0.01" data-field="amount" value="${escapeHtml(item.amount || 0)}" /></label>
      <div class="row"><label class="field" style="flex:1">Due label<input class="input" data-field="dueLabel" value="${escapeHtml(item.dueLabel || '')}" /></label><button class="btn danger remove-tpl-ms" type="button">Remove</button></div>
    </div>`;
  const rebind = () => {
    document.querySelectorAll('.remove-tpl-line').forEach(btn => btn.onclick = () => btn.closest('.tpl-line-row')?.remove());
    document.querySelectorAll('.remove-tpl-ms').forEach(btn => btn.onclick = () => btn.closest('.tpl-ms-row')?.remove());
  };
  rebind();
  byId('addTemplateLineBtn')?.addEventListener('click', () => { byId('templateLinesWrap').insertAdjacentHTML('beforeend', lineRow({ id:uid('li'), name:'', qty:1, unitPrice:0 })); rebind(); });
  byId('addTemplateMsBtn')?.addEventListener('click', () => { byId('templateMsWrap').insertAdjacentHTML('beforeend', msRow({ id:uid('ms'), name:'Milestone', amount:0, dueLabel:'When due' })); rebind(); });
  byId('newTemplateBtn')?.addEventListener('click', () => { window.location.href = 'templates.html'; });
  byId('seedTemplatesBtn')?.addEventListener('click', async () => {
    appState.templates = JSON.parse(JSON.stringify(DemoSeed.templates));
    await saveWorkspace('templates-reseed');
    toast('Starter templates restored.');
    window.location.href = `templates.html?id=${encodeURIComponent(appState.templates[0].id)}`;
  });
  byId('templateForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    const record = {
      id: data.id || uid('tpl'),
      name: String(data.name || '').trim(),
      type: String(data.type || 'offer'),
      intro: String(data.intro || '').trim(),
      scope: String(data.scope || '').trim(),
      terms: String(data.terms || '').trim(),
      lineItems: captureLineItems('#templateLinesWrap', '.tpl-line-row').map(x => ({ id:x.id, name:x.name, qty:x.qty, unitPrice:x.unitPrice })),
      milestones: captureLineItems('#templateMsWrap', '.tpl-ms-row').map(x => ({ id:x.id, name:x.name, amount:x.amount, dueLabel:x.dueLabel })),
      createdAt: data.id ? (getTemplate(data.id)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    const idx = appState.templates.findIndex(x => x.id === record.id);
    if(idx >= 0) appState.templates[idx] = record; else appState.templates.unshift(record);
    await saveWorkspace('template-save');
    toast('Template saved.');
    window.location.href = `templates.html?id=${encodeURIComponent(record.id)}`;
  });
  byId('deleteTemplateBtn')?.addEventListener('click', async () => {
    const id = activeIdFromQuery('id');
    if(!id) return;
    if(!confirm('Delete this template?')) return;
    appState.templates = appState.templates.filter(x => x.id !== id);
    await saveWorkspace('template-delete');
    toast('Template deleted.');
    window.location.href = 'templates.html';
  });
}

function bindTasksPage(){
  byId('newTaskBtn')?.addEventListener('click', () => window.location.href = 'tasks.html');
  const relatedType = document.querySelector('select[name="relatedType"]');
  relatedType?.addEventListener('change', () => renderPage());
  byId('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    const record = {
      id: data.id || uid('tk'),
      title: String(data.title || '').trim(),
      dueDate: String(data.dueDate || isoDateOffset(1)),
      priority: String(data.priority || 'medium'),
      status: String(data.status || 'open'),
      relatedType: String(data.relatedType || 'none'),
      relatedId: String(data.relatedId || ''),
      note: String(data.note || '').trim(),
      createdAt: data.id ? (getTask(data.id)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    const idx = appState.tasks.findIndex(x => x.id === record.id);
    if(idx >= 0) appState.tasks[idx] = record; else appState.tasks.unshift(record);
    await saveWorkspace('task-save');
    toast('Task saved.');
    window.location.href = `tasks.html?id=${encodeURIComponent(record.id)}`;
  });
  byId('deleteTaskBtn')?.addEventListener('click', async () => {
    const id = activeIdFromQuery('id');
    if(!id) return;
    if(!confirm('Delete this task?')) return;
    appState.tasks = appState.tasks.filter(x => x.id !== id);
    await saveWorkspace('task-delete');
    toast('Task deleted.');
    window.location.href = 'tasks.html';
  });
}

function bindDocsPage(){
  const templateText = byId('docHtmlTemplate')?.textContent || '';
  const iframe = byId('docPreviewFrame');
  if(iframe && templateText){
    const html = templateText;
    iframe.srcdoc = html;
  }
  byId('docOfferSelect')?.addEventListener('change', (e) => {
    window.location.href = `docs.html?offerId=${encodeURIComponent(e.target.value)}`;
  });
  byId('printDocBtn')?.addEventListener('click', async () => {
    await ensureLogoDataUrl();
    const offer = getOffer(parseQuery().get('offerId')) || appState.offers[0];
    const html = buildOfferPaperHtml(offer);
    const win = window.open('', '_blank');
    if(!win) return toast('Popup blocked. Allow popups to print.');
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  });
  byId('downloadHtmlBtn')?.addEventListener('click', async () => {
    await ensureLogoDataUrl();
    const offer = getOffer(parseQuery().get('offerId')) || appState.offers[0];
    const html = buildOfferPaperHtml(offer);
    downloadBlob(new Blob([html], { type:'text/html' }), `${slugify(offer.title)}.html`);
  });
}

async function renderSnapshots(){
  const wrap = byId('snapshotListWrap');
  if(!wrap) return;
  const snaps = await DB.listSnapshots();
  if(!snaps.length){
    wrap.innerHTML = '<div class="empty">No snapshots yet. Save one now or just keep working and the app will roll its own restore points over time.</div>';
    return;
  }
  wrap.innerHTML = snaps.map(snap => `
    <div class="list-item">
      <div class="row spread"><div class="list-title">${fmtDate(snap.createdAt)}</div><span class="tag">${escapeHtml(snap.reason || 'snapshot')}</span></div>
      <div class="list-meta">${escapeHtml((snap.value?.contacts || []).length)} contacts · ${escapeHtml((snap.value?.offers || []).length)} offers · ${escapeHtml((snap.value?.tasks || []).length)} tasks</div>
      <div class="row" style="margin-top:10px">
        <button class="btn restore-snapshot" data-id="${snap.id}">Restore</button>
        <button class="btn danger delete-snapshot" data-id="${snap.id}">Delete</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('.restore-snapshot').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
    const snapsNow = await DB.listSnapshots();
    const found = snapsNow.find(x => x.id === id);
    if(!found) return;
    if(!confirm('Restore this snapshot over the current workspace?')) return;
    appState = normalizeWorkspace(found.value);
    await saveWorkspace('snapshot-restore');
    toast('Snapshot restored.');
    window.location.reload();
  });
  wrap.querySelectorAll('.delete-snapshot').forEach(btn => btn.onclick = async () => {
    if(!confirm('Delete this snapshot?')) return;
    await DB.deleteSnapshot(btn.dataset.id);
    toast('Snapshot deleted.');
    renderSnapshots();
  });
}

async function updateBackupAttachmentStats(){
  const el = byId('backupAttachmentStats');
  if(!el) return;
  const items = await DB.listAllAttachments();
  const bytes = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
  el.textContent = `${items.length} local attachment${items.length === 1 ? '' : 's'} stored across the workspace · ${humanFileSize(bytes)} total · JSON and locked backups include them.`;
}

function bindBackupPage(){
  updateBackupAttachmentStats();
  byId('jsonBackupBtn')?.addEventListener('click', async () => {
    await exportJsonBackup();
    toast('JSON backup downloaded.');
  });
  byId('encryptedBackupBtn')?.addEventListener('click', async () => {
    try{
      await exportEncryptedBackup(byId('backupPassphrase')?.value || '');
      toast('Locked backup downloaded.');
    }catch(err){ toast(err.message || 'Could not create locked backup.'); }
  });
  byId('contactsCsvBtn')?.addEventListener('click', () => { exportCsvContacts(); toast('Contacts CSV downloaded.'); });
  byId('offersCsvBtn')?.addEventListener('click', () => { exportCsvOffers(); toast('Offers CSV downloaded.'); });
  byId('snapshotNowBtn')?.addEventListener('click', async () => {
    appState.meta.lastSnapshotAt = 0;
    await maybeAutoSnapshot('manual-snapshot');
    await DB.saveWorkspace(appState);
    toast('Snapshot saved.');
    renderSnapshots();
  });
  byId('restoreBtn')?.addEventListener('click', async () => {
    const file = byId('restoreFile')?.files?.[0];
    if(!file) return toast('Pick a backup file first.');
    try{
      const text = await fileToText(file);
      const msg = await restoreBackupFromText(text, byId('restorePassphrase')?.value || '');
      toast(msg);
      window.location.reload();
    }catch(err){
      toast(err.message || 'Restore failed.');
    }
  });
  byId('factoryResetBtn')?.addEventListener('click', async () => {
    if(!confirm('Factory reset the workspace to starter data?')) return;
    appState = defaultWorkspace();
    await DB.clearAttachments();
    await DB.saveWorkspace(appState);
    toast('Workspace reset.');
    window.location.reload();
  });
  renderSnapshots();
}


function bindTutorialPage(){
  document.querySelectorAll('.tutorial-step-check').forEach(box => {
    box.addEventListener('change', async () => {
      const progress = walkthroughProgress();
      progress[box.dataset.step] = !!box.checked;
      await saveWorkspace('tutorial-step');
      renderPage();
    });
  });
  byId('resetTutorialBtn')?.addEventListener('click', async () => {
    if(!confirm('Reset all walkthrough checks for this workspace?')) return;
    appState.meta.walkthroughProgress = {};
    await saveWorkspace('tutorial-reset');
    toast('Walkthrough checks reset.');
    renderPage();
  });
}

function bindSettingsPage(){
  byId('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    Object.assign(appState.settings, {
      workspaceName: String(fd.get('workspaceName') || '').trim(),
      companyName: String(fd.get('companyName') || '').trim(),
      founderName: String(fd.get('founderName') || '').trim(),
      website: String(fd.get('website') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      currency: String(fd.get('currency') || 'USD'),
      defaultTaxRate: Number(fd.get('defaultTaxRate') || 0),
      defaultDepositPercent: Number(fd.get('defaultDepositPercent') || 0)
    });
    await saveWorkspace('settings-save');
    toast('Workspace defaults saved.');
  });
  const syncSlider = (id, labelId, formatter) => {
    const el = byId(id); const label = byId(labelId);
    if(!el || !label) return;
    const update = async () => {
      const val = Number(el.value);
      label.textContent = formatter(val);
      if(id === 'bgOpacity') appState.settings.backgroundOpacity = val;
      if(id === 'bgDim') appState.settings.backgroundDim = val;
      if(id === 'bgBlur') appState.settings.backgroundBlur = val;
      if(id === 'glassLevel') appState.settings.glassLevel = val;
      applyVisualSettings();
      await DB.saveWorkspace(appState);
    };
    el.addEventListener('input', update);
  };
  syncSlider('bgOpacity','bgOpacityVal', v => v.toFixed(2));
  syncSlider('bgDim','bgDimVal', v => v.toFixed(2));
  syncSlider('bgBlur','bgBlurVal', v => `${v}px`);
  syncSlider('glassLevel','glassLevelVal', v => v.toFixed(2));
  byId('bgUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    appState.settings.backgroundImage = await blobToDataURL(file);
    await saveWorkspace('background-upload');
    toast('Background image saved locally.');
  });
  byId('clearBgBtn')?.addEventListener('click', async () => {
    appState.settings.backgroundImage = null;
    await saveWorkspace('background-clear');
    toast('Custom background removed.');
  });
  byId('installAppBtn2')?.addEventListener('click', () => triggerInstallPrompt());
}

function setupInstallHandlers(){
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = byId('installBtn');
    if(btn) btn.classList.remove('hidden');
  });
  byId('installBtn')?.addEventListener('click', () => triggerInstallPrompt());
}
async function triggerInstallPrompt(){
  if(!deferredPrompt) return toast('Install prompt is not available in this browser right now.');
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
}

function bindGlobalButtons(){
  byId('quickBackupBtn')?.addEventListener('click', () => window.location.href = 'backup.html');
  byId('quickOfferBtn')?.addEventListener('click', () => window.location.href = 'offers.html');
}

async function registerSw(){
  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('./sw.js'); }catch(e){ /* no-op */ }
  }
}

function setupBroadcast(){
  if('BroadcastChannel' in window){
    channel = new BroadcastChannel('skye-offerforge-sync');
    channel.onmessage = async (ev) => {
      if(ev.data?.type === 'workspace-updated'){
        const fresh = await DB.getWorkspace();
        appState = normalizeWorkspace(fresh);
        applyVisualSettings();
        updateShellStats();
        if(pageName !== 'settings') renderPage();
      }
    };
  }
}

async function boot(){
  pageName = document.body.dataset.page || 'dashboard';
  setupBroadcast();
  await loadWorkspace();
  await ensureLogoDataUrl().catch(() => null);
  setPageMeta();
  updateShellStats();
  bindGlobalButtons();
  setupInstallHandlers();
  renderPage();
  registerSw();
}

document.addEventListener('DOMContentLoaded', boot);
