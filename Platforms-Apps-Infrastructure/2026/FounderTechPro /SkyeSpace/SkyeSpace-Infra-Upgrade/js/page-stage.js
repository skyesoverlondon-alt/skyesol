(function(){
  const data = window.SKYESPACE_DATA;
  const state = window.SKYE_STATE.get();
  document.querySelector('#creator-rail').innerHTML = data.creators.map((c, i) => `
    <article class="creator-card" data-searchable>
      <div class="meta"><span>${c.followers}</span><span>${c.revenue}</span></div>
      <h3>${c.name}</h3>
      <p>${c.tag}</p>
      <div class="card-actions"><button class="btn btn-purple" data-follow="creator-${i}">${state.joins[`creator-${i}`] ? 'Following' : 'Follow'}</button></div>
    </article>
  `).join('');
})();
