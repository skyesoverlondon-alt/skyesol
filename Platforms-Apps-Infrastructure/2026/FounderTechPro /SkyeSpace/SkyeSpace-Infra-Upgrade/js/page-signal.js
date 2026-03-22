(function(){
  async function render(){
    const signals = [...window.SKYE_STATE.get().quickSignals, ...(await window.SKYE_API.getSignals())];
    document.querySelector('#signal-board').innerHTML = signals.map(item => `
      <article class="signal-item" data-searchable>
        <div class="meta"><span>${item.source}</span><span>${item.age}</span></div>
        <span class="signal-severity ${item.severity}">${item.severity}</span>
        <h3 style="margin-top:12px">${item.title}</h3>
        <p>${item.detail}</p>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
