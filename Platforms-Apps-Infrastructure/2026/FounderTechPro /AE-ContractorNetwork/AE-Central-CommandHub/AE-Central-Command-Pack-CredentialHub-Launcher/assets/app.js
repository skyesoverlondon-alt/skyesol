
const app = (() => {
  const STORAGE_KEY = 'skydexia.hubvault.payload.v2';
  const UI_KEY = 'skydexia.hubvault.ui.v2';
  const TUTORIAL_KEY = 'credentialvault.sol26.tutorial.seen.v1';
  const PAGE_MAP = {
    launcher: './pages/launcher.html',
    'ae-command-pack': './pages/ae-command-pack.html',
    'credential-pack': './pages/credential-pack.html',
    'ops-pack': './pages/ops-pack.html',
    'service-pack': './pages/service-pack.html',
    dashboard: './pages/dashboard.html',
    sitemap: './pages/sitemap.html',
    tutorial: './pages/tutorial.html',
    contacts: './pages/contacts.html',
    'contact-view': './pages/contact-view.html',
    vault: './pages/vault.html',
    projects: './pages/projects.html',
    notes: './pages/notes.html',
    settings: './pages/settings.html'
  };
  const NAV_BASE = {
    launcher: 'launcher',
    'ae-command-pack': 'ae-command-pack',
    'credential-pack': 'credential-pack',
    'ops-pack': 'ops-pack',
    'service-pack': 'service-pack',
    dashboard: 'dashboard',
    sitemap: 'sitemap',
    tutorial: 'tutorial',
    contacts: 'contacts',
    'contact-view': 'contacts',
    vault: 'vault',
    projects: 'projects',
    notes: 'notes',
    settings: 'settings'
  };
  const CONNECTED_APPS = [
    {
      id:'hub-launcher',
      title:'Credential Hub Launcher',
      kind:'Launcher',
      placement:'Root shell',
      summary:'Central landing surface that anchors the AE Central Command Pack and links the internal lanes plus bundled branch apps from one launcher.',
      icon:'./icon-192.png',
      type:'internal',
      route:'launcher',
      action:'Open launcher'
    },
    {
      id:'ae-command-pack',
      title:'AE Central Command Pack',
      kind:'Guide',
      placement:'Root shell',
      summary:'Merged command page for the free AE FLOW, ConnectLog, Skye Intake Vault, and Exec Sign In Pro stack, with AE Flow Connect and Credential Hub positioning included.',
      icon:'./icon-192.png',
      type:'internal',
      route:'ae-command-pack',
      action:'Open pack'
    },
    {
      id:'credential-pack',
      title:'Credential Pack',
      kind:'Guide',
      placement:'Root shell',
      summary:'Overview page for the four core apps inside the Credential Hub: Contacts Hub, Vault, Projects, and Notes, including linked workflow and estimated lane values.',
      icon:'./icon-192.png',
      type:'internal',
      route:'credential-pack',
      action:'Open credential pack'
    },
    {
      id:'ops-pack',
      title:'Connected Ops Pack',
      kind:'Guide',
      placement:'Root shell',
      summary:'Editorial page for Skye Lead Vault and Skye Split Engine Ops, including how the two connected apps work together from lead to ledger and what they are worth.',
      icon:'./icon-192.png',
      type:'internal',
      route:'ops-pack',
      action:'Open ops pack'
    },
    {
      id:'service-pack',
      title:'Service Master Pack Guide',
      kind:'Guide',
      placement:'Root shell',
      summary:'Editorial page for the Service Master Pack, including payment methodology, recurring and AI-usage context, and help choosing which service lanes to offer.',
      icon:'./icon-192.png',
      type:'internal',
      route:'service-pack',
      action:'Open service guide'
    },
    {
      id:'service-master-pack',
      title:'Service Master Pack',
      kind:'Connected app',
      placement:'Branching Apps',
      summary:'Full contractor-facing service enablement pack with 5 sections, 19 service-specific pages, contractor economics support pages, and direct links back to live SkyeSol service lanes.',
      icon:'./icon-192.png',
      type:'external',
      href:'./Branching Apps/ae-service-pack-master/index.html',
      action:'Launch pack'
    },
    {
      id:'hub-dashboard',
      title:'Credential Vault Dashboard',
      kind:'Lane',
      placement:'Root shell',
      summary:'Main operational snapshot for contacts, credentials, projects, notes, favorites, and recent activity.',
      icon:'./icon-192.png',
      type:'internal',
      route:'dashboard',
      action:'Open dashboard'
    },
    {
      id:'contacts-hub',
      title:'Contacts Hub',
      kind:'Lane',
      placement:'Root shell',
      summary:'People records, CSV import and export, status filters, follow-up history, and relationship context.',
      icon:'./icon-192.png',
      type:'internal',
      route:'contacts',
      action:'Open contacts'
    },
    {
      id:'vault-lane',
      title:'Vault',
      kind:'Lane',
      placement:'Root shell',
      summary:'Credentials, URLs, tokens, secrets, linked contacts, linked projects, and notes in the protected vault lane.',
      icon:'./icon-192.png',
      type:'internal',
      route:'vault',
      action:'Open vault'
    },
    {
      id:'projects-lane',
      title:'Projects',
      kind:'Lane',
      placement:'Root shell',
      summary:'Groups related people, notes, and credentials into named working lanes so the hub stays organized.',
      icon:'./icon-192.png',
      type:'internal',
      route:'projects',
      action:'Open projects'
    },
    {
      id:'notes-lane',
      title:'Notes',
      kind:'Lane',
      placement:'Root shell',
      summary:'Quick references, snippets, reminders, and contextual notes that do not belong in password or contact records.',
      icon:'./icon-192.png',
      type:'internal',
      route:'notes',
      action:'Open notes'
    },
    {
      id:'settings-lane',
      title:'Settings',
      kind:'Utility',
      placement:'Root shell',
      summary:'Background controls, glass tuning, local lock, backup/restore, and install/offline controls.',
      icon:'./icon-192.png',
      type:'internal',
      route:'settings',
      action:'Open settings'
    },
    {
      id:'offerforge',
      title:'Skye-OfferForge',
      kind:'Branch app',
      placement:'Branching Apps',
      summary:'Offline offer and contact workspace with quote lanes, template packs, tasks, docs, backup center, and founder branding.',
      icon:'./Branching Apps/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/oforge/icon-192.png',
      type:'external',
      href:'./Branching Apps/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/oforge/index.html',
      action:'Launch app'
    },
    {
      id:'skyebox',
      title:'SkyeBox Command Vault',
      kind:'Branch app',
      placement:'Branching Apps',
      summary:'Offline authenticator, secure note stack, contact hub, locker files, encrypted exports, and command-vault recovery workflows.',
      icon:'./Branching Apps/SkyeBox-Command-Vault/SkyeBox-Command-Vault-v6-tutorial-walkthrough/icon-192.png',
      type:'external',
      href:'./Branching Apps/SkyeBox-Command-Vault/SkyeBox-Command-Vault-v6-tutorial-walkthrough/index.html',
      action:'Launch app'
    },
    {
      id:'skyeportal',
      title:'SkyePortal Control Plane Vault',
      kind:'Branch app',
      placement:'Branching Apps',
      summary:'Offline vault workstation with encrypted documents, local attachments, device inventory, snapshots, and recovery bundle flows.',
      icon:'./Branching Apps/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/assets/icon-192.png',
      type:'external',
      href:'./Branching Apps/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/index.html',
      action:'Launch app'
    },
    {
      id:'skye-lead-vault',
      title:'Skye Lead Vault',
      kind:'Connected app',
      placement:'Branching Apps',
      summary:'Offline lead-operations vault with daily command center, lead ledger, pipeline, quick capture, playbooks, routes, analytics, backups, and privacy controls.',
      icon:'./Branching Apps/Skye-Lead-Vault-Offline-Phase2-with-Walkthrough/icon-192.png',
      type:'external',
      href:'./Branching Apps/Skye-Lead-Vault-Offline-Phase2-with-Walkthrough/index.html',
      action:'Launch app'
    },
    {
      id:'skye-split-engine-ops',
      title:'Skye Split Engine Ops',
      kind:'Connected app',
      placement:'Branching Apps',
      summary:'Offline money-operations workspace for split math, recurring payout templates, deal ledgering, settlement receipts, CSV movement, contacts, and backup vault recovery.',
      icon:'./Branching Apps/Skye-Split-Engine-Offline-Money-Ops-Walkthrough/skye-split-engine-offline/assets/icons/icon-192.png',
      type:'external',
      href:'./Branching Apps/Skye-Split-Engine-Offline-Money-Ops-Walkthrough/skye-split-engine-offline/index.html',
      action:'Launch app'
    }
  ];

  let deferredInstallPrompt = null;
  let currentPage = 'dashboard';
  let currentParams = {};
  let templateCache = new Map();
  let unlocked = false;
  let currentKey = null;
  let currentSalt = null;
  let state = null;
  let swReady = false;
  let tourActive = false;
  let tourIndex = 0;

  const filters = {
    contactSearch: '',
    contactStatus: '',
    credentialSearch: '',
    credentialCategory: '',
    projectSearch: '',
    noteSearch: ''
  };

  const defaultState = () => ({
    projects: [],
    contacts: [],
    credentials: [],
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const defaultUI = () => ({
    preset: 'duo',
    useUploadedBackground: false,
    customBackground: '',
    opacity: 28,
    blur: 20,
    dim: 34,
    tint: '#5f33d3',
    showFounder: true,
    showLogos: true
  });

  let ui = loadUI();

  function qs(id){ return document.getElementById(id); }
  function uid(){ return (crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2,9)}`); }
  function nowISO(){ return new Date().toISOString(); }
  function deepClone(v){ return JSON.parse(JSON.stringify(v)); }
  function escapeHtml(str=''){ return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function escapeJs(str=''){ return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,''); }
  function formatDate(iso){ if(!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
  function emptyState(msg){ return `<div class="empty">${escapeHtml(msg)}</div>`; }
  function csvCell(value=''){ const str = String(value ?? ''); return `"${str.replace(/"/g,'""')}"`; }

  function loadUI(){
    try{
      const raw = localStorage.getItem(UI_KEY);
      return raw ? {...defaultUI(), ...JSON.parse(raw)} : defaultUI();
    }catch{
      return defaultUI();
    }
  }
  function saveUI(){ localStorage.setItem(UI_KEY, JSON.stringify(ui)); }

  function showToast(message, tone='good'){
    const wrap = qs('toast-wrap');
    if(!wrap) return;
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => el.remove(), 3200);
  }

  function colorHexToRgb(hex){
    const clean = String(hex || '#5f33d3').replace('#','');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const int = parseInt(full, 16);
    return {r:(int>>16)&255, g:(int>>8)&255, b:int&255};
  }

  function applyBackgroundPreset(){
    const secondary = qs('background-secondary');
    const custom = qs('background-custom');
    if(!secondary || !custom) return;
    const duo = './assets/skydexia-duo.webp';
    const solo = './assets/skydexia-solo.webp';
    const founder = './assets/founder.webp';
    if(ui.preset === 'duo'){
      secondary.style.backgroundImage = `url('${duo}')`;
      secondary.style.backgroundPosition = 'center 18%';
      secondary.style.backgroundSize = 'min(78vw, 980px) auto';
    }else if(ui.preset === 'solo'){
      secondary.style.backgroundImage = `url('${solo}')`;
      secondary.style.backgroundPosition = 'center 14%';
      secondary.style.backgroundSize = 'min(52vw, 680px) auto';
    }else if(ui.preset === 'founder'){
      secondary.style.backgroundImage = `url('${founder}')`;
      secondary.style.backgroundPosition = 'left 4% bottom';
      secondary.style.backgroundSize = 'min(44vw, 560px) auto';
    }else{
      secondary.style.backgroundImage = '';
    }
    if(ui.useUploadedBackground && ui.customBackground){
      custom.style.backgroundImage = `url('${ui.customBackground}')`;
      custom.style.opacity = '.84';
    }else{
      custom.style.backgroundImage = '';
      custom.style.opacity = '0';
    }
    document.querySelectorAll('.preset').forEach(el => el.classList.toggle('active', el.dataset.preset === ui.preset));
  }

  function applyUI(){
    document.documentElement.style.setProperty('--panel-bg', `rgba(9,22,56,${(ui.opacity/100).toFixed(2)})`);
    document.documentElement.style.setProperty('--panel-strong', `rgba(9,22,56,${Math.min(ui.opacity/100 + .12,.72).toFixed(2)})`);
    document.documentElement.style.setProperty('--blur', `${ui.blur}px`);
    document.documentElement.style.setProperty('--dim', `rgba(3,4,8,${(ui.dim/100).toFixed(2)})`);
    const {r,g,b} = colorHexToRgb(ui.tint);
    document.documentElement.style.setProperty('--tint', `rgba(${r},${g},${b},.34)`);

    const founder = qs('bg-founder');
    const secondary = qs('background-secondary');
    if(founder) founder.style.opacity = ui.showFounder ? '' : '0';
    if(secondary){
      const wantsFounderArt = ui.preset === 'founder';
      const active = wantsFounderArt ? ui.showFounder : ui.showLogos;
      secondary.style.opacity = active ? '.24' : '0';
    }

    const opacityEl = qs('ui-opacity'); if(opacityEl) opacityEl.value = String(ui.opacity);
    const blurEl = qs('ui-blur'); if(blurEl) blurEl.value = String(ui.blur);
    const dimEl = qs('bg-dim'); if(dimEl) dimEl.value = String(ui.dim);
    const tintEl = qs('tint-color'); if(tintEl) tintEl.value = ui.tint;
    const toggleFounder = qs('toggle-founder'); if(toggleFounder) toggleFounder.classList.toggle('on', !!ui.showFounder);
    const toggleLogos = qs('toggle-logos'); if(toggleLogos) toggleLogos.classList.toggle('on', !!ui.showLogos);
    const toggleUpload = qs('toggle-upload-bg'); if(toggleUpload) toggleUpload.classList.toggle('on', !!ui.useUploadedBackground);

    applyBackgroundPreset();
    saveUI();
  }

  function updateUISetting(key, value){
    if(key === 'opacity' || key === 'blur' || key === 'dim') ui[key] = Number(value);
    else ui[key] = value;
    applyUI();
  }

  function toggleUIOption(key){
    ui[key] = !ui[key];
    applyUI();
  }

  function getWalkthroughSteps(){
    return [
      {page:'dashboard', selector:'[data-tour="dashboard-hero"]', title:'This is your home surface', body:'The dashboard gives you the fast read: totals, pinned records, recent activity, and quick actions without dumping every feature onto one giant page.'},
      {page:'dashboard', selector:'[data-tour="global-toolbar"]', title:'Use the top bar for fast actions', body:'Backup, restore, global search, install, and quick add stay in the top bar so they are always nearby no matter which section you are in.'},
      {page:'contacts', selector:'[data-tour="contacts-toolbar"]', title:'The Contacts Hub is its own lane', body:'Import CSV files, filter your people, add new records, and keep relationship work separate from the rest of the app.'},
      {page:'contacts', selector:'[data-tour="contacts-list"]', title:'Contacts keep their own relationship history', body:'Each contact can hold company details, tags, notes, linked projects, and a running timeline of calls, texts, emails, or in-person touchpoints.'},
      {page:'vault', selector:'[data-tour="vault-toolbar"]', title:'The Vault stores the sensitive records', body:'Logins, API keys, payment details, URLs, and related notes stay here instead of cluttering up the contacts side.'},
      {page:'projects', selector:'[data-tour="projects-list"]', title:'Projects group everything into real lanes', body:'Projects connect people, secrets, and notes so the app feels like a working hub instead of a pile of unrelated entries.'},
      {page:'notes', selector:'[data-tour="notes-list"]', title:'Notes stay in their own page too', body:'Use Notes for snippets, reminders, prompts, and internal context that should not live inside the credentials or contacts pages.'},
      {page:'settings', selector:'[data-tour="settings-background"]', title:'Theme the background without breaking the shell', body:'The background stage is separate from the glass UI, so you can swap art, tune dimming, and change the mood without disturbing the layout.'},
      {page:'settings', selector:'[data-tour="settings-security"]', title:'Optional local lock and recovery tools', body:'Set a local access code, export backups, restore JSON exports, or wipe the browser vault from the Settings page when needed.'},
      {page:'tutorial', selector:'[data-tour="tutorial-overview"]', title:'The Tutorial page stays here for later', body:'Whenever you need a refresher, come back to Tutorial or hit the Walkthrough button in the top bar to run this guided tour again.'}
    ];
  }

  function markTutorialSeen(){
    try{ localStorage.setItem(TUTORIAL_KEY, '1'); }catch{}
  }

  function tutorialSeen(){
    try{ return localStorage.getItem(TUTORIAL_KEY) === '1'; }catch{ return false; }
  }

  function restartTutorial(){
    try{ localStorage.removeItem(TUTORIAL_KEY); }catch{}
    showToast('The tutorial will be offered again on this device.');
  }

  function closeWalkthrough(showNotice=false){
    tourActive = false;
    qs('tour-backdrop')?.classList.add('hidden');
    qs('tour-card')?.classList.remove('centered');
    if(showNotice) showToast('Walkthrough closed.');
    markTutorialSeen();
  }

  function positionWalkthroughElements(target){
    const highlight = qs('tour-highlight');
    const card = qs('tour-card');
    const backdrop = qs('tour-backdrop');
    if(!highlight || !card || !backdrop) return;
    if(!target){
      highlight.style.opacity = '0';
      card.classList.add('centered');
      return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 10;
    highlight.style.opacity = '1';
    highlight.style.left = `${Math.max(8, rect.left - pad)}px`;
    highlight.style.top = `${Math.max(8, rect.top - pad)}px`;
    highlight.style.width = `${Math.max(80, rect.width + pad * 2)}px`;
    highlight.style.height = `${Math.max(56, rect.height + pad * 2)}px`;

    card.classList.remove('centered');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardRect = card.getBoundingClientRect();
    let left = rect.right + 18;
    if(left + cardRect.width > vw - 12) left = rect.left - cardRect.width - 18;
    if(left < 12) left = Math.max(12, Math.min(vw - cardRect.width - 12, rect.left));
    let top = rect.top;
    if(top + cardRect.height > vh - 12) top = vh - cardRect.height - 12;
    if(top < 12) top = 12;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.transform = 'none';
  }

  async function showWalkthroughStep(index){
    const steps = getWalkthroughSteps();
    if(index < 0 || index >= steps.length){ closeWalkthrough(); return; }
    tourActive = true;
    tourIndex = index;
    const step = steps[index];
    if(currentPage !== step.page){
      await goTo(step.page, {}, {updateHash:true});
    }
    await new Promise(r => setTimeout(r, 120));
    const backdrop = qs('tour-backdrop');
    const title = qs('tour-title');
    const body = qs('tour-body');
    const count = qs('tour-step-count');
    const prev = qs('tour-prev');
    const next = qs('tour-next');
    if(backdrop) backdrop.classList.remove('hidden');
    if(title) title.textContent = step.title;
    if(body) body.textContent = step.body;
    if(count) count.textContent = `${index + 1} / ${steps.length}`;
    if(prev) prev.disabled = index === 0;
    if(next) next.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
    const target = step.selector ? document.querySelector(step.selector) : null;
    positionWalkthroughElements(target);
    markTutorialSeen();
  }

  function startWalkthrough(index=0){
    showWalkthroughStep(index);
  }

  function nextWalkthroughStep(){
    const steps = getWalkthroughSteps();
    if(tourIndex >= steps.length - 1){ closeWalkthrough(); return; }
    showWalkthroughStep(tourIndex + 1);
  }

  function previousWalkthroughStep(){
    if(tourIndex <= 0) return;
    showWalkthroughStep(tourIndex - 1);
  }

  function getProjectById(id){ return state.projects.find(p => p.id === id); }
  function getContactById(id){ return state.contacts.find(c => c.id === id); }
  function getCredentialById(id){ return state.credentials.find(c => c.id === id); }
  function getNoteById(id){ return state.notes.find(n => n.id === id); }
  function projectName(id){ return id ? (getProjectById(id)?.name || 'Unlinked project') : 'No project'; }
  function contactName(id){ return id ? (getContactById(id)?.name || 'Unlinked contact') : 'No contact'; }

  function ensureContactTimeline(contact){
    if(contact && !Array.isArray(contact.timeline)) contact.timeline = [];
    return contact?.timeline || [];
  }

  async function encryptAndStore(payload, key, saltB64){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plaintext);
    const record = { mode:'encrypted', salt:saltB64, iv:bytesToBase64(iv), ciphertext:bytesToBase64(new Uint8Array(cipher)) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }
  function bytesToBase64(bytes){ let binary=''; bytes.forEach(b => binary += String.fromCharCode(b)); return btoa(binary); }
  function base64ToBytes(b64){ const bin = atob(b64); const arr = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return arr; }
  async function deriveKey(passcode, saltB64){
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt: base64ToBytes(saltB64), iterations:150000, hash:'SHA-256' }, baseKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }

  async function saveState(){
    if(!state) return;
    state.updatedAt = nowISO();
    if(currentKey && currentSalt) return encryptAndStore(state, currentKey, currentSalt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({mode:'plain', data:state}));
  }

  async function loadPayload(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      state = defaultState();
      unlocked = true;
      currentKey = null;
      currentSalt = null;
      await saveState();
      return;
    }
    let parsed;
    try{ parsed = JSON.parse(raw); }catch{
      state = defaultState(); unlocked = true; currentKey = null; currentSalt = null; await saveState(); return;
    }
    if(parsed.mode === 'encrypted'){
      currentKey = null;
      currentSalt = parsed.salt;
      unlocked = false;
      showLockScreen(true);
    }else{
      state = parsed.data || defaultState();
      unlocked = true;
      currentKey = null;
      currentSalt = null;
    }
    state.contacts.forEach(ensureContactTimeline);
  }

  function showLockScreen(show){
    qs('lock-screen')?.classList.toggle('open', show);
    if(show){
      if(qs('lock-input')) qs('lock-input').value = '';
      if(qs('lock-error')) qs('lock-error').textContent = '';
      setTimeout(() => qs('lock-input')?.focus(), 40);
    }
  }

  async function unlockVault(){
    const pass = qs('lock-input')?.value || '';
    const errorEl = qs('lock-error');
    if(errorEl) errorEl.textContent = '';
    if(!pass){ if(errorEl) errorEl.textContent = 'Enter the access code.'; return; }
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const key = await deriveKey(pass, parsed.salt);
      const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv: base64ToBytes(parsed.iv)}, key, base64ToBytes(parsed.ciphertext));
      state = JSON.parse(new TextDecoder().decode(plain));
      state.contacts.forEach(ensureContactTimeline);
      currentKey = key;
      currentSalt = parsed.salt;
      unlocked = true;
      showLockScreen(false);
      await renderCurrentPage();
      showToast('Vault unlocked.');
    }catch(err){
      console.error(err);
      if(errorEl) errorEl.textContent = 'That access code did not unlock this local vault.';
    }
  }

  function cancelUnlock(){}

  async function applyPasscode(){
    const pass = qs('security-passcode')?.value || '';
    const confirm = qs('security-passcode-confirm')?.value || '';
    if(!pass || pass.length < 4){ showToast('Use an access code with at least 4 characters.', 'bad'); return; }
    if(pass !== confirm){ showToast('The access codes do not match.', 'bad'); return; }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = bytesToBase64(salt);
    const key = await deriveKey(pass, saltB64);
    currentKey = key;
    currentSalt = saltB64;
    await encryptAndStore(state, key, saltB64);
    if(qs('security-passcode')) qs('security-passcode').value = '';
    if(qs('security-passcode-confirm')) qs('security-passcode-confirm').value = '';
    renderSecuritySummary();
    showToast('Local vault lock saved.');
  }

  async function removePasscode(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){ showToast('No local lock is active.'); return; }
    let parsed = null;
    try{ parsed = JSON.parse(raw); }catch{}
    if(parsed?.mode !== 'encrypted'){
      currentKey = null; currentSalt = null; renderSecuritySummary(); showToast('No local lock is active.'); return;
    }
    if(!confirm('Remove the local access code from this browser vault?')) return;
    currentKey = null;
    currentSalt = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({mode:'plain', data:state}));
    renderSecuritySummary();
    showToast('Local vault lock removed.');
  }

  function renderSecuritySummary(){
    const el = qs('security-summary');
    if(!el) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    let txt = 'No vault lock is active right now.';
    try{
      const parsed = raw ? JSON.parse(raw) : null;
      if(parsed?.mode === 'encrypted') txt = 'A local access code is active. This vault must be unlocked on this browser before use.';
    }catch{}
    el.textContent = txt;
  }

  function contactRow(item){
    return `
      <div class="quick-item">
        <div>
          <div style="font-weight:800">${escapeHtml(item.name || 'Unnamed contact')}</div>
          <div class="small-note">${escapeHtml([item.company, item.role, item.email].filter(Boolean).join(' · ') || 'Contact')}</div>
        </div>
        <div class="action-row">
          ${item.email ? `<button class="icon-btn" onclick="app.copyText('${escapeJs(item.email)}','Email copied')">Copy email</button>` : ''}
          <button class="icon-btn" onclick="app.goTo('contact-view',{id:'${item.id}'})">Open</button>
        </div>
      </div>`;
  }

  function credentialQuickRow(item){
    return `
      <div class="quick-item">
        <div>
          <div style="font-weight:800">${escapeHtml(item.title || 'Untitled credential')}</div>
          <div class="small-note">${escapeHtml([item.category, item.username, projectName(item.projectId)].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="action-row">
          <button class="icon-btn" onclick="app.copyText('${escapeJs(item.secret || '')}','Secret copied')">Copy</button>
          <button class="icon-btn" onclick="app.editEntity('credential','${item.id}')">Edit</button>
        </div>
      </div>`;
  }

  async function loadPageTemplate(page){
    const path = PAGE_MAP[page] || PAGE_MAP.dashboard;
    if(templateCache.has(path)) return templateCache.get(path);
    const html = await fetch(path).then(r => {
      if(!r.ok) throw new Error(`Failed to load ${path}`);
      return r.text();
    });
    templateCache.set(path, html);
    return html;
  }

  function serializeHash(page, params={}){
    const usp = new URLSearchParams(params);
    return `#${page}${usp.toString() ? `?${usp.toString()}` : ''}`;
  }

  function parseHash(){
    const raw = location.hash.replace(/^#/, '');
    if(!raw) return {page:'launcher', params:{}};
    const [pagePart, query=''] = raw.split('?');
    const page = PAGE_MAP[pagePart] ? pagePart : 'launcher';
    const params = Object.fromEntries(new URLSearchParams(query).entries());
    return {page, params};
  }

  function updateNav(){
    const active = NAV_BASE[currentPage] || 'launcher';
    document.querySelectorAll('#nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.page === active));
  }

  async function goTo(page, params={}, opts={updateHash:true}){
    currentPage = PAGE_MAP[page] ? page : 'launcher';
    currentParams = {...params};
    updateNav();
    const host = qs('page-host');
    if(host) host.innerHTML = '<div class="page-loader glass">Loading page…</div>';
    try{
      const html = await loadPageTemplate(currentPage);
      if(host) host.innerHTML = html;
      if(opts.updateHash) location.hash = serializeHash(currentPage, currentParams);
      hydratePageControls();
      applyUI();
      await renderCurrentPage();
    }catch(err){
      console.error(err);
      if(host) host.innerHTML = `<div class="page-loader glass">This page could not be loaded.</div>`;
      showToast('Page load failed.', 'bad');
    }
  }

  function hydratePageControls(){
    const map = {
      'contact-search': filters.contactSearch,
      'contact-status-filter': filters.contactStatus,
      'credential-search': filters.credentialSearch,
      'credential-category-filter': filters.credentialCategory,
      'project-search': filters.projectSearch,
      'note-search': filters.noteSearch
    };
    Object.entries(map).forEach(([id, val]) => { const el = qs(id); if(el) el.value = val; });
    updateInstallStatus();
    renderSecuritySummary();
  }

  async function renderCurrentPage(){
    if(!unlocked) return;
    if(currentPage === 'launcher') renderLauncher();
    else if(currentPage === 'ae-command-pack') return;
    else if(currentPage === 'credential-pack') return;
    else if(currentPage === 'ops-pack') return;
    else if(currentPage === 'service-pack') return;
    else if(currentPage === 'dashboard') renderDashboard();
    else if(currentPage === 'sitemap') renderSitemap();
    else if(currentPage === 'tutorial') renderTutorial();
    else if(currentPage === 'contacts') renderContacts();
    else if(currentPage === 'contact-view') renderContactView();
    else if(currentPage === 'vault') renderCredentials();
    else if(currentPage === 'projects') renderProjects();
    else if(currentPage === 'notes') renderNotes();
    else if(currentPage === 'settings') renderSettings();
  }


  function renderLauncher(){
    const apps = CONNECTED_APPS;
    const launcherGrid = qs('launcher-grid');
    if(launcherGrid){
      launcherGrid.innerHTML = apps.map(appItem => `
        <article class="launcher-card ${appItem.type === 'external' ? 'branch' : 'internal'}">
          <div class="launcher-card-top">
            <div class="launcher-icon-wrap"><img class="launcher-icon" src="${appItem.icon}" alt="${escapeHtml(appItem.title)} icon"></div>
            <div>
              <div class="eyebrow">${escapeHtml(appItem.kind)} · ${escapeHtml(appItem.placement)}</div>
              <h3>${escapeHtml(appItem.title)}</h3>
            </div>
          </div>
          <p>${escapeHtml(appItem.summary)}</p>
          <div class="launcher-badges">
            <span class="status-pill">${escapeHtml(appItem.type === 'external' ? 'Bundled app' : 'Built-in lane')}</span>
            <span class="status-pill">${escapeHtml(appItem.kind)}</span>
          </div>
          <div class="launcher-actions">
            ${appItem.type === 'internal'
              ? `<button class="primary-btn" type="button" onclick="app.goTo('${appItem.route}')">${escapeHtml(appItem.action)}</button>`
              : `<a class="primary-btn launcher-anchor" href="${appItem.href}">${escapeHtml(appItem.action)}</a>`}
            ${appItem.type === 'external'
              ? `<a class="soft-btn launcher-anchor" href="${appItem.href}" target="_blank" rel="noopener">Open in new tab</a>`
              : `<button class="soft-btn" type="button" onclick="app.goTo('sitemap')">View sitemap</button>`}
          </div>
          <div class="launcher-path">${escapeHtml(appItem.type === 'external' ? appItem.href : '#' + appItem.route)}</div>
        </article>`).join('');
    }

    const launchSummary = qs('launch-summary');
    if(launchSummary){
      const stats = [
        {label:'Connected apps', value:apps.length, note:'Every launcher target currently wired'},
        {label:'Built-in lanes', value:apps.filter(item => item.type === 'internal').length, note:'Routes inside Credential Vault'},
        {label:'Branch apps', value:apps.filter(item => item.type === 'external').length, note:'Bundled sibling apps now linked'},
        {label:'Support pages', value:5, note:'Launcher, AE Pack, Credential Pack, Ops Pack, and Service Pack now live in the shell'}
      ];
      launchSummary.innerHTML = stats.map(s => `
        <div class="stat-card glass">
          <div class="eyebrow">${escapeHtml(s.label)}</div>
          <div class="value">${s.value}</div>
          <div class="note">${escapeHtml(s.note)}</div>
        </div>`).join('');
    }

    const launcherQuicklinks = qs('launcher-quicklinks');
    if(launcherQuicklinks){
      const quick = [
        {label:'Open the AE Central Command Pack guide', action:`<button class="soft-btn" type="button" onclick="app.goTo('ae-command-pack')">AE Pack</button>`},
        {label:'Open the Credential Pack guide', action:`<button class="soft-btn" type="button" onclick="app.goTo('credential-pack')">Credential Pack</button>`},
        {label:'Open the Connected Ops Pack guide', action:`<button class="soft-btn" type="button" onclick="app.goTo('ops-pack')">Ops Pack</button>`},
        {label:'Open the Service Master Pack guide', action:`<button class="soft-btn" type="button" onclick="app.goTo('service-pack')">Service Pack</button>`},
        {label:'Open the main dashboard', action:`<button class="soft-btn" type="button" onclick="app.goTo('dashboard')">Dashboard</button>`},
        {label:'Review the internal route map', action:`<button class="soft-btn" type="button" onclick="app.goTo('sitemap')">Sitemap</button>`},
        {label:'Run the guided walkthrough', action:`<button class="soft-btn" type="button" onclick="app.goTo('tutorial')">Tutorial</button>`},
        {label:'Download a full local backup before branching out', action:`<button class="soft-btn" type="button" onclick="app.exportBackup()">Backup</button>`}
      ];
      launcherQuicklinks.innerHTML = quick.map(item => `<div class="quick-item"><span>${item.label}</span><span>${item.action}</span></div>`).join('');
    }

    const launcherSitemap = qs('launcher-sitemap');
    if(launcherSitemap){
      const rows = [
        {name:'Launcher', path:'#launcher', detail:'Primary landing page for the full package'},
        {name:'AE Command Pack', path:'#ae-command-pack', detail:'Merged guide for the free AE stack and the hosted-event stack'},
        {name:'Credential Pack', path:'#credential-pack', detail:'Guide for the four core Credential Hub apps and how they work together'},
        {name:'Connected Ops Pack', path:'#ops-pack', detail:'Guide for Skye Lead Vault and Skye Split Engine Ops, including the lead-to-ledger workflow'},
        {name:'Service Master Pack', path:'#service-pack', detail:'Guide for offer selection, payment methodology, recurring revenue, and the bundled service enablement pack'},
        {name:'Dashboard', path:'#dashboard', detail:'Operational readout for the root app'},
        {name:'Contacts / Vault / Projects / Notes / Settings', path:'#contacts • #vault • #projects • #notes • #settings', detail:'Built-in lanes under the root shell'},
        {name:'OfferForge / SkyeBox / SkyePortal / Lead Vault / Split Engine Ops / Service Master Pack', path:'Bundled branch-app entry pages', detail:'Six separate apps now linked from the launcher'}
      ];
      launcherSitemap.innerHTML = rows.map(row => `
        <div class="sitemap-row compact">
          <div>
            <div class="sitemap-name">${escapeHtml(row.name)}</div>
            <div class="small-note">${escapeHtml(row.detail)}</div>
          </div>
          <div class="sitemap-path">${escapeHtml(row.path)}</div>
        </div>`).join('');
    }
  }

  function renderSitemap(){
    const sitemapTree = qs('sitemap-tree');
    if(sitemapTree){
      const rows = [
        {name:'Credential Hub Launcher', path:'#launcher', detail:'Landing page and launch surface for the whole package.', action:`<button class="soft-btn" type="button" onclick="app.goTo('launcher')">Open</button>`},
        {name:'AE Central Command Pack', path:'#ae-command-pack', detail:'Merged guide for the free field stack, intake stack, event stack, and closer upgrade.', action:`<button class="soft-btn" type="button" onclick="app.goTo('ae-command-pack')">Open</button>`},
        {name:'Credential Pack', path:'#credential-pack', detail:'Guide for Contacts Hub, Vault, Projects, and Notes with estimated lane values and linked workflow.', action:`<button class="soft-btn" type="button" onclick="app.goTo('credential-pack')">Open</button>`},
        {name:'Connected Ops Pack', path:'#ops-pack', detail:'Guide for Skye Lead Vault and Skye Split Engine Ops, including value positioning and how the two apps work together.', action:`<button class="soft-btn" type="button" onclick="app.goTo('ops-pack')">Open</button>`},
        {name:'Service Master Pack', path:'#service-pack', detail:'Guide for offer selection, payment methodology, recurring revenue, AI-usage uplift, and the bundled contractor service pack.', action:`<button class="soft-btn" type="button" onclick="app.goTo('service-pack')">Open</button>`},
        {name:'Credential Vault Dashboard', path:'#dashboard', detail:'Main snapshot for root-app activity.', action:`<button class="soft-btn" type="button" onclick="app.goTo('dashboard')">Open</button>`},
        {name:'Contacts Hub', path:'#contacts', detail:'People, company records, CSV import/export, and relationship history.', action:`<button class="soft-btn" type="button" onclick="app.goTo('contacts')">Open</button>`},
        {name:'Vault', path:'#vault', detail:'Credentials, URLs, secrets, and linked records.', action:`<button class="soft-btn" type="button" onclick="app.goTo('vault')">Open</button>`},
        {name:'Projects', path:'#projects', detail:'Grouping layer for linked work lanes.', action:`<button class="soft-btn" type="button" onclick="app.goTo('projects')">Open</button>`},
        {name:'Notes', path:'#notes', detail:'Internal notes and quick references.', action:`<button class="soft-btn" type="button" onclick="app.goTo('notes')">Open</button>`},
        {name:'Settings', path:'#settings', detail:'Background, lock, backup, install, and local controls.', action:`<button class="soft-btn" type="button" onclick="app.goTo('settings')">Open</button>`},
        {name:'Tutorial', path:'#tutorial', detail:'Guided walkthrough and self-serve refresher page.', action:`<button class="soft-btn" type="button" onclick="app.goTo('tutorial')">Open</button>`},
        {name:'Skye-OfferForge', path:'./Branching Apps/.../oforge/index.html', detail:'Bundled branching app for offers, docs, templates, backup, and follow-up work.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial/oforge/index.html">Launch</a>`},
        {name:'SkyeBox Command Vault', path:'./Branching Apps/.../SkyeBox-Command-Vault-v6-tutorial-walkthrough/index.html', detail:'Bundled branching app for authenticator flows, locker files, and encrypted backup exports.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/SkyeBox-Command-Vault/SkyeBox-Command-Vault-v6-tutorial-walkthrough/index.html">Launch</a>`},
        {name:'SkyePortal Control Plane Vault', path:'./Branching Apps/.../SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/index.html', detail:'Bundled branching app for docs, files, inventory, snapshots, and recovery bundle operations.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial/index.html">Launch</a>`},
        {name:'Skye Lead Vault', path:'./Branching Apps/.../Skye-Lead-Vault-Offline-Phase2-with-Walkthrough/index.html', detail:'Bundled connected app for lead ledgering, pipeline pressure, routes, playbooks, backups, and privacy mode.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/Skye-Lead-Vault-Offline-Phase2-with-Walkthrough/index.html">Launch</a>`},
        {name:'Skye Split Engine Ops', path:'./Branching Apps/.../Skye-Split-Engine-Offline-Money-Ops-Walkthrough/skye-split-engine-offline/index.html', detail:'Bundled connected app for split math, deal ledgering, receipts, recurring payouts, CSV movement, and backup protection.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/Skye-Split-Engine-Offline-Money-Ops-Walkthrough/skye-split-engine-offline/index.html">Launch</a>`},
        {name:'Service Master Pack', path:'./Branching Apps/.../ae-service-pack-master/index.html', detail:'Bundled contractor service pack for offer selection, deposit methodology, recurring revenue, and lane-by-lane service understanding.', action:`<a class="soft-btn launcher-anchor" href="./Branching Apps/ae-service-pack-master/index.html">Launch</a>`}
      ];
      sitemapTree.innerHTML = rows.map(row => `
        <div class="sitemap-row">
          <div class="sitemap-main">
            <div class="sitemap-name">${escapeHtml(row.name)}</div>
            <div class="small-note">${escapeHtml(row.detail)}</div>
          </div>
          <div class="sitemap-path">${escapeHtml(row.path)}</div>
          <div class="sitemap-action">${row.action}</div>
        </div>`).join('');
    }

    const sitemapApps = qs('sitemap-apps');
    if(sitemapApps){
      sitemapApps.innerHTML = CONNECTED_APPS.map(item => `
        <div class="linked-card">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="small-note">${escapeHtml(item.kind)} · ${escapeHtml(item.placement)}</div>
          <div>${escapeHtml(item.summary)}</div>
          <div class="sitemap-path">${escapeHtml(item.type === 'external' ? item.href : '#' + item.route)}</div>
        </div>`).join('');
    }
  }

  function renderTutorial(){
    const shell = qs('tutorial-checklist');
    if(!shell) return;
    const cards = [
      {title:'Dashboard first', body:'Start on Dashboard to see totals, favorites, and the most recent work without getting buried.'},
      {title:'Contacts next', body:'Import your people from CSV or add them manually, then use Relationship View to keep a follow-up trail.'},
      {title:'Vault after that', body:'Store credentials and secrets separately from your people records so the app stays organized.'},
      {title:'Projects and Notes', body:'Use Projects to group real work lanes and Notes for context that does not belong in a password field.'},
      {title:'Settings last', body:'Swap the background, tune the glass opacity, set a local lock, and export your offline backup.'}
    ];
    shell.innerHTML = cards.map((card, idx) => `
      <div class="tutorial-step-card">
        <div class="tutorial-step-num">${idx + 1}</div>
        <div>
          <h4>${escapeHtml(card.title)}</h4>
          <p>${escapeHtml(card.body)}</p>
        </div>
      </div>`).join('');
  }

  function renderDashboard(){
    const statsGrid = qs('stats-grid');
    if(!statsGrid) return;
    const stats = [
      {label:'Contacts', value:state.contacts.length, note:'People and companies in the hub'},
      {label:'Credentials', value:state.credentials.length, note:'Secrets, logins, keys, and URLs'},
      {label:'Projects', value:state.projects.length, note:'Working lanes and grouped records'},
      {label:'Notes', value:state.notes.length, note:'Snippets and internal context'}
    ];
    statsGrid.innerHTML = stats.map(s => `
      <div class="stat-card glass">
        <div class="eyebrow">${escapeHtml(s.label)}</div>
        <div class="value">${s.value}</div>
        <div class="note">${escapeHtml(s.note)}</div>
      </div>`).join('');

    const favoriteContacts = state.contacts.filter(x => x.favorite).slice(0,4);
    if(qs('favorite-contacts')) qs('favorite-contacts').innerHTML = favoriteContacts.length ? favoriteContacts.map(contactRow).join('') : emptyState('No favorite contacts yet.');

    const favoriteCreds = state.credentials.filter(x => x.favorite).slice(0,4);
    if(qs('favorite-credentials')) qs('favorite-credentials').innerHTML = favoriteCreds.length ? favoriteCreds.map(credentialQuickRow).join('') : emptyState('No pinned credentials yet.');

    const recent = [
      ...state.contacts.map(item => ({type:'Contact', title:item.name, subtitle:item.company || item.role || item.email || 'Contact record', updatedAt:item.updatedAt || item.createdAt, target:'contact-view', params:{id:item.id}})),
      ...state.credentials.map(item => ({type:'Credential', title:item.title, subtitle:item.url || item.username || item.category || 'Vault record', updatedAt:item.updatedAt || item.createdAt, target:'vault', params:{}})),
      ...state.projects.map(item => ({type:'Project', title:item.name, subtitle:item.category || item.description || 'Project lane', updatedAt:item.updatedAt || item.createdAt, target:'projects', params:{}})),
      ...state.notes.map(item => ({type:'Note', title:item.title, subtitle:item.tags || item.content?.slice(0,80) || 'Note entry', updatedAt:item.updatedAt || item.createdAt, target:'notes', params:{}}))
    ].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,8);

    if(qs('recent-items')) qs('recent-items').innerHTML = recent.length ? recent.map(item => `
      <div class="quick-item">
        <div>
          <div style="font-weight:800">${escapeHtml(item.title || item.type)}</div>
          <div class="small-note">${escapeHtml(item.type)} · ${escapeHtml(item.subtitle || '')}</div>
        </div>
        <div class="action-row">
          <span class="status-pill">${formatDate(item.updatedAt)}</span>
          <button class="icon-btn" onclick="app.goTo('${item.target}', ${JSON.stringify(item.params).replace(/"/g,'&quot;')})">Open</button>
        </div>
      </div>`).join('') : emptyState('Nothing has been added yet.');

    const totalTimeline = state.contacts.reduce((acc,c) => acc + ensureContactTimeline(c).length, 0);
    const todaySurface = [
      `${state.contacts.filter(c => c.status === 'lead').length} lead contacts`,
      `${state.credentials.filter(c => c.favorite).length} pinned credentials`,
      `${state.projects.length} total projects`,
      `${totalTimeline} relationship events logged`
    ];
    if(qs('today-surface')) qs('today-surface').innerHTML = todaySurface.map(line => `<div class="quick-item"><span>${escapeHtml(line)}</span></div>`).join('');
  }

  function renderContacts(){
    const list = qs('contacts-list');
    if(!list) return;
    const search = filters.contactSearch.trim().toLowerCase();
    const status = filters.contactStatus;
    const items = state.contacts.filter(c => {
      const matchesSearch = !search || [c.name,c.company,c.role,c.email,c.phone,c.tags,c.notes,c.website,c.address].join(' ').toLowerCase().includes(search);
      const matchesStatus = !status || c.status === status;
      return matchesSearch && matchesStatus;
    }).sort((a,b)=> Number(!!b.favorite)-Number(!!a.favorite) || new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

    list.innerHTML = items.length ? items.map(c => {
      const timeline = ensureContactTimeline(c);
      return `
      <article class="entity-card glass">
        <div class="head">
          <div>
            <div class="title">${escapeHtml(c.name || 'Unnamed contact')}</div>
            <div class="meta">${escapeHtml([c.company, c.role].filter(Boolean).join(' · ') || 'Contact record')}</div>
          </div>
          <span class="status-pill">${escapeHtml(c.status || 'contact')}</span>
        </div>
        <div class="metric-pills">
          ${c.favorite ? '<span class="metric">★ Favorite</span>' : ''}
          ${c.projectId ? `<span class="metric">${escapeHtml(projectName(c.projectId))}</span>` : ''}
          <span class="metric">${timeline.length} events</span>
          ${c.tags ? c.tags.split(',').filter(Boolean).slice(0,3).map(t => `<span class="metric">${escapeHtml(t.trim())}</span>`).join('') : ''}
        </div>
        <div class="body">
          ${c.email ? `<div><strong>Email:</strong> ${escapeHtml(c.email)}</div>` : ''}
          ${c.phone ? `<div><strong>Phone:</strong> ${escapeHtml(c.phone)}</div>` : ''}
          ${c.website ? `<div><strong>Website:</strong> <a href="${escapeHtml(c.website)}" target="_blank" rel="noreferrer">${escapeHtml(c.website)}</a></div>` : ''}
          ${c.address ? `<div><strong>Address:</strong> ${escapeHtml(c.address)}</div>` : ''}
          ${c.notes ? `<div class="note-block">${escapeHtml(c.notes)}</div>` : ''}
        </div>
        <div class="foot">
          <div class="action-row">
            ${c.email ? `<button class="icon-btn" onclick="app.copyText('${escapeJs(c.email)}','Email copied')">Copy Email</button>` : ''}
            ${c.phone ? `<button class="icon-btn" onclick="app.copyText('${escapeJs(c.phone)}','Phone copied')">Copy Phone</button>` : ''}
            <button class="icon-btn" onclick="app.toggleFavorite('contact','${c.id}')">${c.favorite ? 'Unfavorite' : 'Favorite'}</button>
          </div>
          <div class="action-row">
            <button class="icon-btn" onclick="app.goTo('contact-view',{id:'${c.id}'})">Open</button>
            <button class="icon-btn" onclick="app.editEntity('contact','${c.id}')">Edit</button>
            <button class="icon-btn" onclick="app.deleteEntity('contact','${c.id}')">Delete</button>
          </div>
        </div>
      </article>`;
    }).join('') : emptyState('No contacts match the current filters.');
  }

  function renderContactView(){
    const shell = qs('contact-detail-shell');
    if(!shell) return;
    const contact = getContactById(currentParams.id || '');
    if(!contact){
      shell.innerHTML = emptyState('That contact could not be found.');
      return;
    }
    const timeline = ensureContactTimeline(contact).slice().sort((a,b)=>new Date(b.occurredAt||b.createdAt)-new Date(a.occurredAt||a.createdAt));
    const linkedCreds = state.credentials.filter(c => c.contactId === contact.id);
    const linkedNotes = state.notes.filter(n => n.contactId === contact.id);
    const latestTouch = timeline[0]?.occurredAt || contact.updatedAt || contact.createdAt;
    shell.innerHTML = `
      <div class="detail-grid">
        <div class="stack">
          <div class="detail-card glass">
            <div class="detail-head">
              <div>
                <div class="eyebrow">Relationship View</div>
                <h2 style="margin:.35rem 0 0">${escapeHtml(contact.name || 'Unnamed contact')}</h2>
                <div class="subtle" style="margin-top:8px">${escapeHtml([contact.company, contact.role].filter(Boolean).join(' · ') || 'Contact record')}</div>
              </div>
              <div class="detail-actions">
                <button class="soft-btn" onclick="app.goTo('contacts')">Back</button>
                <button class="soft-btn" onclick="app.editEntity('contact','${contact.id}')">Edit</button>
                <button class="primary-btn" onclick="app.openTimelineModal('${contact.id}')">Add Event</button>
              </div>
            </div>
            <div class="metric-pills">
              <span class="metric">${escapeHtml(contact.status || 'contact')}</span>
              <span class="metric">${timeline.length} relationship events</span>
              <span class="metric">${linkedCreds.length} linked credentials</span>
              <span class="metric">${linkedNotes.length} linked notes</span>
            </div>
            <div class="detail-meta">
              ${contact.email ? `<div class="detail-row"><strong>Email</strong><div>${escapeHtml(contact.email)}</div><div class="action-row"><button class="icon-btn" onclick="app.copyText('${escapeJs(contact.email)}','Email copied')">Copy</button></div></div>` : ''}
              ${contact.phone ? `<div class="detail-row"><strong>Phone</strong><div>${escapeHtml(contact.phone)}</div><div class="action-row"><button class="icon-btn" onclick="app.copyText('${escapeJs(contact.phone)}','Phone copied')">Copy</button></div></div>` : ''}
              ${contact.website ? `<div class="detail-row"><strong>Website</strong><div><a href="${escapeHtml(contact.website)}" target="_blank" rel="noreferrer">${escapeHtml(contact.website)}</a></div></div>` : ''}
              ${contact.address ? `<div class="detail-row"><strong>Address</strong><div>${escapeHtml(contact.address)}</div></div>` : ''}
              <div class="detail-row"><strong>Linked Project</strong><div>${escapeHtml(projectName(contact.projectId))}</div></div>
              <div class="detail-row"><strong>Latest Touch</strong><div>${formatDate(latestTouch)}</div></div>
              ${contact.tags ? `<div class="detail-row"><strong>Tags</strong><div>${escapeHtml(contact.tags)}</div></div>` : ''}
              ${contact.notes ? `<div class="detail-row"><strong>Notes</strong><div class="note-block">${escapeHtml(contact.notes)}</div></div>` : ''}
            </div>
          </div>
          <div class="detail-card glass">
            <div class="section-head"><div><div class="eyebrow">Linked Items</div><h2>Credentials and notes tied to this contact</h2></div></div>
            <div class="linked-grid">
              <div class="stack">
                <div class="small-note">Credentials</div>
                ${linkedCreds.length ? linkedCreds.map(item => `
                  <div class="linked-card"><div class="title">${escapeHtml(item.title || 'Untitled credential')}</div><div class="small-note">${escapeHtml([item.category,item.username].filter(Boolean).join(' · '))}</div><div class="action-row"><button class="icon-btn" onclick="app.copyText('${escapeJs(item.secret || '')}','Secret copied')">Copy secret</button><button class="icon-btn" onclick="app.editEntity('credential','${item.id}')">Edit</button></div></div>
                `).join('') : emptyState('No linked credentials yet.')}
              </div>
              <div class="stack">
                <div class="small-note">Notes</div>
                ${linkedNotes.length ? linkedNotes.map(item => `
                  <div class="linked-card"><div class="title">${escapeHtml(item.title || 'Untitled note')}</div><div class="small-note">${escapeHtml(item.tags || 'Note')}</div><div class="note-block">${escapeHtml((item.content || '').slice(0,180))}</div><div class="action-row"><button class="icon-btn" onclick="app.editEntity('note','${item.id}')">Edit</button></div></div>
                `).join('') : emptyState('No linked notes yet.')}
              </div>
            </div>
          </div>
        </div>
        <div class="detail-card glass">
          <div class="section-head"><div><div class="eyebrow">Relationship Timeline</div><h2>History for this contact</h2></div><button class="ghost-btn" onclick="app.openTimelineModal('${contact.id}')">Add Event</button></div>
          <div class="timeline-list">
            ${timeline.length ? timeline.map(item => `
              <div class="timeline-item">
                <div class="timeline-top">
                  <div class="timeline-title">${escapeHtml(item.title || 'Interaction')}</div>
                  <div class="timeline-channel">${escapeHtml(item.channel || 'general')}</div>
                </div>
                <div class="small-note">${formatDate(item.occurredAt || item.createdAt)}</div>
                ${item.summary ? `<div>${escapeHtml(item.summary)}</div>` : ''}
                ${item.outcome ? `<div class="note-block">${escapeHtml(item.outcome)}</div>` : ''}
                <div class="action-row"><button class="icon-btn" onclick="app.deleteTimelineEvent('${contact.id}','${item.id}')">Delete</button></div>
              </div>`).join('') : emptyState('No relationship events logged yet.')}
          </div>
        </div>
      </div>`;
  }

  function renderCredentials(){
    const list = qs('credentials-list');
    if(!list) return;
    const search = filters.credentialSearch.trim().toLowerCase();
    const cat = filters.credentialCategory;
    const items = state.credentials.filter(c => {
      const matchesSearch = !search || [c.title,c.username,c.secret,c.url,c.category,c.tags,c.notes].join(' ').toLowerCase().includes(search);
      const matchesCat = !cat || c.category === cat;
      return matchesSearch && matchesCat;
    }).sort((a,b)=> Number(!!b.favorite)-Number(!!a.favorite) || new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));

    list.innerHTML = items.length ? items.map(c => `
      <article class="entity-card glass">
        <div class="head">
          <div>
            <div class="title">${escapeHtml(c.title || 'Untitled credential')}</div>
            <div class="meta">${escapeHtml([c.category, projectName(c.projectId), contactName(c.contactId)].filter(Boolean).join(' · '))}</div>
          </div>
          <span class="status-pill">${escapeHtml(c.category || 'secret')}</span>
        </div>
        <div class="metric-pills">
          ${c.favorite ? '<span class="metric">★ Favorite</span>' : ''}
          ${c.tags ? c.tags.split(',').filter(Boolean).slice(0,3).map(t => `<span class="metric">${escapeHtml(t.trim())}</span>`).join('') : ''}
        </div>
        <div class="body">
          ${c.username ? `<div><strong>User:</strong> ${escapeHtml(c.username)}</div>` : ''}
          ${c.url ? `<div><strong>URL:</strong> <a href="${escapeHtml(c.url)}" target="_blank" rel="noreferrer">${escapeHtml(c.url)}</a></div>` : ''}
          <div><strong>Secret:</strong> <span id="secret-${c.id}" data-secret="${escapeHtml(c.secret || '')}">••••••••••••</span></div>
          ${c.notes ? `<div class="note-block">${escapeHtml(c.notes)}</div>` : ''}
        </div>
        <div class="foot">
          <div class="action-row">
            <button class="icon-btn" onclick="app.toggleSecret('${c.id}')">Reveal</button>
            <button class="icon-btn" onclick="app.copyText('${escapeJs(c.secret || '')}','Secret copied')">Copy</button>
            <button class="icon-btn" onclick="app.toggleFavorite('credential','${c.id}')">${c.favorite ? 'Unfavorite' : 'Favorite'}</button>
          </div>
          <div class="action-row">
            <button class="icon-btn" onclick="app.editEntity('credential','${c.id}')">Edit</button>
            <button class="icon-btn" onclick="app.deleteEntity('credential','${c.id}')">Delete</button>
          </div>
        </div>
      </article>`).join('') : emptyState('No credentials match the current filters.');
  }

  function renderProjects(){
    const list = qs('projects-list');
    if(!list) return;
    const search = filters.projectSearch.trim().toLowerCase();
    const items = state.projects.filter(p => !search || [p.name,p.category,p.description].join(' ').toLowerCase().includes(search)).sort((a,b)=> new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    list.innerHTML = items.length ? items.map(p => {
      const contactCount = state.contacts.filter(c => c.projectId === p.id).length;
      const credCount = state.credentials.filter(c => c.projectId === p.id).length;
      const noteCount = state.notes.filter(n => n.projectId === p.id).length;
      return `
        <article class="entity-card glass">
          <div class="head">
            <div>
              <div class="title">${escapeHtml(p.name || 'Untitled project')}</div>
              <div class="meta">${escapeHtml(p.category || 'Project lane')}</div>
            </div>
            <span class="status-pill">${escapeHtml(p.color || 'Custom')}</span>
          </div>
          <div class="body">${p.description ? `<div class="note-block">${escapeHtml(p.description)}</div>` : '<div class="small-note">No description yet.</div>'}</div>
          <div class="metric-pills"><span class="metric">${contactCount} contacts</span><span class="metric">${credCount} credentials</span><span class="metric">${noteCount} notes</span></div>
          <div class="foot">
            <div class="action-row">
              <button class="icon-btn" onclick="app.openEntityModal('contact',{projectId:'${p.id}'})">Add contact</button>
              <button class="icon-btn" onclick="app.openEntityModal('credential',{projectId:'${p.id}'})">Add credential</button>
            </div>
            <div class="action-row">
              <button class="icon-btn" onclick="app.editEntity('project','${p.id}')">Edit</button>
              <button class="icon-btn" onclick="app.deleteEntity('project','${p.id}')">Delete</button>
            </div>
          </div>
        </article>`;
    }).join('') : emptyState('No projects match the current filters.');
  }

  function renderNotes(){
    const list = qs('notes-list');
    if(!list) return;
    const search = filters.noteSearch.trim().toLowerCase();
    const items = state.notes.filter(n => !search || [n.title,n.content,n.tags].join(' ').toLowerCase().includes(search)).sort((a,b)=> Number(!!b.pinned)-Number(!!a.pinned) || new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    list.innerHTML = items.length ? items.map(n => `
      <article class="entity-card glass">
        <div class="head">
          <div>
            <div class="title">${escapeHtml(n.title || 'Untitled note')}</div>
            <div class="meta">${escapeHtml([projectName(n.projectId), contactName(n.contactId), n.tags].filter(Boolean).join(' · '))}</div>
          </div>
          <span class="status-pill">${n.pinned ? 'Pinned' : 'Note'}</span>
        </div>
        <div class="body"><div class="note-block">${escapeHtml(n.content || '')}</div></div>
        <div class="foot">
          <div class="action-row"><button class="icon-btn" onclick="app.togglePinnedNote('${n.id}')">${n.pinned ? 'Unpin' : 'Pin'}</button><button class="icon-btn" onclick="app.copyText('${escapeJs(n.content || '')}','Note copied')">Copy</button></div>
          <div class="action-row"><button class="icon-btn" onclick="app.editEntity('note','${n.id}')">Edit</button><button class="icon-btn" onclick="app.deleteEntity('note','${n.id}')">Delete</button></div>
        </div>
      </article>`).join('') : emptyState('No notes match the current filters.');
  }

  function renderSettingsPresets(){
    const grid = qs('preset-grid');
    if(!grid) return;
    grid.innerHTML = `
      <button type="button" class="preset ${ui.preset==='duo'?'active':''}" data-preset="duo" onclick="app.setPreset('duo')"><img src="./assets/skydexia-duo.webp" alt=""><div class="overlay"></div><div class="label">Duo Crest</div></button>
      <button type="button" class="preset ${ui.preset==='solo'?'active':''}" data-preset="solo" onclick="app.setPreset('solo')"><img src="./assets/skydexia-solo.webp" alt=""><div class="overlay"></div><div class="label">Solo Crest</div></button>
      <button type="button" class="preset ${ui.preset==='founder'?'active':''}" data-preset="founder" onclick="app.setPreset('founder')"><img src="./assets/founder.webp" alt="" style="object-fit:contain;background:linear-gradient(135deg,#061227,#12356f 60%,#d8ac44)"><div class="overlay"></div><div class="label">Founder Mode</div></button>
      <button type="button" class="preset ${ui.preset==='none'?'active':''}" data-preset="none" onclick="app.setPreset('none')"><div class="swatch-bg"></div><div class="overlay"></div><div class="label">Pure Gradient</div></button>`;
  }

  function setPreset(name){ ui.preset = name; applyUI(); }

  function renderSettings(){
    renderSettingsPresets();
    renderSecuritySummary();
    applyUI();
    updateInstallStatus();
  }

  function updateInstallStatus(){
    const installStatus = qs('install-status');
    if(installStatus){
      if(deferredInstallPrompt){ installStatus.textContent = 'Install ready'; installStatus.classList.add('online'); }
      else installStatus.textContent = 'Waiting for browser';
    }
    const swStatus = qs('sw-status');
    if(swStatus){
      swStatus.textContent = swReady ? 'Ready' : ('serviceWorker' in navigator ? 'Checking' : 'Unsupported');
      if(swReady) swStatus.classList.add('online');
    }
  }

  function renderGlobalSearchResults(){
    const input = qs('global-search');
    const panel = qs('results-panel');
    const shell = qs('results-shell');
    if(!input || !panel || !shell || !state) return;
    const q = input.value.trim().toLowerCase();
    if(!q){ panel.classList.remove('open'); shell.innerHTML = ''; return; }
    const results = [
      ...state.contacts.filter(x => [x.name,x.company,x.role,x.email,x.phone,x.tags,x.notes].join(' ').toLowerCase().includes(q)).map(x => ({page:'contact-view', params:{id:x.id}, title:x.name || 'Unnamed contact', subtitle:[x.company,x.email].filter(Boolean).join(' · '), kind:'Contact'})),
      ...state.credentials.filter(x => [x.title,x.username,x.secret,x.url,x.category,x.tags].join(' ').toLowerCase().includes(q)).map(x => ({page:'vault', params:{}, title:x.title || 'Untitled credential', subtitle:[x.category,x.username].filter(Boolean).join(' · '), kind:'Credential'})),
      ...state.projects.filter(x => [x.name,x.category,x.description].join(' ').toLowerCase().includes(q)).map(x => ({page:'projects', params:{}, title:x.name || 'Untitled project', subtitle:x.category || x.description || '', kind:'Project'})),
      ...state.notes.filter(x => [x.title,x.content,x.tags].join(' ').toLowerCase().includes(q)).map(x => ({page:'notes', params:{}, title:x.title || 'Untitled note', subtitle:(x.content || '').slice(0,90), kind:'Note'}))
    ].slice(0,18);
    shell.innerHTML = results.length ? results.map(r => `
      <button type="button" class="result-item" onclick="app.openSearchResult('${r.page}','${escapeJs(JSON.stringify(r.params))}')">
        <div style="font-weight:800">${escapeHtml(r.title)}</div>
        <div class="small-note">${escapeHtml(r.kind)} · ${escapeHtml(r.subtitle)}</div>
      </button>`).join('') : `<div class="result-item"><div style="font-weight:800">No results</div><div class="small-note">Try another search phrase.</div></div>`;
    panel.classList.add('open');
  }

  function openSearchResult(page, paramsText='{}'){
    let params = {};
    try{ params = JSON.parse(paramsText); }catch{}
    qs('global-search').value = '';
    renderGlobalSearchResults();
    goTo(page, params);
  }

  function openModal(title, html){ qs('modal-title').textContent = title; qs('modal-body').innerHTML = html; qs('modal-backdrop').classList.add('open'); }
  function closeModal(){ qs('modal-backdrop').classList.remove('open'); qs('modal-body').innerHTML = ''; }

  function optionList(collection, selectedId=''){ return `<option value="">None</option>` + collection.map(item => `<option value="${item.id}" ${item.id===selectedId?'selected':''}>${escapeHtml(item.name || item.title || 'Untitled')}</option>`).join(''); }

  function collectForm(type, id=null, defaults={}){
    const current = id ? (type === 'contact' ? state.contacts.find(x=>x.id===id) : type === 'credential' ? state.credentials.find(x=>x.id===id) : type === 'project' ? state.projects.find(x=>x.id===id) : state.notes.find(x=>x.id===id)) : null;
    const item = {...defaults, ...(current || {})};
    if(type === 'contact'){
      openModal(current ? 'Edit Contact' : 'Add Contact', `
        <form id="entity-form" class="stack" onsubmit="app.submitEntity(event,'contact','${current?.id || ''}')">
          <div class="form-grid">
            <div class="field-wrap"><label class="small">Name</label><input class="field" name="name" value="${escapeHtml(item.name||'')}" required></div>
            <div class="field-wrap"><label class="small">Company</label><input class="field" name="company" value="${escapeHtml(item.company||'')}"></div>
            <div class="field-wrap"><label class="small">Role</label><input class="field" name="role" value="${escapeHtml(item.role||'')}"></div>
            <div class="field-wrap"><label class="small">Status</label><select class="field" name="status">${['lead','warm','client','vendor','personal'].map(v=>`<option value="${v}" ${(item.status||'lead')===v?'selected':''}>${v}</option>`).join('')}</select></div>
            <div class="field-wrap"><label class="small">Email</label><input class="field" name="email" value="${escapeHtml(item.email||'')}" type="email"></div>
            <div class="field-wrap"><label class="small">Phone</label><input class="field" name="phone" value="${escapeHtml(item.phone||'')}" inputmode="tel"></div>
            <div class="field-wrap"><label class="small">Website</label><input class="field" name="website" value="${escapeHtml(item.website||'')}" placeholder="https://"></div>
            <div class="field-wrap"><label class="small">Project</label><select class="field" name="projectId">${optionList(state.projects, item.projectId||'')}</select></div>
            <div class="field-wrap full"><label class="small">Address</label><input class="field" name="address" value="${escapeHtml(item.address||'')}"></div>
            <div class="field-wrap full"><label class="small">Tags</label><input class="field" name="tags" value="${escapeHtml(item.tags||'')}" placeholder="comma, separated, tags"></div>
            <div class="field-wrap full"><label class="small">Notes</label><textarea name="notes">${escapeHtml(item.notes||'')}</textarea></div>
          </div>
          <div class="toggle-row"><div><strong>Favorite contact</strong><div class="small-note">Pin this person on the dashboard.</div></div><input type="checkbox" name="favorite" ${item.favorite ? 'checked':''}></div>
          <div class="inline-actions"><button type="button" class="soft-btn" onclick="app.closeModal()">Cancel</button><button type="submit" class="primary-btn">${current ? 'Save Contact' : 'Create Contact'}</button></div>
        </form>`);
    }else if(type === 'credential'){
      openModal(current ? 'Edit Credential' : 'Add Credential', `
        <form id="entity-form" class="stack" onsubmit="app.submitEntity(event,'credential','${current?.id || ''}')">
          <div class="form-grid">
            <div class="field-wrap"><label class="small">Title</label><input class="field" name="title" value="${escapeHtml(item.title||'')}" required></div>
            <div class="field-wrap"><label class="small">Category</label><select class="field" name="category">${['login','api','server','payment','document'].map(v=>`<option value="${v}" ${(item.category||'login')===v?'selected':''}>${v}</option>`).join('')}</select></div>
            <div class="field-wrap"><label class="small">Username / Label</label><input class="field" name="username" value="${escapeHtml(item.username||'')}"></div>
            <div class="field-wrap"><label class="small">Secret / Password / Token</label><input class="field" name="secret" value="${escapeHtml(item.secret||'')}" required></div>
            <div class="field-wrap"><label class="small">URL</label><input class="field" name="url" value="${escapeHtml(item.url||'')}" placeholder="https://"></div>
            <div class="field-wrap"><label class="small">Project</label><select class="field" name="projectId">${optionList(state.projects, item.projectId||'')}</select></div>
            <div class="field-wrap"><label class="small">Linked Contact</label><select class="field" name="contactId">${optionList(state.contacts, item.contactId||'')}</select></div>
            <div class="field-wrap"><label class="small">Tags</label><input class="field" name="tags" value="${escapeHtml(item.tags||'')}" placeholder="comma, separated, tags"></div>
            <div class="field-wrap full"><label class="small">Notes</label><textarea name="notes">${escapeHtml(item.notes||'')}</textarea></div>
          </div>
          <div class="toggle-row"><div><strong>Pin this credential</strong><div class="small-note">Keep it on the dashboard for quick access.</div></div><input type="checkbox" name="favorite" ${item.favorite ? 'checked':''}></div>
          <div class="inline-actions"><button type="button" class="soft-btn" onclick="app.closeModal()">Cancel</button><button type="submit" class="primary-btn">${current ? 'Save Credential' : 'Create Credential'}</button></div>
        </form>`);
    }else if(type === 'project'){
      openModal(current ? 'Edit Project' : 'Add Project', `
        <form id="entity-form" class="stack" onsubmit="app.submitEntity(event,'project','${current?.id || ''}')">
          <div class="form-grid">
            <div class="field-wrap"><label class="small">Project Name</label><input class="field" name="name" value="${escapeHtml(item.name||'')}" required></div>
            <div class="field-wrap"><label class="small">Category</label><input class="field" name="category" value="${escapeHtml(item.category||'')}" placeholder="App, client, personal, etc."></div>
            <div class="field-wrap"><label class="small">Color Label</label><input class="field" name="color" value="${escapeHtml(item.color||'Purple Gold')}" placeholder="Purple Gold"></div>
            <div class="field-wrap full"><label class="small">Description</label><textarea name="description">${escapeHtml(item.description||'')}</textarea></div>
          </div>
          <div class="inline-actions"><button type="button" class="soft-btn" onclick="app.closeModal()">Cancel</button><button type="submit" class="primary-btn">${current ? 'Save Project' : 'Create Project'}</button></div>
        </form>`);
    }else if(type === 'note'){
      openModal(current ? 'Edit Note' : 'Add Note', `
        <form id="entity-form" class="stack" onsubmit="app.submitEntity(event,'note','${current?.id || ''}')">
          <div class="form-grid">
            <div class="field-wrap"><label class="small">Title</label><input class="field" name="title" value="${escapeHtml(item.title||'')}" required></div>
            <div class="field-wrap"><label class="small">Project</label><select class="field" name="projectId">${optionList(state.projects, item.projectId||'')}</select></div>
            <div class="field-wrap"><label class="small">Linked Contact</label><select class="field" name="contactId">${optionList(state.contacts, item.contactId||'')}</select></div>
            <div class="field-wrap"><label class="small">Tags</label><input class="field" name="tags" value="${escapeHtml(item.tags||'')}" placeholder="comma, separated, tags"></div>
            <div class="field-wrap full"><label class="small">Content</label><textarea name="content" required>${escapeHtml(item.content||'')}</textarea></div>
          </div>
          <div class="toggle-row"><div><strong>Pin this note</strong><div class="small-note">Keep it surfaced on the dashboard.</div></div><input type="checkbox" name="pinned" ${item.pinned ? 'checked':''}></div>
          <div class="inline-actions"><button type="button" class="soft-btn" onclick="app.closeModal()">Cancel</button><button type="submit" class="primary-btn">${current ? 'Save Note' : 'Create Note'}</button></div>
        </form>`);
    }
  }

  async function submitEntity(event, type, id=''){
    event.preventDefault();
    const form = event.target;
    const fd = new FormData(form);
    const map = {contact:'contacts', credential:'credentials', project:'projects', note:'notes'};
    const key = map[type];
    const existing = id ? state[key].find(x => x.id === id) : null;
    const base = existing ? {...existing} : {id:uid(), createdAt:nowISO()};
    const next = {...base};
    for(const [k,v] of fd.entries()) next[k] = typeof v === 'string' ? v.trim() : v;
    if(type === 'contact'){
      next.favorite = fd.get('favorite') === 'on';
      next.timeline = ensureContactTimeline(base);
    }
    if(type === 'credential') next.favorite = fd.get('favorite') === 'on';
    if(type === 'note') next.pinned = fd.get('pinned') === 'on';
    next.updatedAt = nowISO();
    if(existing) Object.assign(existing, next);
    else state[key].push(next);
    await saveState();
    closeModal();
    await renderCurrentPage();
    showToast(`${type[0].toUpperCase()+type.slice(1)} saved.`);
  }

  function openQuickAdd(){
    openModal('Quick Add', `<div class="stack"><button class="primary-btn" onclick="app.openEntityModal('contact')">New Contact</button><button class="soft-btn" onclick="app.openEntityModal('credential')">New Credential</button><button class="soft-btn" onclick="app.openEntityModal('project')">New Project</button><button class="soft-btn" onclick="app.openEntityModal('note')">New Note</button></div>`);
  }

  function toggleFavorite(type, id){
    const key = type === 'contact' ? 'contacts' : 'credentials';
    const item = state[key].find(x => x.id === id);
    if(!item) return;
    item.favorite = !item.favorite;
    item.updatedAt = nowISO();
    saveState();
    renderCurrentPage();
  }

  function togglePinnedNote(id){
    const item = state.notes.find(n => n.id === id);
    if(!item) return;
    item.pinned = !item.pinned;
    item.updatedAt = nowISO();
    saveState();
    renderCurrentPage();
  }

  function toggleSecret(id){
    const el = qs(`secret-${id}`);
    if(!el) return;
    el.textContent = el.textContent.includes('•') ? el.dataset.secret : '••••••••••••';
  }

  async function copyText(text, msg='Copied'){
    try{ await navigator.clipboard.writeText(text); showToast(msg); }
    catch{ showToast('Copy failed in this browser.', 'bad'); }
  }

  async function deleteEntity(type, id){
    const map = {contact:'contacts', credential:'credentials', project:'projects', note:'notes'};
    const key = map[type];
    if(!key) return;
    if(!confirm(`Delete this ${type}?`)) return;
    state[key] = state[key].filter(item => item.id !== id);
    if(type === 'project'){
      state.contacts.forEach(c => { if(c.projectId === id) c.projectId = ''; });
      state.credentials.forEach(c => { if(c.projectId === id) c.projectId = ''; });
      state.notes.forEach(n => { if(n.projectId === id) n.projectId = ''; });
    }
    if(type === 'contact'){
      state.credentials.forEach(c => { if(c.contactId === id) c.contactId = ''; });
      state.notes.forEach(n => { if(n.contactId === id) n.contactId = ''; });
    }
    await saveState();
    if(type === 'contact' && currentPage === 'contact-view' && currentParams.id === id) await goTo('contacts');
    else await renderCurrentPage();
    showToast(`${type[0].toUpperCase()+type.slice(1)} deleted.`);
  }

  function openTimelineModal(contactId){
    const contact = getContactById(contactId);
    if(!contact) return;
    openModal('Add Relationship Event', `
      <form class="stack" onsubmit="app.submitTimelineEvent(event,'${contactId}')">
        <div class="form-grid">
          <div class="field-wrap"><label class="small">Event Title</label><input class="field" name="title" value="Conversation" required></div>
          <div class="field-wrap"><label class="small">When</label><input class="field" type="datetime-local" name="occurredAt" value="${toDatetimeLocal(nowISO())}"></div>
          <div class="field-wrap"><label class="small">Channel</label><input class="field" name="channel" placeholder="Call, text, email, in person"></div>
          <div class="field-wrap"><label class="small">Outcome</label><input class="field" name="outcome" placeholder="Next step, commitment, takeaway"></div>
          <div class="field-wrap full"><label class="small">Summary</label><textarea name="summary" placeholder="What happened?"></textarea></div>
        </div>
        <div class="inline-actions"><button type="button" class="soft-btn" onclick="app.closeModal()">Cancel</button><button type="submit" class="primary-btn">Save Event</button></div>
      </form>`);
  }

  function toDatetimeLocal(iso){
    const d = new Date(iso);
    if(isNaN(d)) return '';
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function submitTimelineEvent(event, contactId){
    event.preventDefault();
    const contact = getContactById(contactId);
    if(!contact) return;
    const fd = new FormData(event.target);
    const timeline = ensureContactTimeline(contact);
    timeline.push({
      id: uid(),
      title: String(fd.get('title') || '').trim() || 'Interaction',
      occurredAt: String(fd.get('occurredAt') || '').trim() || nowISO(),
      channel: String(fd.get('channel') || '').trim(),
      summary: String(fd.get('summary') || '').trim(),
      outcome: String(fd.get('outcome') || '').trim(),
      createdAt: nowISO()
    });
    contact.updatedAt = nowISO();
    await saveState();
    closeModal();
    await renderCurrentPage();
    showToast('Relationship event saved.');
  }

  async function deleteTimelineEvent(contactId, eventId){
    const contact = getContactById(contactId);
    if(!contact) return;
    if(!confirm('Delete this relationship event?')) return;
    contact.timeline = ensureContactTimeline(contact).filter(item => item.id !== eventId);
    contact.updatedAt = nowISO();
    await saveState();
    await renderCurrentPage();
    showToast('Relationship event deleted.');
  }

  async function resizeImageFile(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 1800, maxH = 1800;
          let {width, height} = img;
          const scale = Math.min(1, maxW/width, maxH/height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = type === 'image/png' ? undefined : 0.82;
          resolve(canvas.toDataURL(type, quality));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleBackgroundUpload(evt){
    const file = evt.target.files?.[0];
    if(!file) return;
    try{
      ui.customBackground = await resizeImageFile(file);
      ui.useUploadedBackground = true;
      applyUI();
      showToast('Background updated.');
    }catch(err){
      console.error(err);
      showToast('That image could not be processed.', 'bad');
    }finally{
      evt.target.value = '';
    }
  }

  function clearCustomBackground(){
    ui.customBackground = '';
    ui.useUploadedBackground = false;
    applyUI();
    showToast('Uploaded background removed.');
  }

  function exportBackup(){
    const payload = { exportedAt: nowISO(), app: 'Credential Vault - s0l26-0s', state, ui };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skydexia-hub-vault-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Backup downloaded.');
  }

  async function restoreBackup(evt){
    const file = evt.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const parsed = JSON.parse(text);
      if(!parsed.state) throw new Error('Invalid backup');
      state = parsed.state;
      state.contacts.forEach(ensureContactTimeline);
      if(parsed.ui){ ui = {...defaultUI(), ...parsed.ui}; applyUI(); }
      await saveState();
      await renderCurrentPage();
      showToast('Backup restored.');
    }catch(err){ console.error(err); showToast('Backup restore failed.', 'bad'); }
    finally{ evt.target.value = ''; }
  }

  function exportContactsCSV(){
    const headers = ['name','company','role','status','email','phone','website','address','tags','notes','project','timelineCount'];
    const rows = state.contacts.map(c => [c.name,c.company,c.role,c.status,c.email,c.phone,c.website,c.address,c.tags,c.notes,projectName(c.projectId),ensureContactTimeline(c).length]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skydexia-contacts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Contacts CSV downloaded.');
  }

  function parseCSV(text){
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for(let i=0; i<text.length; i++){
      const ch = text[i], next = text[i+1];
      if(ch === '"'){
        if(inQuotes && next === '"'){ cell += '"'; i++; }
        else inQuotes = !inQuotes;
      }else if(ch === ',' && !inQuotes){ row.push(cell); cell = ''; }
      else if((ch === '\n' || ch === '\r') && !inQuotes){
        if(ch === '\r' && next === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      }else cell += ch;
    }
    if(cell.length || row.length){ row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
  }

  function findOrCreateProjectByName(name){
    const clean = String(name || '').trim();
    if(!clean) return '';
    let project = state.projects.find(p => (p.name || '').trim().toLowerCase() === clean.toLowerCase());
    if(project) return project.id;
    project = {id:uid(), name:clean, category:'Imported', color:'Purple Gold', description:'Created during contacts CSV import.', createdAt:nowISO(), updatedAt:nowISO()};
    state.projects.push(project);
    return project.id;
  }

  async function importContactsFromCSV(evt){
    const file = evt.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const rows = parseCSV(text);
      if(rows.length < 2) throw new Error('Not enough rows');
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      let imported = 0;
      for(const raw of rows.slice(1)){
        const obj = {};
        headers.forEach((h, idx) => obj[h] = String(raw[idx] ?? '').trim());
        if(!(obj.name || obj.email || obj.phone)) continue;
        const contact = {
          id: uid(),
          name: obj.name || obj.fullname || obj.contact || obj.email || obj.phone || 'Imported contact',
          company: obj.company || obj.organization || '',
          role: obj.role || obj.title || '',
          status: (obj.status || 'lead').toLowerCase(),
          email: obj.email || '',
          phone: obj.phone || obj.mobile || '',
          website: obj.website || obj.url || '',
          address: obj.address || '',
          tags: obj.tags || '',
          notes: obj.notes || obj.note || '',
          projectId: findOrCreateProjectByName(obj.project || obj.projectname || ''),
          favorite: /^(1|true|yes|favorite)$/i.test(obj.favorite || ''),
          timeline: [],
          createdAt: nowISO(),
          updatedAt: nowISO()
        };
        state.contacts.push(contact);
        imported++;
      }
      await saveState();
      await renderCurrentPage();
      showToast(imported ? `Imported ${imported} contacts.` : 'No contacts were imported.', imported ? 'good' : 'bad');
    }catch(err){ console.error(err); showToast('CSV import failed.', 'bad'); }
    finally{ evt.target.value = ''; }
  }

  async function factoryReset(){
    if(!confirm('This wipes the local vault in this browser. Continue?')) return;
    if(!confirm('This cannot be undone. Wipe everything?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UI_KEY);
    ui = defaultUI();
    state = defaultState();
    currentKey = null; currentSalt = null; unlocked = true;
    applyUI();
    await saveState();
    await renderCurrentPage();
    showToast('Local vault wiped.');
  }

  function refresh(){ renderCurrentPage(); }
  function setFilter(key, value){ filters[key] = value; renderCurrentPage(); }

  function updateOfflineBadge(){
    const pill = qs('offline-pill');
    if(!pill) return;
    if(navigator.onLine){ pill.textContent = 'Browser is online'; pill.classList.remove('online'); pill.classList.add('offline'); }
    else { pill.textContent = 'Running offline'; pill.classList.remove('offline'); pill.classList.add('online'); }
  }

  async function registerSW(){
    if(!('serviceWorker' in navigator)){ updateInstallStatus(); return; }
    try{
      const reg = await navigator.serviceWorker.register('./sw.js');
      swReady = true;
      console.log('SW registered', reg.scope);
    }catch(err){ console.error(err); }
    updateInstallStatus();
  }

  function bindInstallPrompt(){
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      qs('install-btn')?.classList.remove('hidden');
      updateInstallStatus();
    });
    qs('install-btn')?.addEventListener('click', async () => {
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      qs('install-btn')?.classList.add('hidden');
      updateInstallStatus();
    });
  }

  function bindShellEvents(){
    document.querySelectorAll('#nav button').forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.page, {})));
    qs('restore-file')?.addEventListener('change', restoreBackup);
    qs('global-search')?.addEventListener('input', renderGlobalSearchResults);
    qs('tour-btn')?.addEventListener('click', () => startWalkthrough());
    qs('tour-next')?.addEventListener('click', nextWalkthroughStep);
    qs('tour-prev')?.addEventListener('click', previousWalkthroughStep);
    qs('tour-skip')?.addEventListener('click', () => closeWalkthrough(true));
    document.addEventListener('click', (e) => {
      const box = document.querySelector('.search');
      if(box && !box.contains(e.target)) qs('results-panel')?.classList.remove('open');
    });
    qs('lock-input')?.addEventListener('keydown', e => { if(e.key === 'Enter') unlockVault(); });
    window.addEventListener('online', updateOfflineBadge);
    window.addEventListener('offline', updateOfflineBadge);
    window.addEventListener('resize', () => { if(tourActive) positionWalkthroughElements(document.querySelector(getWalkthroughSteps()[tourIndex]?.selector || '')); });
    window.addEventListener('scroll', () => { if(tourActive) positionWalkthroughElements(document.querySelector(getWalkthroughSteps()[tourIndex]?.selector || '')); }, true);
    window.addEventListener('hashchange', () => {
      const route = parseHash();
      if(route.page !== currentPage || JSON.stringify(route.params) !== JSON.stringify(currentParams)) goTo(route.page, route.params, {updateHash:false});
    });
  }

  async function init(){
    bindShellEvents();
    bindInstallPrompt();
    applyUI();
    updateOfflineBadge();
    await loadPayload();
    await registerSW();
    const route = parseHash();
    await goTo(route.page, route.params, {updateHash:false});
    if(!tutorialSeen()){
      setTimeout(() => startWalkthrough(), 420);
    }
  }

  return {
    init,
    goTo,
    refresh,
    closeModal,
    openQuickAdd,
    openEntityModal: (type, defaults={}) => collectForm(type, '', defaults),
    editEntity: (type, id) => collectForm(type, id),
    submitEntity,
    deleteEntity,
    toggleFavorite,
    togglePinnedNote,
    toggleSecret,
    copyText,
    clearCustomBackground,
    exportBackup,
    restoreBackup,
    exportContactsCSV,
    importContactsFromCSV,
    factoryReset,
    applyPasscode,
    removePasscode,
    unlockVault,
    cancelUnlock,
    renderGlobalSearchResults,
    openSearchResult,
    handleBackgroundUpload,
    updateUISetting,
    toggleUIOption,
    setPreset,
    setFilter,
    openTimelineModal,
    submitTimelineEvent,
    deleteTimelineEvent,
    startWalkthrough,
    restartTutorial,
    nextWalkthroughStep,
    previousWalkthroughStep
  };
})();

window.app = app;
window.addEventListener('DOMContentLoaded', app.init);