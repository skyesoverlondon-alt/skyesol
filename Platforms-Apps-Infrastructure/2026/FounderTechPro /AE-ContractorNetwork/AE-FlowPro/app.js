
    // ==========================
    // AE FLOW by Skyes Over London — Offline PWA
    // Includes: visits, accounts, deals, handoff packs, daily bundles, share sheet
    // ==========================

    // ---- 3D Cosmos Background (Three.js) ----
    
    function ensureThree(){
      if(window.THREE) return Promise.resolve(true);
      if(window.__AEFLOW_THREE_PROMISE__) return window.__AEFLOW_THREE_PROMISE__;
      const urls = [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
        "https://unpkg.com/three@0.160.0/build/three.min.js"
      ];
      window.__AEFLOW_THREE_PROMISE__ = new Promise((resolve) => {
        const tryLoad = (i) => {
          if(i >= urls.length) return resolve(false);
          const s = document.createElement("script");
          s.src = urls[i];
          s.async = true;
          s.onload = () => resolve(true);
          s.onerror = () => {
            try { s.remove(); } catch(e) {}
            tryLoad(i+1);
          };
          document.head.appendChild(s);
        };
        tryLoad(0);
      });
      return window.__AEFLOW_THREE_PROMISE__;
    }

    async function initCosmosBackground(){
      const canvas = document.getElementById("cosmosCanvas");
      const vig = document.getElementById("cosmosVignette");
      if(!canvas) return;

      const THREE_OK = await ensureThree();
      if(!THREE_OK){
        canvas.style.display = "none";
        if(vig) vig.style.display = "none";
        return;
      }

      const prefersReduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

      let renderer, scene, camera, starField, dustField, nebulaGroup;
      let raf = 0;
      let w = window.innerWidth || 1;
      let h = window.innerHeight || 1;

      function rand(a,b){ return a + Math.random()*(b-a); }

      function makeGlowTexture(){
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        const grad = g.createRadialGradient(128,128,0,128,128,128);
        grad.addColorStop(0.00, "rgba(255,255,255,1)");
        grad.addColorStop(0.18, "rgba(255,255,255,.55)");
        grad.addColorStop(0.45, "rgba(255,255,255,.18)");
        grad.addColorStop(1.00, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0,0,256,256);
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
      }

      function makeStars(count, radius, size, hueCenter){
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const col = new THREE.Color();

        for(let i=0;i<count;i++){
          // Random point inside a sphere (biased outward a bit for depth)
          const u = Math.random();
          const v = Math.random();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2*v - 1);
          const r = radius * Math.pow(Math.random(), 0.55);

          const sp = Math.sin(phi);
          positions[i*3+0] = r * sp * Math.cos(theta);
          positions[i*3+1] = r * Math.cos(phi);
          positions[i*3+2] = r * sp * Math.sin(theta);

          const hue = (hueCenter + rand(-0.08, 0.08) + 1) % 1;
          const sat = rand(0.45, 0.85);
          const lit = rand(0.55, 0.95);
          col.setHSL(hue, sat, lit);

          colors[i*3+0] = col.r;
          colors[i*3+1] = col.g;
          colors[i*3+2] = col.b;
        }

        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
          size,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true
        });

        const pts = new THREE.Points(geo, mat);
        return pts;
      }

      try{
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        });
      }catch(e){
        canvas.style.display = "none";
        const vig = document.getElementById("cosmosVignette");
        if(vig) vig.style.display = "none";
        return;
      }

      const pr = Math.min(window.devicePixelRatio || 1, prefersReduced ? 1.25 : 2);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07040d, 0.0019);

      camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2200);
      camera.position.set(0, 0, 38);

      // Lights (subtle — most glow is additive sprites/points)
      scene.add(new THREE.AmbientLight(0xffffff, 0.60));
      const key = new THREE.PointLight(0xa855f7, 1.15, 800);
      key.position.set(40, 20, 60);
      scene.add(key);
      const rim = new THREE.PointLight(0xf5c542, 0.85, 700);
      rim.position.set(-60, -30, 30);
      scene.add(rim);

      // Star layers
      starField = makeStars(prefersReduced ? 4200 : 7200, 950, prefersReduced ? 1.05 : 1.25, 0.72); // purple/blue
      dustField = makeStars(prefersReduced ? 1600 : 2600, 240, prefersReduced ? 1.35 : 1.75, 0.13); // warm/gold accents
      dustField.material.opacity = 0.55;
      dustField.position.z = 40;

      scene.add(starField);
      scene.add(dustField);

      // Nebula "clouds" (additive glow sprites)
      nebulaGroup = new THREE.Group();
      const glowTex = makeGlowTexture();
      for(let i=0;i<(prefersReduced ? 10 : 18);i++){
        const hue = (0.68 + rand(-0.12, 0.12) + 1) % 1; // mostly violet-blue
        const mat = new THREE.SpriteMaterial({
          map: glowTex,
          color: new THREE.Color().setHSL(hue, rand(0.55, 0.95), rand(0.55, 0.80)),
          transparent: true,
          opacity: prefersReduced ? 0.14 : 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false
        });
        const s = new THREE.Sprite(mat);
        const z = rand(-420, -120);
        s.position.set(rand(-220, 220), rand(-140, 140), z);
        const base = rand(180, 360);
        s.scale.set(base, base * rand(0.65, 1.15), 1);
        s.userData.drift = { x: rand(-0.35, 0.35), y: rand(-0.25, 0.25), r: rand(-0.25, 0.25) };
        nebulaGroup.add(s);
      }
      scene.add(nebulaGroup);

      // Pointer drift (gentle parallax)
      const pointer = { x: 0, y: 0 };
      const target = { x: 0, y: 0 };
      function onPointerMove(e){
        const nx = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
        const ny = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
        target.x = nx;
        target.y = ny;
      }
      if(!prefersReduced){
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      }

      function onResize(){
        w = window.innerWidth || 1;
        h = window.innerHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      window.addEventListener("resize", onResize, { passive: true });

      // Animation loop
      let t0 = performance.now();
      function tick(now){
        const dt = Math.min(0.05, (now - t0) / 1000);
        t0 = now;

        // Smooth pointer
        pointer.x += (target.x - pointer.x) * 0.04;
        pointer.y += (target.y - pointer.y) * 0.04;

        const speed = prefersReduced ? 0.25 : 1.0;
        starField.rotation.y += dt * 0.03 * speed;
        starField.rotation.x += dt * 0.012 * speed;

        dustField.rotation.y -= dt * 0.05 * speed;
        dustField.rotation.x += dt * 0.018 * speed;

        // Nebula drift
        for(let i=0;i<nebulaGroup.children.length;i++){
          const s = nebulaGroup.children[i];
          const d = s.userData.drift;
          s.position.x += d.x * dt * 8 * speed;
          s.position.y += d.y * dt * 6 * speed;
          s.material.rotation += d.r * dt * 0.15 * speed;

          // wrap softly
          if(s.position.x > 260) s.position.x = -260;
          if(s.position.x < -260) s.position.x = 260;
          if(s.position.y > 170) s.position.y = -170;
          if(s.position.y < -170) s.position.y = 170;
        }

        // Camera "breath" + parallax
        const breathe = Math.sin(now * 0.00025) * (prefersReduced ? 0.10 : 0.25);
        camera.position.x = pointer.x * (prefersReduced ? 1.2 : 2.4);
        camera.position.y = -pointer.y * (prefersReduced ? 0.9 : 1.8) + breathe;
        camera.lookAt(0, 0, -220);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }

      // Pause rendering when tab is hidden
      function onVis(){
        if(document.hidden){
          if(raf) cancelAnimationFrame(raf);
          raf = 0;
        }else{
          if(!raf) { t0 = performance.now(); raf = requestAnimationFrame(tick); }
        }
      }
      document.addEventListener("visibilitychange", onVis);

      raf = requestAnimationFrame(tick);
    }

    const APP = {
      name: "AE FLOW by Skyes Over London",
      storageKey: "ae_flow_v1_state",
      storageKeySecure: "ae_flow_v1_secure_mirror",
      storageKeySecureMeta: "ae_flow_v1_secure_meta",
      state: {
        visits: [],
        accounts: [],
        deals: [],
        handoff_log: [], // {id, created_at, date_key, account_id, business_name, business_email, ae_name, filename, handoff_html}
        viewMode: "today",
        filter: null,
        search: "",
        activeTags: [],
        ui: { tab: "intake", accountsView: "mine" },
        settings: {
          depositPct: 0.40,
          presetsText:
`Standard | 0.40 | 0.20
Aggressive | 0.50 | 0.25`,
          forecast: {
            winRate: 0.35,
            retentionMonths: 12,
            closeWindowDays: 30
          },
          brand: {
            orgName: "Skyes Over London LC",
            replyEmail: "",
            tagline: "Proven operator network + conversion systems",
            handoffFooter: "Internal use. Generated by AE FLOW."
          }
        }
      }
    };

    const $ = (id) => document.getElementById(id);

    const nowISO = () => new Date().toISOString();
    const todayKey = (d=new Date()) => {
      const x = new Date(d);
      const yyyy = x.getFullYear();
      const mm = String(x.getMonth()+1).padStart(2,"0");
      const dd = String(x.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    };
    const fmtTime = (iso) => {
      try{
        const d = new Date(iso);
        return d.toLocaleString(undefined, { month:"short", day:"2-digit", hour:"numeric", minute:"2-digit" });
      }catch(e){ return iso; }
    };
    const uid = () => Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);

    function toast(msg){
      const t = $("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(()=> t.classList.remove("show"), 1600);
    }

    function escapeHtml(s){
      return (s||"").toString()
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;");
    }

    function normalizeEmail(email){
      return (email||"").trim().toLowerCase();
    }

    function money(n){
      const x = Number(n || 0);
      return x.toLocaleString(undefined, { style:"currency", currency:"USD" });
    }

    function safeFilename(name){
      return (name||"handoff")
        .toString()
        .trim()
        .replaceAll(/[^a-zA-Z0-9]+/g, "-")
        .replaceAll(/-+/g, "-")
        .replaceAll(/^-|-$/g, "")
        .slice(0, 80) || "handoff";
    }

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    function bufferToBase64(buffer){
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    function base64ToBuffer(str){
      const binary = atob(str);
      const bytes = new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    function ensureForecastDefaults(){
      APP.state.settings.forecast = Object.assign({
        winRate: 0.35,
        retentionMonths: 12,
        closeWindowDays: 30
      }, APP.state.settings?.forecast || {});
      return APP.state.settings.forecast;
    }
    function getForecastSettings(){
      return ensureForecastDefaults();
    }
    async function deriveVaultKey(passphrase, saltB64, iterations=250000){
      const baseKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(base64ToBuffer(saltB64)), iterations, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }
    async function encryptPayload(payload, passphrase){
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const iterations = 250000;
      const saltB64 = bufferToBase64(salt.buffer);
      const ivB64 = bufferToBase64(iv.buffer);
      const key = await deriveVaultKey(passphrase, saltB64, iterations);
      const plaintext = textEncoder.encode(JSON.stringify(payload));
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
      return {
        format: "AE-FLOW-VAULT-V1",
        created_at: nowISO(),
        iterations,
        salt: saltB64,
        iv: ivB64,
        cipher: bufferToBase64(cipher)
      };
    }
    async function decryptPayload(wrapper, passphrase){
      if(!wrapper || wrapper.format !== "AE-FLOW-VAULT-V1") throw new Error("Unsupported vault file");
      const key = await deriveVaultKey(passphrase, wrapper.salt, Number(wrapper.iterations)||250000);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(base64ToBuffer(wrapper.iv)) },
        key,
        base64ToBuffer(wrapper.cipher)
      );
      return JSON.parse(textDecoder.decode(plain));
    }
    function renderVaultStatus(message=""){
      const el = $("vaultStatus");
      if(!el) return;
      const metaRaw = localStorage.getItem(APP.storageKeySecureMeta);
      let meta = null;
      try{ meta = metaRaw ? JSON.parse(metaRaw) : null; }catch(e){ meta = null; }
      const bits = [];
      bits.push(localStorage.getItem(APP.storageKeySecure) ? "Secure mirror saved on this device." : "No secure mirror saved yet.");
      if(meta?.saved_at) bits.push(`Last secure save: ${fmtTime(meta.saved_at)}`);
      if(message) bits.push(message);
      el.textContent = bits.join(" ");
    }
    function getVaultPassphrase(){
      return ($("vaultPassphrase")?.value || "").trim();
    }

    function loadState(){
      try{
        const raw = localStorage.getItem(APP.storageKey);
        if(raw){
          const parsed = JSON.parse(raw);
          if(parsed && typeof parsed === "object"){
            APP.state = Object.assign(APP.state, parsed);
          }
        }
      }catch(e){}
      if(!Array.isArray(APP.state.visits)) APP.state.visits = [];
      if(!Array.isArray(APP.state.accounts)) APP.state.accounts = [];
      if(!Array.isArray(APP.state.deals)) APP.state.deals = [];
      if(!Array.isArray(APP.state.handoff_log)) APP.state.handoff_log = [];
      if(!Array.isArray(APP.state.activeTags)) APP.state.activeTags = [];
      if(!APP.state.settings) APP.state.settings = { depositPct:0.40, presetsText:"Standard | 0.40 | 0.20", forecast:{}, brand:{} };
      APP.state.settings.forecast = Object.assign({
        winRate: 0.35,
        retentionMonths: 12,
        closeWindowDays: 30
      }, APP.state.settings.forecast || {});
      if(!APP.state.settings.brand) APP.state.settings.brand = { orgName:"Skyes Over London LC", replyEmail:"", tagline:"", handoffFooter:"" };
      if(!APP.state.ui) APP.state.ui = { tab:"intake", accountsView:"mine" };
      if(!APP.state.analytics) APP.state.analytics = {};
    }

    function saveState(){
      localStorage.setItem(APP.storageKey, JSON.stringify(APP.state));
    }

    // ---- Script content ----
    const SCRIPT = {
      open: [
        "Hey—quick question. Who handles your bookings or lead follow-up here?",
        "",
        "Nice. I’m with Skyes Over London. I’m not here to sell you anything—my job is building a network of proven local operators we can confidently refer business to."
      ].join("\\n"),
      yesyes: [
        "Yes or no—are you currently open to more of your best customers this month?",
        "And do you prefer those customers call you, book online, or text?"
      ].join("\\n"),
      free: [
        "Perfect. Here’s why I’m here: we’re giving selected businesses a free one-page conversion system—one clean page that routes customers to your exact booking flow or website, with proof, offer clarity, and a fast mobile layout.",
        "",
        "No catch. We don’t need your passwords. We just need the correct business email so we can send it for approval and set you up."
      ].join("\\n"),
      close: [
        "Cool. What’s the best email for the owner or whoever approves marketing assets?",
        "",
        "I’ll send the one-page system for review, and once you say ‘approved,’ we can route referrals to you when we have a match.",
        "",
        "Quick: what’s the one service you want more of, and what area do you want customers from?"
      ].join("\\n"),
      objections: [
        "Objection: “We’re not interested / not doing marketing.”",
        "Reply: Perfect—that’s why this is free and low-maintenance. This isn’t a marketing contract. It’s just a clean conversion page so your existing traffic and referrals convert better.",
        "",
        "Objection: “We already have a website.”",
        "Reply: Great. This doesn’t replace it. It’s a single purpose page that links into your website and booking—built specifically for speed and conversions.",
        "",
        "Objection: “I don’t give out my email.”",
        "Reply: Fair. Two options: you can email me first, or you can give a general inbox like info@. No logins, no passwords, no spam.",
        "",
        "Objection: “We’re too busy / not taking more work.”",
        "Reply: That’s a good problem. Do you want only higher-value jobs? The page can filter for that. If not, I’ll mark you at capacity and we won’t refer right now.",
        "",
        "Objection: “What’s the catch?”",
        "Reply: No catch. We’re building a list of operators we can refer people to. Later, if you want media/ads to push the system, cool—but today is just free setup + approval.",
        "",
        "Objection: “We got burned by marketers.”",
        "Reply: Totally normal. That’s why we lead with infrastructure and transparency. Today isn’t ads—it’s the foundation."
      ].join("\\n")
    };

    function renderScripts(){
      $("scriptOpen").textContent = SCRIPT.open;
      $("scriptYesYes").textContent = SCRIPT.yesyes;
      $("scriptFree").textContent = SCRIPT.free;
      $("scriptClose").textContent = SCRIPT.close;
      $("scriptObj").textContent = SCRIPT.objections;
    }

    // ---- Tags ----
    function setActiveTags(tags){
      APP.state.activeTags = Array.from(new Set(tags)).slice(0, 12);
      saveState();
      renderActiveTags();
    }
    function addTag(tag){
      if(!tag) return;
      const tags = new Set(APP.state.activeTags || []);
      tags.add(tag);
      setActiveTags(Array.from(tags));
      toast("Tag added");
    }
    function clearTags(){
      setActiveTags([]);
      toast("Tags cleared");
    }
    function renderActiveTags(){
      const el = $("activeTags");
      const tags = APP.state.activeTags || [];
      if(tags.length === 0){
        el.innerHTML = `<span class="tiny muted2">No active visit tags. Tap “Tag” under a script section if needed.</span>`;
        return;
      }
      el.innerHTML = tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("") +
        `<span class="tag" style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.28);cursor:pointer" id="clearTagsPill">Clear Tags</span>`;
      setTimeout(()=>{
        const pill = $("clearTagsPill");
        if(pill) pill.onclick = clearTags;
      },0);
    }

    // ---- Copy ----
    async function copyText(text){
      try{
        await navigator.clipboard.writeText(text);
        toast("Copied ✅");
      }catch(e){
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Copied ✅");
      }
    }
    function bindCopyButtons(){
      document.querySelectorAll("[data-copy]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-copy");
          const el = $(id);
          if(el) copyText(el.textContent);
        });
      });
      document.querySelectorAll("[data-addtag]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const tag = btn.getAttribute("data-addtag");
          addTag(tag);
        });
      });
    }

    // ---- Visits ----
    function addVisit(v){
      APP.state.visits.unshift(v);
      saveState();
      renderAll();
    }
    function deleteVisit(id){
      APP.state.visits = APP.state.visits.filter(x => x.id !== id);
      saveState();
      renderAll();
    }

    function currentViewVisits(){
      const all = APP.state.visits || [];
      const mode = APP.state.viewMode || "today";
      const tKey = todayKey();
      let list = all;

      if(mode === "today"){
        list = list.filter(v => (v.date_key || "") === tKey);
      }
      if(APP.state.filter === "permissionYes"){
        list = list.filter(v => v.permission === "yes");
      }

      const q = (APP.state.search||"").trim().toLowerCase();
      if(q){
        list = list.filter(v => {
          const blob = [
            v.ae_name, v.route, v.business_name, v.business_email, v.contact_name, v.phone,
            v.service_1, v.service_area, v.notes, v.industry, v.source_directory, v.lead_temperature,
            v.priority, v.next_action, v.last_contacted_at, v.estimated_setup_value, v.estimated_monthly_value,
            (v.tags||[]).join(" ")
          ].join(" ").toLowerCase();
          return blob.includes(q);
        });
      }
      return list;
    }

    function permissionBadge(p){
      if(p === "yes") return `<span class="badge good">Permission: YES</span>`;
      if(p === "maybe") return `<span class="badge warn">Permission: MAYBE</span>`;
      return `<span class="badge bad">Permission: NO</span>`;
    }

    function isAccountOwnedByEmail(email){
      const e = normalizeEmail(email);
      if(!e) return false;
      return (APP.state.accounts || []).some(a => normalizeEmail(a.business_email) === e);
    }

    function renderVisits(){
      const list = currentViewVisits();
      const el = $("visitsList");
      if(list.length === 0){
        el.innerHTML = `<div class="muted2">No visits in this view yet.</div>`;
        return;
      }
      el.innerHTML = list.map(v => {
        const tags = (v.tags||[]).slice(0,6).map(t => `<span class="badge" style="background:rgba(124,58,237,.12);border-color:rgba(124,58,237,.22)">${escapeHtml(t)}</span>`).join(" ");
        const email = v.business_email ? `<span class="badge">${escapeHtml(v.business_email)}</span>` : "";
        const service = v.service_1 ? `<span class="badge">${escapeHtml(v.service_1)}</span>` : "";
        const ae = v.ae_name ? `<span class="badge" style="border-color:rgba(245,197,66,.26);background:rgba(245,197,66,.10)">AE: ${escapeHtml(v.ae_name)}</span>` : "";
        const owned = isAccountOwnedByEmail(v.business_email) ? `<span class="badge good">Owned Account</span>` : "";
        const priority = v.priority && v.priority !== "Normal" ? `<span class="badge ${v.priority==="Critical"?"bad":"warn"}">${escapeHtml(v.priority)} Priority</span>` : "";
        const industry = v.industry ? `<span class="badge">${escapeHtml(v.industry)}</span>` : "";
        const temp = v.lead_temperature ? `<span class="badge">${escapeHtml(v.lead_temperature)}</span>` : "";
        const src = v.source_directory ? `<span class="badge">Source: ${escapeHtml(v.source_directory)}</span>` : "";

        return `
          <div class="item">
            <div class="left">
              <div class="title">
                <span>${escapeHtml(v.business_name || "Untitled")}</span>
                ${permissionBadge(v.permission)}
                ${owned}
                ${priority}
              </div>
              <div class="meta">${ae} ${email} ${service} ${industry} ${temp}</div>
              <div class="meta">
                <span class="muted2">Saved:</span> ${escapeHtml(fmtTime(v.created_at))}
                ${v.service_area ? ` • <span class="muted2">Area:</span> ${escapeHtml(v.service_area)}` : ""}
                ${v.next_action ? ` • <span class="muted2">Next:</span> ${escapeHtml(v.next_action)}` : ""}
                ${v.follow_up_date ? ` • <span class="muted2">Follow-up:</span> ${escapeHtml(v.follow_up_date)}` : ""}
              </div>
              ${(src || v.estimated_setup_value || v.estimated_monthly_value) ? `<div class="meta">${src} ${v.estimated_setup_value ? `<span class="badge">Setup ${money(v.estimated_setup_value)}</span>` : ""} ${v.estimated_monthly_value ? `<span class="badge">Monthly ${money(v.estimated_monthly_value)}</span>` : ""}</div>` : ""}
              ${v.notes ? `<div class="meta"><span class="muted2">Notes:</span> ${escapeHtml(v.notes).slice(0,220)}${escapeHtml(v.notes).length>220?"…":""}</div>` : ""}
              ${tags ? `<div class="meta">${tags}</div>` : ""}
            </div>
            <div class="actions">
              <button class="btn small secondary" data-vact="copyEmail" data-id="${v.id}">Copy Email</button>
              <button class="btn small gold" data-vact="own" data-id="${v.id}">Convert → Account</button>
              <button class="btn small danger" data-vact="del" data-id="${v.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      el.querySelectorAll("button[data-vact]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const act = btn.getAttribute("data-vact");
          const id = btn.getAttribute("data-id");
          const v = APP.state.visits.find(x => x.id === id);
          if(!v) return;
          if(act === "del"){
            if(confirm("Delete this visit?")) deleteVisit(id);
          }else if(act === "copyEmail"){
            copyText(v.business_email || "");
          }else if(act === "own"){
            convertVisitToAccount(v);
          }
        });
      });
    }

    // ---- Accounts ----
    function addAccount(a){
      APP.state.accounts.unshift(a);
      saveState();
      renderAll();
    }

    function deleteAccount(id){
      APP.state.deals = (APP.state.deals||[]).filter(d => d.account_id !== id);
      APP.state.accounts = (APP.state.accounts||[]).filter(a => a.id !== id);
      saveState();
      renderAll();
    }

    function convertVisitToAccount(v){
      const email = normalizeEmail(v.business_email);
      if(!email){ toast("Need business email"); return; }
      if(isAccountOwnedByEmail(email)){
        toast("Already an owned account");
        switchTab("accounts");
        return;
      }
      const acct = {
        id: uid(),
        created_at: nowISO(),
        updated_at: nowISO(),
        ae_name: v.ae_name || "",
        route: v.route || "",
        business_name: v.business_name || "",
        business_email: email,
        phone: v.phone || "",
        contact_name: v.contact_name || "",
        service_1: v.service_1 || "",
        service_area: v.service_area || "",
        website_or_booking: v.booking_link || "",
        industry: v.industry || "",
        source_directory: v.source_directory || "",
        lead_temperature: v.lead_temperature || "Cold",
        priority: v.priority || "Normal",
        estimated_setup_value: Number(v.estimated_setup_value || 0),
        estimated_monthly_value: Number(v.estimated_monthly_value || 0),
        next_action: v.next_action || "",
        last_contacted_at: v.last_contacted_at || "",
        permission: v.permission || "maybe",
        account_status: (v.permission === "yes") ? "Active (Vetted)" : "Pending Approval",
        notes: v.notes || "",
        tags: (v.tags || []).slice(0,12)
      };
      addAccount(acct);
      toast("Converted to owned Account ✅");
      switchTab("accounts");
    }

    function renderAccounts(){
      const el = $("accountsList");
      const q = (APP.state.search||"").trim().toLowerCase();
      const mine = (APP.state.ui.accountsView || "mine") === "mine";
      const myName = ($("aeName")?.value || "").trim();

      let list = APP.state.accounts || [];
      if(mine && myName){
        list = list.filter(a => (a.ae_name||"").trim().toLowerCase() === myName.toLowerCase());
      }
      if(q){
        list = list.filter(a => {
          const blob = [
            a.business_name, a.business_email, a.contact_name, a.phone,
            a.ae_name, a.service_1, a.service_area, a.notes, a.industry, a.priority,
            a.source_directory, a.next_action, (a.tags||[]).join(" ")
          ].join(" ").toLowerCase();
          return blob.includes(q);
        });
      }

      if(list.length === 0){
        el.innerHTML = `<div class="muted2">No accounts in this view yet.</div>`;
        return;
      }

      el.innerHTML = list.map(a=>{
        const tags = (a.tags||[]).slice(0,5).map(t => `<span class="badge" style="background:rgba(124,58,237,.12);border-color:rgba(124,58,237,.22)">${escapeHtml(t)}</span>`).join(" ");
        const ae = a.ae_name ? `<span class="badge" style="border-color:rgba(245,197,66,.26);background:rgba(245,197,66,.10)">AE: ${escapeHtml(a.ae_name)}</span>` : "";
        const status = a.account_status ? `<span class="badge">${escapeHtml(a.account_status)}</span>` : "";
        const email = a.business_email ? `<span class="badge">${escapeHtml(a.business_email)}</span>` : "";
        const service = a.service_1 ? `<span class="badge">${escapeHtml(a.service_1)}</span>` : "";
        const openDeals = (APP.state.deals||[]).filter(d => d.account_id === a.id && !["Closed Won","Closed Lost"].includes(d.stage)).length;
        const dealsBadge = `<span class="badge ${openDeals>0?"warn":""}">Open deals: ${openDeals}</span>`;
        const priority = a.priority && a.priority !== "Normal" ? `<span class="badge ${a.priority==="Critical"?"bad":"warn"}">${escapeHtml(a.priority)} Priority</span>` : "";
        const industry = a.industry ? `<span class="badge">${escapeHtml(a.industry)}</span>` : "";
        const temp = a.lead_temperature ? `<span class="badge">${escapeHtml(a.lead_temperature)}</span>` : "";
        const forecast12m = ((Number(a.estimated_setup_value)||0) + ((Number(a.estimated_monthly_value)||0) * getForecastSettings().retentionMonths)) * getForecastSettings().winRate;
        const forecastBadge = forecast12m > 0 ? `<span class="badge good">12m Forecast ${escapeHtml(money(forecast12m))}</span>` : "";

        return `
          <div class="item">
            <div class="left">
              <div class="title">
                <span>${escapeHtml(a.business_name || "Untitled")}</span>
                ${status}
                ${dealsBadge}
                ${priority}
                ${forecastBadge}
              </div>
              <div class="meta">${ae} ${email} ${service} ${industry} ${temp}</div>
              <div class="meta">
                ${a.service_area ? `<span class="muted2">Area:</span> ${escapeHtml(a.service_area)}` : ""}
                ${a.website_or_booking ? ` • <span class="muted2">Link:</span> ${escapeHtml(a.website_or_booking)}` : ""}
              </div>
              ${a.notes ? `<div class="meta"><span class="muted2">Notes:</span> ${escapeHtml(a.notes).slice(0,220)}${escapeHtml(a.notes).length>220?"…":""}</div>` : ""}
              ${tags ? `<div class="meta">${tags}</div>` : ""}
            </div>
            <div class="actions">
              <button class="btn small gold" data-aact="handoff" data-id="${a.id}">Generate Handoff Pack</button>
              <button class="btn small secondary" data-aact="emailFree" data-id="${a.id}">Copy Free-System Email</button>
              <button class="btn small secondary" data-aact="emailDeal" data-id="${a.id}">Copy Deposit+Retainer Email</button>
              <button class="btn small secondary" data-aact="deal" data-id="${a.id}">Start Deal</button>
              <button class="btn small danger" data-aact="del" data-id="${a.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      el.querySelectorAll("button[data-aact]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const act = btn.getAttribute("data-aact");
          const id = btn.getAttribute("data-id");
          const a = (APP.state.accounts||[]).find(x => x.id === id);
          if(!a) return;

          if(act === "del"){
            if(confirm("Delete this account and its deals?")) deleteAccount(id);
          }else if(act === "deal"){
            switchTab("deals");
            populateDealAccountSelect();
            $("dealAccountSelect").value = a.id;
            toast("Account selected for deal");
          }else if(act === "handoff"){
            downloadHandoffPack(a.id);
          }else if(act === "emailFree"){
            copyText(buildEmail_FreeSystem(a));
          }else if(act === "emailDeal"){
            copyText(buildEmail_DepositRetainer(a));
          }
        });
      });
    }

    // ---- Deals ----
    let dealItems = [];

    function parsePresets(text){
      const lines = (text||"").split("\\n").map(x=>x.trim()).filter(Boolean);
      const out = [];
      for(const line of lines){
        const parts = line.split("|").map(x=>x.trim());
        if(parts.length < 3) continue;
        const name = parts[0];
        const dep = Number(parts[1]);
        const mon = Number(parts[2]);
        if(!name || Number.isNaN(dep) || Number.isNaN(mon)) continue;
        out.push({ name, aeDepositPct: dep, aeMonthlyPct: mon });
      }
      return out.length ? out : [{ name:"Standard", aeDepositPct:0.40, aeMonthlyPct:0.20 }];
    }

    function populatePresets(){
      const presets = parsePresets(APP.state.settings.presetsText);
      const sel = $("dealPreset");
      sel.innerHTML = presets.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)} (AE: ${p.aeDepositPct*100}% dep, ${p.aeMonthlyPct*100}% mo)</option>`).join("");
    }

    function getPresetByName(name){
      const presets = parsePresets(APP.state.settings.presetsText);
      return presets.find(p => p.name === name) || presets[0];
    }

    function populateDealAccountSelect(){
      const sel = $("dealAccountSelect");
      const accts = APP.state.accounts || [];
      sel.innerHTML = accts.length
        ? accts.map(a => `<option value="${a.id}">${escapeHtml(a.business_name)} — ${escapeHtml(a.business_email||"")}</option>`).join("")
        : `<option value="">No accounts yet</option>`;
    }

    function renderItems(){
      const el = $("itemsList");
      if(dealItems.length === 0){
        el.innerHTML = `<div class="muted2">No items yet. Add line items to build the package.</div>`;
        renderDealCalc();
        return;
      }
      el.innerHTML = dealItems.map((it, idx)=>{
        return `
          <div class="li">
            <div>
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="tiny">Setup: ${money(it.setup)} • Monthly: ${money(it.monthly)}</div>
            </div>
            <div class="right">
              <button class="btn small secondary" data-item="dup" data-idx="${idx}">Duplicate</button>
              <button class="btn small danger" data-item="del" data-idx="${idx}">Remove</button>
            </div>
          </div>
        `;
      }).join("");

      el.querySelectorAll("button[data-item]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const act = btn.getAttribute("data-item");
          const idx = Number(btn.getAttribute("data-idx"));
          if(Number.isNaN(idx)) return;
          if(act === "del"){
            dealItems.splice(idx, 1);
            renderItems();
          }else if(act === "dup"){
            const it = dealItems[idx];
            dealItems.splice(idx+1, 0, { ...it });
            renderItems();
          }
        });
      });

      renderDealCalc();
    }

    function renderDealCalc(){
      const setupTotal = dealItems.reduce((s,it)=> s + (Number(it.setup)||0), 0);
      const monthlyTotal = dealItems.reduce((s,it)=> s + (Number(it.monthly)||0), 0);

      const depPct = Number($("dealDepositPct").value);
      const preset = getPresetByName($("dealPreset").value);

      const depositDue = setupTotal * (Number.isFinite(depPct) ? depPct : APP.state.settings.depositPct);
      const aeDepositProjection = depositDue * preset.aeDepositPct;
      const aeMonthlyProjection = monthlyTotal * preset.aeMonthlyPct;

      $("dealCalcBox").innerHTML = `
        <div class="line"><span class="muted2">Setup total</span> <strong>${money(setupTotal)}</strong></div>
        <div class="line"><span class="muted2">Monthly total</span> <strong>${money(monthlyTotal)}</strong></div>
        <div class="sep"></div>
        <div class="line"><span class="muted2">Deposit (${(depPct*100).toFixed(0)}%)</span> <strong>${money(depositDue)}</strong></div>
        <div class="line"><span class="muted2">AE projection on deposit</span> <strong>${money(aeDepositProjection)}</strong></div>
        <div class="line"><span class="muted2">AE projection on monthly</span> <strong>${money(aeMonthlyProjection)}/mo</strong></div>
        <div class="tiny" style="margin-top:8px;">
          Projection only. Real commissions follow your official structure.
        </div>
      `;
    }

    function saveDeal(){
      const accountId = $("dealAccountSelect").value;
      if(!accountId){ toast("Select an Account first"); return; }
      const acct = (APP.state.accounts||[]).find(a => a.id === accountId);
      if(!acct){ toast("Account not found"); return; }

      const preset = getPresetByName($("dealPreset").value);
      const depPct = Number($("dealDepositPct").value);
      const setupTotal = dealItems.reduce((s,it)=> s + (Number(it.setup)||0), 0);
      const monthlyTotal = dealItems.reduce((s,it)=> s + (Number(it.monthly)||0), 0);
      const depositDue = setupTotal * depPct;

      const deal = {
        id: uid(),
        created_at: nowISO(),
        updated_at: nowISO(),
        date_key: todayKey(),
        account_id: accountId,
        account_name: acct.business_name || "",
        account_email: acct.business_email || "",
        ae_name: acct.ae_name || "",
        name: ($("dealName").value || "").trim() || "Custom Package",
        stage: $("dealStage").value,
        deposit_pct: depPct,
        preset_name: preset.name,
        ae_deposit_pct: preset.aeDepositPct,
        ae_monthly_pct: preset.aeMonthlyPct,
        setup_total: setupTotal,
        monthly_total: monthlyTotal,
        deposit_due: depositDue,
        notes: ($("dealNotes").value || "").trim(),
        items: dealItems.map(it => ({ name: it.name, setup: Number(it.setup)||0, monthly: Number(it.monthly)||0 }))
      };

      APP.state.deals.unshift(deal);
      saveState();
      renderAll();
      toast("Deal saved ✅");
    }

    function resetDeal(){
      $("dealName").value = "";
      $("dealStage").value = "Discovery";
      $("dealNotes").value = "";
      dealItems = [];
      renderItems();
      toast("Deal reset");
    }

    function buildDealSummary(d){
      const lines = [];
      lines.push(`Deal — ${d.name}`);
      lines.push(`Account: ${d.account_name} (${d.account_email})`);
      if(d.ae_name) lines.push(`AE of Record: ${d.ae_name}`);
      lines.push(`Stage: ${d.stage}`);
      lines.push(`Setup total: ${money(d.setup_total)} • Monthly total: ${money(d.monthly_total)}`);
      lines.push(`Deposit (${(d.deposit_pct*100).toFixed(0)}%): ${money(d.deposit_due)}`);
      lines.push(`Preset: ${d.preset_name} (AE: ${(d.ae_deposit_pct*100).toFixed(0)}% dep, ${(d.ae_monthly_pct*100).toFixed(0)}% mo)`);
      lines.push("");
      lines.push("Items:");
      (d.items||[]).forEach(it => lines.push(`- ${it.name} | Setup ${money(it.setup)} | Monthly ${money(it.monthly)}`));
      if(d.notes) { lines.push(""); lines.push(`Notes: ${d.notes}`); }
      return lines.join("\\n");
    }

    function renderDeals(){
      populateDealAccountSelect();
      populatePresets();
      $("dealDepositPct").value = APP.state.settings.depositPct;

      const el = $("dealsList");
      const q = (APP.state.search||"").trim().toLowerCase();
      let list = APP.state.deals || [];
      if(q){
        list = list.filter(d => {
          const blob = [
            d.name, d.account_name, d.account_email, d.ae_name, d.stage, d.notes,
            (d.items||[]).map(it => it.name).join(" ")
          ].join(" ").toLowerCase();
          return blob.includes(q);
        });
      }
      if(list.length === 0){
        el.innerHTML = `<div class="muted2">No deals yet.</div>`;
        return;
      }

      el.innerHTML = list.map(d=>{
        const stage = `<span class="badge ${d.stage==="Closed Won"?"good":(d.stage==="Closed Lost"?"bad":"warn")}">${escapeHtml(d.stage)}</span>`;
        const ae = d.ae_name ? `<span class="badge" style="border-color:rgba(245,197,66,.26);background:rgba(245,197,66,.10)">AE: ${escapeHtml(d.ae_name)}</span>` : "";
        const moneyLine = `<span class="badge">Setup ${money(d.setup_total)}</span> <span class="badge">Monthly ${money(d.monthly_total)}</span> <span class="badge warn">Deposit ${money(d.deposit_due)}</span>`;
        return `
          <div class="item">
            <div class="left">
              <div class="title">
                <span>${escapeHtml(d.name)}</span>
                ${stage}
              </div>
              <div class="meta">${ae} <span class="badge">${escapeHtml(d.account_name)}</span> <span class="badge">${escapeHtml(d.account_email)}</span></div>
              <div class="meta">${moneyLine}</div>
              ${d.notes ? `<div class="meta"><span class="muted2">Notes:</span> ${escapeHtml(d.notes).slice(0,220)}${escapeHtml(d.notes).length>220?"…":""}</div>` : ""}
            </div>
            <div class="actions">
              <button class="btn small gold" data-dact="handoff" data-id="${d.id}">Handoff Pack</button>
              <button class="btn small secondary" data-dact="copy" data-id="${d.id}">Copy Summary</button>
              <button class="btn small secondary" data-dact="won" data-id="${d.id}">Mark Won</button>
              <button class="btn small danger" data-dact="del" data-id="${d.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      el.querySelectorAll("button[data-dact]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const act = btn.getAttribute("data-dact");
          const id = btn.getAttribute("data-id");
          const d = (APP.state.deals||[]).find(x => x.id === id);
          if(!d) return;

          if(act === "del"){
            if(confirm("Delete this deal?")){
              APP.state.deals = (APP.state.deals||[]).filter(x => x.id !== id);
              saveState();
              renderAll();
            }
          }else if(act === "copy"){
            copyText(buildDealSummary(d));
          }else if(act === "won"){
            d.stage = "Closed Won";
            d.updated_at = nowISO();
            saveState();
            renderAll();
            toast("Marked Closed Won ✅");
          }else if(act === "handoff"){
            const acct = (APP.state.accounts||[]).find(a=>a.id===d.account_id);
            if(!acct){ toast("Account not found"); return; }
            downloadHandoffPack(acct.id);
          }
        });
      });
    }

    // ---- Handoff Pack Generator ----
    function accountDeals(accountId){
      return (APP.state.deals||[]).filter(d => d.account_id === accountId);
    }

    function accountVisitsByEmail(email){
      const e = normalizeEmail(email);
      if(!e) return [];
      return (APP.state.visits||[]).filter(v => normalizeEmail(v.business_email) === e);
    }

    function buildEmail_FreeSystem(a){
      const org = APP.state.settings.brand.orgName || "Skyes Over London LC";
      const ae = a.ae_name ? a.ae_name : "our Account Executive";
      const subj = `Lead Sprint — Free One-Page Conversion System (Approval)`;
      const lines = [];
      lines.push(`Subject: ${subj}`);
      lines.push("");
      lines.push(`Hi ${a.contact_name ? a.contact_name.split("(")[0].trim() : "there"},`);
      lines.push("");
      lines.push(`This is ${ae} with ${org}. As promised, we’re sending your free one-page conversion system for approval.`);
      lines.push("");
      lines.push(`Purpose: make referrals + traffic convert better by routing customers into your preferred booking flow (call/text/form/booking).`);
      lines.push("");
      lines.push(`We do NOT need passwords. We only need your “approved” reply once you review the page.`);
      lines.push("");
      lines.push(`Business: ${a.business_name || ""}`);
      if(a.website_or_booking) lines.push(`Link/Booking: ${a.website_or_booking}`);
      if(a.service_1) lines.push(`Primary service to promote: ${a.service_1}`);
      if(a.service_area) lines.push(`Service area: ${a.service_area}`);
      lines.push("");
      lines.push(`Reply “approved” and we’ll proceed to finalize + begin routing matching referrals your way.`);
      lines.push("");
      lines.push(`— ${org}`);
      return lines.join("\\n");
    }

    function buildEmail_DepositRetainer(a){
      const org = APP.state.settings.brand.orgName || "Skyes Over London LC";
      const subj = `Next Step — Expansion System (Deposit + Retainer)`;
      const lines = [];
      lines.push(`Subject: ${subj}`);
      lines.push("");
      lines.push(`Hi ${a.contact_name ? a.contact_name.split("(")[0].trim() : "there"},`);
      lines.push("");
      lines.push(`If you want us to actively scale what we set up (media + ads + tracking + follow-up automation), the next step is a deposit + monthly retainer based on what you want built and managed.`);
      lines.push("");
      lines.push(`We can keep it simple (Lead Sprint) or expand into a full living ecosystem with ads + AI integration. Your AE of record stays the point of contact: ${a.ae_name || "your AE"}.`);
      lines.push("");
      lines.push(`If you reply with your preferred goal (more calls, bookings, or higher-ticket jobs), we’ll send a clean package outline and pricing for approval.`);
      lines.push("");
      lines.push(`— ${org}`);
      return lines.join("\\n");
    }

    function buildHandoffHTML(a){
      const org = APP.state.settings.brand.orgName || "Skyes Over London LC";
      const footer = APP.state.settings.brand.handoffFooter || "Internal use.";
      const deals = accountDeals(a.id);
      const visits = accountVisitsByEmail(a.business_email);

      const dealBlocks = deals.length ? deals.map(d=>{
        const items = (d.items||[]).map(it=>`
          <tr>
            <td>${escapeHtml(it.name)}</td>
            <td style="text-align:right;">${money(it.setup)}</td>
            <td style="text-align:right;">${money(it.monthly)}</td>
          </tr>
        `).join("");

        return `
          <section class="box">
            <h3>Deal: ${escapeHtml(d.name)}</h3>
            <div class="meta">
              <span class="chip">${escapeHtml(d.stage)}</span>
              <span class="chip">Setup: ${money(d.setup_total)}</span>
              <span class="chip">Monthly: ${money(d.monthly_total)}</span>
              <span class="chip">Deposit (${(d.deposit_pct*100).toFixed(0)}%): ${money(d.deposit_due)}</span>
            </div>
            ${d.notes ? `<div class="note"><strong>Notes:</strong> ${escapeHtml(d.notes)}</div>` : ""}
            <table>
              <thead>
                <tr><th>Item</th><th style="text-align:right;">Setup</th><th style="text-align:right;">Monthly</th></tr>
              </thead>
              <tbody>${items || ""}</tbody>
            </table>
          </section>
        `;
      }).join("") : `<div class="muted">No deals saved yet for this account.</div>`;

      const visitBlocks = visits.slice(0, 10).map(v=>{
        return `
          <div class="box">
            <div class="meta">
              <span class="chip">${escapeHtml(v.date_key || "")}</span>
              <span class="chip">Permission: ${escapeHtml(v.permission || "")}</span>
              <span class="chip">Status: ${escapeHtml(v.status || "")}</span>
              <span class="chip">AE: ${escapeHtml(v.ae_name || "")}</span>
            </div>
            ${v.notes ? `<div class="note">${escapeHtml(v.notes)}</div>` : `<div class="muted">No notes.</div>`}
          </div>
        `;
      }).join("");

      const tags = (a.tags||[]).length ? (a.tags||[]).map(t=>`<span class="chip">${escapeHtml(t)}</span>`).join("") : `<span class="muted">None</span>`;

      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Handoff Pack — ${escapeHtml(a.business_name || "")}</title>
<style>
  :root{color-scheme: light;--bg:#ffffff;--ink:#0b0b12;--muted:#5b5b6a;--line:#e6e6ef;--soft:#f7f7fb;--purple:#5b21b6;}
  *{box-sizing:border-box}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--ink)}
  .wrap{max-width:980px;margin:0 auto;padding:22px}
  header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:2px solid var(--line);padding-bottom:14px;margin-bottom:14px}
  h1{margin:0;font-size:20px}
  .sub{color:var(--muted);font-size:12px;margin-top:6px}
  .brand{font-weight:900;color:var(--purple)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .box{border:1px solid var(--line);background:var(--soft);border-radius:14px;padding:12px;margin:10px 0}
  .meta{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 8px}
  .chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;font-size:12px}
  .note{margin-top:8px;color:#222;font-size:13px;line-height:1.35}
  .muted{color:var(--muted);font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:10px;background:#fff;border-radius:12px;overflow:hidden}
  th,td{padding:10px;border-bottom:1px solid var(--line);font-size:13px}
  th{background:#fafafe;text-align:left}
  footer{margin-top:18px;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:12px}
  .k{font-weight:800}
  .link{color:var(--purple);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <div class="brand">${escapeHtml(org)}</div>
      <h1>Account Handoff Pack — ${escapeHtml(a.business_name || "")}</h1>
      <div class="sub">Generated: ${new Date().toLocaleString()}</div>
    </div>
    <div style="text-align:right">
      <div class="k">AE of Record</div>
      <div>${escapeHtml(a.ae_name || "")}</div>
      <div class="sub">${escapeHtml(a.route || "")}</div>
    </div>
  </header>

  <section class="grid">
    <div class="box">
      <div class="k">Contact</div>
      <div class="meta">
        <span class="chip">Email: ${escapeHtml(a.business_email || "")}</span>
        ${a.phone ? `<span class="chip">Phone: ${escapeHtml(a.phone)}</span>` : ""}
      </div>
      <div class="muted">Decision contact: ${escapeHtml(a.contact_name || "—")}</div>
    </div>

    <div class="box">
      <div class="k">Qualification</div>
      <div class="meta">
        ${a.service_1 ? `<span class="chip">Service: ${escapeHtml(a.service_1)}</span>` : ""}
        ${a.service_area ? `<span class="chip">Area: ${escapeHtml(a.service_area)}</span>` : ""}
        <span class="chip">Permission: ${escapeHtml(a.permission || "")}</span>
        <span class="chip">Status: ${escapeHtml(a.account_status || "")}</span>
      </div>
      ${a.website_or_booking ? `<div class="muted">Link/Booking: <a class="link" href="${escapeHtml(a.website_or_booking)}">${escapeHtml(a.website_or_booking)}</a></div>` : `<div class="muted">Link/Booking: —</div>`}
    </div>
  </section>

  <section class="box">
    <div class="k">Tags</div>
    <div class="meta">${tags}</div>
  </section>

  <section class="box">
    <div class="k">Account Notes</div>
    ${a.notes ? `<div class="note">${escapeHtml(a.notes)}</div>` : `<div class="muted">No notes.</div>`}
  </section>

  <section>
    <h2 style="margin:14px 0 6px;font-size:16px;">Deals</h2>
    ${dealBlocks}
  </section>

  <section>
    <h2 style="margin:14px 0 6px;font-size:16px;">Recent Visits (by email match)</h2>
    ${visitBlocks || `<div class="muted">No matching visits found.</div>`}
  </section>

  <footer>${escapeHtml(footer)}</footer>
</div>
</body>
</html>`;
    }

    function downloadText(filename, text, type){
      const blob = new Blob([text], { type: type || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }

    function logHandoffGenerated(entry){
      APP.state.handoff_log = APP.state.handoff_log || [];
      APP.state.handoff_log.unshift(entry);
      if(APP.state.handoff_log.length > 600){
        APP.state.handoff_log = APP.state.handoff_log.slice(0, 600);
      }
      saveState();
      renderHandoffLogStats();
    }

    function downloadHandoffPack(accountId){
      const acct = (APP.state.accounts||[]).find(a=>a.id===accountId);
      if(!acct){ toast("Account not found"); return; }
      const html = buildHandoffHTML(acct);
      const fn = `handoff-${safeFilename(acct.business_name)}-${todayKey()}.html`;
      downloadText(fn, html, "text/html");

      logHandoffGenerated({
        id: uid(),
        created_at: nowISO(),
        date_key: todayKey(),
        account_id: acct.id,
        business_name: acct.business_name || "",
        business_email: acct.business_email || "",
        ae_name: acct.ae_name || "",
        filename: fn,
        handoff_html: html
      });

      toast("Handoff pack downloaded ⬇️");
    }

    // ---- Daily Bundle ----
    function buildDailyBundle(){
      const tKey = todayKey();
      const visitsToday = (APP.state.visits||[]).filter(v=>v.date_key===tKey);
      const dealsToday = (APP.state.deals||[]).filter(d=>d.date_key===tKey);
      const handoffsToday = (APP.state.handoff_log||[]).filter(h=>h.date_key===tKey);

      const uniqueAEs = Array.from(new Set([
        ...visitsToday.map(v => (v.ae_name||"").trim()).filter(Boolean),
        ...dealsToday.map(d => (d.ae_name||"").trim()).filter(Boolean),
        ...handoffsToday.map(h => (h.ae_name||"").trim()).filter(Boolean)
      ]));

      const emails = visitsToday.map(v => normalizeEmail(v.business_email)).filter(Boolean);
      const uniqueEmails = Array.from(new Set(emails));

      const permissionYes = visitsToday.filter(v=>v.permission==="yes").length;

      const touchedAccountIds = Array.from(new Set([
        ...dealsToday.map(d=>d.account_id).filter(Boolean),
        ...handoffsToday.map(h=>h.account_id).filter(Boolean)
      ]));
      const touchedAccounts = touchedAccountIds
        .map(id => (APP.state.accounts||[]).find(a=>a.id===id))
        .filter(Boolean);

      const summary = {
        date_key: tKey,
        visits: visitsToday.length,
        emails_captured: uniqueEmails.length,
        permission_yes: permissionYes,
        deals: dealsToday.length,
        handoffs_generated: handoffsToday.length,
        unique_aes: uniqueAEs,
        touched_accounts: touchedAccounts.map(a => ({
          id: a.id,
          business_name: a.business_name || "",
          business_email: a.business_email || "",
          ae_name: a.ae_name || "",
          account_status: a.account_status || "",
          permission: a.permission || ""
        }))
      };

      return {
        app: APP.name,
        version: "1.1",
        exported_at: nowISO(),
        date_key: tKey,
        brand: APP.state.settings?.brand || {},
        summary,
        visits_today: visitsToday,
        deals_today: dealsToday,
        handoffs_today: handoffsToday
      };
    }

    function exportDailyBundle(){
      const tKey = todayKey();
      const bundle = buildDailyBundle();
      const handoffsCount = (bundle.handoffs_today||[]).length;

      if(handoffsCount === 0){
        const ok = confirm("No handoff packs were generated today on this device. Export bundle anyway (visits+deals only)?");
        if(!ok) return;
      }
      downloadText(`AE-FLOW-DAILY-BUNDLE-${tKey}.json`, JSON.stringify(bundle, null, 2), "application/json");
      toast("Daily bundle exported ⬇️");
    }

    function renderHandoffLogStats(){
      const el = $("handoffLogStats");
      if(!el) return;
      const log = APP.state.handoff_log || [];
      const tKey = todayKey();
      const todayCount = log.filter(x=>x.date_key===tKey).length;
      el.textContent = `Handoffs logged: ${log.length} total • ${todayCount} today`;
    }

    function clearHandoffLog(todayOnly=false){
      const tKey = todayKey();
      if(todayOnly){
        const ok = confirm("Clear TODAY handoff log entries from this device?");
        if(!ok) return;
        APP.state.handoff_log = (APP.state.handoff_log||[]).filter(x=>x.date_key!==tKey);
      }else{
        const ok = confirm("Clear ALL handoff log entries from this device?");
        if(!ok) return;
        APP.state.handoff_log = [];
      }
      saveState();
      renderHandoffLogStats();
      toast("Handoff log cleared");
    }

    // ---- Share Sheet with attached Daily Bundle JSON ----
    function buildDailySummary(){
      const tKey = todayKey();
      const todayVisits = (APP.state.visits||[]).filter(v => v.date_key === tKey);
      const emails = todayVisits.filter(v => (v.business_email||"").trim()).length;
      const permissionYes = todayVisits.filter(v=>v.permission==="yes").length;
      const handoffsToday = (APP.state.handoff_log||[]).filter(h=>h.date_key===tKey).length;

      const lines = [];
      lines.push(`AE FLOW Summary — ${tKey}`);
      lines.push(`Visits: ${todayVisits.length}`);
      lines.push(`Emails captured: ${emails}`);
      lines.push(`Permission YES: ${permissionYes}`);
      lines.push(`Total owned accounts: ${(APP.state.accounts||[]).length}`);
      lines.push(`Open deals: ${(APP.state.deals||[]).filter(d=>!["Closed Won","Closed Lost"].includes(d.stage)).length}`);
      lines.push(`Handoff packs generated today: ${handoffsToday}`);
      return lines.join("\\n");
    }

    async function shareDailyBundle(){
      const tKey = todayKey();
      const bundle = buildDailyBundle();
      const json = JSON.stringify(bundle, null, 2);
      const filename = `AE-FLOW-DAILY-BUNDLE-${tKey}.json`;

      let file = null;
      try{
        file = new File([json], filename, { type: "application/json" });
      }catch(e){
        file = null;
      }

      const canShareFiles = !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));

      if(canShareFiles){
        try{
          await navigator.share({
            title: `Daily Bundle — ${tKey}`,
            text: buildDailySummary(),
            files: [file]
          });
          toast("Shared bundle ✅");
          return;
        }catch(e){
          // user canceled or failed; fall through
        }
      }

      downloadText(filename, json, "application/json");
      await copyText(buildDailySummary());
      toast("Downloaded bundle + copied summary ✅");
    }

    async function shareSummary(){
      const text = buildDailySummary();
      if(navigator.share){
        try{
          await navigator.share({ title:"AE FLOW Summary", text });
          toast("Shared ✅");
          return;
        }catch(e){}
      }
      await copyText(text);
      toast("Copied summary ✅");
    }

    // ---- Settings ----
    function loadSettingsUI(){
      ensureForecastDefaults();
      $("setDepositPct").value = APP.state.settings.depositPct;
      $("setPresets").value = APP.state.settings.presetsText;
      $("setForecastWinRate").value = APP.state.settings.forecast.winRate;
      $("setForecastRetentionMonths").value = APP.state.settings.forecast.retentionMonths;
      $("setForecastCloseWindowDays").value = APP.state.settings.forecast.closeWindowDays;
      renderHandoffLogStats();
      renderVaultStatus();
    }

    function saveSettings(){
      const dep = Number($("setDepositPct").value);
      const winRate = Number($("setForecastWinRate").value);
      const retentionMonths = Number($("setForecastRetentionMonths").value);
      const closeWindowDays = Number($("setForecastCloseWindowDays").value);
      if(!Number.isFinite(dep) || dep < 0 || dep > 1){
        toast("Deposit % must be between 0 and 1");
        return;
      }
      if(!Number.isFinite(winRate) || winRate < 0 || winRate > 1){
        toast("Win rate must be between 0 and 1");
        return;
      }
      if(!Number.isFinite(retentionMonths) || retentionMonths < 1 || retentionMonths > 60){
        toast("Retention months must be between 1 and 60");
        return;
      }
      if(!Number.isFinite(closeWindowDays) || closeWindowDays < 1 || closeWindowDays > 365){
        toast("Close window must be between 1 and 365 days");
        return;
      }
      APP.state.settings.depositPct = dep;
      APP.state.settings.presetsText = ($("setPresets").value || "").trim();
      APP.state.settings.forecast = {
        winRate,
        retentionMonths: Math.round(retentionMonths),
        closeWindowDays: Math.round(closeWindowDays)
      };
      saveState();
      populatePresets();
      $("dealDepositPct").value = APP.state.settings.depositPct;
      renderDealCalc();
      if(APP.state.ui.tab === "analytics") renderAnalytics();
      renderVaultStatus("Forecast + deal settings saved.");
      toast("Settings saved ✅");
    }

    function resetSettings(){
      APP.state.settings.depositPct = 0.40;
      APP.state.settings.presetsText =
`Standard | 0.40 | 0.20
Aggressive | 0.50 | 0.25`;
      APP.state.settings.forecast = {
        winRate: 0.35,
        retentionMonths: 12,
        closeWindowDays: 30
      };
      saveState();
      loadSettingsUI();
      populatePresets();
      $("dealDepositPct").value = APP.state.settings.depositPct;
      renderDealCalc();
      if(APP.state.ui.tab === "analytics") renderAnalytics();
      toast("Settings reset");
    }

    // ---- KPIs ----
    function computeKPIs(){
      const tKey = todayKey();
      const todayVisits = (APP.state.visits||[]).filter(v => v.date_key === tKey);
      const emails = todayVisits.filter(v => (v.business_email||"").trim()).length;
      const owned = (APP.state.accounts||[]).length;
      const openDeals = (APP.state.deals||[]).filter(d => !["Closed Won","Closed Lost"].includes(d.stage)).length;
      return { todayCount: todayVisits.length, emails, owned, openDeals };
    }

    function renderKPIs(){
      const k = computeKPIs();
      document.getElementById("kpiToday").textContent = String(k.todayCount);
      document.getElementById("kpiEmails").textContent = String(k.emails);
      document.getElementById("kpiOwned").textContent = String(k.owned);
      document.getElementById("kpiDeals").textContent = String(k.openDeals);
    }

    // ---- Export / Backup / Import ----
    function toCSV(rows){
      return rows.map(r => r.map(x => `"${(x??"").toString().replaceAll('"','""')}"`).join(",")).join("\\n");
    }

    function exportAllCSV(){
      const tKey = todayKey();
      const vrows = [["type","date_key","created_at","ae_name","route","business_name","business_email","phone","contact_name","service_1","service_area","industry","source_directory","lead_temperature","priority","estimated_setup_value","estimated_monthly_value","next_action","last_contacted_at","permission","status","follow_up_date","tags","notes"]];
      (APP.state.visits||[]).forEach(v=>{
        vrows.push([
          "visit", v.date_key||"", v.created_at||"", v.ae_name||"", v.route||"", v.business_name||"", v.business_email||"",
          v.phone||"", v.contact_name||"", v.service_1||"", v.service_area||"", v.industry||"", v.source_directory||"", v.lead_temperature||"", v.priority||"", v.estimated_setup_value||0, v.estimated_monthly_value||0, v.next_action||"", v.last_contacted_at||"",
          v.permission||"", v.status||"", v.follow_up_date||"",
          (v.tags||[]).join("; "),
          (v.notes||"").replaceAll("\\n"," ")
        ]);
      });

      const arows = [["type","created_at","ae_name","business_name","business_email","phone","contact_name","service_1","service_area","website_or_booking","industry","source_directory","lead_temperature","priority","estimated_setup_value","estimated_monthly_value","next_action","last_contacted_at","permission","account_status","tags","notes"]];
      (APP.state.accounts||[]).forEach(a=>{
        arows.push([
          "account", a.created_at||"", a.ae_name||"", a.business_name||"", a.business_email||"", a.phone||"", a.contact_name||"",
          a.service_1||"", a.service_area||"", a.website_or_booking||"", a.industry||"", a.source_directory||"", a.lead_temperature||"", a.priority||"", a.estimated_setup_value||0, a.estimated_monthly_value||0, a.next_action||"", a.last_contacted_at||"", a.permission||"", a.account_status||"",
          (a.tags||[]).join("; "),
          (a.notes||"").replaceAll("\\n"," ")
        ]);
      });

      const drows = [["type","created_at","ae_name","account_name","account_email","deal_name","stage","setup_total","monthly_total","deposit_pct","deposit_due","preset","items","notes"]];
      (APP.state.deals||[]).forEach(d=>{
        const items = (d.items||[]).map(it => `${it.name} [setup:${it.setup}; monthly:${it.monthly}]`).join(" | ");
        drows.push([
          "deal", d.created_at||"", d.ae_name||"", d.account_name||"", d.account_email||"", d.name||"", d.stage||"",
          d.setup_total||0, d.monthly_total||0, d.deposit_pct||0, d.deposit_due||0,
          d.preset_name||"",
          items,
          (d.notes||"").replaceAll("\\n"," ")
        ]);
      });

      const csv = toCSV([...vrows, [], ...arows, [], ...drows]);
      downloadText(`AE-FLOW-ALL-${tKey}.csv`, csv, "text/csv");
      toast("CSV exported ⬇️");
    }

    function buildBackupPayload(todayOnly=false){
      const tKey = todayKey();
      return {
        app: APP.name,
        version: "1.2",
        exported_at: nowISO(),
        settings: APP.state.settings,
        visits: todayOnly ? (APP.state.visits||[]).filter(v=>v.date_key===tKey) : (APP.state.visits||[]),
        accounts: (APP.state.accounts||[]),
        deals: (APP.state.deals||[]),
        handoff_log: (APP.state.handoff_log||[])
      };
    }

    function normalizeImportedRecord(item, kind){
      const x = Object.assign({}, item || {});
      if(!x.id) x.id = uid();
      if(!x.created_at) x.created_at = nowISO();
      if(!x.updated_at) x.updated_at = x.created_at;
      if(!x.date_key) x.date_key = todayKey(x.created_at);
      if(!Array.isArray(x.tags)){
        if(typeof x.tags === "string") x.tags = x.tags.split(",").map(s=>s.trim()).filter(Boolean);
        else x.tags = [];
      }
      if(kind === "visit"){
        if(!x.status) x.status = "New";
        if(!x.lead_source && x.source_directory) x.lead_source = x.source_directory;
      }
      if(kind === "account"){
        if(!x.account_status && x.status) x.account_status = x.status;
        if(!x.account_status) x.account_status = "Owned";
      }
      if(kind === "deal"){
        if(!Array.isArray(x.items)) x.items = [];
        if(!x.stage) x.stage = "Discovery";
        if(x.deposit_pct == null) x.deposit_pct = Number(APP.state.settings.depositPct || 0.40);
      }
      if(kind === "handoff"){
        if(!x.filename) x.filename = safeFilename(x.business_name || x.account_name || "handoff") + ".html";
        if(!x.handoff_html) x.handoff_html = "";
      }
      return x;
    }

    function normalizeImportedPayload(parsed){
      const raw = parsed && typeof parsed === "object" ? parsed : {};
      const base = raw.state && typeof raw.state === "object" ? raw.state : (raw.data && typeof raw.data === "object" ? raw.data : raw);
      const visits = Array.isArray(base.visits) ? base.visits : (Array.isArray(base.leads) ? base.leads : []);
      const accounts = Array.isArray(base.accounts) ? base.accounts : [];
      const deals = Array.isArray(base.deals) ? base.deals : [];
      const handoff = Array.isArray(base.handoff_log) ? base.handoff_log : (Array.isArray(base.handoffLog) ? base.handoffLog : (Array.isArray(base.handoffs) ? base.handoffs : []));
      const settings = base.settings && typeof base.settings === "object" ? base.settings : {};
      return {
        settings,
        visits: visits.map(v=>normalizeImportedRecord(v, "visit")),
        accounts: accounts.map(a=>normalizeImportedRecord(a, "account")),
        deals: deals.map(d=>normalizeImportedRecord(d, "deal")),
        handoff_log: handoff.map(h=>normalizeImportedRecord(h, "handoff"))
      };
    }

    function mergeBackupPayload(parsed, options={}){
      const normalized = normalizeImportedPayload(parsed);
      const replace = !!options.replace;
      if(replace){
        APP.state.visits = [];
        APP.state.accounts = [];
        APP.state.deals = [];
        APP.state.handoff_log = [];
      }

      const mergeById = (arr, incoming) => {
        const map = new Map(arr.map(x=>[x.id, x]));
        let added = 0;
        (incoming||[]).forEach(x=>{
          const item = x && x.id ? x : normalizeImportedRecord(x, "visit");
          if(item && item.id && !map.has(item.id)){
            arr.push(item);
            map.set(item.id, item);
            added++;
          }
        });
        return added;
      };

      let addedV=0, addedA=0, addedD=0, addedH=0;
      if(Array.isArray(normalized.visits)) addedV = mergeById(APP.state.visits, normalized.visits);
      if(Array.isArray(normalized.accounts)) addedA = mergeById(APP.state.accounts, normalized.accounts);
      if(Array.isArray(normalized.deals)) addedD = mergeById(APP.state.deals, normalized.deals);
      if(Array.isArray(normalized.handoff_log)) addedH = mergeById(APP.state.handoff_log, normalized.handoff_log);
      if(normalized.settings && typeof normalized.settings === "object"){
        APP.state.settings = Object.assign(APP.state.settings, normalized.settings);
        ensureForecastDefaults();
        if(!APP.state.settings.brand) APP.state.settings.brand = { orgName:"Skyes Over London LC", replyEmail:"", tagline:"", handoffFooter:"" };
      }

      APP.state.visits.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
      APP.state.accounts.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
      APP.state.deals.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
      APP.state.handoff_log.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));

      saveState();
      renderAll();
      return { addedV, addedA, addedD, addedH };
    }

    function backupJSON(todayOnly=false){
      const tKey = todayKey();
      const payload = buildBackupPayload(todayOnly);
      downloadText(`AE-FLOW-backup-${todayOnly?"TODAY-":""}${tKey}.json`, JSON.stringify(payload, null, 2), "application/json");
      toast("Backup exported ⬇️");
    }

    let importFile = null;
    let vaultImportFile = null;
    function handleFilePick(){
      const inp = $("importFile");
      if(!inp.files || !inp.files[0]) return;
      importFile = inp.files[0];
      toast("JSON file selected");
    }

    function handleVaultFilePick(){
      const inp = $("vaultImportFile");
      if(!inp || !inp.files || !inp.files[0]) return;
      vaultImportFile = inp.files[0];
      toast("Encrypted vault file selected");
    }

    async function importJSON(){
      if(!importFile){ toast("Choose a JSON file first"); return; }
      try{
        const text = await importFile.text();
        const parsed = JSON.parse(text);
        const res = mergeBackupPayload(parsed, { replace:false });
        toast(`Imported: ${res.addedV} visits, ${res.addedA} accounts, ${res.addedD} deals, ${res.addedH} handoffs`);
      }catch(e){
        console.error("AE FLOW import failed", e);
        toast(`Import failed: ${e && e.message ? e.message : "bad file"}`);
      }
    }

    async function saveSecureMirror(){
      const passphrase = getVaultPassphrase();
      if(passphrase.length < 6){ toast("Use a longer vault passphrase"); return; }
      try{
        const wrapped = await encryptPayload(buildBackupPayload(false), passphrase);
        localStorage.setItem(APP.storageKeySecure, JSON.stringify(wrapped));
        localStorage.setItem(APP.storageKeySecureMeta, JSON.stringify({ saved_at: nowISO(), version: "1.2" }));
        renderVaultStatus("Secure mirror refreshed.");
        toast("Secure mirror saved ✅");
      }catch(e){
        toast("Secure mirror failed");
      }
    }

    async function restoreSecureMirror(){
      const passphrase = getVaultPassphrase();
      const raw = localStorage.getItem(APP.storageKeySecure);
      if(!raw){ toast("No secure mirror on this device"); return; }
      if(passphrase.length < 6){ toast("Enter the vault passphrase"); return; }
      const ok = confirm("Restore the encrypted mirror and replace current device data?");
      if(!ok) return;
      try{
        const parsed = await decryptPayload(JSON.parse(raw), passphrase);
        mergeBackupPayload(parsed, { replace:true });
        renderVaultStatus("Secure mirror restored.");
        toast("Secure mirror restored ✅");
      }catch(e){
        toast("Passphrase or file was wrong");
      }
    }

    async function exportEncryptedBackup(){
      const passphrase = getVaultPassphrase();
      if(passphrase.length < 6){ toast("Use a longer vault passphrase"); return; }
      try{
        const wrapped = await encryptPayload(buildBackupPayload(false), passphrase);
        downloadText(`AE-FLOW-ENCRYPTED-${todayKey()}.aeflowvault.json`, JSON.stringify(wrapped, null, 2), "application/json");
        renderVaultStatus("Encrypted backup exported.");
        toast("Encrypted export ready ⬇️");
      }catch(e){
        toast("Encrypted export failed");
      }
    }

    async function importEncryptedBackup(){
      const passphrase = getVaultPassphrase();
      if(!vaultImportFile){ toast("Choose an encrypted vault file first"); return; }
      if(passphrase.length < 6){ toast("Enter the vault passphrase"); return; }
      try{
        const text = await vaultImportFile.text();
        const wrapped = JSON.parse(text);
        const parsed = await decryptPayload(wrapped, passphrase);
        const res = mergeBackupPayload(parsed, { replace:false });
        renderVaultStatus("Encrypted backup merged into device data.");
        toast(`Vault imported: ${res.addedV} visits, ${res.addedA} accounts, ${res.addedD} deals`);
      }catch(e){
        console.error("AE FLOW encrypted import failed", e);
        toast(`Encrypted import failed: ${e && e.message ? e.message : "bad file"}`);
      }
    }

    function clearSecureMirror(){
      const ok = confirm("Delete the secure mirror stored on this device?");
      if(!ok) return;
      localStorage.removeItem(APP.storageKeySecure);
      localStorage.removeItem(APP.storageKeySecureMeta);
      renderVaultStatus("Secure mirror removed.");
      toast("Secure mirror cleared");
    }



    // ---- Analytics ----
    function sum(arr){ return (arr||[]).reduce((n,x)=>n + (Number(x)||0), 0); }
    function tally(list, getter){
      const m = new Map();
      (list||[]).forEach(item=>{
        const k = (getter(item) || "Unspecified").toString().trim() || "Unspecified";
        m.set(k, (m.get(k)||0) + 1);
      });
      return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
    }
    function tallyDates(list, getter){
      const m = new Map();
      (list||[]).forEach(item=>{
        const k = getter(item);
        if(!k) return;
        m.set(k, (m.get(k)||0) + 1);
      });
      return m;
    }
    function formatPct(n){ return `${Math.round((Number(n)||0) * 100)}%`; }
    function endOfDayKeyOffset(offset){
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return todayKey(d);
    }
    function getDueFollowups(){
      const today = todayKey();
      const in7 = endOfDayKeyOffset(7);
      return (APP.state.visits||[])
        .filter(v => (v.follow_up_date||"") && v.follow_up_date <= in7 && !["Approved","Do not contact"].includes(v.status||""))
        .sort((a,b)=>(a.follow_up_date||"").localeCompare(b.follow_up_date||""))
        .map(v=>({ ...v, overdue: v.follow_up_date < today }));
    }
    function priorityWeight(priority){
      const p = (priority||"").toLowerCase();
      if(p === "critical") return 1.35;
      if(p === "high") return 1.18;
      if(p === "low") return 0.82;
      return 1;
    }
    function temperatureWeight(temp){
      const t = (temp||"").toLowerCase();
      if(t === "hot") return 1.18;
      if(t === "warm") return 0.88;
      if(t === "cold") return 0.55;
      return 0.72;
    }
    function permissionWeight(permission){
      const p = (permission||"").toLowerCase();
      if(p === "yes") return 1.16;
      if(p === "maybe") return 0.84;
      if(p === "no") return 0.22;
      return 0.7;
    }
    function statusWeight(status){
      const s = (status||"").toLowerCase();
      if(s === "approved") return 1.35;
      if(s === "interested") return 1.08;
      if(s === "follow-up sent") return 0.95;
      if(s === "emailed") return 0.88;
      if(s === "no answer") return 0.58;
      if(s === "do not contact") return 0;
      return 0.75;
    }
    function visitPotential12m(v, retentionMonths){
      return (Number(v.estimated_setup_value)||0) + ((Number(v.estimated_monthly_value)||0) * retentionMonths);
    }
    function weightedVisitForecast(v){
      const f = getForecastSettings();
      const base = visitPotential12m(v, f.retentionMonths);
      const weighted = base * f.winRate * priorityWeight(v.priority) * temperatureWeight(v.lead_temperature) * permissionWeight(v.permission) * statusWeight(v.status);
      return Math.max(0, weighted);
    }
    function computeRouteScoring(visits, accounts){
      const accountEmails = new Set((accounts||[]).map(a=>normalizeEmail(a.business_email)).filter(Boolean));
      const byRoute = new Map();
      (visits||[]).forEach(v=>{
        const route = (v.route || "Unspecified").trim() || "Unspecified";
        if(!byRoute.has(route)){
          byRoute.set(route, { route, visits:0, yes:0, accounts:0, est12m:0, weighted12m:0, score:0 });
        }
        const row = byRoute.get(route);
        row.visits += 1;
        if((v.permission||"").toLowerCase() === "yes") row.yes += 1;
        if(accountEmails.has(normalizeEmail(v.business_email))) row.accounts += 1;
        row.est12m += visitPotential12m(v, getForecastSettings().retentionMonths);
        row.weighted12m += weightedVisitForecast(v);
      });
      return Array.from(byRoute.values()).map(r=>{
        r.score = (r.visits * 5) + (r.yes * 13) + (r.accounts * 30) + (r.weighted12m / 1800);
        return r;
      }).sort((a,b)=>b.score - a.score);
    }
    function computeAccountForecasts(accounts, deals){
      const retentionMonths = getForecastSettings().retentionMonths;
      return (accounts||[]).map(a=>{
        const openDeals = (deals||[]).filter(d=>d.account_id === a.id && !["Closed Won","Closed Lost"].includes(d.stage));
        const openDeal12m = sum(openDeals.map(d=>(Number(d.setup_total)||0) + ((Number(d.monthly_total)||0) * retentionMonths)));
        const visitBased12m = (Number(a.estimated_setup_value)||0) + ((Number(a.estimated_monthly_value)||0) * retentionMonths);
        const statusBump = /active/i.test(a.account_status||"") ? 1.1 : 0.82;
        const forecast12m = openDeal12m + (visitBased12m * getForecastSettings().winRate * statusBump);
        return {
          id: a.id,
          business_name: a.business_name || "Untitled",
          ae_name: a.ae_name || "",
          industry: a.industry || "",
          priority: a.priority || "Normal",
          next_action: a.next_action || "",
          account_status: a.account_status || "",
          openDeals: openDeals.length,
          openDeal12m,
          visitBased12m,
          forecast12m
        };
      }).sort((a,b)=>b.forecast12m - a.forecast12m);
    }
    function computeAnalytics(){
      const visits = APP.state.visits || [];
      const accounts = APP.state.accounts || [];
      const deals = APP.state.deals || [];
      const uniqueVisitEmails = new Set(visits.map(v=>normalizeEmail(v.business_email)).filter(Boolean));
      const uniqueAccountEmails = new Set(accounts.map(a=>normalizeEmail(a.business_email)).filter(Boolean));
      const openDeals = deals.filter(d=>!["Closed Won","Closed Lost"].includes(d.stage));
      const totalVisits = visits.length;
      const permissionYes = visits.filter(v=>v.permission === "yes").length;
      const conversion = uniqueVisitEmails.size ? (uniqueAccountEmails.size / uniqueVisitEmails.size) : 0;
      const estSetup = sum(visits.map(v=>v.estimated_setup_value));
      const estMonthly = sum(visits.map(v=>v.estimated_monthly_value));
      const retentionMonths = getForecastSettings().retentionMonths;
      const pipeline = sum(openDeals.map(d=>(Number(d.setup_total)||0) + ((Number(d.monthly_total)||0) * retentionMonths)));
      const activeAEs = new Set(visits.map(v=>(v.ae_name||"").trim()).filter(Boolean)).size;
      const due = getDueFollowups();
      const timelineMap = tallyDates(visits, v=>v.date_key);
      const timeline = [];
      for(let i=13; i>=0; i--){
        const key = endOfDayKeyOffset(-i);
        timeline.push([key.slice(5), timelineMap.get(key)||0]);
      }
      const routeScoring = computeRouteScoring(visits, accounts);
      const accountForecasts = computeAccountForecasts(accounts, deals);
      const weightedVisitForecastTotal = sum(visits.map(v=>weightedVisitForecast(v)));
      return {
        totalVisits,
        permissionYesRate: totalVisits ? permissionYes / totalVisits : 0,
        conversionRate: conversion,
        dueCount: due.length,
        estSetup,
        estMonthly,
        pipeline,
        activeAEs,
        due,
        retentionMonths,
        weightedVisitForecast: weightedVisitForecastTotal,
        routeScoring,
        accountForecasts,
        leadSources: tally(visits, v=>v.source_directory || v.lead_source),
        statuses: tally(visits, v=>v.status),
        aeCounts: tally(visits, v=>v.ae_name),
        routeCounts: tally(visits, v=>v.route),
        industries: tally(visits, v=>v.industry),
        priorityCounts: tally(visits, v=>v.priority),
        dealStages: tally(deals, d=>d.stage),
        timeline,
        visits,
        accounts,
        deals,
        openDeals
      };
    }
    function drawBarChart(canvasId, entries, colorA, colorB){
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width || canvas.width || 520));
      const height = 220;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle = "rgba(255,255,255,.03)";
      ctx.fillRect(0,0,width,height);
      const rows = (entries||[]).slice(0,6);
      if(!rows.length){
        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.font = "13px system-ui";
        ctx.fillText("No data yet.", 16, 28);
        return;
      }
      const max = Math.max(...rows.map(r=>r[1]), 1);
      const left = 118;
      const right = 24;
      const top = 18;
      const rowH = 31;
      rows.forEach((row, i)=>{
        const y = top + i * rowH;
        const label = String(row[0] || "Unspecified").slice(0, 18);
        const value = Number(row[1]) || 0;
        const barW = ((width - left - right) * value) / max;
        const grad = ctx.createLinearGradient(left, 0, left + barW, 0);
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fillRect(left, y, width - left - right, 16);
        ctx.fillStyle = grad;
        ctx.fillRect(left, y, barW, 16);
        ctx.fillStyle = "rgba(255,255,255,.86)";
        ctx.font = "12px system-ui";
        ctx.fillText(label, 12, y + 12);
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.fillText(String(value), Math.min(width - 18, left + barW + 8), y + 12);
      });
    }
    function drawTimelineChart(canvasId, entries){
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width || canvas.width || 520));
      const height = 220;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle = "rgba(255,255,255,.03)";
      ctx.fillRect(0,0,width,height);
      const vals = (entries||[]).map(x=>Number(x[1])||0);
      const max = Math.max(...vals, 1);
      const left = 16, right = 16, top = 18, bottom = 38;
      const plotW = width - left - right;
      const plotH = height - top - bottom;
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 1;
      for(let i=0;i<4;i++){
        const y = top + (plotH * i / 3);
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width-right, y); ctx.stroke();
      }
      if(!entries || !entries.length){
        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.font = "13px system-ui";
        ctx.fillText("No timeline data yet.", 16, 28);
        return;
      }
      ctx.beginPath();
      entries.forEach((e, i)=>{
        const x = left + (plotW * i / Math.max(entries.length - 1, 1));
        const y = top + plotH - ((Number(e[1])||0) / max) * plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.strokeStyle = "rgba(124,58,237,.95)";
      ctx.lineWidth = 3;
      ctx.stroke();
      entries.forEach((e, i)=>{
        const x = left + (plotW * i / Math.max(entries.length - 1, 1));
        const y = top + plotH - ((Number(e[1])||0) / max) * plotH;
        ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fillStyle = "rgba(245,197,66,.95)"; ctx.fill();
        if(i < entries.length - 1){
          ctx.fillStyle = "rgba(255,255,255,.55)";
          ctx.font = "10px system-ui";
          ctx.fillText(String(e[0]), x-10, height-12);
        }
      });
    }
    function buildInsightsText(ana){
      const topAE = (ana.aeCounts[0] || ["No AE data", 0]);
      const topRoute = (ana.routeScoring[0] || { route:"No route data", score:0, weighted12m:0 });
      const topSource = (ana.leadSources[0] || ["No source data", 0]);
      const topIndustry = (ana.industries[0] || ["No industry data", 0]);
      const lines = [];
      lines.push(`Total visits logged: ${ana.totalVisits}.`);
      lines.push(`Visit-to-account conversion is ${formatPct(ana.conversionRate)} and permission-yes rate is ${formatPct(ana.permissionYesRate)}.`);
      lines.push(`Estimated visit-side opportunity totals ${money(ana.estSetup)} setup and ${money(ana.estMonthly)} monthly.`);
      lines.push(`Weighted 12-month visit forecast is ${money(ana.weightedVisitForecast)} using the current local forecast settings.`);
      lines.push(`Open pipeline across saved deals is ${money(ana.pipeline)}.`);
      lines.push(`Top AE right now: ${topAE[0]} with ${topAE[1]} visits.`);
      lines.push(`Top route: ${topRoute.route} with command score ${Math.round(topRoute.score)} and weighted value ${money(topRoute.weighted12m)}.`);
      lines.push(`Strongest intake lane: ${topSource[0]} with ${topSource[1]} visits.`);
      lines.push(`Dominant industry in this dataset: ${topIndustry[0]} with ${topIndustry[1]} visits.`);
      lines.push(`Follow-ups due or overdue: ${ana.dueCount}.`);
      return lines.join("\n");
    }

    function renderInsights(ana){
      const el = document.getElementById("insightsList");
      if(!el) return;
      const topAE = (ana.aeCounts[0] || ["No AE data", 0]);
      const topRoute = (ana.routeScoring[0] || { route:"No route data", score:0, weighted12m:0 });
      const topSource = (ana.leadSources[0] || ["No source data", 0]);
      const insights = [
        `Conversion rate is ${formatPct(ana.conversionRate)} from unique visited emails to owned accounts.`,
        `Permission yes rate is ${formatPct(ana.permissionYesRate)} — that tells you how often the field pitch is actually landing.`,
        `Weighted 12-month visit forecast is ${money(ana.weightedVisitForecast)} using your current win-rate settings.`,
        `Top AE: ${topAE[0]} with ${topAE[1]} logged visits.`,
        `Top route: ${topRoute.route} with a command score of ${Math.round(topRoute.score)} and weighted value of ${money(topRoute.weighted12m)}.`,
        `Best intake source: ${topSource[0]} with ${topSource[1]} visits.`,
        `Follow-up pressure: ${ana.dueCount} due or overdue items in the queue.`
      ];
      el.innerHTML = insights.map(x=>`<div class="insightItem">${escapeHtml(x)}</div>`).join("");
    }
    function renderFollowupQueue(ana){
      const el = document.getElementById("followupQueue");
      if(!el) return;
      if(!ana.due.length){
        el.innerHTML = `<div class="muted2">Nothing due yet. Tiny miracle. 🧪</div>`;
        return;
      }
      el.innerHTML = ana.due.slice(0,8).map(v=>`
        <div class="queueItem">
          <div style="font-weight:950;">${escapeHtml(v.business_name || "Untitled")}</div>
          <div class="metricLine"><span>${escapeHtml(v.follow_up_date || "")}</span><span>${v.overdue ? "Overdue" : "Upcoming"}</span></div>
          <div class="metricLine"><span>${escapeHtml(v.ae_name || "No AE")}</span><span>${escapeHtml(v.priority || "Normal")}</span></div>
          ${v.next_action ? `<div class="tiny" style="margin-top:8px;">Next: ${escapeHtml(v.next_action)}</div>` : ""}
        </div>
      `).join("");
    }
    function renderRouteScores(ana){
      const el = $("routeScoreList");
      if(!el) return;
      if(!ana.routeScoring.length){
        el.innerHTML = `<div class="muted2">No route data yet.</div>`;
        return;
      }
      el.innerHTML = ana.routeScoring.slice(0,8).map((r, idx)=>`
        <div class="tableRow">
          <div>
            <div class="tableTitle">#${idx+1} ${escapeHtml(r.route)}</div>
            <div class="tableMeta">${r.visits} visits • ${r.yes} permission yes • ${r.accounts} converted accounts</div>
          </div>
          <div style="text-align:right;">
            <div class="tableValue">${Math.round(r.score)}</div>
            <div class="tableMeta">${escapeHtml(money(r.weighted12m))}</div>
          </div>
        </div>
      `).join("");
    }
    function renderAccountForecasts(ana){
      const el = $("accountForecastList");
      if(!el) return;
      if(!ana.accountForecasts.length){
        el.innerHTML = `<div class="muted2">No account forecasts yet.</div>`;
        return;
      }
      el.innerHTML = ana.accountForecasts.slice(0,8).map((a, idx)=>`
        <div class="tableRow">
          <div>
            <div class="tableTitle">#${idx+1} ${escapeHtml(a.business_name)}</div>
            <div class="tableMeta">${escapeHtml(a.account_status || "No status")} • ${escapeHtml(a.priority || "Normal")} • ${escapeHtml(a.ae_name || "No AE")}</div>
            ${a.next_action ? `<div class="tiny" style="margin-top:6px;">Next: ${escapeHtml(a.next_action)}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <div class="tableValue">${escapeHtml(money(a.forecast12m))}</div>
            <div class="tableMeta">${a.openDeals} open deal${a.openDeals===1?"":"s"}</div>
          </div>
        </div>
      `).join("");
    }
    function renderAnalytics(){
      const ana = computeAnalytics();
      const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
      set("anaTotalVisits", String(ana.totalVisits));
      set("anaConversion", formatPct(ana.conversionRate));
      set("anaPermissionYes", formatPct(ana.permissionYesRate));
      set("anaFollowupsDue", String(ana.dueCount));
      set("anaEstSetup", money(ana.estSetup));
      set("anaEstMonthly", money(ana.estMonthly));
      set("anaOpenPipeline", money(ana.pipeline));
      set("anaActiveAEs", String(ana.activeAEs));
      set("anaWeighted12m", money(ana.weightedVisitForecast));
      set("anaRouteSignal", String(Math.round(ana.routeScoring[0]?.score || 0)));
      drawBarChart("chartLeadSources", ana.leadSources, "rgba(124,58,237,.95)", "rgba(245,197,66,.95)");
      drawBarChart("chartStatuses", ana.statuses, "rgba(245,197,66,.95)", "rgba(168,85,247,.95)");
      drawBarChart("chartAEs", ana.aeCounts, "rgba(34,197,94,.95)", "rgba(124,58,237,.95)");
      drawBarChart("chartRoutes", ana.routeCounts, "rgba(168,85,247,.95)", "rgba(39,242,255,.95)");
      drawTimelineChart("chartTimeline", ana.timeline);
      drawBarChart("chartIndustries", ana.industries, "rgba(39,242,255,.95)", "rgba(245,197,66,.95)");
      drawBarChart("chartPriorities", ana.priorityCounts, "rgba(245,197,66,.95)", "rgba(239,68,68,.95)");
      drawBarChart("chartDealStages", ana.dealStages, "rgba(34,197,94,.95)", "rgba(39,242,255,.95)");
      renderInsights(ana);
      renderFollowupQueue(ana);
      renderRouteScores(ana);
      renderAccountForecasts(ana);
    }

    function exportAnalyticsJSON(){
      const ana = computeAnalytics();
      const payload = {
        app: APP.name,
        exported_at: nowISO(),
        summary: {
          total_visits: ana.totalVisits,
          conversion_rate: ana.conversionRate,
          permission_yes_rate: ana.permissionYesRate,
          due_followups: ana.dueCount,
          estimated_setup_value: ana.estSetup,
          estimated_monthly_value: ana.estMonthly,
          open_pipeline_value: ana.pipeline,
          weighted_visit_forecast_12m: ana.weightedVisitForecast,
          active_aes: ana.activeAEs
        },
        lead_sources: ana.leadSources,
        statuses: ana.statuses,
        ae_counts: ana.aeCounts,
        route_counts: ana.routeCounts,
        route_scoring: ana.routeScoring,
        account_forecasts: ana.accountForecasts,
        industries: ana.industries,
        priority_counts: ana.priorityCounts,
        deal_stages: ana.dealStages,
        timeline: ana.timeline,
        due_followups: ana.due
      };
      downloadText(`AE-FLOW-analytics-${todayKey()}.json`, JSON.stringify(payload, null, 2), "application/json");
      toast("Analytics JSON exported ⬇️");
    }

    function exportForecastCSV(){
      const ana = computeAnalytics();
      const rows = [
        ["section","name","score_or_value","visits","permission_yes","accounts","open_deals","ae","status","next_action"]
      ];
      ana.routeScoring.forEach(r=>{
        rows.push(["route", r.route, Math.round(r.score), r.visits, r.yes, r.accounts, "", "", "", ""]);
      });
      ana.accountForecasts.forEach(a=>{
        rows.push(["account", a.business_name, Math.round(a.forecast12m), "", "", "", a.openDeals, a.ae_name, a.account_status, a.next_action]);
      });
      downloadText(`AE-FLOW-forecast-${todayKey()}.csv`, toCSV(rows), "text/csv");
      toast("Forecast CSV exported ⬇️");
    }

    function buildOpsHtml(){
      const ana = computeAnalytics();
      const insights = escapeHtml(buildInsightsText(ana)).replaceAll("\n", "<br>");
      const dueHtml = ana.due.slice(0, 12).map(v=>`<li><strong>${escapeHtml(v.business_name||"Untitled")}</strong> — ${escapeHtml(v.follow_up_date||"")} — ${escapeHtml(v.next_action||"No next action saved")}</li>`).join("") || "<li>No due follow-ups.</li>";
      const topRoutes = ana.routeScoring.slice(0,5).map(r=>`<li><strong>${escapeHtml(r.route)}</strong> — score ${Math.round(r.score)} — ${escapeHtml(money(r.weighted12m))}</li>`).join("") || "<li>No route score data.</li>";
      const topAccounts = ana.accountForecasts.slice(0,5).map(a=>`<li><strong>${escapeHtml(a.business_name)}</strong> — ${escapeHtml(money(a.forecast12m))} forecast — ${a.openDeals} open deal${a.openDeals===1?"":"s"}</li>`).join("") || "<li>No account forecasts yet.</li>";
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AE FLOW Ops Report</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#07040d;color:#f6f2ff;padding:24px;line-height:1.45} .card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:16px;padding:16px;margin:0 0 14px} .grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}@media(max-width:980px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}} .num{font-size:24px;font-weight:800}.lbl{font-size:12px;opacity:.72;margin-top:4px} h1,h2{margin:0 0 10px} ul{padding-left:18px}</style></head><body><h1>AE FLOW Ops Report</h1><div class="card">Generated ${escapeHtml(fmtTime(nowISO()))}</div><div class="grid"><div class="card"><div class="num">${ana.totalVisits}</div><div class="lbl">Total visits</div></div><div class="card"><div class="num">${formatPct(ana.conversionRate)}</div><div class="lbl">Visit → account conversion</div></div><div class="card"><div class="num">${formatPct(ana.permissionYesRate)}</div><div class="lbl">Permission yes rate</div></div><div class="card"><div class="num">${ana.dueCount}</div><div class="lbl">Follow-ups due</div></div><div class="card"><div class="num">${escapeHtml(money(ana.weightedVisitForecast))}</div><div class="lbl">Weighted 12-month forecast</div></div><div class="card"><div class="num">${escapeHtml(money(ana.estSetup))}</div><div class="lbl">Estimated setup value</div></div><div class="card"><div class="num">${escapeHtml(money(ana.estMonthly))}</div><div class="lbl">Estimated monthly value</div></div><div class="card"><div class="num">${escapeHtml(money(ana.pipeline))}</div><div class="lbl">Open pipeline value (${ana.retentionMonths}m)</div></div><div class="card"><div class="num">${ana.activeAEs}</div><div class="lbl">Active AEs</div></div><div class="card"><div class="num">${Math.round(ana.routeScoring[0]?.score || 0)}</div><div class="lbl">Top route score</div></div></div><div class="card"><h2>Insights</h2><div>${insights}</div></div><div class="card"><h2>Follow-up Queue</h2><ul>${dueHtml}</ul></div><div class="card"><h2>Top Routes</h2><ul>${topRoutes}</ul></div><div class="card"><h2>Top Account Forecasts</h2><ul>${topAccounts}</ul></div></body></html>`;
    }

    function exportOpsHTML(){
      downloadText(`AE-FLOW-ops-report-${todayKey()}.html`, buildOpsHtml(), "text/html");
      toast("Ops HTML exported ⬇️");
    }

    function buildExecutiveSnapshotHtml(){
      const ana = computeAnalytics();
      const topRoutes = ana.routeScoring.slice(0,8).map(r=>`<tr><td>${escapeHtml(r.route)}</td><td>${r.visits}</td><td>${r.yes}</td><td>${r.accounts}</td><td>${Math.round(r.score)}</td><td>${escapeHtml(money(r.weighted12m))}</td></tr>`).join("");
      const topAccounts = ana.accountForecasts.slice(0,8).map(a=>`<tr><td>${escapeHtml(a.business_name)}</td><td>${escapeHtml(a.ae_name || "-")}</td><td>${a.openDeals}</td><td>${escapeHtml(a.account_status || "-")}</td><td>${escapeHtml(money(a.forecast12m))}</td></tr>`).join("");
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AE FLOW Executive Snapshot</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#06030a;color:#f7f2ff;padding:26px} h1,h2{margin:0 0 12px} .hero{padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(135deg,rgba(124,58,237,.24),rgba(245,197,66,.08));margin-bottom:16px} .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}} .card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:16px;padding:14px} .num{font-size:26px;font-weight:900} .lbl{font-size:12px;opacity:.72;margin-top:4px} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid rgba(255,255,255,.08);padding:10px;text-align:left;font-size:14px} th{opacity:.72;font-size:12px}</style></head><body><div class="hero"><h1>AE FLOW Executive Snapshot</h1><div>Generated ${escapeHtml(fmtTime(nowISO()))} • Offline intelligence deck</div></div><div class="grid"><div class="card"><div class="num">${ana.totalVisits}</div><div class="lbl">Total visits</div></div><div class="card"><div class="num">${formatPct(ana.conversionRate)}</div><div class="lbl">Visit → account conversion</div></div><div class="card"><div class="num">${escapeHtml(money(ana.weightedVisitForecast))}</div><div class="lbl">Weighted 12-month visit forecast</div></div><div class="card"><div class="num">${escapeHtml(money(ana.pipeline))}</div><div class="lbl">Open pipeline value</div></div></div><div class="card"><h2>Top Route Command Scores</h2><table><thead><tr><th>Route</th><th>Visits</th><th>Yes</th><th>Accounts</th><th>Score</th><th>Weighted Value</th></tr></thead><tbody>${topRoutes || '<tr><td colspan="6">No route data.</td></tr>'}</tbody></table></div><div class="card"><h2>Top Account Forecasts</h2><table><thead><tr><th>Account</th><th>AE</th><th>Open Deals</th><th>Status</th><th>Forecast</th></tr></thead><tbody>${topAccounts || '<tr><td colspan="5">No account data.</td></tr>'}</tbody></table></div></body></html>`;
    }

    function exportExecutiveSnapshot(){
      downloadText(`AE-FLOW-executive-snapshot-${todayKey()}.html`, buildExecutiveSnapshotHtml(), "text/html");
      toast("Executive snapshot exported ⬇️");
    }

    function switchTab(tab){
      APP.state.ui.tab = tab;
      saveState();

      document.querySelectorAll(".tab").forEach(t=>{
        t.classList.toggle("active", t.getAttribute("data-tab") === tab);
      });

      document.getElementById("tab-intake").classList.toggle("hidden", tab !== "intake");
      document.getElementById("tab-accounts").classList.toggle("hidden", tab !== "accounts");
      document.getElementById("tab-deals").classList.toggle("hidden", tab !== "deals");
      document.getElementById("tab-analytics").classList.toggle("hidden", tab !== "analytics");
      document.getElementById("tab-settings").classList.toggle("hidden", tab !== "settings");

      if(tab === "accounts") renderAccounts();
      if(tab === "deals") { populateDealAccountSelect(); populatePresets(); document.getElementById("dealDepositPct").value = APP.state.settings.depositPct; renderItems(); renderDeals(); }
      if(tab === "analytics") renderAnalytics();
      if(tab === "settings") loadSettingsUI();
    }

    // ---- PWA install ----
    let deferredPrompt = null;
    function setupInstall(){
      window.addEventListener("beforeinstallprompt", (e)=>{
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById("installBtn").style.display = "inline-flex";
      });
      document.getElementById("installBtn").addEventListener("click", async ()=>{
        if(!deferredPrompt) return;
        deferredPrompt.prompt();
        try{ await deferredPrompt.userChoice; }catch(e){}
        deferredPrompt = null;
        document.getElementById("installBtn").style.display = "none";
      });
    }

    async function registerSW(){
      if(!("serviceWorker" in navigator)) return;
      try{ await navigator.serviceWorker.register("./sw.js"); }catch(e){}
    }

    // ---- Visit form ----
    function resetVisitForm(){
      document.getElementById("intakeForm").reset();
      document.getElementById("followUpDate").value = "";
      document.getElementById("lastContactedAt").value = "";
      toast("Cleared form");
    }

    function buildFollowUpText(){
      return [
        "Lead Sprint (30 days): free one-page conversion system that links to your site/booking, built for speed + proof + easy booking.",
        "Goal: get your approval to be a vetted operator in our network so we can route matches your way.",
        "Reply ‘approved’ if you want us to proceed."
      ].join("\\n");
    }

    function getVisitFromForm(){
      return {
        id: uid(),
        created_at: nowISO(),
        updated_at: nowISO(),
        date_key: todayKey(),
        ae_name: (document.getElementById("aeName").value || "").trim(),
        route: (document.getElementById("route").value || "").trim(),
        business_name: (document.getElementById("bizName").value || "").trim(),
        contact_name: (document.getElementById("contactName").value || "").trim(),
        business_email: normalizeEmail(document.getElementById("bizEmail").value),
        phone: (document.getElementById("bizPhone").value || "").trim(),
        service_1: (document.getElementById("service1").value || "").trim(),
        service_area: (document.getElementById("serviceArea").value || "").trim(),
        lead_action: document.getElementById("leadAction").value,
        response_speed: document.getElementById("responseSpeed").value,
        lead_source: document.getElementById("leadSource").value,
        booking_link: (document.getElementById("bookingLink").value || "").trim(),
        industry: (document.getElementById("industry").value || "").trim(),
        source_directory: (document.getElementById("sourceDirectory").value || "").trim(),
        lead_temperature: document.getElementById("leadTemperature").value,
        priority: document.getElementById("priority").value,
        estimated_setup_value: Number(document.getElementById("estimatedSetupValue").value || 0),
        estimated_monthly_value: Number(document.getElementById("estimatedMonthlyValue").value || 0),
        next_action: (document.getElementById("nextAction").value || "").trim(),
        last_contacted_at: (document.getElementById("lastContactedAt").value || "").trim(),
        permission: document.getElementById("permission").value,
        status: document.getElementById("status").value,
        follow_up_date: document.getElementById("followUpDate").value,
        notes: (document.getElementById("notes").value || "").trim(),
        tags: (APP.state.activeTags || []).slice(0,12)
      };
    }

    function onVisitSubmit(e){
      e.preventDefault();
      const v = getVisitFromForm();
      if(!v.ae_name){ toast("AE name required"); return; }
      if(!v.business_name || !v.business_email){ toast("Business name + email required"); return; }
      addVisit(v);
      toast("Visit saved ✅");
    }

    function convertCurrentFormToAccount(){
      const v = getVisitFromForm();
      if(!v.ae_name){ toast("AE name required"); return; }
      if(!v.business_name || !v.business_email){ toast("Business name + email required"); return; }
      addVisit(v);
      convertVisitToAccount(v);
    }

    // ---- Today CSV quick ----
    function exportTodayCSV(){
      const tKey = todayKey();
      const visits = (APP.state.visits||[]).filter(v=>v.date_key===tKey);
      const rows = [["date_key","created_at","ae_name","route","business_name","business_email","industry","source_directory","priority","lead_temperature","estimated_setup_value","estimated_monthly_value","next_action","permission","service_1","service_area","status","follow_up_date","notes"]];
      visits.forEach(v=>{
        rows.push([
          v.date_key||"", v.created_at||"", v.ae_name||"", v.route||"", v.business_name||"", v.business_email||"", v.industry||"", v.source_directory||"", v.priority||"", v.lead_temperature||"", v.estimated_setup_value||0, v.estimated_monthly_value||0, v.next_action||"",
          v.permission||"", v.service_1||"", v.service_area||"", v.status||"", v.follow_up_date||"",
          (v.notes||"").replaceAll("\\n"," ")
        ]);
      });
      downloadText(`AE-FLOW-TODAY-${tKey}.csv`, toCSV(rows), "text/csv");
      toast("Today CSV exported ⬇️");
    }

    function wipeDevice(){
      const ok = confirm("Wipe ALL saved visits/accounts/deals from this device? This cannot be undone unless exported.");
      if(!ok) return;
      APP.state.visits = [];
      APP.state.accounts = [];
      APP.state.deals = [];
      APP.state.handoff_log = [];
      APP.state.filter = null;
      APP.state.search = "";
      APP.state.activeTags = [];
      saveState();
      renderAll();
      toast("Device wiped");
    }

    // ---- UI bind ----
    function bindUI(){
      document.querySelectorAll(".tab").forEach(t=>{
        t.addEventListener("click", ()=> switchTab(t.getAttribute("data-tab")));
      });

      bindCopyButtons();

      document.getElementById("intakeForm").addEventListener("submit", onVisitSubmit);
      document.getElementById("clearFormBtn").addEventListener("click", resetVisitForm);
      document.getElementById("copyFollowUpTextBtn").addEventListener("click", ()=> copyText(buildFollowUpText()));
      document.getElementById("convertToAccountBtn").addEventListener("click", convertCurrentFormToAccount);

      document.getElementById("todayOnlyBtn").addEventListener("click", ()=>{ APP.state.viewMode="today"; saveState(); renderAll(); toast("Showing today"); });
      document.getElementById("allBtn").addEventListener("click", ()=>{ APP.state.viewMode="all"; saveState(); renderAll(); toast("Showing all"); });
      document.getElementById("filterPermissionYesBtn").addEventListener("click", ()=>{ APP.state.filter="permissionYes"; saveState(); renderAll(); toast("Filter: Permission YES"); });
      document.getElementById("filterOwnedBtn").addEventListener("click", ()=>{ switchTab("accounts"); });

      document.getElementById("search").addEventListener("input", (e)=>{
        APP.state.search = e.target.value;
        saveState();
        renderAll();
      });

      document.getElementById("accountsMineBtn").addEventListener("click", ()=>{ APP.state.ui.accountsView="mine"; saveState(); renderAccounts(); toast("Accounts: Mine"); });
      document.getElementById("accountsAllBtn").addEventListener("click", ()=>{ APP.state.ui.accountsView="all"; saveState(); renderAccounts(); toast("Accounts: All"); });
      document.getElementById("createAccountBlankBtn").addEventListener("click", ()=>{
        const ae = (document.getElementById("aeName").value||"").trim();
        const a = {
          id: uid(),
          created_at: nowISO(),
          updated_at: nowISO(),
          ae_name: ae,
          route: "",
          business_name: "New Account",
          business_email: "",
          phone: "",
          contact_name: "",
          service_1: "",
          service_area: "",
          website_or_booking: "",
          industry: "",
          source_directory: "",
          lead_temperature: "Cold",
          priority: "Normal",
          estimated_setup_value: 0,
          estimated_monthly_value: 0,
          next_action: "",
          last_contacted_at: "",
          permission: "maybe",
          account_status: "Pending Approval",
          notes: "",
          tags: []
        };
        addAccount(a);
        toast("Blank account created");
      });

      document.getElementById("addItemBtn").addEventListener("click", ()=>{
        const name = (document.getElementById("itemName").value||"").trim();
        const setup = Number(document.getElementById("itemSetup").value||0);
        const monthly = Number(document.getElementById("itemMonthly").value||0);
        if(!name){ toast("Item name required"); return; }
        dealItems.push({ name, setup: Number.isFinite(setup)?setup:0, monthly: Number.isFinite(monthly)?monthly:0 });
        document.getElementById("itemName").value = "";
        document.getElementById("itemSetup").value = "";
        document.getElementById("itemMonthly").value = "";
        renderItems();
        toast("Item added");
      });
      document.getElementById("clearItemsBtn").addEventListener("click", ()=>{ dealItems=[]; renderItems(); toast("Items cleared"); });
      document.getElementById("dealDepositPct").addEventListener("input", renderDealCalc);
      document.getElementById("dealPreset").addEventListener("change", renderDealCalc);

      document.getElementById("saveDealBtn").addEventListener("click", saveDeal);
      document.getElementById("resetDealBtn").addEventListener("click", resetDeal);

      document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
      document.getElementById("resetSettingsBtn").addEventListener("click", resetSettings);

      document.getElementById("exportCsvBtn").addEventListener("click", exportAllCSV);
      document.getElementById("exportCsvBtn2").addEventListener("click", exportAllCSV);
      document.getElementById("exportOpsReportBtn").addEventListener("click", exportOpsHTML);
      document.getElementById("exportAnalyticsJsonBtn").addEventListener("click", exportAnalyticsJSON);
      document.getElementById("exportOpsHtmlBtn").addEventListener("click", exportOpsHTML);
      document.getElementById("exportOpsHtmlBtn2").addEventListener("click", exportOpsHTML);
      document.getElementById("exportForecastCsvBtn").addEventListener("click", exportForecastCSV);
      document.getElementById("exportExecutiveSnapshotBtn").addEventListener("click", exportExecutiveSnapshot);
      document.getElementById("copyInsightsBtn").addEventListener("click", ()=> copyText(buildInsightsText(computeAnalytics())));
      document.getElementById("backupBtn").addEventListener("click", ()=> backupJSON(false));
      document.getElementById("backupBtn2").addEventListener("click", ()=> backupJSON(false));
      document.getElementById("exportTodayCsvBtn").addEventListener("click", exportTodayCSV);
      document.getElementById("exportTodayJsonBtn").addEventListener("click", ()=> backupJSON(true));

      document.getElementById("bundleTodayBtn").addEventListener("click", exportDailyBundle);
      document.getElementById("sendBundleTodayBtn").addEventListener("click", shareDailyBundle);

      document.getElementById("clearHandoffLogTodayBtn").addEventListener("click", ()=> clearHandoffLog(true));
      document.getElementById("clearHandoffLogAllBtn").addEventListener("click", ()=> clearHandoffLog(false));

      document.getElementById("shareBtn").addEventListener("click", shareSummary);
      document.getElementById("shareBtn2").addEventListener("click", shareSummary);
      document.getElementById("copySummaryBtn").addEventListener("click", ()=> copyText(buildDailySummary()));

      document.getElementById("importFile").addEventListener("change", handleFilePick);
      document.getElementById("importBtn").addEventListener("click", importJSON);
      document.getElementById("vaultImportFile").addEventListener("change", handleVaultFilePick);
      document.getElementById("vaultImportBtn").addEventListener("click", importEncryptedBackup);
      document.getElementById("saveSecureMirrorBtn").addEventListener("click", saveSecureMirror);
      document.getElementById("restoreSecureMirrorBtn").addEventListener("click", restoreSecureMirror);
      document.getElementById("exportEncryptedBackupBtn").addEventListener("click", exportEncryptedBackup);
      document.getElementById("clearSecureMirrorBtn").addEventListener("click", clearSecureMirror);

      document.getElementById("wipeBtn").addEventListener("click", wipeDevice);

      document.getElementById("newVisitBtn").addEventListener("click", ()=>{ switchTab("intake"); window.scrollTo({top:0,behavior:"smooth"}); document.getElementById("bizName").focus(); });
      document.getElementById("jumpAccountsBtn").addEventListener("click", ()=> switchTab("accounts"));
      document.getElementById("jumpDealsBtn").addEventListener("click", ()=> switchTab("deals"));
      window.addEventListener("resize", ()=>{ if(APP.state.ui.tab === "analytics") renderAnalytics(); });
    }

    // ---- Render all ----
    function renderAll(){
      renderActiveTags();
      renderKPIs();
      renderVisits();
      switchTab(APP.state.ui.tab || "intake");
      if(APP.state.ui.tab === "accounts") renderAccounts();
      if(APP.state.ui.tab === "deals") renderDeals();
      if(APP.state.ui.tab === "analytics") renderAnalytics();
      renderHandoffLogStats();
    }

    // ---- PWA offline label ----
    function setOfflineFlag(){
      const online = navigator.onLine;
      document.getElementById("offlineFlag").textContent = online ? "Online" : "Offline";
      document.getElementById("offlineFlag").style.color = online ? "rgba(255,255,255,.92)" : "var(--gold)";
    }

    // ---- Init ----
    (function init(){
      initCosmosBackground();
      loadState();
      renderScripts();
      setupInstall();
      registerSW();

      populatePresets();
      loadSettingsUI();

      populateDealAccountSelect();
      document.getElementById("dealDepositPct").value = APP.state.settings.depositPct;
      renderItems();
      renderDeals();

      bindUI();
      renderAll();

      setOfflineFlag();
      window.addEventListener("online", setOfflineFlag);
      window.addEventListener("offline", setOfflineFlag);
    })();
  