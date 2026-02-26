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
