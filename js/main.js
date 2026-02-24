/* ══════════════════════════════════════════════
   Main JS — Nav, Scroll Reveals, Counters
   ══════════════════════════════════════════════ */

// ── NAV ──
(function(){
  const nav = document.getElementById('mainNav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!nav || !toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.textContent = '☰';
  }));
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.pageYOffset > 60);
  }, { passive: true });
})();

// ── SCROLL REVEAL ──
(function(){
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  els.forEach(el => obs.observe(el));
})();

// ── ANIMATED COUNTERS ──
(function(){
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const triggered = new Set();

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 2200;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      if (target >= 10000) {
        el.textContent = Math.floor(current / 1000) + 'K' + suffix;
      } else {
        el.textContent = current.toLocaleString() + suffix;
      }
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  counters.forEach(c => {
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !triggered.has(e.target)) {
          triggered.add(e.target);
          animateCounter(e.target);
        }
      });
    }, { threshold: 0.5 }).observe(c);
  });
})();
