/* ══════════════════════════════════════════════
   Main JS — Nav, Scroll Reveals, Counters
   ══════════════════════════════════════════════ */

// ── Service Worker Registration ─────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

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
  const suiteApps = [
    { name: 'SkyeDocx', href: '/SkyeDocx/homepage.html', match: /SkyeDocx/i },
    { name: 'SkyeFlow', href: '/SkyeFlow/index.html', match: /SkyeFlow/i },
    { name: 'SkyeArchive', href: '/SkyeArchive/index.html', match: /SkyeArchive/i },
    { name: 'SkyeCollab', href: '/SkyeCollab/index.html', match: /SkyeCollab/i },
    { name: 'SkyeSheets', href: '/SkyeSheets/index.html', match: /SkyeSheets/i },
    { name: 'SkyeLedger', href: '/SkyeLedger/index.html', match: /SkyeLedger/i },
    { name: 'SkyeOps', href: '/SkyeOps/index.html', match: /SkyeOps/i }
  ];
  function attachSuiteDropdown() {
    if (!links || links.querySelector('.nav-dropdown')) return;
    const anchors = [];
    let insertBeforeNode = null;
    Array.from(links.children).forEach(child => {
      if (child.tagName !== 'A') return;
      const label = child.textContent.trim();
      const matched = suiteApps.find(app => app.name === label);
      if (matched) {
        anchors.push(child);
        child.dataset.suiteApp = matched.name;
        insertBeforeNode = insertBeforeNode || child;
      }
    });
    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';
    const dropdownToggle = document.createElement('button');
    dropdownToggle.type = 'button';
    dropdownToggle.className = 'dropdown-toggle';
    dropdownToggle.textContent = 'SkyeSuite';
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu';
    dropdown.appendChild(dropdownToggle);
    dropdown.appendChild(dropdownMenu);
    const aboutLink = links.querySelector('a[href$="about.html"]');
    const target = insertBeforeNode || (aboutLink ? aboutLink.nextSibling : null);
    links.insertBefore(dropdown, target);
    anchors.forEach(link => dropdownMenu.appendChild(link));
    suiteApps.forEach(app => {
      const present = Array.from(dropdownMenu.children).some(child => child.textContent.trim() === app.name);
        if (!present) {
        const anchor = document.createElement('a');
        anchor.textContent = app.name;
        anchor.href = app.href;
        anchor.setAttribute('data-suite-app', app.name);
        dropdownMenu.appendChild(anchor);
      }
    });
    const markActive = () => {
      const path = location.pathname;
      let active = false;
      dropdownMenu.querySelectorAll('a').forEach(link => {
        const label = link.textContent.trim();
        const appDef = suiteApps.find(app => app.name === label);
        if (appDef && appDef.match.test(path)) {
          link.classList.add('active');
          active = true;
        } else {
          link.classList.remove('active');
        }
      });
      dropdownToggle.classList.toggle('active', active);
    };
    markActive();
    dropdownToggle.addEventListener('click', event => {
      event.stopPropagation();
      dropdown.classList.toggle('expanded');
    });
    document.addEventListener('click', () => dropdown.classList.remove('expanded'));
    dropdownMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => dropdown.classList.remove('expanded'));
    });
    toggle.addEventListener('click', () => dropdown.classList.remove('expanded'));
  }
  attachSuiteDropdown();
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

// ── Mega Nav ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  const menuBtn   = document.getElementById('menuBtn');
  const megaNav   = document.getElementById('megaNav');
  const megaClose = document.getElementById('megaNavClose');
  if (!menuBtn || !megaNav) return;
  function openNav()  { megaNav.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function closeNav() { megaNav.style.display = 'none';  document.body.style.overflow = ''; }
  menuBtn.addEventListener('click', openNav);
  if (megaClose) megaClose.addEventListener('click', closeNav);
  megaNav.addEventListener('click', function(e){ if (e.target === megaNav) closeNav(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeNav(); });
});
