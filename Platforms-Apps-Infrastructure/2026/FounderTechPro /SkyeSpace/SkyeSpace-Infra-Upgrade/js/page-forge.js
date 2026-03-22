(function(){
  const data = window.SKYESPACE_DATA;
  document.querySelector('#project-grid').innerHTML = data.projects.map(p => `
    <article class="project-card" data-searchable>
      <div class="meta"><span>${p.runtime}</span><span class="badge purple">${p.state}</span></div>
      <h3>${p.name}</h3>
      <p>${p.lane}</p>
      <div class="card-actions"><button class="btn btn-soft" data-export-project='${JSON.stringify(p).replace(/'/g, '&apos;')}'>Export JSON</button></div>
    </article>
  `).join('');
})();
