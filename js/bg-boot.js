/* ══════════════════════════════════════════════
   Holographic Boot Sequence — Global Background
   Sits behind Three.js aurora particles.
   z-index: -1 · position: fixed · pointer-events: none
   Injected site-wide via partials.js
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  // Prevent double-init
  if (document.getElementById('sol-boot-sequence')) return;

  /* ── 1. Inject Google Font ── */
  if (!document.querySelector('link[href*="Share+Tech+Mono"]')) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap';
    document.head.appendChild(font);
  }

  /* ── 2. Inject CSS ── */
  const style = document.createElement('style');
  style.id = 'sol-boot-styles';
  style.textContent = `
    :root {
      --sol-bg0:      #030307;
      --sol-gold:     #ffd36a;
      --sol-purple:   #a243ff;
      --sol-cyan:     #00f3ff;
      --sol-cyan-dim: rgba(0,243,255,0.15);
    }

    /* ── Fullscreen Fixed Background ── */
    #sol-boot-sequence {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background: var(--sol-bg0);
      perspective: 1000px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Share Tech Mono', monospace;
    }

    /* CRT Scanlines */
    #sol-boot-sequence .sol-scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 3px,
        rgba(0,0,0,0.25) 3px,
        rgba(0,0,0,0.25) 4px
      );
      z-index: 2;
      pointer-events: none;
      animation: sol-flicker 8s ease-in-out infinite;
    }
    @keyframes sol-flicker {
      0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.8} 94%{opacity:1} 96%{opacity:0.9} 97%{opacity:1}
    }

    /* Vignette */
    #sol-boot-sequence .sol-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%);
      z-index: 3;
      pointer-events: none;
    }

    /* 3D Moving Floor Grid */
    #sol-boot-sequence .sol-cyber-grid {
      position: absolute;
      bottom: -30%;
      left: -50%;
      width: 200%;
      height: 100%;
      background-image:
        linear-gradient(var(--sol-cyan-dim) 1px, transparent 1px),
        linear-gradient(90deg, var(--sol-cyan-dim) 1px, transparent 1px);
      background-size: 50px 50px;
      transform: rotateX(75deg);
      transform-origin: top center;
      animation: sol-gridScroll 3s linear infinite;
      z-index: 1;
      mask-image: linear-gradient(to bottom, transparent 0%, black 40%, black 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 40%, black 100%);
    }
    @keyframes sol-gridScroll {
      0%   { transform: rotateX(75deg) translateY(0); }
      100% { transform: rotateX(75deg) translateY(50px); }
    }

    /* Neon Stars — canvas-based (replaces 250 animated divs) */
    #sol-boot-sequence .sol-stars-canvas {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      width: 100%;
      height: 100%;
    }

    /* Console Core */
    #sol-boot-sequence .sol-console-core {
      position: relative;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 600px;
    }

    /* Holographic 3D Rings */
    #sol-boot-sequence .sol-hologram-stage {
      position: relative;
      width: 340px;
      height: 340px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      transform-style: preserve-3d;
    }

    #sol-boot-sequence .sol-holo-logo {
      width: 220px;
      position: absolute;
      z-index: 5;
      filter: drop-shadow(0 0 15px rgba(0,243,255,0.4)) drop-shadow(0 0 30px rgba(162,67,255,0.2));
      animation: sol-logoFloat 4s ease-in-out infinite, sol-logoGlitch 6s infinite;
    }

    #sol-boot-sequence .sol-ring {
      position: absolute;
      border-radius: 50%;
      border: 1px solid transparent;
      box-shadow: inset 0 0 15px rgba(255,255,255,0.05), 0 0 15px rgba(255,255,255,0.05);
    }
    #sol-boot-sequence .sol-ring-1 {
      width: 320px; height: 320px;
      border-top: 2px solid var(--sol-cyan);
      border-bottom: 2px solid var(--sol-cyan);
      animation: sol-spinAxis1 4s linear infinite;
    }
    #sol-boot-sequence .sol-ring-2 {
      width: 280px; height: 280px;
      border-left: 2px solid var(--sol-purple);
      border-right: 2px solid var(--sol-purple);
      animation: sol-spinAxis2 5s linear infinite;
    }
    #sol-boot-sequence .sol-ring-3 {
      width: 240px; height: 240px;
      border-top: 2px solid var(--sol-gold);
      border-left: 2px solid var(--sol-gold);
      animation: sol-spinAxis3 3.5s linear infinite;
    }

    @keyframes sol-spinAxis1 { 0% { transform: rotateX(70deg) rotateZ(0deg);   } 100% { transform: rotateX(70deg) rotateZ(360deg); } }
    @keyframes sol-spinAxis2 { 0% { transform: rotateY(70deg) rotateZ(0deg);   } 100% { transform: rotateY(70deg) rotateZ(360deg); } }
    @keyframes sol-spinAxis3 { 0% { transform: rotateX(45deg) rotateY(45deg) rotateZ(0deg); } 100% { transform: rotateX(45deg) rotateY(45deg) rotateZ(360deg); } }

    @keyframes sol-logoFloat {
      0%,100% { transform: translateY(0px) scale(1); }
      50%      { transform: translateY(-6px) scale(1.04); }
    }
    @keyframes sol-logoGlitch {
      0%,96%,100% { filter: drop-shadow(0 0 15px rgba(0,243,255,0.4)) hue-rotate(0deg); opacity:1; }
      97% { filter: drop-shadow(0 0 25px var(--sol-purple)) hue-rotate(90deg);  opacity:0.8; transform:translateX(2px); }
      98% { filter: drop-shadow(0 0 25px var(--sol-cyan))   hue-rotate(-90deg); opacity:0.9; transform:translateX(-2px); }
      99% { filter: drop-shadow(0 0 15px var(--sol-gold))   hue-rotate(45deg);  opacity:1;   transform:translateX(0); }
    }

    /* Terminal Text */
    #sol-boot-sequence .sol-terminal-output {
      width: 100%;
      height: 80px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 24px;
      position: relative;
    }
    #sol-boot-sequence .sol-log-line {
      font-size: 11px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      margin-bottom: 5px;
      transition: all 0.3s ease;
      text-align: center;
      width: 100%;
    }
    #sol-boot-sequence .sol-log-line.active {
      color: var(--sol-cyan);
      text-shadow: 0 0 8px var(--sol-cyan);
      font-size: 12px;
    }
    #sol-boot-sequence .sol-cursor {
      display: inline-block;
      width: 7px; height: 14px;
      background: var(--sol-cyan);
      margin-left: 5px;
      vertical-align: middle;
      animation: sol-blink 0.8s step-end infinite;
      box-shadow: 0 0 10px var(--sol-cyan);
    }
    @keyframes sol-blink { 50% { opacity: 0; } }

    /* Progress Bar */
    #sol-boot-sequence .sol-progress-container {
      width: 280px;
      height: 3px;
      background: rgba(255,255,255,0.05);
      border-radius: 2px;
      position: relative;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);
      overflow: hidden;
    }
    #sol-boot-sequence .sol-progress-fill {
      position: absolute;
      top: 0; left: 0; bottom: 0;
      width: 0%;
      background: linear-gradient(90deg, transparent, var(--sol-cyan) 50%, var(--sol-gold) 80%, #fff 100%);
      box-shadow: 0 0 12px rgba(0,243,255,0.6);
      transition: width 0.1s linear;
    }
    #sol-boot-sequence .sol-progress-glow {
      position: absolute;
      right: 0; top: -3px; bottom: -3px;
      width: 4px;
      background: #fff;
      box-shadow: 0 0 12px 4px var(--sol-cyan);
      border-radius: 50%;
    }
  `;
  document.head.appendChild(style);

  /* ── 3. Inject DOM ── */
  const boot = document.createElement('div');
  boot.id = 'sol-boot-sequence';
  boot.innerHTML = `
    <canvas class="sol-stars-canvas" id="sol-boot-stars"></canvas>
    <div class="sol-scanlines"></div>
    <div class="sol-vignette"></div>
    <div class="sol-cyber-grid"></div>
    <div class="sol-console-core">
      <div class="sol-hologram-stage">
        <div class="sol-ring sol-ring-1"></div>
        <div class="sol-ring sol-ring-2"></div>
        <div class="sol-ring sol-ring-3"></div>
        <img
          src="https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png"
          alt="Skyes Over London"
          class="sol-holo-logo"
        >
      </div>
      <div class="sol-terminal-output" id="sol-boot-terminal"></div>
      <div class="sol-progress-container">
        <div class="sol-progress-fill" id="sol-boot-bar">
          <div class="sol-progress-glow"></div>
        </div>
      </div>
    </div>
  `;
  // Insert as very first child of body so it underlies everything
  document.body.insertBefore(boot, document.body.firstChild);

  /* ── 4. Animation ── */
  const bootLines = [
    'INITIALIZING SKYES OVER LONDON SHELL',
    'LOADING KAIXU GATE DELTA POSTMORTEM',
    'VERIFYING GOVERNANCE POSTURE',
    'RENDERING SUPERGATE UPGRADE LOG',
    'BYPASSING SECURITY PROTOCOLS',
    'DECRYPTING NEURAL ARCHIVE',
    'SYSTEM REBOOT INITIATED'
  ];

  const terminal    = document.getElementById('sol-boot-terminal');
  const progressBar = document.getElementById('sol-boot-bar');
  const starsEl     = document.getElementById('sol-boot-stars');

  // Canvas stars — 250 stars in a single canvas element (no DOM thrash)
  const starCanvas = starsEl;
  const ctx = starCanvas.getContext('2d');
  const starData = [];
  const STAR_COLORS_RAW = ['#00f3ff', '#a243ff', '#ffd36a', '#ffffff'];
  const STAR_COUNT = 250;

  function initStarCanvas() {
    starCanvas.width  = boot.offsetWidth  || window.innerWidth;
    starCanvas.height = boot.offsetHeight || window.innerHeight;
    starData.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      starData.push({
        x:        Math.random() * starCanvas.width,
        y:        Math.random() * starCanvas.height,
        r:        Math.random() * 1.5 + 0.5,
        color:    STAR_COLORS_RAW[Math.floor(Math.random() * STAR_COLORS_RAW.length)],
        phase:    Math.random() * Math.PI * 2,
        speed:    Math.random() * 0.008 + 0.003,
        driftX:   (Math.random() - 0.5) * 0.15,
        driftY:   (Math.random() - 0.5) * 0.15,
      });
    }
  }

  let starRafId;
  function drawStars(ts) {
    ctx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    for (let i = 0; i < starData.length; i++) {
      const s = starData[i];
      s.x += s.driftX;
      s.y += s.driftY;
      if (s.x < 0) s.x = starCanvas.width;
      if (s.x > starCanvas.width) s.x = 0;
      if (s.y < 0) s.y = starCanvas.height;
      if (s.y > starCanvas.height) s.y = 0;
      const alpha = (Math.sin(ts * s.speed + s.phase) + 1) / 2;
      ctx.globalAlpha = 0.1 + alpha * 0.9;
      ctx.fillStyle = s.color;
      ctx.shadowBlur = alpha > 0.7 ? 8 : 0;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    starRafId = requestAnimationFrame(drawStars);
  }

  initStarCanvas();
  starRafId = requestAnimationFrame(drawStars);

  // Resize handler
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() { initStarCanvas(); }, 200);
  });

  // Scramble text effect
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+<>?';
  const sleep  = ms => new Promise(r => setTimeout(r, ms));

  const totalChars = bootLines.join('').length;
  let charsTyped = 0;

  function updateProgress() {
    charsTyped++;
    progressBar.style.width = Math.min((charsTyped / totalChars) * 100, 100) + '%';
  }

  async function scrambleText(el, final) {
    let built = '';
    for (let i = 0; i < final.length; i++) {
      for (let j = 0; j < 2; j++) {
        el.innerHTML = built + chars[Math.floor(Math.random() * chars.length)] + '<span class="sol-cursor"></span>';
        await sleep(15);
      }
      built += final[i];
      el.innerHTML = built + '<span class="sol-cursor"></span>';
      updateProgress();
    }
  }

  async function runBootSequence() {
    charsTyped = 0;
    terminal.innerHTML = '';
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    void progressBar.offsetWidth; // reflow
    progressBar.style.transition = 'width 0.1s linear';

    const logEls = [];

    for (let i = 0; i < bootLines.length; i++) {
      if (logEls.length > 0) {
        logEls[logEls.length - 1].classList.remove('active');
        logEls[logEls.length - 1].innerHTML = logEls[logEls.length - 1].innerText;
      }
      const line = document.createElement('div');
      line.className = 'sol-log-line active';
      terminal.appendChild(line);
      logEls.push(line);
      if (logEls.length > 3) logEls[logEls.length - 4].style.display = 'none';

      await scrambleText(line, bootLines[i]);
      if (i !== bootLines.length - 1) {
        await sleep(400);
      } else {
        progressBar.style.width = '100%';
        await sleep(2500);
      }
    }

    terminal.style.transition = 'opacity 0.6s ease-out';
    terminal.style.opacity    = '0';
    await sleep(700);
    terminal.style.opacity    = '1';
    terminal.style.transition = '';

    runBootSequence();
  }

  setTimeout(runBootSequence, 500);

})();
