(() => {
  "use strict";
  const TOUR_KEY = "kaixu_suite_tour_v1";
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function showTour() {
    const overlay = document.createElement("div");
    overlay.className = "tour";

    const card = document.createElement("div");
    card.className = "tour-card";

    const steps = [
      { title:"Welcome to the kAIxU PDF Suite", body:"Fortune-500 style PDF factory. Provider is Skyes Over London. Intelligence layer is kAIxU. Pick a tab, fill inputs, run, export a branded PDF." },
      { title:"Tabs = Engines", body:"Top neon tabs are your tool engines. Search narrows tabs instantly. Deep-links (routes/*.html) jump straight into a tool." },
      { title:"Attachments (Netlify Blobs)", body:"Upload screenshots/docs to Blobs. Optionally include attachment keys inside the run so kAIxU can reference what you uploaded." },
      { title:"Vault (Neon DB + Blobs)", body:"Save runs to the Vault. Neon stores metadata + JSON. Blobs stores PDFs/uploads. This makes the suite operational, not a one-off generator." },
      { title:"Export Like a Machine", body:"Export PDF is instant. Save PDF stores the artifact in Blobs so it can be re-downloaded later from the Vault list." }
    ];

    let i = 0;

    function render(){
      const step = steps[i];
      card.innerHTML = `
        <div class="tour-top">
          <div class="tour-title">${escapeHtml(step.title)}</div>
          <button class="btn ghost small" id="tourClose">Close</button>
        </div>
        <div class="tour-body">${escapeHtml(step.body)}</div>
        <div class="tour-actions">
          <button class="btn ghost" id="tourBack" ${i===0?'disabled':''}>Back</button>
          <div class="tour-dots">${steps.map((_,idx)=>`<span class="tour-dot ${idx===i?'on':''}"></span>`).join("")}</div>
          <button class="btn neon" id="tourNext">${i===steps.length-1?'Finish':'Next'}</button>
        </div>
        <div class="tour-fine">Tip: Diagnostics tab confirms Functions + Vault connectivity.</div>
      `;
      $("tourClose").onclick = () => overlay.remove();
      $("tourBack").onclick = () => { if (i>0){ i--; render(); } };
      $("tourNext").onclick = () => {
        if (i < steps.length-1){ i++; render(); }
        else { localStorage.setItem(TOUR_KEY, "done"); overlay.remove(); }
      };
    }

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    render();
  }

  window.__kaixuShowTour = showTour;

  const btn = $("openTutorial");
  if (btn) {
    btn.addEventListener("click", showTour);
    if (!localStorage.getItem(TOUR_KEY)) setTimeout(showTour, 900);
  }
})();