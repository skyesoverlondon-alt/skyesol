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

    // Re-bind nav JS if we just swapped the header
    if (node.matches('nav.main-nav') && window.SOL && typeof window.SOL.attachNav === 'function') {
      window.SOL.attachNav();
    }
  } catch (err) {
    console.warn('Partial inject failed for', url, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectPartial('nav.main-nav', '/partials/header.html', 'start');
  injectPartial('footer', '/partials/footer.html', 'end');
});
