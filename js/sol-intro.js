(() => {
  if (document.getElementById('sol-intro')) return;
  const body = document.body;
  const markup = `
    <div id="sol-intro">
      <canvas id="si-canvas"></canvas>
      <div class="si-lightning" id="si-lightning"></div>
      <div class="si-fog"></div>
      <div class="si-fog si-fog2"></div>
      <div class="si-vignette"></div>
      <div class="si-grain"></div>
      <div class="si-text">
        <div class="si-sub" id="si-sub">An Intelligence Ecosystem</div>
        <h1 class="si-title" id="si-title">Skyes Over London</h1>
        <img src="https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png" class="si-logo" id="si-logo" alt="SOL Logo">
        <div class="si-tagline" id="si-tagline">Eminence In Motion</div>
      </div>
      <button class="si-skip" id="si-skip">Skip</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', markup);
  body.classList.add('sol-intro-active');

  const IC = document.getElementById('sol-intro');
  const canvas = document.getElementById('si-canvas');
  if (!IC || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const LT = document.getElementById('si-lightning');

  let w;
  let h;
  let drops = [];
  let done = false;

  function init() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    drops = [];
    const target = Math.floor(w * 0.4);
    for (let i = 0; i < target; i++) {
      const z = Math.random();
      drops.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        len: (Math.random() * 20 + 10) * (z * 1.5 + 0.5),
        spd: (Math.random() * 15 + 10) * (z * 2 + 0.5),
        op: (Math.random() * 0.3 + 0.05) * (z * 1.5 + 0.2),
        th: (Math.random() * 2 + 0.5) * (z * 1.5 + 0.2)
      });
    }
  }

  function rain() {
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#010206');
    gradient.addColorStop(1, '#060a12');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    drops.forEach(d => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * (0.1 + d.z * 0.05), d.y + d.len);
      ctx.strokeStyle = `rgba(180,200,230,${d.op})`;
      ctx.lineWidth = d.th;
      ctx.stroke();
      d.y += d.spd;
      d.x += d.spd * (0.1 + d.z * 0.05);
      if (d.y > h) {
        d.y = -d.len;
        d.x = Math.random() * w;
      }
    });
    requestAnimationFrame(rain);
  }

  window.addEventListener('resize', init);
  init();
  rain();

  function flash(opacity, duration) {
    if (!LT) return;
    LT.style.opacity = opacity;
    setTimeout(() => { if (LT) LT.style.opacity = '0'; }, duration);
  }

  function end() {
    if (done) return;
    done = true;
    IC.style.transition = 'opacity 1.2s ease';
    IC.style.opacity = '0';
    body.classList.remove('sol-intro-active');
    setTimeout(() => {
      IC.remove();
      document.body.style.overflow = '';
    }, 1200);
  }

  const skipButton = document.getElementById('si-skip');
  skipButton?.addEventListener('click', end);
  body.style.overflow = 'hidden';

  setTimeout(() => flash(0.2, 40), 200);
  setTimeout(() => flash(0.15, 80), 350);
  setTimeout(() => document.getElementById('si-sub')?.classList.add('si-anim-sub'), 400);
  setTimeout(() => {
    flash(0.9, 30);
    setTimeout(() => {
      flash(1, 100);
      document.getElementById('si-logo')?.classList.add('si-anim-logo');
      document.getElementById('si-title')?.classList.add('si-anim-title');
      setTimeout(() => flash(0.5, 60), 150);
      setTimeout(() => document.getElementById('si-tagline')?.classList.add('si-anim-tag'), 600);
    }, 120);
  }, 1500);
  setTimeout(() => flash(0.12, 60), 3500);
  setTimeout(end, 6000);
})();