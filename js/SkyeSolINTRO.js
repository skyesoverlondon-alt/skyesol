(function () {
  if (window.__SKYESOL_INTRO_RAN__) return;
  window.__SKYESOL_INTRO_RAN__ = true;

  var style = document.createElement('style');
  style.id = 'skyesol-intro-style';
  style.textContent = [
    'body.skyesol-intro-locked{overflow:hidden !important;}',
    '.skyesol-intro{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;flex-direction:column;',
    'background:#05050b;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}',
    '.skyesol-intro::before{content:"";position:absolute;inset:0;',
    'background:radial-gradient(ellipse at 20% 45%, rgba(255,211,106,.14), transparent 58%),',
    'radial-gradient(ellipse at 80% 45%, rgba(162,67,255,.16), transparent 58%),',
    'radial-gradient(ellipse at 50% 72%, rgba(39,242,255,.10), transparent 62%);}',
    '.skyesol-intro-content{position:relative;z-index:2;text-align:center;padding:1.25rem;max-width:860px;}',
    '.skyesol-intro-title{margin:0;font-size:clamp(1.9rem,6.8vw,4.6rem);font-weight:800;line-height:1.05;',
    'letter-spacing:.01em;color:#ffd36a;}',
    '.skyesol-intro-sub{margin:.9rem auto 0;max-width:65ch;font-size:clamp(.9rem,2.2vw,1.1rem);line-height:1.8;color:rgba(255,255,255,.78);}',
    '.skyesol-intro-logo{width:min(220px,42vw);height:auto;margin:0 auto 1rem;display:block;',
    'filter:drop-shadow(0 0 14px rgba(255,211,106,.24));}',
    '.skyesol-intro-exit{animation:skyesolIntroFade .72s ease forwards;}',
    '@keyframes skyesolIntroFade{to{opacity:0;visibility:hidden;}}'
  ].join('');

  function buildIntro() {
    if (document.getElementById('skyesol-intro')) return;

    if (!document.getElementById('skyesol-intro-style')) {
      document.head.appendChild(style);
    }

    var intro = document.createElement('div');
    intro.id = 'skyesol-intro';
    intro.className = 'skyesol-intro';
    intro.setAttribute('aria-hidden', 'true');

    var content = document.createElement('div');
    content.className = 'skyesol-intro-content';

    var logo = document.createElement('img');
    logo.className = 'skyesol-intro-logo';
    logo.alt = 'Skyes Over London Intro';
    logo.src = 'https://cdn1.sharemyimage.com/2026/03/03/Gemini_Generated_Image_5aft6s5aft6s5aft-1.png';

    var title = document.createElement('h1');
    title.className = 'skyesol-intro-title';
    title.textContent = 'Skyes Over London';

    var subtitle = document.createElement('p');
    subtitle.className = 'skyesol-intro-sub';
    subtitle.textContent = 'Operator-grade AI + web infrastructure built to ship and built to prove.';

    content.appendChild(logo);
    content.appendChild(title);
    content.appendChild(subtitle);
    intro.appendChild(content);

    document.body.classList.add('skyesol-intro-locked');
    document.body.appendChild(intro);

    window.setTimeout(function () {
      intro.classList.add('skyesol-intro-exit');
      document.body.classList.remove('skyesol-intro-locked');
      window.setTimeout(function () {
        if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
      }, 760);
    }, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildIntro, { once: true });
  } else {
    buildIntro();
  }
})();
