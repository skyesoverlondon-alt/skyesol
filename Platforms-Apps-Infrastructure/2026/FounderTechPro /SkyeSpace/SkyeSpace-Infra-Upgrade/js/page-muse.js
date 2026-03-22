(function(){
  const boards = [
    {title:'Night Market Aesthetics', tag:'Editorial board', note:'Local textures, signage, late-lights, and human rhythm.'},
    {title:'Gold Signal Capsule', tag:'Premium journal', note:'A private publishing arc pairing field reports with clean typography.'},
    {title:'District Portraits', tag:'Photo essays', note:'Faces, storefronts, maker desks, and hyperlocal identity.'},
    {title:'After Dark Founders', tag:'Member-only zine', note:'Short essays, audio notes, and city-sized ambition.'},
    {title:'Soft Tech / Hard Gold', tag:'Gallery set', note:'Luxe UI fragments, architecture, and mythic product language.'}
  ];
  document.querySelector('#muse-boards').innerHTML = boards.map((b, i) => `
    <article class="board-card" data-searchable>
      <div class="meta"><span>${b.tag}</span><span>Board ${i+1}</span></div>
      <h3>${b.title}</h3>
      <p>${b.note}</p>
      <div class="card-actions"><button class="btn btn-soft" data-toggle-save="board-${i}">Save</button></div>
    </article>
  `).join('');
})();
