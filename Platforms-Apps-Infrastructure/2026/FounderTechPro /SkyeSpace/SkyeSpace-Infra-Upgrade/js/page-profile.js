(function(){
  const form = document.querySelector('#profile-form');

  async function hydrateForm(){
    const profile = await window.SKYE_API.getProfile();
    form.name.value = profile.name || '';
    form.handle.value = profile.handle || '';
    form.title.value = profile.title || '';
    form.bio.value = profile.bio || '';
    render();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const saved = await window.SKYE_API.saveProfile({
      name: form.name.value,
      handle: form.handle.value,
      title: form.title.value,
      bio: form.bio.value
    });
    window.SKYE_STATE.setProfile({
      name: saved.name,
      handle: saved.handle,
      title: saved.title,
      bio: saved.bio
    });
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  function render(){
    const p = window.SKYE_STATE.get().profile;
    document.querySelector('#profile-name').textContent = p.name;
    document.querySelector('#profile-handle').textContent = p.handle;
    document.querySelector('#profile-title').textContent = p.title;
    document.querySelector('#profile-bio').textContent = p.bio;
  }
  hydrateForm();
  render();
  window.addEventListener('skye:update', render);
})();
