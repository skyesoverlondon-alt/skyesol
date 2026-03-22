(function () {
  const root = document.getElementById('background-root');
  if (!root) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'background-canvas';
  const overlay = document.createElement('div');
  overlay.id = 'background-overlay';
  root.appendChild(canvas);
  root.appendChild(overlay);

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let stars = [];
  let raf = null;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(80, Math.floor((width * height) / 14000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.8 + 0.25,
      a: Math.random() * 0.7 + 0.15,
      t: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.0012 + 0.0002,
      drift: Math.random() * 0.14 + 0.04
    }));
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(8, 10, 20, 0.7)');
    grad.addColorStop(1, 'rgba(5, 7, 15, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (const s of stars) {
      s.t += s.speed * (time || 0);
      const pulse = 0.6 + Math.sin(s.t) * 0.4;
      const y = s.y + Math.sin(s.t * 0.4) * s.drift * 8;
      const x = s.x + Math.cos(s.t * 0.25) * s.drift * 4;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.12, s.a * pulse)})`;
      ctx.arc(x, y, s.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    const orb1 = ctx.createRadialGradient(width * 0.18, height * 0.18, 0, width * 0.18, height * 0.18, width * 0.32);
    orb1.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
    orb1.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, width, height);

    const orb2 = ctx.createRadialGradient(width * 0.76, height * 0.22, 0, width * 0.76, height * 0.22, width * 0.24);
    orb2.addColorStop(0, 'rgba(244, 199, 91, 0.11)');
    orb2.addColorStop(1, 'rgba(244, 199, 91, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, width, height);

    raf = requestAnimationFrame(draw);
  }

  resize();
  draw(0);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => raf && cancelAnimationFrame(raf), { once: true });
})();
