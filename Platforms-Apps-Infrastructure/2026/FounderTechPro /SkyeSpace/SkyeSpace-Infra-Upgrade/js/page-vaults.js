
(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();
    document.querySelector('#vault-wall').innerHTML = data.vaults.map((v, i) => `
      <article class="vault-card" data-searchable>
        <div class="meta"><span>${v.tier}</span><span>${v.members}</span></div>
        <h3>${v.title}</h3>
        <p>${v.promise}</p>
        <div class="listing-pricing"><strong>${v.price}</strong><button class="btn btn-soft" data-join="vault-${i}">${state.joins[`vault-${i}`] ? 'Joined' : 'Join'}</button></div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
