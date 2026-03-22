(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();
    document.querySelector('#debate-grid').innerHTML = data.debates.map((d, i) => `
      <article class="debate-card" data-searchable>
        <div class="meta"><span>${d.votes}</span><span class="badge green">Live debate</span></div>
        <h3>${d.title}</h3>
        <div class="chips"><span class="chip">A: ${d.stanceA}</span><span class="chip">B: ${d.stanceB}</span></div>
        <div class="card-actions"><button class="btn btn-soft" data-vote="debate-${i}">${state.votes[`debate-${i}`] ? 'Voted' : 'Cast vote'}</button></div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
