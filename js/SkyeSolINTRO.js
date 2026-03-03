(function () {
  if (window.__SKYESOL_INTRO_RAN__) return;
  window.__SKYESOL_INTRO_RAN__ = true;

  var INTRO_IMAGE = 'https://cdn1.sharemyimage.com/2026/03/03/Gemini_Generated_Image_5aft6s5aft6s5aft-1.png';
  var INTRO_FADE_START_MS = 4600;
  var INTRO_REMOVE_MS = 5700;

  var style = document.createElement('style');
  style.id = 'skyesol-intro-style';
  style.textContent = [
    'body.skyesol-intro-locked{overflow:hidden !important;height:100vh;}',
    '.cinematic-opener{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#05050b;pointer-events:none;}',
    '.cinematic-opener::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 22% 52%, rgba(255,211,106,.14) 0%, transparent 55%),radial-gradient(ellipse at 78% 52%, rgba(162,67,255,.16) 0%, transparent 55%),radial-gradient(ellipse at 50% 75%, rgba(39,242,255,.08) 0%, transparent 60%);animation:skyesolGradientPulse 4s ease-in-out infinite;}',
    '.opener-content{position:relative;z-index:2;text-align:center;padding:2rem;max-width:980px;}',
    '.opener-line{overflow:hidden;}',
    '.opener-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.72);font-size:clamp(.9rem,2.6vw,1.15rem);letter-spacing:.28em;text-transform:uppercase;opacity:0;transform:translateY(100%);animation:skyesolSlideUp 1s cubic-bezier(0.16,1,0.3,1) .5s forwards;}',
    '.opener-title{font-family:Georgia,Times,"Times New Roman",serif;color:#ffd36a;font-size:clamp(2.2rem,7.8vw,5.2rem);font-weight:700;line-height:1.05;margin:1.25rem 0;opacity:0;transform:translateY(100%);animation:skyesolSlideUp 1.2s cubic-bezier(0.16,1,0.3,1) 1s forwards;}',
    '.opener-subtitle{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:rgba(255,255,255,.70);font-size:clamp(.95rem,2vw,1.1rem);letter-spacing:.04em;opacity:0;animation:skyesolFadeIn 1.2s cubic-bezier(0.16,1,0.3,1) 2s forwards;max-width:72ch;margin:0 auto;line-height:1.85;}',
    '.opener-divider{width:0;height:1px;background:linear-gradient(90deg, transparent, #27f2ff, #ffd36a, #a243ff, transparent);margin:1.8rem auto;animation:skyesolExpandLine 1.5s cubic-bezier(0.16,1,0.3,1) 1.5s forwards;opacity:.9;}',
    '.opener-logo{margin-top:2.4rem;opacity:0;animation:skyesolFadeIn 1s cubic-bezier(0.16,1,0.3,1) 2.45s forwards;display:flex;justify-content:center;}',
    '.sol-logo{width:180px;height:auto;filter:drop-shadow(0 0 16px rgba(255,211,106,.18)) drop-shadow(0 0 18px rgba(39,242,255,.10));animation:skyesolPulseLogo 2.8s ease-in-out infinite;user-select:none;-webkit-user-drag:none;}',
    '.opener-company{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.44);font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;margin-top:1rem;opacity:0;animation:skyesolFadeIn 1s cubic-bezier(0.16,1,0.3,1) 3s forwards;}',
    '.progress-bar{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);width:240px;height:2px;background:rgba(255,255,255,.10);border-radius:2px;overflow:hidden;z-index:2147483001;}',
    '.progress-fill{height:100%;width:0;background:linear-gradient(90deg,#27f2ff,#ffd36a,#a243ff);animation:skyesolProgressFill 4s cubic-bezier(0.25,1,0.5,1) forwards;box-shadow:0 0 18px rgba(39,242,255,.28);}',
    '.cinematic-opener.intro-exit{animation:skyesolOpenerFadeOut 1s cubic-bezier(0.16,1,0.3,1) forwards;}',
    '.progress-bar.intro-exit{animation:skyesolBarFadeOut .5s cubic-bezier(0.16,1,0.3,1) forwards;}',
    '@keyframes skyesolGradientPulse{0%,100%{opacity:.55}50%{opacity:1}}',
    '@keyframes skyesolSlideUp{to{opacity:1;transform:translateY(0)}}',
    '@keyframes skyesolFadeIn{to{opacity:1}}',
    '@keyframes skyesolExpandLine{to{width:240px}}',
    '@keyframes skyesolPulseLogo{0%,100%{transform:translateY(0) scale(1);opacity:.92}50%{transform:translateY(-2px) scale(1.02);opacity:1}}',
    '@keyframes skyesolProgressFill{0%{width:0}100%{width:100%}}',
    '@keyframes skyesolOpenerFadeOut{to{opacity:0;visibility:hidden}}',
    '@keyframes skyesolBarFadeOut{to{opacity:0}}',
    '@media (prefers-reduced-motion: reduce){.cinematic-opener::before,.sol-logo,.progress-fill{animation:none !important;}}'
  ].join('');

  function ensureStyle() {
    if (!document.getElementById('skyesol-intro-style')) {
      document.head.appendChild(style);
    }
  }

  function preloadImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'sync';
      img.fetchPriority = 'high';
      img.onload = function () {
        if (img.decode) {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
      };
      img.onerror = resolve;
      img.src = url;
    });
  }

  function ensurePreloadLink(url) {
    if (document.querySelector('link[rel="preload"][as="image"][href="' + url + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }

  function fallbackPartial() {
    return '<div id="skyesol-intro-root" data-intro-partial="skyesol-about-intro">'
      + '<div class="cinematic-opener" aria-hidden="true">'
      + '<div class="opener-content">'
      + '<div class="opener-line"><p class="opener-text">A Skyes Over London LC Publication</p></div>'
      + '<div class="opener-line"><h1 class="opener-title">About<br/>Skyes Over London</h1></div>'
      + '<div class="opener-divider"></div>'
      + '<p class="opener-subtitle">Operator-grade AI + web infrastructure built with a proof-first discipline: gateways, brains, IDEs, portals, and systems that can be verified, governed, and shipped.</p>'
      + '<div class="opener-logo"><img class="sol-logo" src="' + INTRO_IMAGE + '" alt="Skyes Over London LC top image" loading="eager" decoding="sync" fetchpriority="high" width="180" height="180" /></div>'
      + '<p class="opener-company">A subsidiary of Solenterprises International Nexus &amp; Holdings LLC</p>'
      + '</div>'
      + '<div class="progress-bar" aria-hidden="true"><div class="progress-fill"></div></div>'
      + '</div>'
      + '</div>';
  }

  function loadPartial() {
    return fetch('/partials/intro.html', { cache: 'force-cache' })
      .then(function (res) { return res.ok ? res.text() : fallbackPartial(); })
      .catch(function () { return fallbackPartial(); });
  }

  function mountIntro(markup) {
    if (document.getElementById('skyesol-intro-root') || document.querySelector('.cinematic-opener')) return null;
    var holder = document.createElement('div');
    holder.innerHTML = String(markup || '').trim();
    var root = holder.firstElementChild;
    if (!root) return null;
    document.body.appendChild(root);
    return root;
  }

  function scheduleExit(root) {
    window.setTimeout(function () {
      var opener = root.querySelector('.cinematic-opener');
      var bar = root.querySelector('.progress-bar');
      if (opener) opener.classList.add('intro-exit');
      if (bar) bar.classList.add('intro-exit');
      document.body.classList.remove('skyesol-intro-locked');
    }, INTRO_FADE_START_MS);

    window.setTimeout(function () {
      if (root && root.parentNode) root.parentNode.removeChild(root);
    }, INTRO_REMOVE_MS);
  }

  function start() {
    if (!document.body) return;
    if (document.querySelector('.cinematic-opener') || document.getElementById('skyesol-intro-root')) return;

    ensureStyle();
    ensurePreloadLink(INTRO_IMAGE);

    Promise.all([
      loadPartial(),
      Promise.race([
        preloadImage(INTRO_IMAGE),
        new Promise(function (resolve) { window.setTimeout(resolve, 2500); })
      ])
    ]).then(function (result) {
      var markup = result[0];
      document.body.classList.add('skyesol-intro-locked');
      var root = mountIntro(markup);
      if (!root) {
        document.body.classList.remove('skyesol-intro-locked');
        return;
      }
      scheduleExit(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
