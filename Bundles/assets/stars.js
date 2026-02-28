// assets/stars.js
(function(){
  function initStarfield(canvasId){
    const c = document.getElementById(canvasId);
    if(!c) return;

    const ctx = c.getContext('2d', { alpha: true });
    let W=0, H=0, stars=[], t=0;

    function resize(){
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      W = c.width = Math.floor(window.innerWidth * dpr);
      H = c.height = Math.floor(window.innerHeight * dpr);
      c.style.width = window.innerWidth + 'px';
      c.style.height = window.innerHeight + 'px';

      const count = Math.floor((window.innerWidth * window.innerHeight) / 14000);
      const n = Math.max(90, Math.min(240, count));
      stars = Array.from({length: n}, () => ({
        x: Math.random()*W,
        y: Math.random()*H,
        z: Math.random()*1 + 0.2,
        r: Math.random()*1.2 + 0.3,
        tw: Math.random()*Math.PI*2
      }));
    }

    function draw(){
      t += 0.008;
      ctx.clearRect(0,0,W,H);

      // vignette
      const g = ctx.createRadialGradient(W*0.5,H*0.45, 0, W*0.5,H*0.55, Math.max(W,H)*0.65);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,W,H);

      for(const s of stars){
        s.tw += 0.01*s.z;
        const drift = Math.sin(t*0.8 + s.tw) * (0.35*s.z);
        s.y += 0.08*s.z;
        if(s.y > H+10){ s.y = -10; s.x = Math.random()*W; }

        const a = 0.55 + 0.35*Math.sin(s.tw + t*1.2);
        ctx.beginPath();
        ctx.arc(s.x + drift, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(239,232,255,${Math.max(0.10, a*0.35)})`;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize, { passive:true });
    resize(); draw();
  }

  window.SkyeStars = { init: initStarfield };
})();
