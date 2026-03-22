(function(){
  async function render(){
    const data = await window.SKYE_API.getDistricts();
    const state = window.SKYE_STATE.get();

    document.querySelector('#district-grid').innerHTML = data.map((d, i) => `
      <article class="district-card" data-searchable>
        <div class="meta"><span>${d.hotspot}</span><span>${d.active}</span></div>
        <h3>${d.name}</h3>
        <p>${d.vibe}</p>
        <div class="card-actions">
          <button class="btn btn-soft" data-join="district-${d.id || i}">${state.joins[`district-${d.id || i}`] ? 'Joined' : 'Join'}</button>
        </div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
