(function(){
  const INTRO_MS = 3600; // timing
  const FADE_MS = 850;   // fade out timing

  function lockScroll(){
    document.documentElement.classList.add('lock-scroll');
  }
  function unlockScroll(){
    document.documentElement.classList.remove('lock-scroll');
  }

  function mountIntro(){
    const existing = document.getElementById('skye-intro');
    if(existing) return;

    const intro = document.createElement('div');
    intro.id = 'skye-intro';
    intro.innerHTML = `
      <div class="introBox" role="dialog" aria-label="SKYE INTRO">
        <div class="introRow">
          <div class="introLeft">
            <img class="introMark" src="` + (window.__KAIXU_LOGO__ || '') + `" alt="kAIxU" />
            <div class="introTitle">
              <strong>SKYES OVER LONDON LC</strong>
              <span>Premium Service Systems • SVS</span>
            </div>
          </div>
          <div class="introStatus">Initializing</div>
        </div>
        <div class="introDivider"></div>
        <div class="introLine">
          Loading your service lane. Locking focus. Preparing kAIxU task-agent embed.
        </div>
        <div class="introProg" aria-hidden="true"><div></div></div>
        <div class="introFoot">
          <span>Secure Sequence</span>
          <span id="introPct">0%</span>
        </div>
      </div>
    `;
    document.body.appendChild(intro);

    const bar = intro.querySelector('.introProg > div');
    const pct = intro.querySelector('#introPct');

    const t0 = performance.now();
    lockScroll();

    function tick(t){
      const dt = t - t0;
      const p = Math.max(0, Math.min(1, dt / INTRO_MS));
      const pctVal = Math.round(p * 100);
      bar.style.width = pctVal + '%';
      pct.textContent = pctVal + '%';
      if(p < 1){
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          intro.classList.add('out');
          setTimeout(() => {
            intro.remove();
            unlockScroll();
          }, FADE_MS);
        }, 220);
      }
    }
    requestAnimationFrame(tick);
  }

  function bindBurger(){
    const btn = document.querySelector('[data-burger]');
    const panel = document.querySelector('[data-mobilepanel]');
    if(!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = panel.getAttribute('data-open') === '1';
      panel.setAttribute('data-open', open ? '0' : '1');
      panel.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    // Close on link click
    panel.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        panel.setAttribute('data-open','0');
        panel.style.display = 'none';
        btn.setAttribute('aria-expanded','false');
      });
    });
  }

  function bindScrollLinks(){
    document.querySelectorAll('a[data-scroll]').forEach(a => {
      a.addEventListener('click', (e) => {
        const target = a.getAttribute('href') || '';
        if(target.startsWith('#')){
          const el = document.querySelector(target);
          if(el){
            e.preventDefault();
            el.scrollIntoView({behavior:'smooth', block:'start'});
          }
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Expose logo url for intro injection
    if(!window.__KAIXU_LOGO__){
      const meta = document.querySelector('meta[name="kaixu-logo"]');
      window.__KAIXU_LOGO__ = meta ? meta.content : '';
    }
    mountIntro();
    bindBurger();
    bindScrollLinks();
  });
})();
