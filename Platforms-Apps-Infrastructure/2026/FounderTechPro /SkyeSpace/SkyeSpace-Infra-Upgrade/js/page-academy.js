(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();
    document.querySelector('#course-grid').innerHTML = data.courses.map((c, i) => `
      <article class="course-card" data-searchable>
        <div class="meta"><span>${c.cohort}</span><span>${c.length}</span></div>
        <h3>${c.title}</h3>
        <p>${c.seats}</p>
        <div class="card-actions"><button class="btn btn-soft" data-enroll="course-${i}">${state.enrollments[`course-${i}`] ? 'Enrolled' : 'Enroll'}</button></div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
