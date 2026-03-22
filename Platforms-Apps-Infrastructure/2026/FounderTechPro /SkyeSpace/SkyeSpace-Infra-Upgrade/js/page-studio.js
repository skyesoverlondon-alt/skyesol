(function(){
  const schedule = document.querySelector('#quick-schedule');
  schedule?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(schedule);
    const payload = {
      lane: 'feed',
      category: 'Studio Scheduler',
      title: fd.get('headline'),
      body: `Queued for ${fd.get('when')} in ${fd.get('lane')}.`
    };
    const remote = await window.SKYE_API.compose(payload);
    if(!remote?.ok){
      window.SKYE_STATE.pushPost({
        author: window.SKYE_STATE.get().profile.name,
        role: 'Studio Scheduler',
        type: 'Scheduled',
        title: fd.get('headline'),
        text: `Queued for ${fd.get('when')} in ${fd.get('lane')}.`
      });
    }
    schedule.reset();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  async function renderMetrics(){
    const metrics = await window.SKYE_API.getMetrics();
    if(!metrics) return;
    const cards = document.querySelectorAll('.section.grid-3 .card p');
    if(cards[0]) cards[0].textContent = `${metrics.listings} listings · ${metrics.posts} posts · ${metrics.signals} signals · ${metrics.messages} messages`;
    if(cards[1]) cards[1].textContent = `Live API ${window.SKYE_API.isLive() ? 'connected' : 'offline fallback'} · ${metrics.districts} districts · ${metrics.profiles} profiles · ${metrics.conversations} conversation threads.`;
  }
  renderMetrics();
  window.addEventListener('skye:update', renderMetrics);
})();
