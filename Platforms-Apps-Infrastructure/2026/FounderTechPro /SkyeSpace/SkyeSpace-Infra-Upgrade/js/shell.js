(function(){
  const page = document.body.dataset.page;

  function ensureAuthChrome(){
    if(document.querySelector('.skye-auth-style')) return;
    const style = document.createElement('style');
    style.className = 'skye-auth-style';
    style.textContent = `
      .skye-auth-gate {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(7, 11, 22, 0.72);
        backdrop-filter: blur(10px);
      }
      .skye-auth-gate.open { display: flex; }
      .skye-auth-card {
        width: min(720px, calc(100vw - 40px));
        border-radius: 28px;
        padding: 28px;
        background: linear-gradient(160deg, rgba(15,20,34,0.97), rgba(24,33,55,0.95));
        border: 1px solid rgba(121, 180, 255, 0.24);
        box-shadow: 0 28px 80px rgba(0,0,0,0.38);
        color: #edf4ff;
      }
      .skye-auth-card h2 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); }
      .skye-auth-card p { margin: 0; color: rgba(237,244,255,0.78); line-height: 1.7; }
      .skye-auth-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }
      .skye-auth-notes {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .skye-auth-note {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .skye-auth-note strong { display: block; margin-bottom: 6px; color: #9ed0ff; }
      .auth-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        font-size: 12px;
      }
      .auth-chip .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ffb347;
      }
      .auth-chip.ready .dot { background: #6bf5a6; }
    `;
    document.head.appendChild(style);

    const gate = document.createElement('div');
    gate.className = 'skye-auth-gate';
    gate.innerHTML = `
      <div class="skye-auth-card">
        <div class="auth-chip" data-auth-chip><span class="dot"></span><span data-auth-copy>Gateway session required</span></div>
        <h2>SkyeSpace now runs through Gateway 13.</h2>
        <p>You can preview the shell, but messaging, publishing, market actions, and saved state now route through the shared Gateway session and shared site database. Sign in once and that login persists across the wider site.</p>
        <div class="skye-auth-actions">
          <a class="btn btn-gold" href="/account/">Sign In</a>
          <a class="btn btn-soft" href="/gateway/dashboard.html">Open Gateway 13</a>
          <a class="btn btn-soft" href="/skyefuelstation/">Open SkyeFuelStation</a>
        </div>
        <div class="skye-auth-notes">
          <div class="skye-auth-note"><strong>Shared auth</strong>One Gateway 13 bearer session now governs SkyeSpace actions.</div>
          <div class="skye-auth-note"><strong>Shared SQL</strong>SkyeSpace data is stored on the main site database contract.</div>
          <div class="skye-auth-note"><strong>Onboarding flow</strong>Account, Gateway, Fuel Station, and SkyeSpace now point into one path instead of parallel silos.</div>
        </div>
      </div>
    `;
    document.body.appendChild(gate);
  }

  function syncAuthGate(){
    ensureAuthChrome();
    const gate = document.querySelector('.skye-auth-gate');
    const chip = document.querySelector('[data-auth-chip]');
    const label = document.querySelector('[data-auth-copy]');
    const authenticated = !!window.SKYE_API?.auth?.isAuthenticated?.();
    if(gate) gate.classList.toggle('open', !authenticated);
    if(chip) chip.classList.toggle('ready', authenticated);
    if(label) label.textContent = authenticated ? 'Gateway session active' : 'Gateway session required';
  }

  function applyNav(){
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === page);
    });
  }

  function ensureInfraBadge(){
    const utility = document.querySelector('.utility-bar');
    if(!utility || utility.querySelector('.infra-chip')) return;
    const chip = document.createElement('div');
    chip.className = 'infra-chip';
    chip.innerHTML = '<span class="dot"></span><span data-infra-label>Infra booting</span>';
    utility.prepend(chip);
  }

  function syncInfraBadge(){
    const label = document.querySelector('[data-infra-label]');
    if(!label) return;
    label.textContent = document.documentElement.dataset.infraMode === 'live' ? 'Live infra' : 'Local fallback';
  }

  function syncProfileName(){
    const state = window.SKYE_STATE.get();
    document.querySelectorAll('[data-profile-name]').forEach(node => node.textContent = state.profile.name);
  }

  function syncButtons(){
    const state = window.SKYE_STATE.get();
    document.querySelectorAll('[data-toggle-save]').forEach(btn => {
      const id = btn.dataset.toggleSave;
      btn.textContent = state.saves[id] ? 'Saved' : 'Save';
    });
    document.querySelectorAll('[data-join]').forEach(btn => {
      const id = btn.dataset.join;
      btn.textContent = state.joins[id] ? 'Joined' : 'Join';
    });
    document.querySelectorAll('[data-vote]').forEach(btn => {
      const id = btn.dataset.vote;
      btn.textContent = state.votes[id] ? 'Voted' : 'Cast vote';
    });
    document.querySelectorAll('[data-enroll]').forEach(btn => {
      const id = btn.dataset.enroll;
      btn.textContent = state.enrollments[id] ? 'Enrolled' : 'Enroll';
    });
    document.querySelectorAll('[data-follow]').forEach(btn => {
      const id = btn.dataset.follow;
      btn.textContent = state.joins[id] ? 'Following' : 'Follow';
    });
  }

  function openComposer(){ document.querySelector('.composer-backdrop')?.classList.add('open'); }
  function closeComposer(){ document.querySelector('.composer-backdrop')?.classList.remove('open'); }

  document.addEventListener('click', async e => {
    const openBtn = e.target.closest('[data-open-composer]');
    if(openBtn){ openComposer(); return; }

    const closeBtn = e.target.closest('[data-close-composer]');
    if(closeBtn){ closeComposer(); return; }

    if(e.target.classList.contains('composer-backdrop')){ closeComposer(); return; }

    const saveBtn = e.target.closest('[data-toggle-save]');
    if(saveBtn){
      const id = saveBtn.dataset.toggleSave;
      window.SKYE_STATE.toggle('saves', id);
      syncButtons();
      return;
    }

    const joinBtn = e.target.closest('[data-join]');
    if(joinBtn){
      const id = joinBtn.dataset.join;
      window.SKYE_STATE.toggle('joins', id);
      syncButtons();
      return;
    }

    const voteBtn = e.target.closest('[data-vote]');
    if(voteBtn){
      const id = voteBtn.dataset.vote;
      window.SKYE_STATE.toggle('votes', id);
      syncButtons();
      return;
    }

    const enrollBtn = e.target.closest('[data-enroll]');
    if(enrollBtn){
      const id = enrollBtn.dataset.enroll;
      window.SKYE_STATE.toggle('enrollments', id);
      syncButtons();
      return;
    }

    const followBtn = e.target.closest('[data-follow]');
    if(followBtn){
      const id = followBtn.dataset.follow;
      window.SKYE_STATE.toggle('joins', id);
      syncButtons();
      return;
    }

    const exportProject = e.target.closest('[data-export-project]');
    if(exportProject){
      const payload = JSON.parse(exportProject.dataset.exportProject);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${String(payload.name || 'project').replace(/\W+/g,'-').toLowerCase()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return;
    }

    const sellerBtn = e.target.closest('[data-message-seller]');
    if(sellerBtn){
      const seller = sellerBtn.dataset.messageSeller;
      const topic = sellerBtn.dataset.topic || 'Market inquiry';
      const params = new URLSearchParams({ seller, topic });
      location.href = `messages.html?${params.toString()}`;
      return;
    }
  });

  const searchInput = document.querySelector('[data-global-search]');
  if(searchInput){
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('[data-searchable]').forEach(node => {
        const hay = node.textContent.toLowerCase();
        node.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }

  const form = document.querySelector('#quick-compose-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const state = window.SKYE_STATE.get();
    const lane = fd.get('lane');
    const payload = {
      author: state.profile.name,
      title: fd.get('title'),
      body: fd.get('body'),
      category: fd.get('category'),
      lane,
      price: fd.get('price'),
      eta: fd.get('eta'),
      district: fd.get('district'),
      severity: fd.get('severity')
    };

    const remote = await window.SKYE_API.compose(payload);
    if(remote?.ok){
      form.reset();
      closeComposer();
      window.dispatchEvent(new CustomEvent('skye:update'));
      return;
    }

    if(lane === 'market'){
      window.SKYE_STATE.pushListing({
        title: payload.title,
        category: payload.category || 'Custom Offer',
        price: payload.price || '$—',
        seller: state.profile.name,
        eta: payload.eta || 'Flexible',
        district: payload.district || 'Custom'
      });
    }else if(lane === 'signal'){
      window.SKYE_STATE.pushSignal({
        severity: payload.severity || 'medium',
        title: payload.title,
        detail: payload.body,
        source: state.profile.name,
        age: 'just now'
      });
    }else if(lane === 'messages'){
      window.SKYE_STATE.pushMessage({
        author: state.profile.name,
        body: payload.body || payload.title,
        mine: true,
        ts: Date.now()
      });
    }else{
      window.SKYE_STATE.pushPost({
        author: state.profile.name,
        role: payload.category || 'Custom',
        type: lane.charAt(0).toUpperCase() + lane.slice(1),
        title: payload.title,
        text: payload.body
      });
    }
    form.reset();
    closeComposer();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  async function bootProfile(){
    try{
      const profile = await window.SKYE_API.getProfile();
      if(profile){
        window.SKYE_STATE.setProfile({
          name: profile.name,
          handle: profile.handle,
          title: profile.title,
          bio: profile.bio
        });
      }
      window.dispatchEvent(new CustomEvent('skye:update'));
    }catch(_err){}
  }

  function syncAll(){
    ensureInfraBadge();
    syncAuthGate();
    applyNav();
    syncProfileName();
    syncButtons();
    syncInfraBadge();
  }

  syncAll();
  window.addEventListener('skye:update', syncAll);
  window.addEventListener('skye:infra', syncAll);
  window.addEventListener('skye:auth', syncAll);
  window.SKYE_API.detect().then(syncAll);
  bootProfile();
})();
