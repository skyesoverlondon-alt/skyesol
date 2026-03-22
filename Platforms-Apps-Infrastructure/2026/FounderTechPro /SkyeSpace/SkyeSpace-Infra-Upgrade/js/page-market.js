(function(){
  async function render(){
    const state = window.SKYE_STATE.get();
    const items = [...state.quickListings, ...(await window.SKYE_API.getListings())];
    document.querySelector('#market-listings').innerHTML = items.map((item, i) => `
      <article class="listing" data-searchable>
        <div class="meta"><span>${item.category}</span><span>${item.district}</span></div>
        <h3>${item.title}</h3>
        <p>${item.seller}</p>
        <div class="listing-pricing"><strong>${item.price}</strong><span class="badge blue">${item.eta}</span></div>
        <div class="card-actions">
          <button class="btn btn-soft" data-toggle-save="listing-${item.id || i}">${state.saves[`listing-${item.id || i}`] ? 'Saved' : 'Save'}</button>
          <button class="btn btn-gold" data-message-seller="${item.seller}" data-topic="${item.title}">Message seller</button>
        </div>
      </article>
    `).join('');

    const metrics = await window.SKYE_API.getMetrics();
    if(metrics){
      const stats = document.querySelectorAll('.hero-main .stat-value');
      if(stats[0]) stats[0].textContent = `${metrics.listings.toLocaleString()} listings`;
      if(stats[1]) stats[1].textContent = `${metrics.listings.toLocaleString()} live`;
      if(stats[2]) stats[2].textContent = `${metrics.messages.toLocaleString()} inquiries`;
      if(stats[3]) stats[3].textContent = `${metrics.profiles.toLocaleString()} sellers`;
    }
  }
  render();
  window.addEventListener('skye:update', render);
})();
