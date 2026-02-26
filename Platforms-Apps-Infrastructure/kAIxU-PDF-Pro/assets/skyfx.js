(() => {
  "use strict";
  const canvas = document.getElementById("skyfx");
  const loader = document.getElementById("cineloader");
  if (loader) {
    loader.classList.add("on");
    requestAnimationFrame(() => setTimeout(() => loader.classList.remove("on"), 650));
  }
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let w = 0, h = 0, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const particles = [];
  const streaks = [];
  const rand = (a,b) => Math.random()*(b-a)+a;

  function resize() {
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    particles.length = 0;
    streaks.length = 0;
    const count = Math.floor((w * h) / 16000);
    for (let i=0;i<count;i++){
      particles.push({ x: rand(0,w), y: rand(0,h), r: rand(0.6,2.4), z: rand(0.2,1.0), vx: rand(-0.08,0.08), vy: rand(0.02,0.22), tw: rand(0, Math.PI*2) });
    }
    const sCount = Math.max(10, Math.floor(w/120));
    for (let i=0;i<sCount;i++){
      streaks.push({ x: rand(-w*0.2, w*1.2), y: rand(-h*0.2, h*1.2), len: rand(120,420), a: rand(0.02,0.08), speed: rand(0.25,0.85), ang: rand(-0.65,0.65) });
    }
  }

  function draw(time){
    const t = time*0.001;
    ctx.clearRect(0,0,w,h);

    const grd = ctx.createRadialGradient(w*0.5,h*0.45,40,w*0.5,h*0.45,Math.max(w,h)*0.75);
    grd.addColorStop(0,"rgba(123,44,255,0.10)");
    grd.addColorStop(0.35,"rgba(47,227,255,0.06)");
    grd.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const s of streaks){
      const dx = Math.cos(s.ang)*s.len;
      const dy = Math.sin(s.ang)*s.len;
      const x1 = s.x + Math.sin(t*0.3 + s.ang)*18;
      const y1 = s.y + Math.cos(t*0.28 + s.ang)*12;
      const x2 = x1 + dx;
      const y2 = y1 + dy;
      const g = ctx.createLinearGradient(x1,y1,x2,y2);
      g.addColorStop(0,"rgba(47,227,255,0)");
      g.addColorStop(0.45,`rgba(47,227,255,${s.a})`);
      g.addColorStop(0.65,`rgba(255,210,74,${s.a*0.8})`);
      g.addColorStop(1,"rgba(123,44,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      s.x += s.speed*0.35;
      if (s.x > w*1.25) s.x = -w*0.25;
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles){
      p.tw += 0.02 + p.z*0.02;
      p.x += p.vx*(0.6+p.z);
      p.y += p.vy*(0.6+p.z);
      if (p.y > h+10) p.y = -10;
      if (p.x < -10) p.x = w+10;
      if (p.x > w+10) p.x = -10;
      const tw = 0.35 + Math.sin(p.tw + t*1.6)*0.28;
      const a = Math.max(0.05, Math.min(0.6, tw*(0.28+p.z*0.45)));
      const glow = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*6);
      glow.addColorStop(0,`rgba(247,242,255,${a})`);
      glow.addColorStop(0.4,`rgba(47,227,255,${a*0.28})`);
      glow.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => { resize(); init(); }, { passive:true });
  resize(); init(); requestAnimationFrame(draw);
})();