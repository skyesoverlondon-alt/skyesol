async function injectCanonicalHeader() {
  if (!document || !document.body) return;

  const navSelector = 'nav.main-nav';
  const existingNav = document.querySelector(navSelector);

  try {
    const res = await fetch('/partials/header.html', { cache: 'no-cache' });
    if (!res.ok) return;

    const html = await res.text();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const headerNav = wrapper.firstElementChild;
    if (!headerNav || !headerNav.matches('nav.main-nav')) return;

    if (existingNav) {
      existingNav.replaceWith(headerNav);
    } else {
      document.body.prepend(headerNav);
    }

    if (window.SOL) {
      if (typeof window.SOL.attachNav === 'function') {
        window.SOL.attachNav();
      }
      if (typeof window.SOL.attachMegaNav === 'function') {
        window.SOL.attachMegaNav();
      }
    }
  } catch (err) {
    console.warn('Canonical header injection failed', err);
  }
}

function sharedAttachMegaNav() {
  const menuBtn = document.getElementById('menuBtn');
  const megaNav = document.getElementById('megaNav');
  const megaClose = document.getElementById('megaNavClose');
  if (!menuBtn || !megaNav) return;
  if (menuBtn.dataset.megaBound === 'true') return;
  menuBtn.dataset.megaBound = 'true';

  function openNav() {
    megaNav.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    megaNav.style.display = 'none';
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', openNav);
  if (megaClose) megaClose.addEventListener('click', closeNav);
  megaNav.addEventListener('click', function (e) {
    if (e.target === megaNav) closeNav();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  window.SOL = window.SOL || {};
  if (typeof window.SOL.attachMegaNav !== 'function') {
    window.SOL.attachMegaNav = sharedAttachMegaNav;
  }
  injectCanonicalHeader();
});
