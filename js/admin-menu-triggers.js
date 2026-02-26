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

  function showAdminMenu(){ window.location.href = adminMenuUrl; }
  function isDigitKey(k){ return typeof k === 'string' && /^[0-9]$/.test(k); }
  function seenWithin(keyNames, ms){ const now = Date.now(); return keyNames.some(k => (recent[k] && (now - recent[k]) <= ms)); }
  function has6And7Loose(){
    const now = Date.now();
    const has6 = held.has('6') || held.has('Digit6') || held.has('Numpad6') || seenWithin(['6','Digit6','Numpad6'], HOLD_GRACE_MS);
    const has7 = held.has('7') || held.has('Digit7') || held.has('Numpad7') || seenWithin(['7','Digit7','Numpad7'], HOLD_GRACE_MS);
    return has6 && has7;
  }

  // Debug panel
  const dbg = document.createElement('div');
  dbg.id = 'adminShortcutDebug';
  dbg.style.position = 'fixed';
  dbg.style.left = '24px';
  dbg.style.bottom = '72px';
  dbg.style.zIndex = '100000';
  dbg.style.padding = '6px 8px';
  dbg.style.background = 'rgba(10,10,14,0.85)';
  dbg.style.color = '#e8e6ff';
  dbg.style.fontFamily = 'Fira Code, monospace';
  dbg.style.fontSize = '12px';
  dbg.style.border = '1px solid rgba(138,99,255,0.18)';
  dbg.style.borderRadius = '8px';
  dbg.style.pointerEvents = 'none';
  dbg.innerText = 'Admin shortcut: ready';
  document.body.appendChild(dbg);

  function updateDebug(){
    const now = Date.now();
    const heldArr = Array.from(held).slice(0,6).join(',');
    const age = lastBufferAt ? Math.round((now-lastBufferAt)/1000) + 's' : '-';
    dbg.innerText = `held: [${heldArr}]\nbuf: ${codeBuffer} (age ${age})\ncombo: ${comboCount}`;
  }

  // diagnostics: show fallback button on localhost if no keyboard seen
  let keyEventSeen = false;
  const FALLBACK_DELAY_MS = 6000;

  function appendToBuffer(d){
    const now = Date.now();
    codeBuffer += d;
    lastBufferAt = now;
    updateDebug();
    if (codeBuffer.endsWith('444666')){
      console.log('[ADMIN DEBUG] sequence matched, opening menu');
      showAdminMenu();
      codeBuffer = '';
      updateDebug();
    }
  }

  function registerComboPress(){
    const now = Date.now();
    if (now - lastComboAt < COMBO_COOLDOWN_MS) return;
    lastComboAt = now;
    comboCount++;
    updateDebug();
    if (comboCount >= 3){
      console.log('[ADMIN DEBUG] triple combo detected, opening menu');
      showAdminMenu();
      comboCount = 0;
      codeBuffer = '';
      lastBufferAt = 0;
      updateDebug();
    }
    setTimeout(() => { if (Date.now() - lastComboAt >= COMBO_RESET_MS) { comboCount = 0; updateDebug(); } }, COMBO_RESET_MS + 50);
  }

  window.addEventListener('keydown', (e) => {
    try {
      if (!keyEventSeen) {
        console.debug('[ADMIN DEBUG] key events now being seen');
        keyEventSeen = true;
      }
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

  // If no key events observed shortly after load, show a local-only fallback button
  setTimeout(() => {
    if (!keyEventSeen && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
      console.warn('[ADMIN DEBUG] no keyboard events detected; showing local fallback button');
      const f = document.createElement('button');
      f.textContent = 'Open Admin (fallback)';
      f.style.position = 'fixed';
      f.style.left = '24px';
      f.style.bottom = '112px';
      f.style.zIndex = '100001';
      f.style.padding = '6px 8px';
      f.style.borderRadius = '6px';
      f.style.background = 'rgba(138,99,255,0.16)';
      f.style.color = '#e8e6ff';
      f.style.border = '1px solid rgba(138,99,255,0.18)';
      f.addEventListener('click', () => { console.log('[ADMIN DEBUG] fallback button clicked'); showAdminMenu(); });
      document.body.appendChild(f);
    }
  }, FALLBACK_DELAY_MS);

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
