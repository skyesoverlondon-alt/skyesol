(function(){
  window.addEventListener('load', () => {
    setTimeout(() => { document.body.classList.remove('locked'); }, 5200);
  });

  const year = document.getElementById('year');
  if(year) year.textContent = new Date().getFullYear();

  const nav = document.querySelector('.nav');
  const burger = document.getElementById('burger');
  const mobile = document.getElementById('mobile');

  function closeMenu(){ nav && nav.classList.remove('open'); }
  if(burger) burger.addEventListener('click', () => nav && nav.classList.toggle('open'));
  if(mobile) mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if(!id || id.length < 2) return;
      const el = document.querySelector(id);
      if(!el) return;
      e.preventDefault();
      el.scrollIntoView({behavior: prefersReduced ? 'auto' : 'smooth', block:'start'});
    });
  });
})();