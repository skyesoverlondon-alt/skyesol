function ensureStyleSheet(href){
  if (!document || !document.head) return;
  const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(link => (link.getAttribute('href') || '').includes(href));
  if (exists) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureScript(src, callback){
  if (!document || !document.head) {
    if (typeof callback === 'function') callback();
    return;
  }

  const found = Array.from(document.querySelectorAll('script[src]'))
    .find(s => (s.getAttribute('src') || '').includes(src));

  if (found) {
    if (typeof callback === 'function') {
      if (found.dataset.loaded === 'true') {
        callback();
      } else {
        found.addEventListener('load', callback, { once: true });
      }
    }
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.onload = () => {
    script.dataset.loaded = 'true';
    if (typeof callback === 'function') callback();
  };
  document.head.appendChild(script);
}

async function injectPartial(selector, url, position){
  if (!document || !document.body) return;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return;
    const html = await res.text();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const node = wrapper.firstElementChild;
    if (!node) return;

    const target = document.querySelector(selector);
    if (target) {
      target.replaceWith(node);
    } else if (position === 'start') {
      document.body.prepend(node);
    } else {
      document.body.appendChild(node);
    }

    // Re-bind nav + mega nav when header is swapped in
    if (node.matches('nav.main-nav') && window.SOL) {
      if (typeof window.SOL.attachNav === 'function') {
        window.SOL.attachNav();
      }
      if (typeof window.SOL.attachMegaNav === 'function') {
        window.SOL.attachMegaNav();
      }
    } else if (node.matches('nav.main-nav')) {
      ensureScript('/js/main.js', () => {
        if (window.SOL && typeof window.SOL.attachNav === 'function') {
          window.SOL.attachNav();
        }
        if (window.SOL && typeof window.SOL.attachMegaNav === 'function') {
          window.SOL.attachMegaNav();
        }
      });
    }

    // Ensure admin menu triggers script is loaded once footer/header are present
    if (!window.__adminMenuTriggersLoaderAdded) {
      window.__adminMenuTriggersLoaderAdded = true;
      const s = document.createElement('script');
      s.src = '/js/admin-menu-triggers.js';
      s.async = false; // ensure execution order
      s.onload = () => console.debug('admin-menu-triggers loaded');
      s.onerror = (e) => console.warn('admin-menu-triggers failed to load', e);
      document.head.appendChild(s);
    }
  } catch (err) {
    console.warn('Partial inject failed for', url, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Ensure pages using partial headers always have the nav style/runtime stack.
  ensureStyleSheet('/css/style.css');
  ensureScript('/js/main.js');

  // ── Holographic Boot Sequence Background (site-wide) ──
  if (!document.getElementById('sol-boot-sequence')) {
    const bgScript = document.createElement('script');
    bgScript.src = '/js/bg-boot.js';
    document.head.appendChild(bgScript);
  }

  injectPartial('nav.main-nav', '/partials/header.html', 'start');
  injectPartial('footer', '/partials/footer.html', 'end');
  // Ensure admin menu floating link exists on pages that include partials.js
  if (!document.getElementById('adminMenuFloatLink')) {
    const a = document.createElement('a');
    a.id = 'adminMenuFloatLink';
    a.className = 'floating-glow-neon';
    a.href = '/admin-menu.html';
    a.textContent = 'ADMIN MENU';
    a.style.display = 'block';
    document.body.appendChild(a);
  }
});
