
const SKYMAIL_KEY = 'skymail_supplemental_suite_v1';
const REMOTE_APP_ID = 'skymail-suite';
const REMOTE_SYNC_DELAY_MS = 500;
const SEEDED_STATE = {"meta": {"updatedAt": "2026-03-21T00:00:00.000Z"}, "sharedDesk": [{"id": "sd1", "subject": "Roofing quote request", "contact": "Maya Johnson", "company": "Johnson Roofing", "email": "maya@johnsonroofing.com", "owner": "Skye AE-01", "queue": "Sales", "priority": "High", "status": "Open", "waiting": "Internal", "lastTouch": "2026-03-21", "slaHours": 2, "notes": "Requested revised quote with financing language.", "tags": ["Quote", "Hot lead"]}, {"id": "sd2", "subject": "Partnership proposal", "contact": "Aaron Webb", "company": "Webb Media", "email": "aaron@webbmedia.co", "owner": "Skye AE-02", "queue": "Partnerships", "priority": "Medium", "status": "Assigned", "waiting": "Client", "lastTouch": "2026-03-20", "slaHours": 8, "notes": "Waiting on budget range and launch timing.", "tags": ["Partner", "Pending"]}, {"id": "sd3", "subject": "Support issue: locked account", "contact": "Rita Bell", "company": "Bell & Co", "email": "rita@bellco.com", "owner": "Support Lane", "queue": "Support", "priority": "Urgent", "status": "Open", "waiting": "Internal", "lastTouch": "2026-03-21", "slaHours": 1, "notes": "Reset pending after identity confirmation.", "tags": ["Support", "Escalation"]}], "followUps": [{"id": "fu1", "lead": "Maya Johnson", "email": "maya@johnsonroofing.com", "stage": "Proposal sent", "nextTouch": "2026-03-22", "cadence": "48h", "template": "Quote follow-up", "health": "Hot", "sequenceStep": 2, "owner": "Skye AE-01", "notes": "Mention financing option + timeline"}, {"id": "fu2", "lead": "Aaron Webb", "email": "aaron@webbmedia.co", "stage": "Discovery", "nextTouch": "2026-03-24", "cadence": "72h", "template": "Partnership nudge", "health": "Warm", "sequenceStep": 1, "owner": "Skye AE-02", "notes": "Ask for team size + deliverables"}, {"id": "fu3", "lead": "Vera House", "email": "vera@housecollective.io", "stage": "No reply", "nextTouch": "2026-03-21", "cadence": "24h", "template": "Revive thread", "health": "Cooling", "sequenceStep": 4, "owner": "Skye AE-03", "notes": "Final bump before recovery queue"}], "intake": [{"id": "iv1", "client": "Johnson Roofing", "contact": "Maya Johnson", "email": "maya@johnsonroofing.com", "stage": "Qualified", "value": 4200, "nextAction": "Send revised quote", "due": "2026-03-22", "checklist": ["Contact captured", "Scope captured", "Quote in progress"], "files": ["scope-notes.pdf"], "notes": "Interested in recurring support add-on."}, {"id": "iv2", "client": "Webb Media", "contact": "Aaron Webb", "email": "aaron@webbmedia.co", "stage": "Discovery", "value": 1800, "nextAction": "Request budget ceiling", "due": "2026-03-24", "checklist": ["Contact captured", "Needs clarified"], "files": ["brief.docx"], "notes": "Potential white-label collaboration."}, {"id": "iv3", "client": "Bell & Co", "contact": "Rita Bell", "email": "rita@bellco.com", "stage": "Active support", "value": 0, "nextAction": "Unlock account and confirm", "due": "2026-03-21", "checklist": ["Identity check pending"], "files": ["ticket-204.png"], "notes": "Needs same-day turnaround."}], "contacts": [{"id": "cb1", "name": "Maya Johnson", "company": "Johnson Roofing", "email": "maya@johnsonroofing.com", "phone": "602-555-0182", "score": 91, "segment": "Hot lead", "owner": "Skye AE-01", "lastReply": "2026-03-21", "notes": "Responds quickly when finance options are mentioned.", "tags": ["Roofing", "Local", "High value"]}, {"id": "cb2", "name": "Aaron Webb", "company": "Webb Media", "email": "aaron@webbmedia.co", "phone": "480-555-0149", "score": 73, "segment": "Partner", "owner": "Skye AE-02", "lastReply": "2026-03-20", "notes": "Wants recurring partner terms.", "tags": ["Media", "Partner"]}, {"id": "cb3", "name": "Rita Bell", "company": "Bell & Co", "email": "rita@bellco.com", "phone": "623-555-0128", "score": 54, "segment": "Client", "owner": "Support Lane", "lastReply": "2026-03-21", "notes": "Prefers quick concise status updates.", "tags": ["Support", "Priority"]}], "replyTemplates": [{"id": "rt1", "title": "Quote Follow-Up", "category": "Sales", "subject": "Checking in on your quote", "body": "Hey {{name}},\n\nWanted to circle back on the quote I sent over. I can answer questions, adjust scope, or tighten the timeline if needed.\n\nBest,\n{{sender}}"}, {"id": "rt2", "title": "Ghosted Lead Revive", "category": "Recovery", "subject": "Still want to move this forward?", "body": "Hey {{name}},\n\nWanted to bump this back to the top of your inbox. If this is still live, I can get you moving fast. If priorities shifted, no pressure — just let me know.\n\nBest,\n{{sender}}"}, {"id": "rt3", "title": "Support Resolution", "category": "Support", "subject": "Your issue has been handled", "body": "Hi {{name}},\n\nYour request has been handled on our side. If you want, I can stay on the thread until you confirm everything looks right.\n\nBest,\n{{sender}}"}], "analytics": {"monthlyRecovered": 18600, "replyCompliance": 87, "avgFirstResponseMins": 34, "openAssignments": 9, "hotLeads": 6}, "recoveryLog": [{"id": "rl1", "name": "Vera House", "email": "vera@housecollective.io", "reason": "No reply in 9 days after proposal", "estValue": 2600, "action": "Queue revive template", "severity": "High"}, {"id": "rl2", "name": "Nate Cole", "email": "nate@coleelectric.net", "reason": "Pricing question unanswered", "estValue": 1100, "action": "Assign to sales desk", "severity": "Medium"}]};
const APP_META = [
  {id:'shared-desk', title:'Shared Desk', href:'shared-desk.html'},
  {id:'follow-up-engine', title:'Follow-Up Engine', href:'follow-up-engine.html'},
  {id:'intake-vault', title:'Intake Vault', href:'intake-vault.html'},
  {id:'recovery-engine', title:'Recovery Engine', href:'recovery-engine.html'},
  {id:'contact-brain', title:'Contact Brain', href:'contact-brain.html'},
  {id:'reply-studio', title:'Reply Studio', href:'reply-studio.html'},
  {id:'ops-console', title:'Ops Console', href:'ops-console.html'}
];
const COLLECTION_KEY_BY_PAGE = {
  'shared-desk': 'sharedDesk',
  'follow-up-engine': 'followUps',
  'intake-vault': 'intake',
  'recovery-engine': 'recoveryLog',
  'contact-brain': 'contacts',
  'reply-studio': 'replyTemplates'
};
let remoteSyncTimer = 0;
function adminToken(){try{return sessionStorage.getItem('KAIXU_ADMIN_TOKEN')||''}catch{return ''}}
function canUseRemoteState(){return !!String(adminToken()).trim()}
async function requestRemoteState(method='GET', body){const token=adminToken().trim(); if(!token) return null; const response=await fetch('/.netlify/functions/admin-skymail-suite',{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}); if(!response.ok){const data=await response.json().catch(()=>({})); throw new Error(data?.error||`Remote state request failed (${response.status})`)} return await response.json().catch(()=>null)}
async function requestLaneState(collection, method='GET', body){const token=adminToken().trim(); if(!token) return null; const response=await fetch(`/.netlify/functions/admin-skymail-suite-items?collection=${encodeURIComponent(collection)}`,{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}); if(!response.ok){const data=await response.json().catch(()=>({})); throw new Error(data?.error||`Lane state request failed (${response.status})`)} return await response.json().catch(()=>null)}
async function hydrateRemoteState(){if(!canUseRemoteState()) return false; try{const payload=await requestRemoteState('GET'); if(!payload?.state) return false; saveState(payload.state,{skipRemote:true}); return true}catch(err){console.warn('skymail remote hydrate failed:', err?.message||err); return false}}
function queueRemoteSync(state){if(!canUseRemoteState()) return; clearTimeout(remoteSyncTimer); remoteSyncTimer=setTimeout(()=>{requestRemoteState('PUT',{state}).catch((err)=>console.warn('skymail remote sync failed:', err?.message||err))}, REMOTE_SYNC_DELAY_MS)}
function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)}
function seedData(){ const copy=JSON.parse(JSON.stringify(SEEDED_STATE)); copy.meta.updatedAt=new Date().toISOString(); ['sharedDesk','followUps','intake','contacts','replyTemplates','recoveryLog'].forEach(key=>copy[key].forEach(item=>{ if(!item.id || /^(sd|fu|iv|cb|rt|rl)/.test(String(item.id))) item.id=uid(); })); return copy; }
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatMoney(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0))}
function formatDate(v){if(!v) return ''; const d=new Date(v); return isNaN(d)?String(v):d.toLocaleDateString()}
function formatDateTime(v){if(!v) return ''; const d=new Date(v); return isNaN(d)?String(v):d.toLocaleString()}
function loadState(){try{const raw=localStorage.getItem(SKYMAIL_KEY); if(raw) return JSON.parse(raw)}catch(e){} const s=seedData(); saveState(s); return s}
function saveState(state, options={}){state.meta=state.meta||{}; state.meta.updatedAt=new Date().toISOString(); localStorage.setItem(SKYMAIL_KEY, JSON.stringify(state)); if(!options.skipRemote) queueRemoteSync(state)}
function laneStateKey(pageOrCollection){return COLLECTION_KEY_BY_PAGE[pageOrCollection]||pageOrCollection}
function cloneState(state){return JSON.parse(JSON.stringify(state||{}))}
function applyStateSnapshot(state, snapshot){Object.keys(state||{}).forEach((key)=>delete state[key]); Object.assign(state, cloneState(snapshot)); return state}
function optimisticActorLabel(){return canUseRemoteState() ? 'admin' : 'local'}
function stampLaneItem(previous, next){const now=new Date().toISOString(); return {...(previous||{}),...(next||{}),createdAt:previous?.createdAt||next?.createdAt||now,updatedAt:now,updatedBy:next?.updatedBy||previous?.updatedBy||optimisticActorLabel()}}
function upsertLocalLaneItem(state, collection, item){const key=laneStateKey(collection); const list=Array.isArray(state[key])?state[key]:[]; const nextItem={...item}; const index=list.findIndex(entry=>String(entry?.id||'')===String(nextItem.id||'')); if(index>=0) list[index]={...list[index],...nextItem}; else list.unshift(nextItem); state[key]=list; return nextItem}
function deleteLocalLaneItem(state, collection, itemId){const key=laneStateKey(collection); state[key]=(state[key]||[]).filter(entry=>String(entry?.id||'')!==String(itemId||''))}
function laneAuditLabel(item){const parts=[]; if(item?.createdAt) parts.push(`Created ${formatDateTime(item.createdAt)}`); if(item?.updatedAt || item?.updatedBy){const updatedAt=item?.updatedAt?formatDateTime(item.updatedAt):''; const updatedBy=item?.updatedBy?` by ${item.updatedBy}`:''; const summary=`Updated ${updatedAt}${updatedBy}`.trim(); if(summary!=='Updated') parts.push(summary);} return parts.join(' • ')}
function laneAuditMarkup(item){const label=laneAuditLabel(item); return label?`<div class="mini" style="margin-top:8px">${safe(label)}</div>`:''}
async function hydrateLaneCollection(state, collection){if(!canUseRemoteState()) return false; try{const payload=await requestLaneState(collection,'GET'); const key=laneStateKey(collection); if(!payload?.items) return false; state[key]=Array.isArray(payload.items)?payload.items:[]; saveState(state,{skipRemote:true}); return true}catch(err){console.warn('skymail lane hydrate failed:', collection, err?.message||err); return false}}
async function saveLaneItem(state, collection, item){const key=laneStateKey(collection); const snapshot=cloneState(state); const previous=byId(state[key],item?.id||''); const nextItem=stampLaneItem(previous,{...item,id:item?.id||uid()}); upsertLocalLaneItem(state,key,nextItem); saveState(state,{skipRemote:true}); if(!canUseRemoteState()) return nextItem; try{const payload=await requestLaneState(key,'POST',{item:nextItem}); if(payload?.state){applyStateSnapshot(state,payload.state); saveState(state,{skipRemote:true}); return byId(state[key],nextItem.id)||nextItem} if(payload?.item){upsertLocalLaneItem(state,key,payload.item); saveState(state,{skipRemote:true}); return payload.item}}catch(err){applyStateSnapshot(state,snapshot); saveState(state,{skipRemote:true}); console.warn('skymail lane save failed:', key, err?.message||err); throw err} return nextItem}
async function deleteLaneItem(state, collection, itemId){const key=laneStateKey(collection); const snapshot=cloneState(state); deleteLocalLaneItem(state,key,itemId); saveState(state,{skipRemote:true}); if(!canUseRemoteState()) return true; try{const payload=await requestLaneState(key,'DELETE',{item_id:itemId}); if(payload?.state){applyStateSnapshot(state,payload.state); saveState(state,{skipRemote:true})}}catch(err){applyStateSnapshot(state,snapshot); saveState(state,{skipRemote:true}); console.warn('skymail lane delete failed:', key, err?.message||err); throw err} return true}
async function replaceLaneCollection(state, collection, items){const key=laneStateKey(collection); const snapshot=cloneState(state); const previousById=new Map((state[key]||[]).map(item=>[String(item?.id||''),item])); const stamped=(Array.isArray(items)?items:[]).map((item)=>stampLaneItem(previousById.get(String(item?.id||'')), item)); state[key]=stamped; saveState(state,{skipRemote:true}); if(!canUseRemoteState()) return state[key]; try{const current=await requestLaneState(key,'GET'); const nextIds=new Set(state[key].map(item=>String(item?.id||''))); for(const item of state[key]) await requestLaneState(key,'POST',{item}); for(const item of (current?.items||[])){ if(!nextIds.has(String(item?.id||''))) await requestLaneState(key,'DELETE',{item_id:item.id}); } const refreshed=await requestLaneState(key,'GET'); if(refreshed?.items){ state[key]=Array.isArray(refreshed.items)?refreshed.items:state[key]; saveState(state,{skipRemote:true}); } return state[key]}catch(err){applyStateSnapshot(state,snapshot); saveState(state,{skipRemote:true}); console.warn('skymail lane replace failed:', key, err?.message||err); throw err}}
function exportState(){const blob=new Blob([JSON.stringify(loadState(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='skymail-suite-export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function importState(file){return new Promise((resolve,reject)=>{const r=new FileReader(); r.onload=()=>{try{const data=JSON.parse(String(r.result||'{}')); saveState(data); resolve(data)}catch(err){reject(err)}}; r.onerror=()=>reject(new Error('Import failed')); r.readAsText(file)})}
function resetState(){const s=seedData(); saveState(s); return s}
function byId(list,id){return (list||[]).find(x=>String(x.id)===String(id))}
function removeById(list,id){const i=(list||[]).findIndex(x=>String(x.id)===String(id)); if(i>=0) list.splice(i,1)}
function panelToggle(button){const panel=button.closest('.panel'); if(!panel) return; panel.classList.toggle('collapsed'); button.textContent=panel.classList.contains('collapsed')?'+':'−'}
function renderShell(pageId, title, subtitle){
  const state=loadState();
  const counts={'shared-desk': state.sharedDesk.length,'follow-up-engine': state.followUps.length,'intake-vault': state.intake.length,'recovery-engine': state.recoveryLog.length,'contact-brain': state.contacts.length,'reply-studio': state.replyTemplates.length,'ops-console': state.sharedDesk.length + state.followUps.length};
  const navTop=APP_META.map(app=>`<a href="${app.href}" class="${app.id===pageId?'active':''}">${safe(app.title)}</a>`).join('');
  const navSide=APP_META.map(app=>`<a href="${app.href}" class="${app.id===pageId?'active':''}"><span>${safe(app.title)}</span><span class="count">${counts[app.id]||0}</span></a>`).join('');
  return `
    <div class="topbar"><div class="topbar-inner">
      <div class="brand"><div class="brand-mark">S</div><div class="brand-copy"><strong>SkyMail Supplemental Suite</strong><small>${safe(title)}</small></div></div>
      <div class="navlinks"><a href="index.html">Launcher</a>${navTop}<a href="#" id="exportStateBtn">Export</a><label for="importStateFile" class="btn small ghost" style="display:inline-flex;align-items:center">Import</label><input id="importStateFile" type="file" accept="application/json" style="display:none" /><a href="#" id="resetStateBtn">Reset</a></div>
    </div></div>
    <div class="layout">
      <aside class="sidebar">
        <div class="card"><div class="side-title">Suite Apps</div><div class="side-nav">${navSide}</div></div>
        <div class="card"><div class="side-title">How this bundle works</div><div class="mini">Local-first by default. With Gateway admin auth present, the suite also syncs into dedicated SkyMail tables on the root backend.</div></div>
        <div class="card"><div class="side-title">Suite Control</div><div class="btnrow" style="margin-top:10px"><button class="btn small" id="sideExportBtn" type="button">Export Data</button><button class="btn small danger" id="sideResetBtn" type="button">Reset Seed</button></div></div>
      </aside>
      <main class="main">
        <section class="hero">
          <section class="card">
            <div class="badge">Front-end MVP • Supplemental App Layer</div>
            <div class="h1">${safe(title)}</div>
            <p class="sub">${safe(subtitle)}</p>
            <div class="btnrow"><a class="btn gold" href="index.html">Back to Launcher</a><button class="btn" id="heroExportBtn" type="button">Export JSON</button><button class="btn warn" id="heroResetBtn" type="button">Reset Seed Data</button></div>
          </section>
          <aside class="card">
            <div class="eyebrow">Suite State</div>
            <div class="grid2" style="margin-top:12px">
              <div class="stat"><b>${counts[pageId]||0}</b><span class="mini">Records in this app</span></div>
              <div class="stat"><b>${new Date(state.meta.updatedAt).toLocaleString()}</b><span class="mini">Last local save</span></div>
            </div>
            <div class="notice" style="margin-top:12px">Physical navigation is still present for offline review, but the suite now upgrades to root server persistence when admin auth is live.</div>
          </aside>
        </section>
        <div id="pageContent"></div>
      </main>
    </div>
    <div class="footer"><div class="mini">SkyMail Supplemental Suite • local-first MVP bundle with dedicated root sync when admin auth is present.</div></div>`;
}
function wireGlobalControls(){
  const runExport=()=>exportState();
  ['exportStateBtn','sideExportBtn','heroExportBtn'].forEach(id=>{const el=document.getElementById(id); if(el) el.onclick=(e)=>{e.preventDefault();runExport()}})
  const runReset=()=>{resetState(); location.reload()};
  ['resetStateBtn','sideResetBtn','heroResetBtn'].forEach(id=>{const el=document.getElementById(id); if(el) el.onclick=(e)=>{e.preventDefault(); if(confirm('Reset suite data back to seed records?')) runReset()}})
  const input=document.getElementById('importStateFile'); if(input){input.onchange=async()=>{const f=input.files&&input.files[0]; if(!f) return; try{await importState(f); location.reload()}catch(err){alert(err.message||'Import failed')}}}
  document.querySelectorAll('[data-panel-toggle]').forEach(btn=>btn.onclick=()=>panelToggle(btn))
}
function mountPage(pageId,title,subtitle,renderFn){ document.body.innerHTML=`<div class="wrap">${renderShell(pageId,title,subtitle)}</div>`; renderFn(loadState()); wireGlobalControls(); hydrateRemoteState().then((didHydrate)=>{ if(didHydrate){ document.body.innerHTML=`<div class="wrap">${renderShell(pageId,title,subtitle)}</div>`; renderFn(loadState()); wireGlobalControls(); }}).catch(()=>{}); }
