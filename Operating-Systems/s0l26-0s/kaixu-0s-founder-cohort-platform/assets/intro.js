(function () {
  const gate = document.getElementById('intro-gate');
  if (!gate) return;

  const reveal = document.getElementById('intro-reveal');
  const enterBtn = document.getElementById('enter-cohort');
  const skipBtn = document.getElementById('skip-intro');
  const seenKey = 'osFounderCohortIntroSeen';

  if (sessionStorage.getItem(seenKey) === '1') {
    document.body.classList.remove('intro-active');
    gate.remove();
    return;
  }

  document.body.classList.add('intro-active');

  const rainCanvas = document.getElementById('intro-rain');
  const rainCtx = rainCanvas.getContext('2d');
  const lightCanvas = document.getElementById('intro-lightning');
  const lightCtx = lightCanvas.getContext('2d');
  const lensCanvas = document.getElementById('intro-lens');
  const lensCtx = lensCanvas.getContext('2d');

  let width = 0;
  let height = 0;
  let drops = [];
  let rainRaf = null;
  let flashTimers = [];
  let closed = false;

  function resizeCanvases() {
    const viewport = window.visualViewport;
    width = Math.round(viewport ? viewport.width : window.innerWidth);
    height = Math.round(viewport ? viewport.height : window.innerHeight);
    [rainCanvas, lightCanvas, lensCanvas].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    });
    initRain();
    drawLensDrops();
  }

  function drawLensDrops() {
    lensCtx.clearRect(0, 0, width, height);
    for (let i = 0; i < 24; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 38 + 10;
      const opacity = Math.random() * 0.12 + 0.05;
      const gradient = lensCtx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
      gradient.addColorStop(0.8, `rgba(200,220,255,${opacity * 0.45})`);
      gradient.addColorStop(1, 'transparent');
      lensCtx.fillStyle = gradient;
      lensCtx.beginPath();
      lensCtx.arc(x, y, r, 0, Math.PI * 2);
      lensCtx.fill();
    }
  }

  function initRain() {
    drops = [];
    const dropCount = Math.floor(width * 0.42);
    for (let i = 0; i < dropCount; i += 1) {
      const z = Math.random();
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        len: (Math.random() * 28 + 15) * (z + 0.5),
        speed: (Math.random() * 18 + 16) * (z + 0.5),
        opacity: (Math.random() * 0.2 + 0.05) * (z + 0.5),
        wind: Math.random() * 2 + 1
      });
    }
  }

  function renderRain() {
    rainCtx.clearRect(0, 0, width, height);
    rainCtx.lineCap = 'round';
    for (const d of drops) {
      rainCtx.beginPath();
      rainCtx.moveTo(d.x, d.y);
      rainCtx.lineTo(d.x + d.wind, d.y + d.len);
      rainCtx.strokeStyle = `rgba(180,200,240,${d.opacity})`;
      rainCtx.lineWidth = d.z * 1.4 + 0.4;
      rainCtx.stroke();
      d.y += d.speed;
      d.x += d.wind;
      if (d.y > height) {
        d.y = -d.len;
        d.x = Math.random() * width;
      }
    }
    rainRaf = requestAnimationFrame(renderRain);
  }

  function drawLightningBranch(x1, y1, x2, y2, thickness, opacity) {
    lightCtx.beginPath();
    lightCtx.moveTo(x1, y1);
    lightCtx.lineTo(x2, y2);
    lightCtx.lineWidth = thickness;
    lightCtx.strokeStyle = `rgba(230,240,255,${opacity})`;
    lightCtx.shadowBlur = thickness * 5;
    lightCtx.shadowColor = '#aa00ff';
    lightCtx.stroke();
  }

  function createFractalBolt(startX, startY, endY, isMainBolt = true) {
    let currX = startX;
    let currY = startY;
    const segments = isMainBolt ? Math.floor(Math.random() * 10) + 15 : Math.floor(Math.random() * 5) + 5;
    const segmentLength = (endY - startY) / segments;
    let currentThickness = isMainBolt ? Math.random() * 3 + 3 : Math.random() * 1.5 + 0.5;
    let currentOpacity = isMainBolt ? 1 : 0.6;

    for (let i = 0; i < segments; i += 1) {
      const nextY = currY + segmentLength;
      const nextX = currX + (Math.random() - 0.5) * (isMainBolt ? 100 : 50);
      drawLightningBranch(currX, currY, nextX, nextY, currentThickness, currentOpacity);
      if (Math.random() > 0.72 && currentThickness > 1) {
        createFractalBolt(currX, currY, currY + (Math.random() * 200 + 100), false);
      }
      currX = nextX;
      currY = nextY;
      currentThickness *= 0.9;
      currentOpacity *= 0.94;
    }
  }

  function triggerStrike(intensity, big) {
    lightCtx.clearRect(0, 0, width, height);
    lightCtx.fillStyle = `rgba(170,0,255,${intensity * 0.12})`;
    lightCtx.fillRect(0, 0, width, height);
    lightCtx.fillStyle = `rgba(255,255,255,${intensity * 0.26})`;
    lightCtx.fillRect(0, 0, width, height);
    const numBolts = big ? Math.floor(Math.random() * 3) + 2 : 1;
    for (let i = 0; i < numBolts; i += 1) {
      const startX = (Math.random() * 0.8 + 0.1) * width;
      createFractalBolt(startX, -10, height * (Math.random() * 0.45 + 0.5), true);
    }
    const t1 = setTimeout(() => {
      lightCtx.clearRect(0, 0, width, height);
      lightCtx.fillStyle = `rgba(170,0,255,${intensity * 0.05})`;
      lightCtx.fillRect(0, 0, width, height);
      const t2 = setTimeout(() => lightCtx.clearRect(0, 0, width, height), 110);
      flashTimers.push(t2);
    }, 55);
    flashTimers.push(t1);
  }

  function showReveal() {
    reveal.classList.add('active');
  }

  function closeIntro() {
    if (closed) return;
    closed = true;
    sessionStorage.setItem(seenKey, '1');
    gate.classList.add('hidden');
    setTimeout(() => {
      if (rainRaf) cancelAnimationFrame(rainRaf);
      flashTimers.forEach((t) => clearTimeout(t));
      document.body.classList.remove('intro-active');
      gate.remove();
    }, 1200);
  }

  function boot() {
    resizeCanvases();
    renderRain();
    gate.classList.add('played');
    const timings = [
      [400, () => triggerStrike(0.34, false)],
      [1300, () => triggerStrike(0.2, false)],
      [3800, () => triggerStrike(0.95, true)],
      [4200, () => triggerStrike(0.5, true)],
      [7800, showReveal],
      [15500, closeIntro]
    ];
    timings.forEach(([ms, fn]) => {
      const timer = setTimeout(() => {
        if (!closed) fn();
      }, ms);
      flashTimers.push(timer);
    });
  }

  if (enterBtn) enterBtn.addEventListener('click', closeIntro);
  if (skipBtn) skipBtn.addEventListener('click', closeIntro);
  window.addEventListener('resize', resizeCanvases, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvases, { passive: true });
  window.addEventListener('pagehide', () => {
    if (rainRaf) cancelAnimationFrame(rainRaf);
    flashTimers.forEach((t) => clearTimeout(t));
    document.body.classList.remove('intro-active');
  }, { once: true });

  boot();
})();
