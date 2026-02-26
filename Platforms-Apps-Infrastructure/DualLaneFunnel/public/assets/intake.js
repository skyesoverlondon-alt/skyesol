(function(){
  function encode(data){
    return Object.keys(data)
      .map(function(k){
        return encodeURIComponent(k) + '=' + encodeURIComponent(data[k] == null ? '' : String(data[k]));
      })
      .join('&');
  }

  async function postNetlifyForm(formName, fields){
    // Netlify forms SPA submission pattern
    const body = encode(Object.assign({ 'form-name': formName }, fields));
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    // Netlify often responds with 200/302; treat non-5xx as success
    if (res.status >= 500) throw new Error('Netlify Forms error');
    return true;
  }

  async function postFunctionIntake(lane, fields){
    const res = await fetch('/.netlify/functions/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lane: lane, fields: fields })
    });
    if (!res.ok) throw new Error('Intake function error');
    return await res.json();
  }

  function setToast(el, kind, msg){
    el.classList.remove('ok','bad');
    el.classList.add(kind);
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function handleForm(form){
    const toast = form.parentElement.querySelector('.toast');
    const submitBtn = form.querySelector('button[type="submit"]');
    const lane = form.getAttribute('data-lane') || 'unknown';
    const formName = form.getAttribute('name') || 'intake';

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      // Collect fields
      const fd = new FormData(form);
      // strip honeypot
      if (fd.get('bot-field')) {
        setToast(toast,'ok','Submitted.');
        return;
      }

      const fields = {};
      fd.forEach((v,k)=>{ if(k !== 'bot-field') fields[k]=v; });

      // UI lock
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      try{
        // 1) Netlify Forms (source of truth for "drop" deployments)
        await postNetlifyForm(formName, fields);

        // 2) Optional: Function intake (Neon + Blobs). If functions not deployed, this will fail;
        // we treat that as "forms captured" and still complete.
        try{
          await postFunctionIntake(lane, fields);
        } catch(_err){
          // ignore — still a legitimate Netlify Forms submission
        }

        // Redirect
        const next = form.getAttribute('data-success') || '/thank-you.html';
        window.location.href = next + '?lane=' + encodeURIComponent(lane);
      } catch(err){
        console.error(err);
        setToast(toast,'bad','Submission failed. Please refresh and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });
  }

  async function loadDiagnostics(){
    const box = document.getElementById('diagnosticsBox');
    if(!box) return;
    try{
      const res = await fetch('/.netlify/functions/health');
      if(!res.ok) throw new Error('health failed');
      const j = await res.json();
      box.textContent = JSON.stringify(j, null, 2);
    } catch(e){
      box.textContent = 'Diagnostics unavailable (functions not deployed yet).';
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('form[data-intake="true"]').forEach(handleForm);
    loadDiagnostics();
  });
})();
