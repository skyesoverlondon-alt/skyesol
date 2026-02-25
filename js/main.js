/* ══════════════════════════════════════════════
   Main JS — Nav, Scroll Reveals, Counters
   ══════════════════════════════════════════════ */

// ── Service Worker Registration (disabled for now to avoid stale cache) ─────────────────
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').then(reg => {
//       console.info('SW registered', reg.scope);
//       reg.addEventListener('updatefound', () => console.info('SW update found'));
//       if (reg.installing) {
//         reg.installing.addEventListener('statechange', ev => {
//           if (ev.target && ev.target.state) {
//             console.info('SW state change', ev.target.state);
//           }
//         });
//       }
//       navigator.serviceWorker.ready.then(() => console.info('SW ready'));
//     }).catch(err => {
//       console.error('SW registration failed', err);
//     });
//   });
// }

// ── NAV ──
function attachNav(){
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
    { name: 'SkyeSlides', href: '/SkyeSlides/index.html', match: /SkyeSlides/i },
    { name: 'SkyeDrive', href: '/SkyeDrive/index.html', match: /SkyeDrive/i },
    { name: 'SkyeCollab', href: '/SkyeCollab/index.html', match: /SkyeCollab/i },
    { name: 'SkyeSheets', href: '/SkyeSheets/index.html', match: /SkyeSheets/i },
    { name: 'SkyeLedger', href: '/SkyeLedger/index.html', match: /SkyeLedger/i },
    { name: 'SkyeOps', href: '/SkyeOps/index.html', match: /SkyeOps/i }
  ];
  const servicePages = [
    { name: 'Web Builds', href: '/Services/WebBuilds.html', match: /WebBuilds/i },
    { name: 'AI & Data Apps', href: '/Services/ai-data-apps.html', match: /ai-data-apps/i },
    { name: 'Portals & Hubs', href: '/Services/portals-hubs.html', match: /portals-hubs/i },
    { name: 'Ecommerce & Payments', href: '/Services/ecommerce-payments.html', match: /ecommerce-payments/i },
    { name: 'Intake & Routing', href: '/Services/intake-routing.html', match: /intake-routing/i },
    { name: 'Trust Surfaces', href: '/Services/trust-surfaces.html', match: /trust-surfaces/i }
  ];

  // Close all other dropdowns when one opens
  function closeAllDropdowns(except) {
    links.querySelectorAll('.nav-dropdown').forEach(dd => {
      if (dd !== except) dd.classList.remove('expanded');
    });
  }

  function attachServicesDropdown() {
    if (!links) return;
    // Remove any stale flat "Services" <a> that JS shouldn't leave behind
    links.querySelectorAll(':scope > a').forEach(a => {
      if (/^services$/i.test(a.textContent.trim()) && !a.closest('.nav-dropdown')) a.remove();
    });
    let dropdown = links.querySelector('.nav-dropdown[data-type="services"]');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'nav-dropdown';
      dropdown.dataset.type = 'services';
      const dropdownToggleEl = document.createElement('button');
      dropdownToggleEl.type = 'button';
      dropdownToggleEl.className = 'dropdown-toggle';
      dropdownToggleEl.textContent = 'Services';
      const dropdownMenuEl = document.createElement('div');
      dropdownMenuEl.className = 'dropdown-menu';
      dropdown.appendChild(dropdownToggleEl);
      dropdown.appendChild(dropdownMenuEl);
      servicePages.forEach(page => {
        const anchor = document.createElement('a');
        anchor.textContent = page.name;
        anchor.href = page.href;
        dropdownMenuEl.appendChild(anchor);
      });
      const aboutLink = links.querySelector('a[href$="about.html"]');
      const target = aboutLink || links.firstChild;
      if (target) {
        links.insertBefore(dropdown, target);
      } else {
        links.appendChild(dropdown);
      }
    } else {
      // Ensure existing dropdown has all service links
      const dropdownMenuEl = dropdown.querySelector('.dropdown-menu');
      if (dropdownMenuEl) {
        const existing = new Set(Array.from(dropdownMenuEl.querySelectorAll('a')).map(a => a.textContent.trim()));
        servicePages.forEach(page => {
          if (!existing.has(page.name)) {
            const anchor = document.createElement('a');
            anchor.textContent = page.name;
            anchor.href = page.href;
            dropdownMenuEl.appendChild(anchor);
          }
        });
      }
    }
    const dropdownToggle = dropdown.querySelector('.dropdown-toggle');
    const dropdownMenu = dropdown.querySelector('.dropdown-menu');
    if (!dropdownToggle || !dropdownMenu) return;
    const markActive = () => {
      const path = location.pathname;
      let active = false;
      dropdownMenu.querySelectorAll('a').forEach(link => {
        const label = link.textContent.trim();
        const svc = servicePages.find(page => page.name === label);
        if (svc && svc.match.test(path)) {
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
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('expanded');
    });
    document.addEventListener('click', () => dropdown.classList.remove('expanded'));
    dropdownMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => dropdown.classList.remove('expanded'));
    });
    toggle.addEventListener('click', () => dropdown.classList.remove('expanded'));
  }

  function attachSuiteDropdown() {
    if (!links) return;
    // Prevent duplicate
    if (links.querySelector('.nav-dropdown[data-type="suite"]')) {
      // Already exists — just wire up events
      const existing = links.querySelector('.nav-dropdown[data-type="suite"]');
      const existToggle = existing.querySelector('.dropdown-toggle');
      const existMenu = existing.querySelector('.dropdown-menu');
      if (existToggle && existMenu) {
        existToggle.addEventListener('click', event => {
          event.stopPropagation();
          closeAllDropdowns(existing);
          existing.classList.toggle('expanded');
        });
        document.addEventListener('click', () => existing.classList.remove('expanded'));
        existMenu.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', () => existing.classList.remove('expanded'));
        });
        toggle.addEventListener('click', () => existing.classList.remove('expanded'));
      }
      return;
    }
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
    dropdown.dataset.type = 'suite';
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
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle('expanded');
    });
    document.addEventListener('click', () => dropdown.classList.remove('expanded'));
    dropdownMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => dropdown.classList.remove('expanded'));
    });
    toggle.addEventListener('click', () => dropdown.classList.remove('expanded'));
  }

  attachServicesDropdown();
  attachSuiteDropdown();
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.pageYOffset > 60);
  }, { passive: true });
}

// expose for partial-injected navs and run once on load
window.SOL = window.SOL || {};
window.SOL.attachNav = attachNav;
attachNav();

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
  const servicePages = [
    { name: 'Web Builds', href: '/Services/WebBuilds.html' },
    { name: 'AI & Data Apps', href: '/Services/ai-data-apps.html' },
    { name: 'Portals & Hubs', href: '/Services/portals-hubs.html' },
    { name: 'Ecommerce & Payments', href: '/Services/ecommerce-payments.html' },
    { name: 'Intake & Routing', href: '/Services/intake-routing.html' },
    { name: 'Trust Surfaces', href: '/Services/trust-surfaces.html' }
  ];
  const grid = megaNav.querySelector('.mega-nav-grid');
  if (grid) {
    const cols = Array.from(grid.querySelectorAll('.mega-nav-col'));
    let servicesCol = cols.find(col => {
      const label = col.querySelector('.mega-nav-label');
      return label && label.textContent.trim().toLowerCase() === 'services';
    });
    const platformCol = cols.find(col => {
      const label = col.querySelector('.mega-nav-label');
      return label && label.textContent.trim().toLowerCase() === 'platform';
    });
    if (!servicesCol) {
      servicesCol = document.createElement('div');
      servicesCol.className = 'mega-nav-col';
      servicesCol.setAttribute('data-col', 'services');
      const label = document.createElement('div');
      label.className = 'mega-nav-label';
      label.textContent = 'Services';
      servicesCol.appendChild(label);
      const insertBeforeNode = platformCol || null;
      if (insertBeforeNode) {
        grid.insertBefore(servicesCol, insertBeforeNode);
      } else {
        grid.appendChild(servicesCol);
      }
    }
    const existingTexts = new Set(Array.from(servicesCol.querySelectorAll('a')).map(a => a.textContent.trim()));
    servicePages.forEach(page => {
      if (existingTexts.has(page.name)) return;
      const anchor = document.createElement('a');
      anchor.textContent = page.name;
      anchor.href = page.href;
      servicesCol.appendChild(anchor);
    });
  }
  function openNav()  { megaNav.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function closeNav() { megaNav.style.display = 'none';  document.body.style.overflow = ''; }
  menuBtn.addEventListener('click', openNav);
  if (megaClose) megaClose.addEventListener('click', closeNav);
  megaNav.addEventListener('click', function(e){ if (e.target === megaNav) closeNav(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeNav(); });
});
