(function(){
  // Subtle runtime niceties: year stamp + smooth anchor jumps
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({behavior:'smooth', block:'start'});
  });
})();
