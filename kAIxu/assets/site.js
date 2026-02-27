(function(){
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function unlockScrollAfterOpener(){
    const unlock = () => setTimeout(() => document.body.classList.remove("locked"), 5200);
    if (document.readyState === "complete") {
      unlock();
    } else {
      window.addEventListener("load", unlock);
    }
  }

  function navScrollState(){
    const nav = $("#nav");
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 18) nav.classList.add("scrolled");
      else nav.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
  }

  function revealOnScroll(){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, { threshold: 0.12 });
    $all(".fade-up").forEach(el => io.observe(el));
  }

  function setActiveNav(){
    const page = document.body.getAttribute("data-page") || "";
    const links = $all('[data-nav]');
    links.forEach(a => a.classList.remove("active"));
    const active = links.find(a => (a.getAttribute("data-nav") || "") === page);
    if (active) active.classList.add("active");
  }

  function starfield(){
    const canvas = $("#stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha:true });
    let w, h, dpr;
    const stars = [];
    const STAR_COUNT = 190;

    function resize(){
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth = window.innerWidth;
      h = canvas.clientHeight = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rand(min, max){ return Math.random() * (max - min) + min; }

    function seed(){
      stars.length = 0;
      for (let i=0; i<STAR_COUNT; i++){
        stars.push({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(0.4, 1.6),
          a: rand(0.15, 0.85),
          vx: rand(-0.06, 0.06),
          vy: rand(-0.03, 0.09),
        });
      }
    }

    function step(){
      ctx.clearRect(0,0,w,h);

      const g1 = ctx.createRadialGradient(w*0.18, h*0.12, 0, w*0.18, h*0.12, Math.max(w,h)*0.8);
      g1.addColorStop(0, "rgba(162,67,255,0.10)");
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1; ctx.fillRect(0,0,w,h);

      const g2 = ctx.createRadialGradient(w*0.82, h*0.22, 0, w*0.82, h*0.22, Math.max(w,h)*0.8);
      g2.addColorStop(0, "rgba(39,242,255,0.07)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2; ctx.fillRect(0,0,w,h);

      const g3 = ctx.createRadialGradient(w*0.62, h*0.88, 0, w*0.62, h*0.88, Math.max(w,h)*0.8);
      g3.addColorStop(0, "rgba(255,211,106,0.06)");
      g3.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g3; ctx.fillRect(0,0,w,h);

      for (const s of stars){
        s.x += s.vx; s.y += s.vy;
        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        if (s.y > h + 10) s.y = -10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(step);
    }

    window.addEventListener("resize", () => { resize(); seed(); }, { passive:true });
    resize(); seed(); step();
  }

  function pricingEstimator(){
    const form = document.getElementById("estimator");
    if (!form) return;

    const models = {
      flash: { name:"kAIxU 6.7 Flash", inPerM: 0.14, outPerM: 0.56, ctx:"Up to 512K" },
      pro:   { name:"kAIxU 6.7 Pro",   inPerM: 7.05, outPerM: 21.15, ctx:"Up to 2M" },
      ultra: { name:"kAIxU 6.7 Ultra", inPerM: 12.69, outPerM: 38.07, ctx:"Up to 2M" }
    };

    const plans = {
      starter: { name:"kAIxU Starter", monthly: 249 },
      team:    { name:"kAIxU Team", monthly: 799 },
      scale:   { name:"kAIxU Scale", monthly: 1890 }
    };

    const modelSel = document.getElementById("model");
    const planSel  = document.getElementById("plan");
    const inTokens = document.getElementById("inTokens");
    const outTokens= document.getElementById("outTokens");

    const outTotal = document.getElementById("estTotal");
    const outBreak = document.getElementById("estBreakdown");

    function n(v){
      const x = parseFloat(String(v).replace(/,/g,"").trim());
      return Number.isFinite(x) ? x : 0;
    }
    function money(x){
      return x.toLocaleString(undefined, { style:"currency", currency:"USD", maximumFractionDigits:2 });
    }

    function calc(){
      const m = models[modelSel.value] || models.flash;
      const p = plans[planSel.value] || plans.starter;

      const inM  = n(inTokens.value)  / 1000000;
      const outM = n(outTokens.value) / 1000000;

      const usage = (inM * m.inPerM) + (outM * m.outPerM);
      const platform = p.monthly;
      const total = usage + platform;

      outTotal.textContent = money(total);
      outBreak.innerHTML =
        `<div><b>Plan:</b> ${p.name} (${money(platform)}/mo)</div>` +
        `<div><b>Model:</b> ${m.name} (${m.ctx})</div>` +
        `<div><b>Usage estimate:</b> ${money(usage)} — Input ${money(inM*m.inPerM)} + Output ${money(outM*m.outPerM)}</div>` +
        `<div style="margin-top:.35rem;color:rgba(255,255,255,.70);">Calculated from token totals you enter. Input and output are billed separately.</div>`;
    }

    ["change","input"].forEach(evt => {
      form.addEventListener(evt, (e) => {
        if (e.target && (e.target.matches("input") || e.target.matches("select"))) calc();
      });
    });

    calc();
  }

  document.addEventListener("DOMContentLoaded", () => {
    unlockScrollAfterOpener();
    navScrollState();
    revealOnScroll();
    setActiveNav();
    starfield();
    pricingEstimator();
  });
})();