
(() => {
  'use strict';

  const STORAGE_KEY = 'SKYE_LEAD_VAULT_V3';
  const SNAPSHOT_KEY = 'SKYE_LEAD_VAULT_LIGHT_SNAPSHOTS';
  const ALERT_KEY = 'SKYE_LEAD_VAULT_ALERTS';
  const UNLOCK_KEY = 'SKYE_LEAD_VAULT_UNLOCK';
  const page = document.body.dataset.page || 'dashboard';
  const stageOrder = ['Prospect', 'Contacted', 'Warm', 'Proposal', 'Won', 'Lost'];
  const pageMeta = {
    dashboard: { kicker: 'Daily command center', title: 'Skye Lead Vault', sub: 'Offline lead control with dedupe radar, recovery lane, route planning, script generation, and encrypted backup.' },
    leads: { kicker: 'Lead records', title: 'Lead ledger', sub: 'Work the vault in table, cards, or dossier mode. Edit records, attach files, map contacts, and move fast.' },
    pipeline: { kicker: 'Movement board', title: 'Pipeline board', sub: 'Drag stages, surface overdue work, and see where momentum is getting stuck.' },
    contacts: { kicker: 'People layer', title: 'Contact hub', sub: 'Primary contacts, supporting relationships, decision-maker mapping, and quick reach-out actions.' },
    playbooks: { kicker: 'Scripts + offers', title: 'Playbook studio', sub: 'Generate script packs, build simple quotes, and save reusable offer structures fully offline.' },
    capture: { kicker: 'Field mode', title: 'Quick capture', sub: 'Fast-add leads in the field, tag the moment, attach a photo, and record a voice note when supported.' },
    routes: { kicker: 'Territory planning', title: 'Routes + territory', sub: 'Bucket leads into territories, assemble route plans, and export printable run sheets without live maps.' },
    analytics: { kicker: 'Clarity layer', title: 'Analytics', sub: 'Stage counts, source distribution, recovery targets, activity velocity, and open value from local data only.' },
    backups: { kicker: 'Resilience layer', title: 'Backup vault', sub: 'Plain export, encrypted export, restore preview, merge restore, and lightweight local snapshots.' },
    settings: { kicker: 'Identity + privacy', title: 'Workspace settings', sub: 'Background studio, visual controls, follow-up presets, reminder permission, and local app lock.' }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const nowISO = () => new Date().toISOString();
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const safeJson = (str, fallback = null) => { try { return JSON.parse(str); } catch { return fallback; } };
  const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (s) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  };
  const fmtShort = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString([], { year:'numeric', month:'short', day:'2-digit' });
  };
  const fmtCurrency = (num) => new Intl.NumberFormat([], { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(num || 0));
  const normText = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normPhone = (v) => String(v || '').replace(/\D/g, '');
  const normEmail = (v) => String(v || '').trim().toLowerCase();
  const daysBetween = (a, b = new Date()) => {
    if (!a) return 9999;
    const da = new Date(a);
    if (Number.isNaN(da.getTime())) return 9999;
    return Math.floor((b.getTime() - da.getTime()) / 86400000);
  };
  const dueState = (iso) => {
    if (!iso) return 'none';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'none';
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    if (t < start.getTime()) return 'overdue';
    if (t <= end.getTime()) return 'due';
    return 'future';
  };
  const daysFromNowISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    d.setSeconds(0,0);
    return d.toISOString();
  };
  const isoToLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const localInputToISO = (v) => v ? new Date(v).toISOString() : '';
  const downloadBlob = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const downloadText = (filename, text, mime='text/plain') => downloadBlob(filename, new Blob([text], { type: mime }));
  const toCSV = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const badge = (label, cls='') => `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
  const stageBadge = (lead) => {
    const due = dueState(lead.next_followup);
    if (lead.stage === 'Won') return badge('Won', 'good');
    if (lead.stage === 'Lost') return badge('Lost', 'bad');
    if (due === 'overdue') return badge('Overdue', 'bad');
    if (due === 'due') return badge('Due now', 'warn');
    return badge(lead.stage || 'Prospect');
  };
  const copyText = async (text, success='Copied.') => {
    if (!text) return toast('Nothing to copy.');
    await navigator.clipboard.writeText(text);
    toast(success);
  };
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
  const textToHtml = (text) => escapeHtml(text).replace(/\n/g, '<br>');
  const arrayBufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const base64ToArrayBuffer = (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
  const storageUsage = () => {
    try { return new Blob([localStorage.getItem(STORAGE_KEY) || '']).size; } catch { return 0; }
  };

  function logoMarkup(){
    return '<img src="assets/media/skydexia-logo.png" alt="SkyDexia logo">';
  }

  function defaultTemplates(){
    return [
      { id:'tpl-initial', name:'Initial outreach', type:'email', body:`Hi {{contact|there}},\n\nI’m {{me}} with {{company}}. I took a look at {{business}} and saw a few simple moves that could tighten visibility and make follow-up easier.\n\nI can show you the cleanest first win and the next steps from there.\n\nWould a short conversation this week make sense?\n\n— {{me}}\n{{signature}}` },
      { id:'tpl-followup', name:'Follow-up nudge', type:'email', body:`Hi {{contact|there}},\n\nJust circling back on {{business}}. I still think there is an easy win here around follow-up, intake, and clarity.\n\nIf helpful, I can send a short outline with the first 2–3 things I would fix first.\n\n— {{me}}\n{{signature}}` },
      { id:'tpl-text', name:'Quick text', type:'text', body:`Hi {{contact|there}}, it’s {{me}}. Quick question — are you open to a short chat this week about a practical improvement for {{business}}?` },
      { id:'tpl-visit', name:'Walk-in opener', type:'script', body:`I’m {{me}} with {{company}}. I work with local businesses like {{business}} on follow-up, lead handling, and cleaner online conversion paths. I only need two minutes to show you what stood out.` }
    ];
  }

  function defaultQuoteTemplates(){
    return [
      {
        id:'quote-lite',
        name:'Starter build',
        items:[
          { id:uid(), label:'Lead capture tune-up', qty:1, price:850 },
          { id:uid(), label:'Follow-up sequence pack', qty:1, price:650 },
          { id:uid(), label:'Install + setup', qty:1, price:400 }
        ]
      },
      {
        id:'quote-local',
        name:'Local growth package',
        items:[
          { id:uid(), label:'Offer + landing page refresh', qty:1, price:1200 },
          { id:uid(), label:'Reputation and review workflow', qty:1, price:950 },
          { id:uid(), label:'Reporting and handoff', qty:1, price:600 }
        ]
      }
    ];
  }

  function seedLeads(){
    const created = nowISO();
    return [
      normalizeLead({
        id:uid(),
        business:'Valley Custom Detail',
        primary_contact:'Marcus',
        email:'marcus@example.com',
        phone:'(602) 555-0148',
        website:'https://example.com',
        address:'1127 East Fillmore Street',
        city:'Phoenix, AZ',
        territory:'Central Phoenix',
        source:'Walk-in',
        stage:'Warm',
        priority:1,
        estimated_value:2200,
        service:'Lead capture + follow-up console',
        tags:'auto, local, high-intent',
        notes:'Owner actually answered. Interested in follow-up automation and mobile-friendly quote intake.',
        link:'',
        next_followup:daysFromNowISO(0),
        last_contacted_at:daysFromNowISO(-1),
        manual_boost:8,
        created_at:created,
        updated_at:created,
        contacts:[
          { id:uid(), name:'Marcus', role:'Owner', email:'marcus@example.com', phone:'(602) 555-0148', decision:'Decision maker', notes:'Moves quickly when shown clean visuals.' },
          { id:uid(), name:'Tina', role:'Front desk', email:'', phone:'(602) 555-0100', decision:'Gatekeeper', notes:'Friendly, best in afternoons.' }
        ],
        tasks:[
          { id:uid(), title:'Send one-page breakdown', due:daysFromNowISO(0), done:false, notes:'Keep it visual.' }
        ],
        logs:[
          { id:uid(), at:daysFromNowISO(-2), type:'Walk-in', note:'Met owner in person. Good energy.' },
          { id:uid(), at:daysFromNowISO(-1), type:'Call', note:'Asked for simple breakdown and next steps.' }
        ],
        attachments:[]
      }),
      normalizeLead({
        id:uid(),
        business:'Desert Smile Studio',
        primary_contact:'Jasmine',
        email:'jasmine@example.com',
        phone:'(480) 555-0126',
        website:'https://example.com',
        address:'78 South Dobson',
        city:'Mesa, AZ',
        territory:'East Valley',
        source:'Referral',
        stage:'Proposal',
        priority:1,
        estimated_value:6400,
        service:'Reputation + local page stack',
        tags:'dental, referral, proposal',
        notes:'Strong fit. Wants a visual before committing.',
        link:'',
        next_followup:daysFromNowISO(2),
        last_contacted_at:nowISO(),
        manual_boost:10,
        created_at:created,
        updated_at:created,
        contacts:[
          { id:uid(), name:'Jasmine', role:'Practice manager', email:'jasmine@example.com', phone:'(480) 555-0126', decision:'Champion', notes:'Wants to move before month end.' },
          { id:uid(), name:'Dr. Cole', role:'Owner', email:'', phone:'', decision:'Decision maker', notes:'Needs concise ROI framing.' }
        ],
        tasks:[
          { id:uid(), title:'Prepare quote draft', due:daysFromNowISO(1), done:false, notes:'Starter and local package versions.' }
        ],
        logs:[
          { id:uid(), at:daysFromNowISO(-3), type:'Referral', note:'Introduced by existing client.' },
          { id:uid(), at:nowISO(), type:'Email', note:'Sent proposal and example layout.' }
        ],
        attachments:[]
      }),
      normalizeLead({
        id:uid(),
        business:'North Central HVAC',
        primary_contact:'Andre',
        email:'andre@example.com',
        phone:'(623) 555-0182',
        website:'https://example.com',
        address:'2501 West Northern Ave',
        city:'Glendale, AZ',
        territory:'West Valley',
        source:'Cold outreach',
        stage:'Contacted',
        priority:2,
        estimated_value:3600,
        service:'Website recovery + quote funnel',
        tags:'hvac, website, follow-up',
        notes:'Need to hit again with a tighter angle.',
        link:'',
        next_followup:daysFromNowISO(-1),
        last_contacted_at:daysFromNowISO(-4),
        manual_boost:0,
        created_at:created,
        updated_at:created,
        contacts:[
          { id:uid(), name:'Andre', role:'Owner', email:'andre@example.com', phone:'(623) 555-0182', decision:'Decision maker', notes:'Prefers text before calls.' }
        ],
        tasks:[],
        logs:[
          { id:uid(), at:daysFromNowISO(-4), type:'Email', note:'Sent first contact note.' }
        ],
        attachments:[]
      }),
      normalizeLead({
        id:uid(),
        business:'Valley Custom Detail',
        primary_contact:'Marcus',
        email:'marcus@example.com',
        phone:'(602) 555-0148',
        website:'',
        address:'1127 East Fillmore Street',
        city:'Phoenix, AZ',
        territory:'Central Phoenix',
        source:'Business card import',
        stage:'Prospect',
        priority:2,
        estimated_value:2000,
        service:'',
        tags:'duplicate, import',
        notes:'Intentionally seeded duplicate so the duplicate radar has something real to show.',
        next_followup:daysFromNowISO(7),
        last_contacted_at:'',
        manual_boost:0,
        created_at:created,
        updated_at:created,
        contacts:[],
        tasks:[],
        logs:[],
        attachments:[]
      })
    ];
  }

  function defaultState(){
    const ts = nowISO();
    return {
      version:3,
      created_at:ts,
      updated_at:ts,
      settings:{
        me:'Skyes Over London',
        company:'Skyes Over London LC',
        signature:'Skyes Over London LC\n(480) 469-5416\nSkyesOverLondonLC@solenterprises.org',
        defaultCity:'Phoenix, AZ',
        defaultSource:'Field outreach',
        followupPresetsDays:[1,3,7,14,30],
        backgroundMode:'gradient',
        backgroundImageDataUrl:'',
        uiTint:'rgba(112,73,196,.16)',
        pageGlow:'rgba(244,196,78,.10)',
        themeName:'Skydexia Glass',
        notes:'',
        privacyMode:false,
        pinHash:'',
        recoveryDays:30
      },
      templates: defaultTemplates(),
      quoteTemplates: defaultQuoteTemplates(),
      savedViews: [],
      routes: [],
      leads: seedLeads()
    };
  }

  function calculateLeadScore(lead){
    let score = 28;
    if (lead.primary_contact) score += 6;
    if (lead.email) score += 8;
    if (lead.phone) score += 8;
    if (lead.website) score += 4;
    if (lead.address) score += 4;
    if (lead.notes && lead.notes.length > 30) score += 4;
    if ((lead.contacts || []).length) score += Math.min(10, lead.contacts.length * 4);
    if ((lead.tasks || []).some((t) => !t.done)) score += 4;
    score += Math.min(18, Math.floor(Number(lead.estimated_value || 0) / 500));
    score += ({ Prospect:2, Contacted:6, Warm:10, Proposal:15, Won:18, Lost:-10 }[lead.stage] || 0);
    score += ({ 1:12, 2:6, 3:0 }[String(lead.priority || 2)] || 0);
    const due = dueState(lead.next_followup);
    if (due === 'overdue') score += 6;
    if (due === 'due') score += 4;
    const stale = daysBetween(lead.last_contacted_at || lead.updated_at);
    if (stale > 14) score -= 5;
    if (stale > 30) score -= 7;
    const tags = String(lead.tags || '').toLowerCase();
    ['referral', 'decision', 'owner', 'urgent', 'high-intent', 'proposal'].forEach((k) => { if (tags.includes(k)) score += 3; });
    score += Number(lead.manual_boost || 0);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function normalizeLead(lead){
    const base = {
      id:uid(), business:'', primary_contact:'', email:'', phone:'', website:'', address:'', city:'', territory:'', source:'', stage:'Prospect',
      priority:2, score:0, estimated_value:0, service:'', tags:'', notes:'', link:'', next_followup:'', last_contacted_at:'', created_at:nowISO(),
      updated_at:nowISO(), manual_boost:0, logs:[], contacts:[], attachments:[], tasks:[], quotes:[]
    };
    const out = { ...base, ...(lead || {}) };
    out.contacts = Array.isArray(out.contacts) ? out.contacts : [];
    out.attachments = Array.isArray(out.attachments) ? out.attachments : [];
    out.tasks = Array.isArray(out.tasks) ? out.tasks : [];
    out.logs = Array.isArray(out.logs) ? out.logs : [];
    out.quotes = Array.isArray(out.quotes) ? out.quotes : [];
    out.priority = Number(out.priority || 2);
    out.estimated_value = Number(out.estimated_value || 0);
    out.manual_boost = Number(out.manual_boost || 0);
    out.score = calculateLeadScore(out);
    return out;
  }

  function loadState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = safeJson(raw, null);
    if (!parsed || typeof parsed !== 'object') return defaultState();
    const fallback = defaultState();
    parsed.settings = { ...fallback.settings, ...(parsed.settings || {}) };
    parsed.templates = Array.isArray(parsed.templates) ? parsed.templates : fallback.templates;
    parsed.quoteTemplates = Array.isArray(parsed.quoteTemplates) ? parsed.quoteTemplates : fallback.quoteTemplates;
    parsed.savedViews = Array.isArray(parsed.savedViews) ? parsed.savedViews : [];
    parsed.routes = Array.isArray(parsed.routes) ? parsed.routes : [];
    parsed.leads = Array.isArray(parsed.leads) ? parsed.leads.map(normalizeLead) : fallback.leads;
    parsed.version = 3;
    return parsed;
  }

  let state = loadState();
  let ui = {
    filters: {
      search: '',
      stage: 'All',
      due: 'All',
      territory: 'All',
      sort: 'score',
      layout: sessionStorage.getItem('skye-lead-layout') || 'table',
      viewId: ''
    },
    selectedLeadId: sessionStorage.getItem('skye-selected-lead') || (state.leads[0]?.id || ''),
    pendingRestore: null,
    currentQuoteLeadId: state.leads[0]?.id || '',
    currentQuoteTemplateId: state.quoteTemplates[0]?.id || '',
    currentScriptTemplateId: state.templates[0]?.id || '',
    quoteDraftItems: [],
    quickCapture: { noteType:'Walk-in', attachments:[], voiceAttachment:null }
  };

  function lightweightState(){
    const light = clone(state);
    light.settings.backgroundImageDataUrl = '';
    light.leads = light.leads.map((lead) => ({
      ...lead,
      attachments:(lead.attachments || []).map((a) => ({ id:a.id, name:a.name, type:a.type, size:a.size, added_at:a.added_at, kind:a.kind }))
    }));
    return light;
  }

  function saveLightSnapshot(reason='Update'){
    const list = safeJson(localStorage.getItem(SNAPSHOT_KEY), []);
    list.unshift({
      id: uid(),
      at: nowISO(),
      reason,
      lead_count: state.leads.length,
      open_value: state.leads.filter((l) => l.stage !== 'Lost').reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
      data: lightweightState()
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list.slice(0, 8)));
  }

  function saveState(reason='Saved', options={}){
    state.updated_at = nowISO();
    state.leads = state.leads.map(normalizeLead);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!options.skipSnapshot) saveLightSnapshot(reason);
    syncShell();
    applyBackground();
    if (!options.silent) toast(reason);
  }

  function getLightSnapshots(){
    return safeJson(localStorage.getItem(SNAPSHOT_KEY), []);
  }

  function getLead(id){
    return state.leads.find((lead) => lead.id === id) || null;
  }

  function setSelectedLead(id){
    ui.selectedLeadId = id || '';
    sessionStorage.setItem('skye-selected-lead', ui.selectedLeadId);
  }

  function upsertLead(lead, reason='Lead saved'){
    const item = normalizeLead({ ...lead, updated_at: nowISO() });
    const idx = state.leads.findIndex((x) => x.id === item.id);
    if (idx >= 0) state.leads[idx] = item;
    else state.leads.unshift(item);
    setSelectedLead(item.id);
    logAutoDuplicateHint(item);
    saveState(reason);
    renderPage();
  }

  function deleteLead(id){
    state.leads = state.leads.filter((lead) => lead.id !== id);
    if (ui.selectedLeadId === id) setSelectedLead(state.leads[0]?.id || '');
    saveState('Lead deleted');
    renderPage();
  }

  function addLog(leadId, type, note){
    const lead = getLead(leadId);
    if (!lead) return;
    lead.logs.unshift({ id:uid(), at:nowISO(), type, note:note || `${type} logged` });
    if (type !== 'Imported') lead.last_contacted_at = nowISO();
    upsertLead(lead, `${type} logged`);
  }

  function duplicateMatchesFor(lead){
    return state.leads.filter((other) => {
      if (!lead || other.id === lead.id) return false;
      const sameEmail = normEmail(lead.email) && normEmail(lead.email) === normEmail(other.email);
      const samePhone = normPhone(lead.phone) && normPhone(lead.phone) === normPhone(other.phone);
      const sameBiz = normText(lead.business) && normText(lead.business) === normText(other.business);
      const sameAddr = normText(lead.address) && normText(lead.address) === normText(other.address);
      const sameCity = normText(lead.city) && normText(lead.city) === normText(other.city);
      return sameEmail || samePhone || (sameBiz && (sameAddr || sameCity));
    });
  }

  function duplicateGroups(){
    const seen = new Set();
    const groups = [];
    state.leads.forEach((lead) => {
      if (seen.has(lead.id)) return;
      const matches = duplicateMatchesFor(lead);
      if (matches.length) {
        const ids = [lead.id, ...matches.map((x) => x.id)];
        ids.forEach((id) => seen.add(id));
        groups.push([lead, ...matches]);
      }
    });
    return groups;
  }

  function logAutoDuplicateHint(lead){
    const matches = duplicateMatchesFor(lead);
    if (!matches.length) return;
    const names = matches.map((m) => m.business || m.primary_contact || 'lead').slice(0, 3).join(', ');
    if (!(lead.logs || []).some((x) => x.type === 'Duplicate radar' && (x.note || '').includes(names))) {
      lead.logs.unshift({ id:uid(), at:nowISO(), type:'Duplicate radar', note:`Possible duplicate with ${names}` });
    }
  }

  function renderTemplate(text, lead){
    const map = {
      me: state.settings.me || '',
      company: state.settings.company || '',
      signature: state.settings.signature || '',
      business: lead?.business || '',
      contact: lead?.primary_contact || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      website: lead?.website || '',
      city: lead?.city || state.settings.defaultCity || '',
      territory: lead?.territory || '',
      service: lead?.service || '',
      link: lead?.link || '',
      value: fmtCurrency(lead?.estimated_value || 0)
    };
    return String(text || '').replace(/\{\{([\w]+)(\|[^}]+)?\}\}/g, (_, key, fallback) => {
      const value = map[key];
      return String(value || '').trim() ? String(value) : (fallback ? fallback.slice(1) : '');
    });
  }

  function buildScriptPack(lead){
    if (!lead) return { title:'No lead selected', blocks:[] };
    const first = lead.primary_contact || 'there';
    const business = lead.business || 'your business';
    const service = lead.service || 'your next practical improvement';
    const intro = `Hi ${first}, I’m ${state.settings.me}. I’ve been looking at ${business} and I think there is a clean, practical way to improve ${service.toLowerCase()}.`;
    const voicemail = `Hi ${first}, this is ${state.settings.me}. I wanted to leave a quick note because I saw a real opportunity for ${business}. No long pitch — just a clean recommendation and a next step.`;
    const walkin = `I’m ${state.settings.me} with ${state.settings.company}. I help businesses like ${business} tighten follow-up and conversion. I only need two minutes to show you what stood out.`;
    const callback = `Wanted to circle back on ${business}. I still think the easiest win is getting the front end of the offer and the follow-up process tighter.`;
    const objections = [
      `“We already have something.” — Totally fair. I’m usually not replacing everything. I’m tightening the weak spots that are leaving money on the table.`,
      `“Not interested.” — No problem. Before I leave, can I show you the one thing I noticed first?`,
      `“Email me.” — Absolutely. I’ll keep it clean and brief and send the exact angle I think matters most for ${business}.`
    ];
    const followups = [
      `Day 1: Send concise first note referencing ${business} and the specific opportunity you saw.`,
      `Day 3: Text or short email: “Wanted to make sure this didn’t get buried. Still happy to show you the quickest win.”`,
      `Day 7: Reframe around outcome: “This is less about tech and more about lost follow-up / missed opportunity.”`,
      `Day 14: Close the loop respectfully and offer a small one-page breakdown instead of a full call.`
    ];
    return {
      title: `${business} — script pack`,
      blocks: [
        { label:'Cold intro', text:intro },
        { label:'Voicemail', text:voicemail },
        { label:'Walk-in opener', text:walkin },
        { label:'Callback opener', text:callback },
        { label:'Objection answers', text:objections.join('\n\n') },
        { label:'Follow-up sequence', text:followups.join('\n\n') }
      ]
    };
  }

  function quoteItemsFromTemplate(templateId){
    const template = state.quoteTemplates.find((x) => x.id === templateId) || state.quoteTemplates[0];
    return clone(template?.items || []);
  }

  if (!ui.quoteDraftItems.length) ui.quoteDraftItems = quoteItemsFromTemplate(ui.currentQuoteTemplateId);

  function buildQuote(lead, items){
    const cleanItems = (items || []).map((item) => ({ ...item, qty:Number(item.qty || 0), price:Number(item.price || 0) }));
    const total = cleanItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const quoteText = [
      `${state.settings.company}`,
      `Prepared for: ${lead?.business || 'Lead'}`,
      `Contact: ${lead?.primary_contact || '—'}`,
      `Date: ${fmtShort(nowISO())}`,
      '',
      ...cleanItems.map((item, idx) => `${idx+1}. ${item.label} — ${item.qty} × ${fmtCurrency(item.price)} = ${fmtCurrency(item.qty * item.price)}`),
      '',
      `Total: ${fmtCurrency(total)}`,
      '',
      `Prepared by ${state.settings.me}`,
      state.settings.signature || ''
    ].join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(lead?.business || 'Lead')} Quote</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}h1{margin:0 0 10px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f4f4}.total{font-size:22px;font-weight:700;margin-top:24px}</style></head><body><h1>${escapeHtml(state.settings.company)}</h1><p>Prepared for <strong>${escapeHtml(lead?.business || 'Lead')}</strong><br>Contact: ${escapeHtml(lead?.primary_contact || '—')}<br>Date: ${escapeHtml(fmtShort(nowISO()))}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Line total</th></tr></thead><tbody>${cleanItems.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.qty}</td><td>${escapeHtml(fmtCurrency(item.price))}</td><td>${escapeHtml(fmtCurrency(item.qty * item.price))}</td></tr>`).join('')}</tbody></table><div class="total">Total: ${escapeHtml(fmtCurrency(total))}</div><p style="margin-top:24px;white-space:pre-wrap">${escapeHtml(state.settings.signature || '')}</p></body></html>`;
    return { items: cleanItems, total, text: quoteText, html };
  }

  function metrics(){
    const leads = state.leads;
    const dueToday = leads.filter((l) => !['Won','Lost'].includes(l.stage) && dueState(l.next_followup) === 'due').length;
    const overdue = leads.filter((l) => !['Won','Lost'].includes(l.stage) && dueState(l.next_followup) === 'overdue').length;
    const active = leads.filter((l) => !['Won','Lost'].includes(l.stage)).length;
    const won = leads.filter((l) => l.stage === 'Won').length;
    const stale = leads.filter((l) => !['Won','Lost'].includes(l.stage) && daysBetween(l.last_contacted_at || l.updated_at) >= Number(state.settings.recoveryDays || 30)).length;
    const openValue = leads.filter((l) => l.stage !== 'Lost').reduce((sum, l) => sum + Number(l.estimated_value || 0), 0);
    const avgScore = leads.length ? Math.round(leads.reduce((sum, l) => sum + Number(l.score || 0), 0) / leads.length) : 0;
    return { total: leads.length, dueToday, overdue, active, won, stale, openValue, avgScore, duplicates: duplicateGroups().length };
  }

  function uniqueTerritories(){
    return Array.from(new Set(state.leads.map((l) => l.territory).filter(Boolean))).sort();
  }

  function uniqueCities(){
    return Array.from(new Set(state.leads.map((l) => l.city).filter(Boolean))).sort();
  }

  function filteredLeads(filters = ui.filters){
    const search = String(filters.search || '').trim().toLowerCase();
    return state.leads
      .filter((lead) => {
        const hay = [lead.business, lead.primary_contact, lead.email, lead.phone, lead.website, lead.address, lead.city, lead.territory, lead.source, lead.service, lead.tags, lead.notes].join(' ').toLowerCase();
        const searchOk = !search || hay.includes(search);
        const stageOk = filters.stage === 'All' || lead.stage === filters.stage;
        const dueOk = filters.due === 'All' || dueState(lead.next_followup) === String(filters.due).toLowerCase();
        const territoryOk = filters.territory === 'All' || lead.territory === filters.territory;
        return searchOk && stageOk && dueOk && territoryOk;
      })
      .sort((a, b) => {
        if (filters.sort === 'value') return Number(b.estimated_value || 0) - Number(a.estimated_value || 0);
        if (filters.sort === 'next') {
          const ta = a.next_followup ? new Date(a.next_followup).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.next_followup ? new Date(b.next_followup).getTime() : Number.POSITIVE_INFINITY;
          return ta - tb;
        }
        if (filters.sort === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (filters.sort === 'stale') return daysBetween(b.last_contacted_at || b.updated_at) - daysBetween(a.last_contacted_at || a.updated_at);
        return Number(b.score || 0) - Number(a.score || 0);
      });
  }

  function deriveContacts(){
    const rows = [];
    state.leads.forEach((lead) => {
      if (lead.primary_contact || lead.email || lead.phone) {
        rows.push({
          leadId: lead.id,
          business: lead.business,
          name: lead.primary_contact,
          role: 'Primary',
          email: lead.email,
          phone: lead.phone,
          decision: 'Primary record',
          territory: lead.territory,
          city: lead.city,
          score: lead.score
        });
      }
      (lead.contacts || []).forEach((contact) => rows.push({
        leadId: lead.id,
        business: lead.business,
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        decision: contact.decision || '',
        territory: lead.territory,
        city: lead.city,
        score: lead.score,
        notes: contact.notes || ''
      }));
    });
    return rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  function recentActivity(limit = 10){
    return state.leads.flatMap((lead) => (lead.logs || []).map((log) => ({ ...log, leadId: lead.id, business: lead.business })))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  }

  function staleLeads(){
    const threshold = Number(state.settings.recoveryDays || 30);
    return state.leads
      .filter((lead) => !['Won','Lost'].includes(lead.stage) && daysBetween(lead.last_contacted_at || lead.updated_at) >= threshold)
      .sort((a, b) => daysBetween(b.last_contacted_at || b.updated_at) - daysBetween(a.last_contacted_at || a.updated_at));
  }

  function hotLeads(){
    return state.leads.filter((lead) => lead.stage !== 'Lost').sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 6);
  }

  function applyBackground(){
    const settings = state.settings || {};
    const img = settings.backgroundImageDataUrl || '';
    document.documentElement.style.setProperty('--custom-bg-image', settings.backgroundMode === 'image' && img ? `url(${img})` : 'none');
    document.documentElement.style.setProperty('--ui-tint', settings.uiTint || 'rgba(112,73,196,.16)');
    document.documentElement.style.setProperty('--page-glow', settings.pageGlow || 'rgba(244,196,78,.10)');
    document.body.classList.toggle('privacy-mode', !!settings.privacyMode);
  }

  function applyMeta(){
    const meta = pageMeta[page] || pageMeta.dashboard;
    $('#pageKicker').textContent = meta.kicker;
    $('#pageTitle').textContent = meta.title;
    $('#pageSub').textContent = meta.sub;
    document.title = `${meta.title} — Skye Lead Vault`;
  }

  function syncShell(){
    const m = metrics();
    const map = {
      '[data-count="today"]': m.overdue + m.dueToday,
      '[data-count="leads"]': m.total,
      '[data-count="pipeline"]': m.active,
      '[data-count="contacts"]': deriveContacts().length,
      '[data-count="playbooks"]': state.templates.length + state.quoteTemplates.length,
      '[data-count="capture"]': 'fast',
      '[data-count="routes"]': state.routes.length,
      '[data-count="analytics"]': m.avgScore,
      '[data-count="backups"]': 'safe',
      '[data-count="settings"]': state.settings.pinHash ? 'lock' : 'set'
    };
    Object.entries(map).forEach(([sel, value]) => {
      const el = $(sel);
      if (el) el.textContent = value;
    });
    const toggle = $('#privacyToggle');
    if (toggle) toggle.classList.toggle('active', !!state.settings.privacyMode);
    const label = $('#storageUsage');
    if (label) label.textContent = `${Math.round(storageUsage()/1024)} KB local`;
  }

  function toast(msg){
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  async function sha256(text){
    const bytes = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2,'0')).join('');
  }

  async function ensureUnlocked(){
    if (!state.settings.pinHash) return true;
    const sessionValue = sessionStorage.getItem(UNLOCK_KEY);
    if (sessionValue === state.settings.pinHash) {
      $('#lockOverlay')?.classList.remove('show');
      return true;
    }
    $('#lockOverlay')?.classList.add('show');
    return false;
  }

  async function tryUnlock(pin){
    const digest = await sha256(pin);
    if (digest === state.settings.pinHash) {
      sessionStorage.setItem(UNLOCK_KEY, digest);
      $('#lockOverlay')?.classList.remove('show');
      toast('Vault unlocked');
      return true;
    }
    toast('Wrong PIN');
    return false;
  }

  function lockNow(){
    sessionStorage.removeItem(UNLOCK_KEY);
    if (state.settings.pinHash) $('#lockOverlay')?.classList.add('show');
  }

  function reminderState(){
    return safeJson(localStorage.getItem(ALERT_KEY), {});
  }

  function saveReminderState(obj){
    localStorage.setItem(ALERT_KEY, JSON.stringify(obj));
  }

  function checkReminders(){
    const due = state.leads.filter((lead) => !['Won','Lost'].includes(lead.stage) && ['due','overdue'].includes(dueState(lead.next_followup)));
    if (!due.length) return;
    const todayKey = new Date().toISOString().slice(0,10);
    const sent = reminderState();
    due.forEach((lead) => {
      const key = `${todayKey}:${lead.id}`;
      if (sent[key]) return;
      if (Notification && Notification.permission === 'granted') {
        try {
          new Notification(`Follow-up ${dueState(lead.next_followup) === 'overdue' ? 'overdue' : 'due'}: ${lead.business}`, {
            body: `${lead.primary_contact || 'Lead'} • ${lead.territory || lead.city || 'No territory'}`
          });
        } catch {}
      }
      sent[key] = true;
    });
    saveReminderState(sent);
  }

  async function requestReminderPermission(){
    if (!('Notification' in window)) return toast('This browser does not support notifications.');
    const result = await Notification.requestPermission();
    toast(`Notifications: ${result}`);
    if (result === 'granted') checkReminders();
  }

  async function encryptPayload(payload, passphrase){
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:120000, hash:'SHA-256' }, keyMaterial, { name:'AES-GCM', length:256 }, false, ['encrypt']);
    const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
    return {
      encrypted:true,
      app:'Skye Lead Vault',
      version:3,
      salt: arrayBufferToBase64(salt.buffer),
      iv: arrayBufferToBase64(iv.buffer),
      cipher: arrayBufferToBase64(cipher),
      exported_at: nowISO()
    };
  }

  async function decryptPayload(obj, passphrase){
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt:new Uint8Array(base64ToArrayBuffer(obj.salt)), iterations:120000, hash:'SHA-256' }, keyMaterial, { name:'AES-GCM', length:256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:new Uint8Array(base64ToArrayBuffer(obj.iv)) }, key, base64ToArrayBuffer(obj.cipher));
    return safeJson(new TextDecoder().decode(plain), null);
  }

  function backupPayload(){
    return { app:'Skye Lead Vault', version:3, exported_at:nowISO(), data:state };
  }

  function exportPlainBackup(){
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    downloadText(`skye-lead-vault-backup-${stamp}.json`, JSON.stringify(backupPayload(), null, 2), 'application/json');
    toast('Plain backup exported');
  }

  async function exportEncryptedBackup(){
    const passphrase = prompt('Set a passphrase for this encrypted backup');
    if (!passphrase) return;
    const payload = await encryptPayload(backupPayload(), passphrase);
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    downloadText(`skye-lead-vault-backup-encrypted-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Encrypted backup exported');
  }

  function mergeImportedState(imported){
    const source = imported.data || imported;
    if (!source || !Array.isArray(source.leads)) throw new Error('Backup does not contain lead data.');
    const merged = clone(state);
    const mergeById = (current, incoming, mapper) => {
      const map = new Map((current || []).map((item) => [item.id, item]));
      (incoming || []).forEach((item) => {
        const normalized = mapper ? mapper(item) : item;
        const existing = map.get(normalized.id);
        if (!existing) map.set(normalized.id, normalized);
        else {
          const existingTime = new Date(existing.updated_at || existing.at || 0).getTime();
          const incomingTime = new Date(normalized.updated_at || normalized.at || 0).getTime();
          map.set(normalized.id, incomingTime >= existingTime ? normalized : existing);
        }
      });
      return Array.from(map.values());
    };
    merged.leads = mergeById(merged.leads, source.leads, normalizeLead);
    merged.templates = mergeById(merged.templates, source.templates || []);
    merged.quoteTemplates = mergeById(merged.quoteTemplates, source.quoteTemplates || []);
    merged.savedViews = mergeById(merged.savedViews, source.savedViews || []);
    merged.routes = mergeById(merged.routes, source.routes || []);
    return merged;
  }

  function replaceImportedState(imported){
    const source = imported.data || imported;
    if (!source || !Array.isArray(source.leads)) throw new Error('Backup does not contain lead data.');
    source.settings = { ...defaultState().settings, ...(source.settings || {}) };
    source.leads = source.leads.map(normalizeLead);
    source.templates = Array.isArray(source.templates) ? source.templates : defaultTemplates();
    source.quoteTemplates = Array.isArray(source.quoteTemplates) ? source.quoteTemplates : defaultQuoteTemplates();
    source.savedViews = Array.isArray(source.savedViews) ? source.savedViews : [];
    source.routes = Array.isArray(source.routes) ? source.routes : [];
    source.version = 3;
    return source;
  }

  function importPayload(mode){
    if (!ui.pendingRestore) return;
    if (mode === 'merge') state = mergeImportedState(ui.pendingRestore);
    else state = replaceImportedState(ui.pendingRestore);
    setSelectedLead(state.leads[0]?.id || '');
    saveState(mode === 'merge' ? 'Backup merged' : 'Backup restored', { skipSnapshot:true });
    ui.pendingRestore = null;
    renderPage();
  }

  function exportLeadPack(ids){
    const selected = state.leads.filter((lead) => ids.includes(lead.id));
    const payload = {
      app:'Skye Lead Vault Lead Pack',
      exported_at: nowISO(),
      leads: selected,
      contacts: deriveContacts().filter((row) => ids.includes(row.leadId))
    };
    downloadText(`skye-lead-pack-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Lead pack exported');
  }

  function exportLeadDossier(lead){
    if (!lead) return;
    const pack = buildScriptPack(lead);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(lead.business)} dossier</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.5;color:#181818}h1,h2{margin:0 0 12px}section{margin-top:22px}ul{padding-left:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f7f7f7}</style></head><body><h1>${escapeHtml(lead.business)}</h1><p>Primary contact: ${escapeHtml(lead.primary_contact || '—')}<br>Email: ${escapeHtml(lead.email || '—')}<br>Phone: ${escapeHtml(lead.phone || '—')}<br>Territory: ${escapeHtml(lead.territory || lead.city || '—')}</p><section><h2>Lead details</h2><p>${textToHtml(lead.notes || 'No notes yet.')}</p></section><section><h2>Contacts</h2><ul>${(lead.contacts || []).map((c) => `<li>${escapeHtml(c.name)} — ${escapeHtml(c.role || '')} ${c.decision ? `(${escapeHtml(c.decision)})` : ''}</li>`).join('') || '<li>No linked contacts yet.</li>'}</ul></section><section><h2>Tasks</h2><ul>${(lead.tasks || []).map((t) => `<li>${escapeHtml(t.title)} — ${escapeHtml(fmtShort(t.due))} ${t.done ? '(done)' : ''}</li>`).join('') || '<li>No tasks yet.</li>'}</ul></section><section><h2>Recent activity</h2><ul>${(lead.logs || []).slice(0,8).map((log) => `<li>${escapeHtml(fmtDate(log.at))} — ${escapeHtml(log.type)} — ${escapeHtml(log.note || '')}</li>`).join('') || '<li>No activity yet.</li>'}</ul></section><section><h2>Script pack</h2>${pack.blocks.map((b) => `<h3>${escapeHtml(b.label)}</h3><p>${textToHtml(b.text)}</p>`).join('')}</section></body></html>`;
    downloadText(`${(lead.business || 'lead').replace(/[^a-z0-9]+/ig,'-').toLowerCase()}-dossier.html`, html, 'text/html');
    toast('Lead dossier exported');
  }

  function rescoreAll(){
    state.leads = state.leads.map(normalizeLead);
    saveState('Lead scores refreshed');
    renderPage();
  }

  function dashboardMarkup(){
    const m = metrics();
    const dueLeads = state.leads.filter((lead) => ['due','overdue'].includes(dueState(lead.next_followup)) && !['Won','Lost'].includes(lead.stage))
      .sort((a,b) => new Date(a.next_followup).getTime() - new Date(b.next_followup).getTime())
      .slice(0, 8);
    const stale = staleLeads().slice(0, 8);
    const dupes = duplicateGroups().slice(0, 6);
    const routes = state.routes.slice(0, 4);
    const activity = recentActivity(8);
    return `
      <div class="stack">
        <section class="kpi-grid">
          <div class="kpi"><div class="kpi-label">Total leads</div><div class="kpi-value" data-private="true">${m.total}</div><div class="kpi-sub">Stored locally on this device</div></div>
          <div class="kpi"><div class="kpi-label">Due today</div><div class="kpi-value" data-private="true">${m.dueToday}</div><div class="kpi-sub">Follow-ups due before tonight</div></div>
          <div class="kpi"><div class="kpi-label">Overdue</div><div class="kpi-value" data-private="true">${m.overdue}</div><div class="kpi-sub">Recovery lane needs these first</div></div>
          <div class="kpi"><div class="kpi-label">Open value</div><div class="kpi-value" data-private="true">${escapeHtml(fmtCurrency(m.openValue))}</div><div class="kpi-sub">Pipeline value still alive</div></div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">Daily command center</div><div class="card-sub">The next touches, the hottest leads, and the oldest neglected records.</div></div><div class="badge-row"><span class="file-pill" id="storageUsage">0 KB local</span><button class="btn btn-primary" data-action="open-lead-modal">+ New lead</button><button class="btn" data-action="goto-capture">Quick capture</button></div></div>
          <div class="metric-strip">
            <div class="metric-chip"><div class="small">Average score</div><div class="v" data-private="true">${m.avgScore}</div></div>
            <div class="metric-chip"><div class="small">Won</div><div class="v" data-private="true">${m.won}</div></div>
            <div class="metric-chip"><div class="small">Active</div><div class="v" data-private="true">${m.active}</div></div>
            <div class="metric-chip"><div class="small">Stale</div><div class="v" data-private="true">${m.stale}</div></div>
            <div class="metric-chip"><div class="small">Duplicate groups</div><div class="v" data-private="true">${m.duplicates}</div></div>
            <div class="metric-chip"><div class="small">Routes</div><div class="v" data-private="true">${state.routes.length}</div></div>
          </div>
        </section>

        <section class="split-3">
          <div class="card">
            <div class="card-head"><div><div class="card-title">Due queue</div><div class="card-sub">Who gets hit first.</div></div><button class="btn" onclick="window.location.href='leads.html'">Open ledger</button></div>
            <div class="stack">${dueLeads.length ? dueLeads.map((lead) => `
              <div class="list-card">
                <div class="lead-title">${escapeHtml(lead.business)}</div>
                <div class="lead-meta">${stageBadge(lead)} ${badge(lead.territory || lead.city || 'No territory')} ${badge(`Score ${lead.score}`)}</div>
                <div class="muted">${escapeHtml(lead.primary_contact || 'No contact')} • ${escapeHtml(fmtDate(lead.next_followup))}</div>
                <div class="inline-actions"><button class="btn btn-primary" data-action="select-lead" data-id="${lead.id}">Open</button><button class="btn" data-action="schedule-next" data-id="${lead.id}">+ Next</button><button class="btn btn-gold" data-action="log-touch" data-id="${lead.id}" data-type="Call">Log call</button></div>
              </div>`).join('') : `<div class="empty-state"><div class="card-title">Queue clear</div><div class="card-sub">No due or overdue work right now.</div></div>`}</div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Hot leads</div><div class="card-sub">Local scoring engine top picks.</div></div><button class="btn" data-action="rescore-all">Rescore</button></div>
            <div class="stack">${hotLeads().map((lead) => `
              <div class="list-card">
                <div class="lead-title">${escapeHtml(lead.business)}</div>
                <div class="lead-meta">${badge(`Score ${lead.score}`, 'good')} ${badge(lead.stage)} ${badge(fmtCurrency(lead.estimated_value))}</div>
                <div class="muted">${escapeHtml(lead.service || 'No service note yet')}</div>
                <div class="inline-actions"><button class="btn" data-action="open-dossier" data-id="${lead.id}">Dossier</button><button class="btn btn-gold" data-action="export-pack" data-id="${lead.id}">Pack</button></div>
              </div>`).join('')}</div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Dead-lead recovery lane</div><div class="card-sub">Leads untouched for ${Number(state.settings.recoveryDays || 30)}+ days.</div></div><button class="btn" onclick="window.location.href='playbooks.html'">Recovery scripts</button></div>
            <div class="stack">${stale.length ? stale.map((lead) => `
              <div class="list-card">
                <div class="lead-title">${escapeHtml(lead.business)}</div>
                <div class="lead-meta">${badge(`${daysBetween(lead.last_contacted_at || lead.updated_at)} days cold`, 'bad')} ${badge(lead.territory || lead.city || 'No territory')}</div>
                <div class="muted">${escapeHtml(lead.notes || 'No note yet.')}</div>
                <div class="inline-actions"><button class="btn btn-primary" data-action="log-touch" data-id="${lead.id}" data-type="Recovery">Revive</button><button class="btn" data-action="schedule-next" data-id="${lead.id}">Set follow-up</button></div>
              </div>`).join('') : `<div class="empty-state"><div class="card-title">Recovery lane clean</div><div class="card-sub">No stale open leads beyond your threshold.</div></div>`}</div>
          </div>
        </section>

        <section class="split-2">
          <div class="card">
            <div class="card-head"><div><div class="card-title">Duplicate radar</div><div class="card-sub">Smart duplicate detection by business, email, phone, and location.</div></div><button class="btn" onclick="window.location.href='leads.html'">Review</button></div>
            <div class="dupe-list">${dupes.length ? dupes.map((group, idx) => `
              <div class="dupe-card">
                <strong>Group ${idx + 1}</strong>
                <div class="badge-row">${group.map((lead) => badge(`${lead.business} • ${lead.primary_contact || 'No contact'}`)).join('')}</div>
                <div class="muted">${escapeHtml(group[0].email || group[0].phone || group[0].address || 'Potential overlap')}</div>
              </div>`).join('') : `<div class="empty-state"><div class="card-title">No duplicate groups</div><div class="card-sub">The duplicate radar is clear right now.</div></div>`}</div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Routes and recent activity</div><div class="card-sub">Territory packs and the latest work stamped into the vault.</div></div><button class="btn" onclick="window.location.href='routes.html'">Open routes</button></div>
            <div class="route-list">${routes.length ? routes.map((route) => `<div class="route-item"><div><div class="lead-title">${escapeHtml(route.name)}</div><div class="muted">${escapeHtml(route.territory || 'Mixed territory')} • ${route.leadIds.length} leads</div></div><div class="inline-actions"><button class="btn" data-action="export-route" data-id="${route.id}">Export</button></div></div>`).join('') : `<div class="notice">No route plans yet. Build them from the routes page by territory, city, or custom list.</div>`}</div>
            <hr class="sep">
            <div class="timeline">${activity.length ? activity.map((row) => `<div class="timeline-item"><div class="timeline-meta">${escapeHtml(fmtDate(row.at))} • ${escapeHtml(row.business)}</div><div class="timeline-note">${escapeHtml(row.type)} — ${escapeHtml(row.note || '')}</div></div>`).join('') : `<div class="empty-state"><div class="card-title">No activity yet</div><div class="card-sub">As you log calls, texts, and visits, they land here.</div></div>`}</div>
          </div>
        </section>
      </div>`;
  }

  function savedViewsOptions(){
    return `<option value="">Saved views</option>${state.savedViews.map((view) => `<option value="${view.id}" ${ui.filters.viewId === view.id ? 'selected' : ''}>${escapeHtml(view.name)}</option>`).join('')}`;
  }

  function filtersMarkup(){
    return `
      <div class="quickbar">
        <div class="filter-grid">
          <input class="input" id="filterSearch" placeholder="Search leads, notes, source, territory..." value="${escapeHtml(ui.filters.search)}">
          <select id="filterStage"><option>All</option>${stageOrder.map((stage) => `<option ${ui.filters.stage===stage?'selected':''}>${stage}</option>`).join('')}</select>
          <select id="filterDue">
            <option ${ui.filters.due==='All'?'selected':''}>All</option>
            <option value="due" ${ui.filters.due==='due'?'selected':''}>Due</option>
            <option value="overdue" ${ui.filters.due==='overdue'?'selected':''}>Overdue</option>
            <option value="future" ${ui.filters.due==='future'?'selected':''}>Future</option>
          </select>
          <select id="filterTerritory"><option>All</option>${uniqueTerritories().map((territory) => `<option ${ui.filters.territory===territory?'selected':''}>${escapeHtml(territory)}</option>`).join('')}</select>
          <select id="filterSort">
            <option value="score" ${ui.filters.sort==='score'?'selected':''}>Sort: score</option>
            <option value="value" ${ui.filters.sort==='value'?'selected':''}>Sort: value</option>
            <option value="next" ${ui.filters.sort==='next'?'selected':''}>Sort: next follow-up</option>
            <option value="updated" ${ui.filters.sort==='updated'?'selected':''}>Sort: updated</option>
            <option value="stale" ${ui.filters.sort==='stale'?'selected':''}>Sort: stale</option>
          </select>
          <select id="savedViewSelect">${savedViewsOptions()}</select>
        </div>
        <div class="saved-view-row" style="margin-top:10px">
          <div class="layout-tabs">
            <button class="btn ${ui.filters.layout==='table'?'btn-primary':''}" data-action="set-layout" data-layout="table">Table</button>
            <button class="btn ${ui.filters.layout==='cards'?'btn-primary':''}" data-action="set-layout" data-layout="cards">Cards</button>
            <button class="btn ${ui.filters.layout==='dossier'?'btn-primary':''}" data-action="set-layout" data-layout="dossier">Dossier</button>
          </div>
          <button class="btn" data-action="save-view">Save view</button>
          <button class="btn" data-action="delete-view">Delete view</button>
          <button class="btn btn-gold" data-action="export-filtered-pack">Export filtered pack</button>
          <button class="btn btn-primary" data-action="open-lead-modal">+ New lead</button>
        </div>
      </div>`;
  }

  function leadRowMarkup(lead){
    const dupe = duplicateMatchesFor(lead).length;
    return `<tr>
      <td><div class="title-row">${escapeHtml(lead.business)}</div><div class="muted">${escapeHtml(lead.service || 'No service note')}</div></td>
      <td data-private="true">${escapeHtml(lead.primary_contact || '—')}</td>
      <td><div class="badge-row">${stageBadge(lead)} ${dupe ? badge(`${dupe} dupes`, 'warn') : ''}</div></td>
      <td data-private="true">${lead.score}</td>
      <td data-private="true">${escapeHtml(fmtCurrency(lead.estimated_value))}</td>
      <td>${escapeHtml(lead.territory || lead.city || '—')}</td>
      <td>${escapeHtml(fmtShort(lead.next_followup))}</td>
      <td>
        <div class="inline-actions">
          <button class="btn" data-action="open-dossier" data-id="${lead.id}">Dossier</button>
          <button class="btn btn-primary" data-action="open-lead-modal" data-id="${lead.id}">Edit</button>
          <button class="btn btn-gold" data-action="export-pack" data-id="${lead.id}">Pack</button>
        </div>
      </td>
    </tr>`;
  }

  function leadCardMarkup(lead){
    const dupe = duplicateMatchesFor(lead).length;
    return `<div class="lead-card">
      <div class="lead-title">${escapeHtml(lead.business)}</div>
      <div class="lead-meta">${stageBadge(lead)} ${badge(`Score ${lead.score}`, lead.score >= 80 ? 'good' : '')} ${badge(lead.territory || lead.city || 'No territory')}</div>
      <div class="muted" data-private="true">${escapeHtml(lead.primary_contact || 'No contact')} • ${escapeHtml(lead.email || lead.phone || 'No direct line')}</div>
      <div class="notes">${escapeHtml(lead.notes || 'No notes yet.')}</div>
      <div class="badge-row">${lead.tags ? lead.tags.split(',').slice(0,3).map((tag) => badge(tag.trim())).join('') : ''}${dupe ? badge(`${dupe} dupes`, 'warn') : ''}</div>
      <div class="inline-actions"><button class="btn" data-action="open-dossier" data-id="${lead.id}">Dossier</button><button class="btn btn-primary" data-action="open-lead-modal" data-id="${lead.id}">Edit</button><button class="btn" data-action="schedule-next" data-id="${lead.id}">+ Next</button></div>
    </div>`;
  }

  function dossierMarkup(lead){
    if (!lead) return `<div class="card"><div class="empty-state"><div class="card-title">No lead selected</div><div class="card-sub">Select one from the left to open the dossier.</div></div></div>`;
    const pack = buildScriptPack(lead);
    const dupes = duplicateMatchesFor(lead);
    return `
      <div class="dossier">
        <section class="card">
          <div class="dossier-head">
            <div>
              <div class="page-kicker">Lead dossier</div>
              <div class="page-title" style="font-size:24px">${escapeHtml(lead.business)}</div>
              <div class="page-sub">${escapeHtml(lead.service || 'No service note yet.')}</div>
            </div>
            <div class="inline-actions">
              <button class="btn btn-primary" data-action="open-lead-modal" data-id="${lead.id}">Edit</button>
              <button class="btn" data-action="schedule-next" data-id="${lead.id}">Set next</button>
              <button class="btn btn-gold" data-action="export-dossier" data-id="${lead.id}">Export dossier</button>
            </div>
          </div>
          <div class="badge-row">${stageBadge(lead)} ${badge(`Score ${lead.score}`, lead.score >= 80 ? 'good' : '')} ${badge(fmtCurrency(lead.estimated_value))} ${dupes.length ? badge(`${dupes.length} duplicate matches`, 'warn') : ''}</div>
          <div class="key-grid" style="margin-top:14px">
            <div class="key-box"><div class="k">Primary contact</div><div class="v" data-private="true">${escapeHtml(lead.primary_contact || '—')}<br>${escapeHtml(lead.email || '—')}<br>${escapeHtml(lead.phone || '—')}</div></div>
            <div class="key-box"><div class="k">Location</div><div class="v">${escapeHtml(lead.address || '—')}<br>${escapeHtml(lead.city || '—')}<br>${escapeHtml(lead.territory || '—')}</div></div>
            <div class="key-box"><div class="k">Source + next action</div><div class="v">${escapeHtml(lead.source || '—')}<br>${escapeHtml(fmtDate(lead.next_followup))}<br>${escapeHtml(daysBetween(lead.last_contacted_at || lead.updated_at))} days since touch</div></div>
          </div>
          <hr class="sep">
          <div class="muted">${escapeHtml(lead.notes || 'No notes yet.')}</div>
        </section>

        ${dupes.length ? `<section class="card"><div class="card-head"><div><div class="card-title">Duplicate radar match</div><div class="card-sub">Possible overlap with existing records.</div></div></div><div class="dupe-list">${dupes.map((item) => `<div class="dupe-card"><strong>${escapeHtml(item.business)}</strong><div class="muted">${escapeHtml(item.primary_contact || 'No contact')} • ${escapeHtml(item.email || item.phone || item.address || 'No direct match detail')}</div><div class="inline-actions"><button class="btn" data-action="open-dossier" data-id="${item.id}">Open</button></div></div>`).join('')}</div></section>` : ''}

        <section class="split-3">
          <div class="card">
            <div class="card-head"><div><div class="card-title">Relationship map</div><div class="card-sub">Primary and linked contacts for this account.</div></div></div>
            <div class="contact-list">${(lead.contacts || []).length ? lead.contacts.map((contact) => `<div class="contact-item"><div><div class="lead-title">${escapeHtml(contact.name)}</div><div class="muted">${escapeHtml(contact.role || 'Contact')} ${contact.decision ? `• ${escapeHtml(contact.decision)}` : ''}<br>${escapeHtml(contact.email || '')} ${contact.phone ? `• ${escapeHtml(contact.phone)}` : ''}</div><div class="small">${escapeHtml(contact.notes || '')}</div></div><div class="inline-actions"><button class="btn" data-action="copy-contact" data-email="${escapeHtml(contact.email || '')}" data-phone="${escapeHtml(contact.phone || '')}">Copy</button><button class="btn btn-danger" data-action="remove-contact" data-lead-id="${lead.id}" data-contact-id="${contact.id}">Remove</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No linked contacts</div><div class="card-sub">Add decision makers, assistants, or front desk roles below.</div></div>`}</div>
            <hr class="sep">
            <div class="inline-form">
              <div><div class="small">Name</div><input class="input" id="contactName" placeholder="Contact name"></div>
              <div><div class="small">Role</div><input class="input" id="contactRole" placeholder="Owner / Manager"></div>
              <div><div class="small">Email</div><input class="input" id="contactEmail" placeholder="email"></div>
              <div><div class="small">Phone</div><input class="input" id="contactPhone" placeholder="phone"></div>
              <div><div class="small">Decision</div><input class="input" id="contactDecision" placeholder="Champion / Decision maker"></div>
              <div class="full"><div class="small">Notes</div><input class="input" id="contactNotes" placeholder="How they fit into this account"></div>
              <div><button class="btn btn-primary" data-action="add-contact" data-id="${lead.id}">Add contact</button></div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Tasks + follow-up scheduler</div><div class="card-sub">Local reminders and next actions for this one lead.</div></div></div>
            <div class="task-list">${(lead.tasks || []).length ? lead.tasks.map((task) => `<div class="task-item"><div><div class="lead-title">${escapeHtml(task.title)}</div><div class="muted">${escapeHtml(fmtDate(task.due))} ${task.notes ? `• ${escapeHtml(task.notes)}` : ''}</div></div><div class="inline-actions"><button class="btn ${task.done ? '' : 'btn-gold'}" data-action="toggle-task" data-lead-id="${lead.id}" data-task-id="${task.id}">${task.done ? 'Undo' : 'Done'}</button><button class="btn btn-danger" data-action="remove-task" data-lead-id="${lead.id}" data-task-id="${task.id}">Remove</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No tasks yet</div><div class="card-sub">Tasks become the local reminder queue when the app is open or installed.</div></div>`}</div>
            <hr class="sep">
            <div class="inline-form compact">
              <div class="wide"><div class="small">Task</div><input class="input" id="taskTitle" placeholder="What needs to happen?"></div>
              <div><div class="small">Due</div><input class="input" id="taskDue" type="datetime-local" value="${escapeHtml(isoToLocalInput(lead.next_followup || daysFromNowISO(1)))}"></div>
              <div><div class="small">Notes</div><input class="input" id="taskNotes" placeholder="Optional"></div>
              <div><button class="btn btn-primary" data-action="add-task" data-id="${lead.id}">Add task</button></div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Document vault</div><div class="card-sub">Attach lightweight docs, images, voice notes, and reference files locally.</div></div></div>
            <div class="attachment-list">${(lead.attachments || []).length ? lead.attachments.map((file) => `<div class="attachment-item"><div><div class="lead-title">${escapeHtml(file.name)}</div><div class="muted">${escapeHtml(file.kind || file.type || 'file')} • ${Math.round(Number(file.size || 0) / 1024)} KB • ${escapeHtml(fmtDate(file.added_at))}</div></div><div class="inline-actions"><button class="btn" data-action="download-attachment" data-lead-id="${lead.id}" data-attachment-id="${file.id}">Download</button><button class="btn btn-danger" data-action="remove-attachment" data-lead-id="${lead.id}" data-attachment-id="${file.id}">Remove</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">Vault empty</div><div class="card-sub">Keep it lightweight for browser storage. Great for quotes, photos, receipts, and voice notes.</div></div>`}</div>
            <hr class="sep">
            <div class="inline-actions"><input class="input" id="attachmentInput" type="file" multiple><button class="btn btn-primary" data-action="attach-files" data-id="${lead.id}">Attach selected files</button></div>
          </div>
        </section>

        <section class="split-2">
          <div class="card">
            <div class="card-head"><div><div class="card-title">Activity timeline</div><div class="card-sub">Every call, text, visit, recovery touch, or note stays on-record.</div></div></div>
            <div class="inline-actions"><button class="btn btn-gold" data-action="log-touch" data-id="${lead.id}" data-type="Call">Log call</button><button class="btn" data-action="log-touch" data-id="${lead.id}" data-type="Email">Log email</button><button class="btn" data-action="log-touch" data-id="${lead.id}" data-type="Text">Log text</button><button class="btn" data-action="log-touch" data-id="${lead.id}" data-type="Visit">Log visit</button></div>
            <div class="inline-form compact" style="margin-top:10px">
              <div class="wide"><div class="small">Custom note</div><input class="input" id="timelineNote" placeholder="Stamp a custom note into the record"></div>
              <div><button class="btn btn-primary" data-action="add-note-log" data-id="${lead.id}">Add note</button></div>
            </div>
            <hr class="sep">
            <div class="timeline">${(lead.logs || []).length ? lead.logs.map((log) => `<div class="timeline-item"><div class="timeline-meta">${escapeHtml(log.type)} • ${escapeHtml(fmtDate(log.at))}</div><div class="timeline-note">${escapeHtml(log.note || '')}</div></div>`).join('') : `<div class="empty-state"><div class="card-title">No activity yet</div><div class="card-sub">Use the quick log buttons to keep this record alive.</div></div>`}</div>
          </div>

          <div class="card">
            <div class="card-head"><div><div class="card-title">Script pack + quote history</div><div class="card-sub">Portable selling language and saved quotes for this record.</div></div></div>
            <div class="script-blocks">${pack.blocks.map((block) => `<div class="script-block"><div class="lead-title">${escapeHtml(block.label)}</div><div class="quote-preview">${escapeHtml(block.text)}</div><div class="inline-actions" style="margin-top:8px"><button class="btn" data-action="copy-script" data-text="${encodeURIComponent(block.text)}">Copy</button></div></div>`).join('')}</div>
            <hr class="sep">
            <div class="attachment-list">${(lead.quotes || []).length ? lead.quotes.map((quote) => `<div class="attachment-item"><div><div class="lead-title">${escapeHtml(quote.name || 'Saved quote')}</div><div class="muted">${escapeHtml(fmtDate(quote.created_at))} • ${escapeHtml(fmtCurrency(quote.total || 0))}</div></div><div class="inline-actions"><button class="btn" data-action="download-quote" data-lead-id="${lead.id}" data-quote-id="${quote.id}">Download</button><button class="btn btn-danger" data-action="remove-quote" data-lead-id="${lead.id}" data-quote-id="${quote.id}">Remove</button></div></div>`).join('') : `<div class="notice">No quotes saved yet. Build one from Playbook Studio and save it back onto this lead.</div>`}</div>
          </div>
        </section>
      </div>`;
  }

  function leadsMarkup(){
    const leads = filteredLeads();
    const current = getLead(ui.selectedLeadId) || leads[0] || null;
    if (current && current.id !== ui.selectedLeadId) setSelectedLead(current.id);
    if (ui.filters.layout === 'dossier') {
      return `<div class="stack">${filtersMarkup()}<div class="split-2"><div class="card"><div class="card-head"><div><div class="card-title">Lead list</div><div class="card-sub">${leads.length} results from current filters.</div></div></div><div class="stack">${leads.length ? leads.map((lead) => `<div class="list-card ${current && current.id===lead.id?'active':''}"><div class="lead-title">${escapeHtml(lead.business)}</div><div class="badge-row">${stageBadge(lead)} ${badge(`Score ${lead.score}`)} ${duplicateMatchesFor(lead).length ? badge(`${duplicateMatchesFor(lead).length} dupes`, 'warn') : ''}</div><div class="muted">${escapeHtml(lead.primary_contact || 'No contact')} • ${escapeHtml(lead.territory || lead.city || 'No territory')}</div><div class="inline-actions"><button class="btn btn-primary" data-action="open-dossier" data-id="${lead.id}">Open</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No results</div><div class="card-sub">Adjust filters or add a new lead.</div></div>`}</div></div><div>${dossierMarkup(current)}</div></div></div>`;
    }
    if (ui.filters.layout === 'cards') {
      return `<div class="stack">${filtersMarkup()}<div class="lead-grid">${leads.length ? leads.map(leadCardMarkup).join('') : `<div class="empty-state"><div class="card-title">No results</div><div class="card-sub">Adjust filters or add a new lead.</div></div>`}</div></div>`;
    }
    return `<div class="stack">${filtersMarkup()}<div class="card"><div class="card-head"><div><div class="card-title">Lead table</div><div class="card-sub">${leads.length} results from current filters.</div></div></div><div class="table-wrap"><table><thead><tr><th>Business</th><th>Contact</th><th>Stage</th><th>Score</th><th>Value</th><th>Territory</th><th>Next</th><th>Actions</th></tr></thead><tbody>${leads.length ? leads.map(leadRowMarkup).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="card-title">No results</div><div class="card-sub">Adjust filters or add a new lead.</div></div></td></tr>`}</tbody></table></div></div></div>`;
  }

  function pipelineMarkup(){
    const columns = stageOrder.map((stage) => {
      const items = state.leads.filter((lead) => lead.stage === stage).sort((a,b) => Number(b.score || 0) - Number(a.score || 0));
      return `<section class="stage-column" data-stage="${stage}">
        <div class="stage-head"><div class="stage-title">${escapeHtml(stage)}</div><div class="stage-count">${items.length}</div></div>
        <div class="dropzone" data-stage="${stage}">
          ${items.map((lead) => `<div class="pipeline-card" draggable="true" data-lead-id="${lead.id}">
            <div class="lead-title">${escapeHtml(lead.business)}</div>
            <div class="badge-row">${badge(`Score ${lead.score}`, lead.score >= 80 ? 'good' : '')} ${dueState(lead.next_followup)==='overdue' ? badge('Overdue', 'bad') : dueState(lead.next_followup)==='due' ? badge('Due', 'warn') : ''}</div>
            <div class="muted">${escapeHtml(lead.primary_contact || 'No contact')} • ${escapeHtml(lead.territory || lead.city || 'No territory')}</div>
            <div class="inline-actions"><button class="btn" data-action="open-dossier" data-id="${lead.id}">Open</button><button class="btn" data-action="schedule-next" data-id="${lead.id}">+ Next</button></div>
          </div>`).join('')}
        </div>
      </section>`;
    }).join('');
    return `<div class="stack"><div class="card"><div class="card-head"><div><div class="card-title">Drag-and-drop pipeline</div><div class="card-sub">Move records across stages. Every move is logged into the lead timeline.</div></div><div class="inline-actions"><button class="btn btn-primary" data-action="open-lead-modal">+ New lead</button><button class="btn" data-action="rescore-all">Rescore</button></div></div><div class="pipeline-board">${columns}</div></div></div>`;
  }

  function contactsMarkup(){
    const contacts = deriveContacts();
    return `<div class="stack"><div class="card"><div class="card-head"><div><div class="card-title">Contact hub</div><div class="card-sub">Relationship mapping by business, role, and decision layer.</div></div><button class="btn btn-gold" data-action="export-contacts-csv">Export CSV</button></div><div class="contact-list">${contacts.length ? contacts.map((contact) => `<div class="contact-item"><div><div class="lead-title">${escapeHtml(contact.business)}</div><div class="muted" data-private="true">${escapeHtml(contact.name || 'No name')} • ${escapeHtml(contact.role || 'Contact')} ${contact.decision ? `• ${escapeHtml(contact.decision)}` : ''}<br>${escapeHtml(contact.email || '—')} ${contact.phone ? `• ${escapeHtml(contact.phone)}` : ''}</div><div class="small">${escapeHtml(contact.territory || contact.city || 'No territory')}</div></div><div class="inline-actions"><button class="btn" data-action="copy-contact" data-email="${escapeHtml(contact.email || '')}" data-phone="${escapeHtml(contact.phone || '')}">Copy</button><button class="btn btn-primary" data-action="open-dossier" data-id="${contact.leadId}">Open lead</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No contacts yet</div><div class="card-sub">Contacts are derived from lead records and relationship maps.</div></div>`}</div></div></div>`;
  }

  function playbooksMarkup(){
    const lead = getLead(ui.currentQuoteLeadId) || state.leads[0] || null;
    const template = state.templates.find((x) => x.id === ui.currentScriptTemplateId) || state.templates[0];
    const generated = lead && template ? renderTemplate(template.body, lead) : '';
    const pack = buildScriptPack(lead);
    const quote = buildQuote(lead, ui.quoteDraftItems);
    return `<div class="stack">
      <div class="split-2">
        <div class="card">
          <div class="card-head"><div><div class="card-title">Script pack generator</div><div class="card-sub">Cold intro, voicemail, walk-in opener, callback, objections, and follow-up set.</div></div></div>
          <div class="form-grid">
            <div><div class="small">Lead</div><select id="playbookLeadSelect">${state.leads.map((item) => `<option value="${item.id}" ${lead && item.id===lead.id?'selected':''}>${escapeHtml(item.business)}</option>`).join('')}</select></div>
            <div><div class="small">Template</div><select id="scriptTemplateSelect">${state.templates.map((item) => `<option value="${item.id}" ${ui.currentScriptTemplateId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
            <div class="span-2"><div class="small">Generated template</div><div class="quote-preview">${escapeHtml(generated)}</div></div>
          </div>
          <div class="quote-actions" style="margin-top:12px"><button class="btn" data-action="copy-generated-template">Copy template</button><button class="btn btn-gold" data-action="copy-script-pack" data-id="${lead?.id || ''}">Copy full pack</button><button class="btn btn-primary" data-action="export-script-pack" data-id="${lead?.id || ''}">Export pack</button></div>
          <hr class="sep">
          <div class="script-blocks">${pack.blocks.map((block) => `<div class="script-block"><div class="lead-title">${escapeHtml(block.label)}</div><div class="quote-preview">${escapeHtml(block.text)}</div><div class="inline-actions" style="margin-top:8px"><button class="btn" data-action="copy-script" data-text="${encodeURIComponent(block.text)}">Copy</button></div></div>`).join('')}</div>
        </div>

        <div class="card">
          <div class="card-head"><div><div class="card-title">Offer + quote builder</div><div class="card-sub">Reusable quote templates, editable line items, exportable HTML, and save-back to the lead.</div></div></div>
          <div class="form-grid">
            <div><div class="small">Lead</div><select id="quoteLeadSelect">${state.leads.map((item) => `<option value="${item.id}" ${lead && item.id===lead.id?'selected':''}>${escapeHtml(item.business)}</option>`).join('')}</select></div>
            <div><div class="small">Quote template</div><select id="quoteTemplateSelect">${state.quoteTemplates.map((item) => `<option value="${item.id}" ${ui.currentQuoteTemplateId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
          </div>
          <div class="table-wrap" style="margin-top:12px"><table class="quote-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Line total</th><th></th></tr></thead><tbody id="quoteItemsBody">${ui.quoteDraftItems.map((item) => `<tr><td><input class="input" data-quote-field="label" data-item-id="${item.id}" value="${escapeHtml(item.label)}"></td><td><input class="input" data-quote-field="qty" data-item-id="${item.id}" type="number" min="0" value="${escapeHtml(item.qty)}"></td><td><input class="input" data-quote-field="price" data-item-id="${item.id}" type="number" min="0" step="50" value="${escapeHtml(item.price)}"></td><td>${escapeHtml(fmtCurrency(Number(item.qty || 0) * Number(item.price || 0)))}</td><td><button class="btn btn-danger" data-action="remove-quote-item" data-item-id="${item.id}">x</button></td></tr>`).join('')}</tbody></table></div>
          <div class="quote-actions" style="margin-top:10px"><button class="btn" data-action="add-quote-item">Add line</button><button class="btn" data-action="reset-quote-template">Reset from template</button></div>
          <hr class="sep">
          <div class="quote-total" data-private="true">${escapeHtml(fmtCurrency(quote.total))}</div>
          <div class="quote-preview" style="margin-top:12px">${escapeHtml(quote.text)}</div>
          <div class="quote-actions" style="margin-top:12px"><button class="btn" data-action="copy-quote-text">Copy quote</button><button class="btn btn-gold" data-action="download-quote-now">Download HTML</button><button class="btn btn-primary" data-action="save-quote-to-lead">Save to lead</button></div>
        </div>
      </div>
    </div>`;
  }

  function quickCaptureMarkup(){
    const presets = ['Walk-in', 'Call back', 'Quote needed', 'Not decision maker', 'Follow up Friday', 'Hot lead'];
    return `<div class="stack"><div class="capture-grid">
      <div class="capture-pad">
        <div class="card-head"><div><div class="card-title">Field quick-capture mode</div><div class="card-sub">Fast record creation for live use in the field.</div></div><button class="btn btn-primary" data-action="save-quick-capture">Save lead fast</button></div>
        <div class="form-grid">
          <div><div class="small">Business</div><input class="input" id="qcBusiness" placeholder="Business name"></div>
          <div><div class="small">Primary contact</div><input class="input" id="qcContact" placeholder="Contact name"></div>
          <div><div class="small">Phone</div><input class="input" id="qcPhone" placeholder="Phone"></div>
          <div><div class="small">Email</div><input class="input" id="qcEmail" placeholder="Email"></div>
          <div><div class="small">Address</div><input class="input" id="qcAddress" placeholder="Address"></div>
          <div><div class="small">City</div><input class="input" id="qcCity" placeholder="${escapeHtml(state.settings.defaultCity)}"></div>
          <div><div class="small">Territory</div><input class="input" id="qcTerritory" placeholder="Territory"></div>
          <div><div class="small">Value guess</div><input class="input" id="qcValue" type="number" min="0" step="100" placeholder="0"></div>
          <div><div class="small">Stage</div><select id="qcStage">${stageOrder.map((stage) => `<option ${stage==='Prospect'?'selected':''}>${stage}</option>`).join('')}</select></div>
          <div><div class="small">Next follow-up</div><input class="input" id="qcNext" type="datetime-local" value="${escapeHtml(isoToLocalInput(daysFromNowISO(1)))}"></div>
          <div class="span-2"><div class="small">Quick notes</div><textarea id="qcNotes" placeholder="What happened? What matters? Who blocked or opened the door?"></textarea></div>
        </div>
        <div class="section-title">Fast note stamps</div>
        <div class="capture-note-tiles">${presets.map((item) => `<button class="capture-tile ${ui.quickCapture.noteType===item?'active':''}" data-action="set-qc-note-type" data-note-type="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}</div>
        <div class="capture-actions">
          <button class="btn" data-action="append-qc-note">Append stamp</button>
          <button class="btn btn-gold" data-action="start-voice-note">Record voice</button>
          <button class="btn" data-action="stop-voice-note">Stop voice</button>
        </div>
      </div>

      <div class="capture-pad">
        <div class="card-head"><div><div class="card-title">Offline attachments</div><div class="card-sub">Photo notes, uploaded docs, and voice notes packed into the new record.</div></div></div>
        <div class="inline-actions"><input class="input" id="qcFiles" type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.csv,audio/*"><button class="btn btn-primary" data-action="stage-qc-files">Stage files</button></div>
        <div class="notice">Best results come from lightweight files. This vault is optimized for field packs, not giant archives.</div>
        <div class="attachment-list" id="qcAttachmentPreview">${renderQuickCaptureAttachmentPreview()}</div>
      </div>
    </div></div>`;
  }

  function renderQuickCaptureAttachmentPreview(){
    const staged = [...ui.quickCapture.attachments, ...(ui.quickCapture.voiceAttachment ? [ui.quickCapture.voiceAttachment] : [])];
    return staged.length ? staged.map((file) => `<div class="attachment-item"><div><div class="lead-title">${escapeHtml(file.name)}</div><div class="muted">${escapeHtml(file.kind || file.type || 'file')} • ${Math.round(Number(file.size || 0)/1024)} KB</div></div><div class="inline-actions"><button class="btn btn-danger" data-action="remove-qc-file" data-file-id="${file.id}">Remove</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No staged files</div><div class="card-sub">Add photos, small docs, or a voice note and they will follow the new record into the vault.</div></div>`;
  }

  function routesMarkup(){
    const territoryOptions = uniqueTerritories();
    return `<div class="stack">
      <div class="split-2">
        <div class="card">
          <div class="card-head"><div><div class="card-title">Create route plan</div><div class="card-sub">Assemble a territory or city run without online maps.</div></div></div>
          <div class="form-grid">
            <div><div class="small">Route name</div><input class="input" id="routeName" placeholder="Friday West Valley run"></div>
            <div><div class="small">Territory</div><select id="routeTerritory"><option value="">Mixed / manual</option>${territoryOptions.map((territory) => `<option>${escapeHtml(territory)}</option>`).join('')}</select></div>
            <div><div class="small">City filter</div><select id="routeCity"><option value="">Any city</option>${uniqueCities().map((city) => `<option>${escapeHtml(city)}</option>`).join('')}</select></div>
            <div><div class="small">Stage filter</div><select id="routeStage"><option value="">Any stage</option>${stageOrder.map((stage) => `<option>${escapeHtml(stage)}</option>`).join('')}</select></div>
            <div class="span-2"><div class="small">Notes</div><input class="input" id="routeNotes" placeholder="Door-to-door, callbacks, or recovery pass"></div>
          </div>
          <hr class="sep">
          <div class="section-title">Leads in plan</div>
          <div class="check-list" id="routeCandidateList">${routeCandidateMarkup()}</div>
          <div class="route-actions" style="margin-top:12px"><button class="btn btn-primary" data-action="save-route">Save route</button><button class="btn" data-action="refresh-route-candidates">Refresh candidates</button></div>
        </div>

        <div class="card">
          <div class="card-head"><div><div class="card-title">Saved route plans</div><div class="card-sub">Portable run sheets for offline field work.</div></div></div>
          <div class="route-plan-grid">${state.routes.length ? state.routes.map((route) => `<div class="route-item"><div><div class="lead-title">${escapeHtml(route.name)}</div><div class="muted">${escapeHtml(route.territory || 'Mixed route')} • ${route.leadIds.length} leads<br>${escapeHtml(route.notes || '')}</div></div><div class="inline-actions"><button class="btn" data-action="export-route" data-id="${route.id}">Export</button><button class="btn btn-danger" data-action="delete-route" data-id="${route.id}">Delete</button></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No routes yet</div><div class="card-sub">Use the filters on the left, check your leads, and save a plan.</div></div>`}</div>
        </div>
      </div>
    </div>`;
  }

  function routeCandidateMarkup(){
    const territory = $('#routeTerritory')?.value || '';
    const city = $('#routeCity')?.value || '';
    const stage = $('#routeStage')?.value || '';
    const candidates = state.leads.filter((lead) => (!territory || lead.territory === territory) && (!city || lead.city === city) && (!stage || lead.stage === stage));
    return candidates.length ? candidates.map((lead) => `<label class="check-item"><input type="checkbox" class="route-lead-check" value="${lead.id}" checked><div><div class="lead-title">${escapeHtml(lead.business)}</div><div class="muted">${escapeHtml(lead.primary_contact || 'No contact')} • ${escapeHtml(lead.territory || lead.city || 'No territory')} • ${escapeHtml(fmtCurrency(lead.estimated_value))}</div></div></label>`).join('') : `<div class="notice">No leads match the current route filters.</div>`;
  }

  function analyticsMarkup(){
    const stageCounts = stageOrder.map((stage) => ({ label:stage, value: state.leads.filter((lead) => lead.stage === stage).length }));
    const sourceCounts = Array.from(new Map(state.leads.map((lead) => [lead.source || 'Unknown', 0]))).map(([label]) => ({ label, value: state.leads.filter((lead) => (lead.source || 'Unknown') === label).length })).sort((a,b) => b.value - a.value).slice(0,6);
    const territoryCounts = uniqueTerritories().map((territory) => ({ label:territory, value: state.leads.filter((lead) => lead.territory === territory).length })).sort((a,b) => b.value - a.value).slice(0,6);
    const activityDays = Array.from({length:7}).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const value = state.leads.flatMap((lead) => lead.logs || []).filter((log) => {
        const t = new Date(log.at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      return { label:d.toLocaleDateString([], { month:'short', day:'numeric' }), value };
    });
    const max = (rows) => Math.max(1, ...rows.map((row) => row.value));
    const barSet = (rows) => `<div class="bar-chart">${rows.map((row) => `<div class="bar-row"><div class="bar-label">${escapeHtml(row.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${(row.value / max(rows)) * 100}%"></div></div><div class="bar-value">${row.value}</div></div>`).join('')}</div>`;
    const m = metrics();
    return `<div class="stack">
      <section class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Average score</div><div class="kpi-value" data-private="true">${m.avgScore}</div><div class="kpi-sub">Lead scoring engine snapshot</div></div>
        <div class="kpi"><div class="kpi-label">Open value</div><div class="kpi-value" data-private="true">${escapeHtml(fmtCurrency(m.openValue))}</div><div class="kpi-sub">All non-lost opportunity</div></div>
        <div class="kpi"><div class="kpi-label">Stale leads</div><div class="kpi-value" data-private="true">${m.stale}</div><div class="kpi-sub">Recovery threshold ${state.settings.recoveryDays} days</div></div>
        <div class="kpi"><div class="kpi-label">Duplicate groups</div><div class="kpi-value" data-private="true">${m.duplicates}</div><div class="kpi-sub">Needs review or merge</div></div>
      </section>
      <section class="split-2">
        <div class="card"><div class="card-head"><div><div class="card-title">Stage distribution</div><div class="card-sub">Where the pipeline is sitting right now.</div></div></div>${barSet(stageCounts)}</div>
        <div class="card"><div class="card-head"><div><div class="card-title">Activity last 7 days</div><div class="card-sub">Every stamped action in the timeline.</div></div></div>${barSet(activityDays)}</div>
      </section>
      <section class="split-2">
        <div class="card"><div class="card-head"><div><div class="card-title">Source mix</div><div class="card-sub">Where your records are coming from.</div></div></div>${barSet(sourceCounts)}</div>
        <div class="card"><div class="card-head"><div><div class="card-title">Territory concentration</div><div class="card-sub">How your vault is distributed geographically.</div></div></div>${barSet(territoryCounts)}</div>
      </section>
    </div>`;
  }

  function backupsMarkup(){
    const snaps = getLightSnapshots();
    const preview = ui.pendingRestore;
    return `<div class="stack">
      <div class="split-2">
        <div class="card">
          <div class="card-head"><div><div class="card-title">Backup export</div><div class="card-sub">Plain JSON, encrypted JSON, and current local snapshot history.</div></div></div>
          <div class="notice">Encrypted backups use AES-GCM with a passphrase you choose at export time. Keep that passphrase safe — this app cannot recover it for you.</div>
          <div class="quote-actions" style="margin-top:12px"><button class="btn btn-primary" data-action="export-backup">Export plain</button><button class="btn btn-gold" data-action="export-backup-encrypted">Export encrypted</button><button class="btn" data-action="reset-vault">Reset local vault</button></div>
          <hr class="sep">
          <div class="card-title">Lightweight local snapshots</div>
          <div class="attachment-list" style="margin-top:10px">${snaps.length ? snaps.map((snap) => `<div class="attachment-item"><div><div class="lead-title">${escapeHtml(snap.reason)}</div><div class="muted">${escapeHtml(fmtDate(snap.at))} • ${snap.lead_count} leads • ${escapeHtml(fmtCurrency(snap.open_value))}</div></div></div>`).join('') : `<div class="empty-state"><div class="card-title">No snapshots yet</div><div class="card-sub">Snapshots are created automatically as you work.</div></div>`}</div>
        </div>

        <div class="card">
          <div class="card-head"><div><div class="card-title">Restore preview</div><div class="card-sub">Load a backup file, preview what is inside, then merge or replace.</div></div></div>
          <div class="inline-actions"><input class="input" id="restoreFileInput" type="file" accept=".json"><button class="btn btn-primary" data-action="load-restore-file">Load file</button></div>
          ${preview ? `<div class="success" style="margin-top:12px">Loaded backup from ${escapeHtml(fmtDate(preview.exported_at || preview.data?.updated_at || nowISO()))}</div>
            <div class="key-grid" style="margin-top:12px">
              <div class="key-box"><div class="k">Leads</div><div class="v">${(preview.data?.leads || preview.leads || []).length}</div></div>
              <div class="key-box"><div class="k">Routes</div><div class="v">${(preview.data?.routes || preview.routes || []).length}</div></div>
              <div class="key-box"><div class="k">Templates</div><div class="v">${(preview.data?.templates || preview.templates || []).length}</div></div>
            </div>
            <div class="quote-actions" style="margin-top:12px"><button class="btn btn-gold" data-action="restore-merge">Merge restore</button><button class="btn btn-danger" data-action="restore-replace">Replace current vault</button><button class="btn" data-action="clear-restore-preview">Clear preview</button></div>` : `<div class="notice" style="margin-top:12px">No restore file loaded yet.</div>`}
        </div>
      </div>
    </div>`;
  }

  function settingsMarkup(){
    return `<div class="stack">
      <div class="split-2">
        <div class="card">
          <div class="card-head"><div><div class="card-title">Identity + default behavior</div><div class="card-sub">Signature, default city/source, follow-up presets, and recovery threshold.</div></div></div>
          <div class="form-grid">
            <div><div class="small">Your name</div><input class="input" id="setMe" value="${escapeHtml(state.settings.me)}"></div>
            <div><div class="small">Company</div><input class="input" id="setCompany" value="${escapeHtml(state.settings.company)}"></div>
            <div><div class="small">Default city</div><input class="input" id="setDefaultCity" value="${escapeHtml(state.settings.defaultCity)}"></div>
            <div><div class="small">Default source</div><input class="input" id="setDefaultSource" value="${escapeHtml(state.settings.defaultSource)}"></div>
            <div><div class="small">Follow-up presets</div><input class="input" id="setPresets" value="${escapeHtml((state.settings.followupPresetsDays || []).join(', '))}"></div>
            <div><div class="small">Recovery days</div><input class="input" id="setRecoveryDays" type="number" min="7" value="${escapeHtml(state.settings.recoveryDays)}"></div>
            <div class="span-2"><div class="small">Signature block</div><textarea id="setSignature">${escapeHtml(state.settings.signature)}</textarea></div>
            <div class="span-2"><div class="small">Notes</div><textarea id="setNotes">${escapeHtml(state.settings.notes || '')}</textarea></div>
          </div>
          <div class="quote-actions" style="margin-top:12px"><button class="btn btn-primary" data-action="save-settings">Save settings</button><button class="btn" data-action="request-reminders">Enable reminders</button></div>
        </div>

        <div class="card">
          <div class="card-head"><div><div class="card-title">Background studio + privacy</div><div class="card-sub">Keep the UI glass, switch the background, and manage local app lock.</div></div></div>
          <div class="form-grid">
            <div><div class="small">UI tint</div><input class="input" id="setUiTint" value="${escapeHtml(state.settings.uiTint)}"></div>
            <div><div class="small">Glow tint</div><input class="input" id="setGlow" value="${escapeHtml(state.settings.pageGlow)}"></div>
            <div class="span-2"><div class="small">Custom background image</div><input class="input" id="bgImageInput" type="file" accept="image/*"></div>
            <div><button class="btn btn-primary" data-action="save-visuals">Save visuals</button></div>
            <div><button class="btn" data-action="clear-background">Use gradient</button></div>
          </div>
          <hr class="sep">
          <div class="section-title">App lock</div>
          <div class="inline-form compact" style="margin-top:10px">
            <div><div class="small">Set / change PIN</div><input class="input" id="pinInput" type="password" placeholder="4+ digit PIN"></div>
            <div><button class="btn btn-primary" data-action="set-pin">Set PIN</button></div>
            <div><button class="btn btn-danger" data-action="clear-pin">Clear PIN</button></div>
          </div>
          <hr class="sep">
          <div class="inline-actions"><button class="toggle ${state.settings.privacyMode ? 'active' : ''}" data-action="toggle-privacy">${state.settings.privacyMode ? 'Privacy mode on' : 'Privacy mode off'}</button><button class="btn" data-action="lock-now">Lock now</button></div>
        </div>
      </div>
    </div>`;
  }

  function renderPage(){
    applyMeta();
    applyBackground();
    syncShell();
    const root = $('#pageRoot');
    if (!root) return;
    if (page === 'dashboard') root.innerHTML = dashboardMarkup();
    else if (page === 'leads') root.innerHTML = leadsMarkup();
    else if (page === 'pipeline') root.innerHTML = pipelineMarkup();
    else if (page === 'contacts') root.innerHTML = contactsMarkup();
    else if (page === 'playbooks') root.innerHTML = playbooksMarkup();
    else if (page === 'capture') root.innerHTML = quickCaptureMarkup();
    else if (page === 'routes') root.innerHTML = routesMarkup();
    else if (page === 'analytics') root.innerHTML = analyticsMarkup();
    else if (page === 'backups') root.innerHTML = backupsMarkup();
    else if (page === 'settings') root.innerHTML = settingsMarkup();
    bindPageEnhancements();
  }

  function bindPageEnhancements(){
    if (page === 'pipeline') {
      $$('.pipeline-card').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain', card.dataset.leadId);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
      });
      $$('.dropzone').forEach((zone) => {
        zone.addEventListener('dragover', (e) => e.preventDefault());
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          const lead = getLead(id);
          if (!lead) return;
          lead.stage = zone.dataset.stage;
          lead.logs.unshift({ id:uid(), at:nowISO(), type:'Stage move', note:`Moved to ${zone.dataset.stage}` });
          upsertLead(lead, `Moved to ${zone.dataset.stage}`);
        });
      });
    }
    if (page === 'routes') {
      ['#routeTerritory', '#routeCity', '#routeStage'].forEach((sel) => {
        $(sel)?.addEventListener('change', () => {
          const box = $('#routeCandidateList');
          if (box) box.innerHTML = routeCandidateMarkup();
        });
      });
    }
  }

  function openLeadModal(id=''){
    const isNew = !id;
    const lead = isNew ? normalizeLead({
      id:uid(),
      business:'',
      primary_contact:'',
      city:state.settings.defaultCity || '',
      source:state.settings.defaultSource || '',
      next_followup:daysFromNowISO((state.settings.followupPresetsDays || [3])[0] || 3),
      created_at:nowISO(),
      updated_at:nowISO(),
      contacts:[],
      tasks:[],
      attachments:[],
      logs:[]
    }) : clone(getLead(id));
    if (!lead) return;
    $('#modalBackdrop').classList.add('show');
    $('#modalTitle').textContent = isNew ? 'New lead' : (lead.business || 'Edit lead');
    $('#modalSub').textContent = isNew ? 'Add a real offline record.' : 'Edit the core record quickly.';
    $('#modalDeleteBtn').classList.toggle('hidden', isNew);
    $('#modalDeleteBtn').dataset.id = lead.id;
    $('#modalSaveBtn').dataset.id = lead.id;
    $('#modalBody').innerHTML = `
      <div class="form-grid">
        <div><div class="small">Business</div><input class="input" id="mBusiness" value="${escapeHtml(lead.business)}"></div>
        <div><div class="small">Primary contact</div><input class="input" id="mContact" value="${escapeHtml(lead.primary_contact)}"></div>
        <div><div class="small">Email</div><input class="input" id="mEmail" value="${escapeHtml(lead.email)}"></div>
        <div><div class="small">Phone</div><input class="input" id="mPhone" value="${escapeHtml(lead.phone)}"></div>
        <div><div class="small">Website</div><input class="input" id="mWebsite" value="${escapeHtml(lead.website)}"></div>
        <div><div class="small">Address</div><input class="input" id="mAddress" value="${escapeHtml(lead.address)}"></div>
        <div><div class="small">City</div><input class="input" id="mCity" value="${escapeHtml(lead.city)}"></div>
        <div><div class="small">Territory</div><input class="input" id="mTerritory" value="${escapeHtml(lead.territory)}"></div>
        <div><div class="small">Source</div><input class="input" id="mSource" value="${escapeHtml(lead.source)}"></div>
        <div><div class="small">Stage</div><select id="mStage">${stageOrder.map((stage) => `<option ${lead.stage===stage?'selected':''}>${stage}</option>`).join('')}</select></div>
        <div><div class="small">Priority</div><select id="mPriority"><option value="1" ${String(lead.priority)==='1'?'selected':''}>1 — High</option><option value="2" ${String(lead.priority)==='2'?'selected':''}>2 — Normal</option><option value="3" ${String(lead.priority)==='3'?'selected':''}>3 — Lower</option></select></div>
        <div><div class="small">Estimated value</div><input class="input" id="mValue" type="number" min="0" step="100" value="${escapeHtml(lead.estimated_value)}"></div>
        <div><div class="small">Manual score boost</div><input class="input" id="mBoost" type="number" min="-20" max="20" value="${escapeHtml(lead.manual_boost || 0)}"></div>
        <div><div class="small">Next follow-up</div><input class="input" id="mNext" type="datetime-local" value="${escapeHtml(isoToLocalInput(lead.next_followup))}"></div>
        <div class="span-2"><div class="small">Service / offer</div><input class="input" id="mService" value="${escapeHtml(lead.service)}"></div>
        <div class="span-2"><div class="small">Tags</div><input class="input" id="mTags" value="${escapeHtml(lead.tags)}"></div>
        <div class="span-2"><div class="small">Value-add link</div><input class="input" id="mLink" value="${escapeHtml(lead.link || '')}"></div>
        <div class="span-2"><div class="small">Notes</div><textarea id="mNotes">${escapeHtml(lead.notes)}</textarea></div>
      </div>`;
  }

  function readLeadModal(id){
    const existing = getLead(id);
    return normalizeLead({
      ...(existing || { id, created_at: nowISO(), contacts:[], tasks:[], attachments:[], logs:[], quotes:[] }),
      id,
      business: $('#mBusiness').value.trim(),
      primary_contact: $('#mContact').value.trim(),
      email: $('#mEmail').value.trim(),
      phone: $('#mPhone').value.trim(),
      website: $('#mWebsite').value.trim(),
      address: $('#mAddress').value.trim(),
      city: $('#mCity').value.trim(),
      territory: $('#mTerritory').value.trim(),
      source: $('#mSource').value.trim(),
      stage: $('#mStage').value,
      priority: Number($('#mPriority').value || 2),
      estimated_value: Number($('#mValue').value || 0),
      manual_boost: Number($('#mBoost').value || 0),
      next_followup: localInputToISO($('#mNext').value),
      service: $('#mService').value.trim(),
      tags: $('#mTags').value.trim(),
      link: $('#mLink').value.trim(),
      notes: $('#mNotes').value.trim(),
      updated_at: nowISO()
    });
  }

  function closeModal(){
    $('#modalBackdrop').classList.remove('show');
  }

  function applyFiltersFromInputs(){
    ui.filters.search = $('#filterSearch')?.value.trim() || '';
    ui.filters.stage = $('#filterStage')?.value || 'All';
    ui.filters.due = $('#filterDue')?.value || 'All';
    ui.filters.territory = $('#filterTerritory')?.value || 'All';
    ui.filters.sort = $('#filterSort')?.value || 'score';
    ui.filters.viewId = $('#savedViewSelect')?.value || '';
  }

  function applySavedView(id){
    const view = state.savedViews.find((v) => v.id === id);
    if (!view) return;
    ui.filters = { ...ui.filters, ...(view.filters || {}), viewId:id };
    renderPage();
  }

  function saveCurrentView(){
    const name = prompt('Name this saved view');
    if (!name) return;
    applyFiltersFromInputs();
    const record = { id: uid(), name, filters: clone({ ...ui.filters }) };
    state.savedViews.unshift(record);
    saveState('View saved');
    renderPage();
  }

  function deleteCurrentView(){
    if (!ui.filters.viewId) return toast('No saved view selected.');
    state.savedViews = state.savedViews.filter((view) => view.id !== ui.filters.viewId);
    ui.filters.viewId = '';
    saveState('View deleted');
    renderPage();
  }

  async function attachFilesToLead(leadId, fileList){
    const lead = getLead(leadId);
    if (!lead) return;
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (file.size > 2.5 * 1024 * 1024) {
        toast(`${file.name} skipped — keep files lightweight.`);
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      lead.attachments.unshift({
        id:uid(),
        name:file.name,
        type:file.type || 'application/octet-stream',
        size:file.size,
        kind:file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'file',
        dataUrl,
        added_at:nowISO()
      });
    }
    upsertLead(lead, 'Files attached');
  }

  async function stageQuickCaptureFiles(fileList){
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (file.size > 2.5 * 1024 * 1024) {
        toast(`${file.name} skipped — keep files lightweight.`);
        continue;
      }
      ui.quickCapture.attachments.push({
        id:uid(),
        name:file.name,
        type:file.type || 'application/octet-stream',
        size:file.size,
        kind:file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'file',
        dataUrl: await fileToDataUrl(file),
        added_at:nowISO()
      });
    }
    renderPage();
  }

  async function startVoiceNote(){
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice notes are not supported in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type:'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        ui.quickCapture.voiceAttachment = { id:uid(), name:`voice-note-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`, type:'audio/webm', size:blob.size, kind:'audio', dataUrl:reader.result, added_at:nowISO() };
        renderPage();
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    ui.quickCapture.recorder = recorder;
    toast('Voice recording started');
  }

  function stopVoiceNote(){
    if (!ui.quickCapture.recorder) return toast('No recording in progress.');
    ui.quickCapture.recorder.stop();
    ui.quickCapture.recorder = null;
    toast('Voice note staged');
  }

  function saveQuickCapture(){
    const business = $('#qcBusiness')?.value.trim();
    if (!business) return toast('Business name is required.');
    const lead = normalizeLead({
      id:uid(),
      business,
      primary_contact: $('#qcContact').value.trim(),
      email: $('#qcEmail').value.trim(),
      phone: $('#qcPhone').value.trim(),
      address: $('#qcAddress').value.trim(),
      city: $('#qcCity').value.trim() || state.settings.defaultCity || '',
      territory: $('#qcTerritory').value.trim(),
      source: state.settings.defaultSource || 'Field outreach',
      stage: $('#qcStage').value,
      priority:1,
      estimated_value:Number($('#qcValue').value || 0),
      service:'',
      tags: ui.quickCapture.noteType.toLowerCase(),
      notes: $('#qcNotes').value.trim(),
      next_followup: localInputToISO($('#qcNext').value),
      last_contacted_at: nowISO(),
      created_at: nowISO(),
      updated_at: nowISO(),
      contacts:[],
      attachments:[...ui.quickCapture.attachments, ...(ui.quickCapture.voiceAttachment ? [ui.quickCapture.voiceAttachment] : [])],
      tasks:[],
      logs:[{ id:uid(), at:nowISO(), type:'Quick capture', note: ui.quickCapture.noteType }]
    });
    state.leads.unshift(lead);
    ui.quickCapture = { noteType:'Walk-in', attachments:[], voiceAttachment:null, recorder:null };
    setSelectedLead(lead.id);
    saveState('Quick capture saved');
    renderPage();
  }

  function exportRoute(routeId){
    const route = state.routes.find((x) => x.id === routeId);
    if (!route) return;
    const leads = state.leads.filter((lead) => route.leadIds.includes(lead.id));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(route.name)}</title><style>body{font-family:Arial,sans-serif;padding:32px}h1{margin:0 0 10px}section{margin-top:22px;padding:16px;border:1px solid #ddd;border-radius:14px}</style></head><body><h1>${escapeHtml(route.name)}</h1><p>${escapeHtml(route.territory || 'Mixed territory')} • ${leads.length} leads</p>${leads.map((lead) => `<section><h2>${escapeHtml(lead.business)}</h2><p>${escapeHtml(lead.primary_contact || 'No contact')}<br>${escapeHtml(lead.phone || lead.email || '—')}<br>${escapeHtml(lead.address || '')}<br>${escapeHtml(lead.city || '')}</p><p>${escapeHtml(lead.notes || '')}</p></section>`).join('')}</body></html>`;
    downloadText(`${route.name.replace(/[^a-z0-9]+/ig,'-').toLowerCase()}.html`, html, 'text/html');
    toast('Route exported');
  }

  function saveRoute(){
    const name = $('#routeName')?.value.trim();
    if (!name) return toast('Route name required.');
    const leadIds = $$('.route-lead-check').filter((x) => x.checked).map((x) => x.value);
    if (!leadIds.length) return toast('Choose at least one lead.');
    state.routes.unshift({
      id:uid(),
      name,
      territory: $('#routeTerritory')?.value || '',
      notes: $('#routeNotes')?.value.trim() || '',
      leadIds,
      created_at:nowISO(),
      updated_at:nowISO()
    });
    saveState('Route saved');
    renderPage();
  }

  function exportContactsCsv(){
    const rows = [['Business','Name','Role','Decision','Email','Phone','Territory','City']];
    deriveContacts().forEach((item) => rows.push([item.business, item.name, item.role, item.decision, item.email, item.phone, item.territory, item.city]));
    downloadText('skye-lead-vault-contacts.csv', toCSV(rows), 'text/csv');
    toast('Contacts CSV exported');
  }

  function saveSettingsFromInputs(){
    state.settings.me = $('#setMe').value.trim();
    state.settings.company = $('#setCompany').value.trim();
    state.settings.defaultCity = $('#setDefaultCity').value.trim();
    state.settings.defaultSource = $('#setDefaultSource').value.trim();
    state.settings.followupPresetsDays = ($('#setPresets').value || '').split(',').map((x) => Number(x.trim())).filter((n) => n > 0);
    if (!state.settings.followupPresetsDays.length) state.settings.followupPresetsDays = [1,3,7,14,30];
    state.settings.recoveryDays = Number($('#setRecoveryDays').value || 30);
    state.settings.signature = $('#setSignature').value;
    state.settings.notes = $('#setNotes').value;
    saveState('Settings saved');
    renderPage();
  }

  async function saveVisualsFromInputs(){
    state.settings.uiTint = $('#setUiTint').value.trim() || 'rgba(112,73,196,.16)';
    state.settings.pageGlow = $('#setGlow').value.trim() || 'rgba(244,196,78,.10)';
    const bgFile = $('#bgImageInput')?.files?.[0];
    if (bgFile) {
      if (bgFile.size > 3 * 1024 * 1024) return toast('Background image too large. Keep it under 3 MB.');
      state.settings.backgroundImageDataUrl = await fileToDataUrl(bgFile);
      state.settings.backgroundMode = 'image';
    }
    saveState('Visuals saved');
    renderPage();
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'open-lead-modal') return openLeadModal(btn.dataset.id || '');
    if (action === 'select-lead' || action === 'open-dossier') {
      setSelectedLead(btn.dataset.id);
      ui.filters.layout = 'dossier';
      sessionStorage.setItem('skye-lead-layout', ui.filters.layout);
      if (page !== 'leads') window.location.href = 'leads.html';
      else renderPage();
      return;
    }
    if (action === 'set-layout') {
      ui.filters.layout = btn.dataset.layout;
      sessionStorage.setItem('skye-lead-layout', ui.filters.layout);
      renderPage();
      return;
    }
    if (action === 'schedule-next') {
      const lead = getLead(btn.dataset.id);
      if (!lead) return;
      const presets = state.settings.followupPresetsDays || [3];
      lead.next_followup = daysFromNowISO(presets[0] || 3);
      lead.logs.unshift({ id:uid(), at:nowISO(), type:'Follow-up', note:`Next follow-up set +${presets[0] || 3}d` });
      upsertLead(lead, 'Follow-up scheduled');
      return;
    }
    if (action === 'log-touch') {
      const note = prompt(`Optional note for ${btn.dataset.type}`, '');
      addLog(btn.dataset.id, btn.dataset.type, note || `${btn.dataset.type} logged`);
      return;
    }
    if (action === 'export-pack') return exportLeadPack([btn.dataset.id]);
    if (action === 'export-dossier') return exportLeadDossier(getLead(btn.dataset.id));
    if (action === 'copy-contact') return copyText([btn.dataset.email, btn.dataset.phone].filter(Boolean).join(' / '), 'Contact copied.');
    if (action === 'copy-script') return copyText(decodeURIComponent(btn.dataset.text || ''), 'Script copied.');
    if (action === 'copy-script-pack') {
      const pack = buildScriptPack(getLead(btn.dataset.id));
      return copyText(pack.blocks.map((b) => `${b.label}\n${b.text}`).join('\n\n'), 'Script pack copied.');
    }
    if (action === 'export-script-pack') {
      const pack = buildScriptPack(getLead(btn.dataset.id));
      return downloadText(`${pack.title.replace(/[^a-z0-9]+/ig,'-').toLowerCase()}.txt`, pack.blocks.map((b) => `${b.label}\n${b.text}`).join('\n\n'));
    }
    if (action === 'copy-generated-template') {
      const lead = getLead($('#playbookLeadSelect')?.value || ui.currentQuoteLeadId);
      const template = state.templates.find((x) => x.id === (ui.currentScriptTemplateId || state.templates[0]?.id));
      return copyText(renderTemplate(template?.body || '', lead), 'Template copied.');
    }
    if (action === 'add-contact') {
      const lead = getLead(btn.dataset.id);
      if (!lead) return;
      const name = $('#contactName').value.trim();
      if (!name) return toast('Contact name required.');
      lead.contacts.push({ id:uid(), name, role:$('#contactRole').value.trim(), email:$('#contactEmail').value.trim(), phone:$('#contactPhone').value.trim(), decision:$('#contactDecision').value.trim(), notes:$('#contactNotes').value.trim() });
      upsertLead(lead, 'Contact added');
      return;
    }
    if (action === 'remove-contact') {
      const lead = getLead(btn.dataset.leadId);
      if (!lead) return;
      lead.contacts = (lead.contacts || []).filter((x) => x.id !== btn.dataset.contactId);
      upsertLead(lead, 'Contact removed');
      return;
    }
    if (action === 'add-task') {
      const lead = getLead(btn.dataset.id);
      if (!lead) return;
      const title = $('#taskTitle').value.trim();
      if (!title) return toast('Task title required.');
      lead.tasks.push({ id:uid(), title, due:localInputToISO($('#taskDue').value), done:false, notes:$('#taskNotes').value.trim() });
      upsertLead(lead, 'Task added');
      return;
    }
    if (action === 'toggle-task') {
      const lead = getLead(btn.dataset.leadId);
      if (!lead) return;
      const task = (lead.tasks || []).find((x) => x.id === btn.dataset.taskId);
      if (!task) return;
      task.done = !task.done;
      upsertLead(lead, task.done ? 'Task completed' : 'Task reopened');
      return;
    }
    if (action === 'remove-task') {
      const lead = getLead(btn.dataset.leadId);
      if (!lead) return;
      lead.tasks = (lead.tasks || []).filter((x) => x.id !== btn.dataset.taskId);
      upsertLead(lead, 'Task removed');
      return;
    }
    if (action === 'attach-files') {
      return attachFilesToLead(btn.dataset.id, $('#attachmentInput')?.files || []);
    }
    if (action === 'download-attachment') {
      const lead = getLead(btn.dataset.leadId);
      const file = (lead?.attachments || []).find((x) => x.id === btn.dataset.attachmentId);
      if (!file) return;
      const byteStr = atob(String(file.dataUrl).split(',')[1] || '');
      const mime = file.type || 'application/octet-stream';
      const arr = new Uint8Array(byteStr.length); for (let i=0;i<byteStr.length;i++) arr[i] = byteStr.charCodeAt(i);
      return downloadBlob(file.name, new Blob([arr], { type:mime }));
    }
    if (action === 'remove-attachment') {
      const lead = getLead(btn.dataset.leadId);
      if (!lead) return;
      lead.attachments = (lead.attachments || []).filter((x) => x.id !== btn.dataset.attachmentId);
      upsertLead(lead, 'Attachment removed');
      return;
    }
    if (action === 'add-note-log') {
      const note = $('#timelineNote').value.trim();
      if (!note) return toast('Note is empty.');
      addLog(btn.dataset.id, 'Note', note);
      return;
    }
    if (action === 'download-quote') {
      const lead = getLead(btn.dataset.leadId);
      const quote = (lead?.quotes || []).find((x) => x.id === btn.dataset.quoteId);
      if (!quote) return;
      return downloadText(`${(lead.business || 'lead').replace(/[^a-z0-9]+/ig,'-').toLowerCase()}-quote.html`, quote.html, 'text/html');
    }
    if (action === 'remove-quote') {
      const lead = getLead(btn.dataset.leadId);
      if (!lead) return;
      lead.quotes = (lead.quotes || []).filter((x) => x.id !== btn.dataset.quoteId);
      upsertLead(lead, 'Quote removed');
      return;
    }
    if (action === 'save-view') return saveCurrentView();
    if (action === 'delete-view') return deleteCurrentView();
    if (action === 'export-filtered-pack') return exportLeadPack(filteredLeads().map((x) => x.id));
    if (action === 'rescore-all') return rescoreAll();
    if (action === 'goto-capture') { window.location.href = 'quick-capture.html'; return; }
    if (action === 'export-contacts-csv') return exportContactsCsv();
    if (action === 'add-quote-item') {
      ui.quoteDraftItems.push({ id:uid(), label:'New line item', qty:1, price:250 });
      renderPage();
      return;
    }
    if (action === 'remove-quote-item') {
      ui.quoteDraftItems = ui.quoteDraftItems.filter((x) => x.id !== btn.dataset.itemId);
      renderPage();
      return;
    }
    if (action === 'reset-quote-template') {
      ui.quoteDraftItems = quoteItemsFromTemplate(ui.currentQuoteTemplateId);
      renderPage();
      return;
    }
    if (action === 'copy-quote-text') {
      const lead = getLead($('#quoteLeadSelect')?.value || ui.currentQuoteLeadId);
      return copyText(buildQuote(lead, ui.quoteDraftItems).text, 'Quote copied.');
    }
    if (action === 'download-quote-now') {
      const lead = getLead($('#quoteLeadSelect')?.value || ui.currentQuoteLeadId);
      return downloadText(`${(lead?.business || 'lead').replace(/[^a-z0-9]+/ig,'-').toLowerCase()}-quote.html`, buildQuote(lead, ui.quoteDraftItems).html, 'text/html');
    }
    if (action === 'save-quote-to-lead') {
      const lead = getLead($('#quoteLeadSelect')?.value || ui.currentQuoteLeadId);
      if (!lead) return;
      const q = buildQuote(lead, ui.quoteDraftItems);
      lead.quotes.unshift({ id:uid(), name: state.quoteTemplates.find((x) => x.id === ui.currentQuoteTemplateId)?.name || 'Quote', created_at:nowISO(), total:q.total, items:q.items, html:q.html });
      lead.logs.unshift({ id:uid(), at:nowISO(), type:'Quote', note:`Saved quote for ${fmtCurrency(q.total)}` });
      upsertLead(lead, 'Quote saved');
      return;
    }
    if (action === 'set-qc-note-type') {
      ui.quickCapture.noteType = btn.dataset.noteType;
      renderPage();
      return;
    }
    if (action === 'append-qc-note') {
      const area = $('#qcNotes');
      if (area) area.value = `${area.value.trim()}${area.value.trim() ? '\n' : ''}${ui.quickCapture.noteType}`.trim();
      return;
    }
    if (action === 'stage-qc-files') return stageQuickCaptureFiles($('#qcFiles')?.files || []);
    if (action === 'remove-qc-file') {
      ui.quickCapture.attachments = ui.quickCapture.attachments.filter((x) => x.id !== btn.dataset.fileId);
      if (ui.quickCapture.voiceAttachment?.id === btn.dataset.fileId) ui.quickCapture.voiceAttachment = null;
      renderPage();
      return;
    }
    if (action === 'start-voice-note') return startVoiceNote();
    if (action === 'stop-voice-note') return stopVoiceNote();
    if (action === 'save-quick-capture') return saveQuickCapture();
    if (action === 'save-route') return saveRoute();
    if (action === 'refresh-route-candidates') { const box = $('#routeCandidateList'); if (box) box.innerHTML = routeCandidateMarkup(); return; }
    if (action === 'export-route') return exportRoute(btn.dataset.id);
    if (action === 'delete-route') {
      state.routes = state.routes.filter((x) => x.id !== btn.dataset.id);
      saveState('Route deleted');
      renderPage();
      return;
    }
    if (action === 'export-backup') return exportPlainBackup();
    if (action === 'export-backup-encrypted') return exportEncryptedBackup();
    if (action === 'clear-restore-preview') { ui.pendingRestore = null; renderPage(); return; }
    if (action === 'restore-merge') return importPayload('merge');
    if (action === 'restore-replace') {
      if (!confirm('Replace the current vault with the loaded backup?')) return;
      return importPayload('replace');
    }
    if (action === 'load-restore-file') {
      const file = $('#restoreFileInput')?.files?.[0];
      if (!file) return toast('Choose a file first.');
      const text = await file.text();
      let obj = safeJson(text, null);
      if (!obj) return toast('Could not read backup JSON.');
      if (obj.encrypted) {
        const passphrase = prompt('Enter the backup passphrase');
        if (!passphrase) return;
        try { obj = await decryptPayload(obj, passphrase); }
        catch { return toast('Wrong passphrase or invalid encrypted file.'); }
      }
      ui.pendingRestore = obj;
      renderPage();
      return;
    }
    if (action === 'reset-vault') {
      if (!confirm('Reset the local vault on this device?')) return;
      state = defaultState();
      ui.pendingRestore = null;
      ui.selectedLeadId = state.leads[0]?.id || '';
      saveState('Local vault reset', { skipSnapshot:true });
      renderPage();
      return;
    }
    if (action === 'save-settings') return saveSettingsFromInputs();
    if (action === 'save-visuals') return await saveVisualsFromInputs();
    if (action === 'clear-background') {
      state.settings.backgroundImageDataUrl = '';
      state.settings.backgroundMode = 'gradient';
      saveState('Background reset');
      renderPage();
      return;
    }
    if (action === 'request-reminders') return requestReminderPermission();
    if (action === 'toggle-privacy') {
      state.settings.privacyMode = !state.settings.privacyMode;
      saveState(`Privacy mode ${state.settings.privacyMode ? 'enabled' : 'disabled'}`, { silent:true });
      renderPage();
      return;
    }
    if (action === 'lock-now') return lockNow();
    if (action === 'set-pin') {
      const pin = $('#pinInput').value.trim();
      if (pin.length < 4) return toast('Use at least 4 characters.');
      state.settings.pinHash = await sha256(pin);
      saveState('PIN saved');
      renderPage();
      return;
    }
    if (action === 'clear-pin') {
      state.settings.pinHash = '';
      sessionStorage.removeItem(UNLOCK_KEY);
      saveState('PIN cleared');
      renderPage();
      return;
    }
  });

  document.addEventListener('input', (e) => {
    if (['filterSearch','filterStage','filterDue','filterTerritory','filterSort'].includes(e.target.id)) {
      applyFiltersFromInputs();
      renderPage();
    }
    if (e.target.id === 'savedViewSelect') {
      if (e.target.value) applySavedView(e.target.value);
    }
    if (e.target.matches('[data-quote-field]')) {
      const item = ui.quoteDraftItems.find((x) => x.id === e.target.dataset.itemId);
      if (!item) return;
      item[e.target.dataset.quoteField] = ['qty','price'].includes(e.target.dataset.quoteField) ? Number(e.target.value || 0) : e.target.value;
      renderPage();
    }
    if (e.target.id === 'playbookLeadSelect') {
      ui.currentQuoteLeadId = e.target.value;
      renderPage();
    }
    if (e.target.id === 'scriptTemplateSelect') {
      ui.currentScriptTemplateId = e.target.value;
      renderPage();
    }
    if (e.target.id === 'quoteLeadSelect') {
      ui.currentQuoteLeadId = e.target.value;
      renderPage();
    }
    if (e.target.id === 'quoteTemplateSelect') {
      ui.currentQuoteTemplateId = e.target.value;
      ui.quoteDraftItems = quoteItemsFromTemplate(ui.currentQuoteTemplateId);
      renderPage();
    }
  });

  $('#quickAddBtn')?.addEventListener('click', () => openLeadModal(''));
  $('#quickBackupBtn')?.addEventListener('click', () => exportPlainBackup());
  $('#quickTodayBtn')?.addEventListener('click', () => { window.location.href = 'leads.html'; });
  $('#modalCloseBtn')?.addEventListener('click', closeModal);
  $('#modalDeleteBtn')?.addEventListener('click', () => {
    const id = $('#modalDeleteBtn').dataset.id;
    if (!id) return;
    if (!confirm('Delete this lead?')) return;
    closeModal();
    deleteLead(id);
  });
  $('#modalSaveBtn')?.addEventListener('click', () => {
    const id = $('#modalSaveBtn').dataset.id;
    if (!id) return;
    const lead = readLeadModal(id);
    closeModal();
    upsertLead(lead, 'Lead saved');
  });

  $('#unlockBtn')?.addEventListener('click', () => tryUnlock($('#unlockPin').value));
  $('#unlockPin')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock($('#unlockPin').value); });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  applyMeta();
  applyBackground();
  syncShell();
  renderPage();
  ensureUnlocked();
  checkReminders();
  setInterval(checkReminders, 60000);
})();


  document.addEventListener('change', (e) => {
    if (['filterStage','filterDue','filterTerritory','filterSort','savedViewSelect'].includes(e.target.id)) {
      if (e.target.id === 'savedViewSelect' && e.target.value) applySavedView(e.target.value);
      else {
        applyFiltersFromInputs();
        renderPage();
      }
      return;
    }
    if (e.target.id === 'playbookLeadSelect') {
      ui.currentQuoteLeadId = e.target.value;
      renderPage();
      return;
    }
    if (e.target.id === 'quoteLeadSelect') {
      ui.currentQuoteLeadId = e.target.value;
      renderPage();
      return;
    }
    if (e.target.id === 'quoteTemplateSelect') {
      ui.currentQuoteTemplateId = e.target.value;
      ui.quoteDraftItems = quoteItemsFromTemplate(ui.currentQuoteTemplateId);
      renderPage();
      return;
    }
    if (e.target.id === 'scriptTemplateSelect') {
      ui.currentScriptTemplateId = e.target.value;
      renderPage();
      return;
    }
  });
