(function(){
  if (window.__adminMenuShortcutBound) return;
  window.__adminMenuShortcutBound = true;

  const adminMenuUrl = "/admin-menu.html";
  const held = new Set();
  const recent = {};
  let codeBuffer = "";
  let logoClicks = 0;

  const HOLD_GRACE_MS = 700;
  const BUFFER_TIMEOUT_MS = 3000;
  let lastBufferAt = 0;
  const COMBO_COOLDOWN_MS = 600;
  const COMBO_RESET_MS = 2000;
  let comboCount = 0;
  let lastComboAt = 0;

  function showAdminMenu(){ 
    showKO();
    setTimeout(() => { window.location.href = adminMenuUrl; }, 1500);
  }

  function isDigitKey(k){ return typeof k === 'string' && /^[0-9]$/.test(k); }

  function seenWithin(keyNames, ms){
    const now = Date.now();
    return keyNames.some(k => (recent[k] && (now - recent[k]) <= ms));
  }

  function has6And7Loose(){
    const now = Date.now();
    const has6 = held.has('6') || held.has('Digit6') || held.has('Numpad6') || seenWithin(['6','Digit6','Numpad6'], HOLD_GRACE_MS);
    const has7 = held.has('7') || held.has('Digit7') || held.has('Numpad7') || seenWithin(['7','Digit7','Numpad7'], HOLD_GRACE_MS);
    return has6 && has7;
  }

  // --- Street Fighter HUD Setup REMOVED per user request ---
  /*
  const hudStyles = document.createElement('style');
  hudStyles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    #sf-hud {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 100000;
  ...
  document.body.appendChild(koScreen);
  */

  // Helper to map keys to icons/text
  function mapKeyToIcon(k) {
    if (k === '4') return '←';
    if (k === '6') return '→';
    if (k === '8') return '↑';
    if (k === '2') return '↓';
    if (k === '5') return 'N';
    if (k === '7') return 'HK';
    return k;
  }

  function updateDebug(){
    const now = Date.now();
    const bufferEl = document.getElementById('hud-buffer');
    const comboEl = document.getElementById('hud-combo');
    const superFill = document.getElementById('hud-super-fill');

    if (!bufferEl) return;

    // BUFFER: show last 10 chars mapped
    const displayBuffer = codeBuffer.split('').slice(-10).map(mapKeyToIcon).join(' ');
    bufferEl.innerText = displayBuffer || "AWAITING...";

    // COMBO: Animate if count > 0
    if (comboCount > 0) {
      if(comboEl) {
        comboEl.innerText = `${comboCount} HIT COMBO!`;
        comboEl.classList.add('combo-active');
      }
    } else {
      if(comboEl) comboEl.classList.remove('combo-active');
    }

    // SUPER METER: defined by comboCount (0-3)
    const pct = Math.min((comboCount / 3) * 100, 100);
    if(superFill) {
      superFill.style.width = `${pct}%`;
      if (pct >= 100) {
          superFill.style.background = 'linear-gradient(90deg, #f00, #ff0)';
      } else {
          superFill.style.background = 'linear-gradient(90deg, #00f, #0ff)';
      }
    }
  }

  function showKO() {
     const ko = document.querySelector('.ko-overlay');
     if(ko) ko.classList.add('ko-show');
  }

  function appendToBuffer(d){
    const now = Date.now();
    codeBuffer += d;
    lastBufferAt = now;
    
    if (codeBuffer.endsWith('444666')){ // LLLRRR
      console.log('[ADMIN DEBUG] sequence matched, opening menu');
      showKO(); // Effect
      setTimeout(showAdminMenu, 1000); 
      codeBuffer = '';
    }
    updateDebug();
  }

  function registerComboPress(){
    const now = Date.now();
    if (now - lastComboAt < COMBO_COOLDOWN_MS) return; // debounce
    lastComboAt = now;
    comboCount++;

    // Trigger visual hit effect
    const comboEl = document.getElementById('hud-combo');
    if(comboEl){
      comboEl.classList.remove('combo-active');
      void comboEl.offsetWidth; // trigger reflow
      comboEl.classList.add('combo-active');
    }

    if (comboCount >= 3){
      console.log('[ADMIN DEBUG] triple combo detected, opening menu');
      showKO();
      setTimeout(showAdminMenu, 1500);
      comboCount = 3; 
      updateDebug();
      // Reset
      setTimeout(() => {
          comboCount = 0;
          codeBuffer = '';
          lastBufferAt = 0;
          updateDebug();
      }, 2000); 
      return;
    }
    updateDebug();
    // reset combo after idle
    setTimeout(() => {
      if (Date.now() - lastComboAt >= COMBO_RESET_MS) {
        comboCount = 0;
        updateDebug();
      }
    }, COMBO_RESET_MS + 50);
  }

  // diagnostics: show fallback button on localhost if no keyboard seen
  let keyEventSeen = false;
  const FALLBACK_DELAY_MS = 6000;

  window.addEventListener('keydown', (e) => {
    try {
      if (!keyEventSeen) keyEventSeen = true;
      held.add(e.key);
      held.add(e.code);
      recent[e.key] = Date.now();
      recent[e.code] = Date.now();

      if (has6And7Loose() && isDigitKey(e.key)) {
        appendToBuffer(e.key);
      }
      if (has6And7Loose() && (e.key === '6' || e.key === '7' || (typeof e.code === 'string' && (e.code.includes('6') || e.code.includes('7'))))) {
        registerComboPress();
      }
      updateDebug();
    } catch (err) { console.warn('[ADMIN DEBUG] keydown handler error', err); }
  }, true);

  // Create persistent admin buttons above the HUD
  setTimeout(() => {
    // Check if buttons already exist to avoid duplicates
    if (document.getElementById('exec-admin-btn')) return;

    // --- Middle button: Admin Menu (the path inventory menu) ---
    const adminMenuBtn = document.createElement('button');
    adminMenuBtn.id = 'admin-menu-btn';
    adminMenuBtn.textContent = 'Admin Menu';
    adminMenuBtn.style.position = 'fixed';
    adminMenuBtn.style.left = '20px';
    adminMenuBtn.style.bottom = '140px';
    adminMenuBtn.style.zIndex = '100001';
    adminMenuBtn.style.background = 'rgba(0,0,0,0.8)';
    adminMenuBtn.style.color = '#0ff';
    adminMenuBtn.style.border = '1px solid #0ff';
    adminMenuBtn.style.padding = '5px 10px';
    adminMenuBtn.style.fontFamily = "'Press Start 2P', monospace";
    adminMenuBtn.style.fontSize = '10px';
    adminMenuBtn.style.cursor = 'pointer';
    adminMenuBtn.style.pointerEvents = 'auto';

    adminMenuBtn.addEventListener('click', () => { window.location.href = adminMenuUrl; });
    adminMenuBtn.addEventListener('mouseenter', () => { adminMenuBtn.style.background = '#0ff'; adminMenuBtn.style.color = '#000'; });
    adminMenuBtn.addEventListener('mouseleave', () => { adminMenuBtn.style.background = 'rgba(0,0,0,0.8)'; adminMenuBtn.style.color = '#0ff'; });

    document.body.appendChild(adminMenuBtn);

    // --- Top button: Executive Admin (main admin dashboard) ---
    const f = document.createElement('button');
    f.id = 'exec-admin-btn';
    f.textContent = 'Executive Admin';
    f.style.position = 'fixed';
    f.style.left = '20px';
    f.style.bottom = '170px';
    f.style.zIndex = '100001';
    f.style.background = 'rgba(0,0,0,0.8)';
    f.style.color = '#f00';
    f.style.border = '1px solid #f00';
    f.style.padding = '5px 10px';
    f.style.fontFamily = "'Press Start 2P', monospace";
    f.style.fontSize = '10px';
    f.style.cursor = 'pointer';
    f.style.pointerEvents = 'auto';

    f.addEventListener('click', () => { window.location.href = '/admin.html'; });
    f.addEventListener('mouseenter', () => { f.style.background = '#f00'; f.style.color = '#000'; });
    f.addEventListener('mouseleave', () => { f.style.background = 'rgba(0,0,0,0.8)'; f.style.color = '#f00'; });

    document.body.appendChild(f);
  }, 1000);


  window.addEventListener('keyup', (e) => {
    try {
      held.delete(e.key);
      held.delete(e.code);
      recent[e.key] = Date.now();
      recent[e.code] = Date.now();
      if (!has6And7Loose()) {
        setTimeout(() => {
          if (!has6And7Loose() && (Date.now() - lastBufferAt) > BUFFER_TIMEOUT_MS) {
            codeBuffer = '';
            updateDebug();
          }
        }, HOLD_GRACE_MS + 50);
      }
      updateDebug();
    } catch (err) { console.warn('[ADMIN DEBUG] keyup handler error', err); }
  }, true);

  setInterval(() => {
    if (lastBufferAt && (Date.now() - lastBufferAt) > BUFFER_TIMEOUT_MS) {
      if (codeBuffer) { codeBuffer = ''; updateDebug(); }
      lastBufferAt = 0;
    }
  }, 800);

  const logoBtn = document.querySelector('.nav-logo');
  if (logoBtn) {
    logoBtn.addEventListener('click', () => {
      if (has6And7Loose()) {
        logoClicks++;
        if (logoClicks >= 3) { showAdminMenu(); logoClicks = 0; }
      } else { logoClicks = 0; }
    });
  }

  updateDebug();
})();
