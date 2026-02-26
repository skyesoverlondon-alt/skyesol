/* ═══════════════════════════════════════════════════════
   kAIxU Gateway 13 — Neural Constellation Background
   Gold + purple floating nodes with connection lines
   Feels like data routing through a network
   ═══════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById("three-bg");
  if (!canvas || typeof THREE === "undefined") return;

  /* ── Renderer ──────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x07070f, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 22);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  /* ── Node positions & velocities ───────────────────── */
  const NODE_COUNT    = 120;
  const CONNECT_DIST  = 5.8;
  const FIELD_W       = 28;
  const FIELD_H       = 18;
  const FIELD_D       = 10;

  const goldPal   = [new THREE.Color(0.85, 0.68, 0.22), new THREE.Color(0.95, 0.85, 0.42), new THREE.Color(1.0, 0.93, 0.58)];
  const purplePal = [new THREE.Color(0.55, 0.40, 1.0),  new THREE.Color(0.62, 0.48, 0.94), new THREE.Color(0.74, 0.60, 1.0)];

  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const isGold = Math.random() < 0.55;
    const pal = isGold ? goldPal : purplePal;
    nodes.push({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * FIELD_W,
        (Math.random() - 0.5) * FIELD_H,
        (Math.random() - 0.5) * FIELD_D - 3
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.012,
        (Math.random() - 0.5) * 0.010,
        (Math.random() - 0.5) * 0.006
      ),
      baseSize: Math.random() * 0.35 + 0.12,
      color: pal[Math.floor(Math.random() * pal.length)],
      phase: Math.random() * Math.PI * 2
    });
  }

  /* ── Node point cloud ──────────────────────────────── */
  const nodePos   = new Float32Array(NODE_COUNT * 3);
  const nodeColor = new Float32Array(NODE_COUNT * 3);
  const nodeSize  = new Float32Array(NODE_COUNT);

  for (let i = 0; i < NODE_COUNT; i++) {
    const n = nodes[i];
    nodePos[i * 3]     = n.pos.x;
    nodePos[i * 3 + 1] = n.pos.y;
    nodePos[i * 3 + 2] = n.pos.z;
    nodeColor[i * 3]     = n.color.r;
    nodeColor[i * 3 + 1] = n.color.g;
    nodeColor[i * 3 + 2] = n.color.b;
    nodeSize[i] = n.baseSize;
  }

  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
  ptGeo.setAttribute("color",    new THREE.BufferAttribute(nodeColor, 3));
  ptGeo.setAttribute("size",     new THREE.BufferAttribute(nodeSize, 1));

  const ptMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      attribute float size;
      attribute vec3  color;
      uniform   float uTime;
      uniform   float uPixelRatio;
      varying   vec3  vColor;
      varying   float vAlpha;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        float pulse = 0.85 + sin(uTime * 1.2 + position.x * 0.6 + position.y * 0.4) * 0.15;
        vAlpha = smoothstep(30.0, 6.0, dist) * pulse;
        gl_PointSize = (size * 60.0 * uPixelRatio) / dist;
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3  vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.05, d);
        float glow = smoothstep(0.5, 0.0,  d) * 0.5;
        float a = (core + glow) * vAlpha;
        gl_FragColor = vec4(vColor * 1.3, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  const pointCloud = new THREE.Points(ptGeo, ptMat);
  scene.add(pointCloud);

  /* ── Connection lines (dynamic) ────────────────────── */
  const MAX_LINES = NODE_COUNT * 6;
  const linePos   = new Float32Array(MAX_LINES * 6);
  const lineColor = new Float32Array(MAX_LINES * 6);

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color",    new THREE.BufferAttribute(lineColor, 3));
  lineGeo.setDrawRange(0, 0);

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lineSegments);

  /* ── Subtle ambient particles (dust) ───────────────── */
  const DUST = 400;
  const dPos  = new Float32Array(DUST * 3);
  const dSize = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3]     = (Math.random() - 0.5) * 36;
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 24;
    dPos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 6;
    dSize[i] = Math.random() * 0.08 + 0.02;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute("size",     new THREE.BufferAttribute(dSize, 1));

  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        pos.y += sin(uTime * 0.15 + position.x * 0.3) * 0.4;
        pos.x += cos(uTime * 0.1  + position.y * 0.2) * 0.3;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        float dist = -mv.z;
        vAlpha = smoothstep(28.0, 8.0, dist) * 0.25;
        gl_PointSize = (size * 40.0 * uPixelRatio) / dist;
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float s = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(0.65, 0.55, 0.85, s * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  /* ── Pulse rings (occasional data-burst effect) ────── */
  const rings = [];
  const RING_INTERVAL = 3.5;
  let ringTimer = 0;

  function spawnRing(origin, col) {
    const geo = new THREE.RingGeometry(0.01, 0.06, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.lookAt(camera.position);
    scene.add(mesh);
    rings.push({ mesh, age: 0, maxAge: 2.2 });
  }

  /* ── Events ────────────────────────────────────────── */
  window.addEventListener("mousemove", (e) => {
    mouse.tx =  (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener("scroll", () => { scrollY = window.pageYOffset; }, { passive: true });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ── Animate ───────────────────────────────────────── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t  = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    /* camera parallax */
    mouse.x += (mouse.tx - mouse.x) * 0.03;
    mouse.y += (mouse.ty - mouse.y) * 0.03;
    camera.position.x = mouse.x * 1.4;
    camera.position.y = mouse.y * 0.8 - scrollY * 0.002;
    camera.lookAt(0, -scrollY * 0.001, 0);

    /* move nodes */
    const posArr  = ptGeo.attributes.position.array;
    const sizeArr = ptGeo.attributes.size.array;

    for (let i = 0; i < NODE_COUNT; i++) {
      const n = nodes[i];
      n.pos.add(n.vel);

      if (n.pos.x >  FIELD_W * 0.5) n.vel.x = -Math.abs(n.vel.x);
      if (n.pos.x < -FIELD_W * 0.5) n.vel.x =  Math.abs(n.vel.x);
      if (n.pos.y >  FIELD_H * 0.5) n.vel.y = -Math.abs(n.vel.y);
      if (n.pos.y < -FIELD_H * 0.5) n.vel.y =  Math.abs(n.vel.y);
      if (n.pos.z >  1)             n.vel.z = -Math.abs(n.vel.z);
      if (n.pos.z < -FIELD_D - 3)   n.vel.z =  Math.abs(n.vel.z);

      sizeArr[i] = n.baseSize * (0.9 + Math.sin(t * 0.8 + n.phase) * 0.1);

      posArr[i * 3]     = n.pos.x;
      posArr[i * 3 + 1] = n.pos.y;
      posArr[i * 3 + 2] = n.pos.z;
    }
    ptGeo.attributes.position.needsUpdate = true;
    ptGeo.attributes.size.needsUpdate     = true;

    /* rebuild connections */
    let seg = 0;
    const lp = lineGeo.attributes.position.array;
    const lc = lineGeo.attributes.color.array;

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = nodes[i].pos.x - nodes[j].pos.x;
        const dy = nodes[i].pos.y - nodes[j].pos.y;
        const dz = nodes[i].pos.z - nodes[j].pos.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 < CONNECT_DIST * CONNECT_DIST) {
          const fade = 1 - Math.sqrt(dist2) / CONNECT_DIST;
          const ci = nodes[i].color;
          const cj = nodes[j].color;
          const idx = seg * 6;
          lp[idx]     = nodes[i].pos.x; lp[idx + 1] = nodes[i].pos.y; lp[idx + 2] = nodes[i].pos.z;
          lp[idx + 3] = nodes[j].pos.x; lp[idx + 4] = nodes[j].pos.y; lp[idx + 5] = nodes[j].pos.z;
          lc[idx]     = ci.r * fade; lc[idx + 1] = ci.g * fade; lc[idx + 2] = ci.b * fade;
          lc[idx + 3] = cj.r * fade; lc[idx + 4] = cj.g * fade; lc[idx + 5] = cj.b * fade;
          seg++;
          if (seg >= MAX_LINES) break;
        }
      }
      if (seg >= MAX_LINES) break;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate    = true;
    lineGeo.setDrawRange(0, seg * 2);

    /* update uniforms */
    ptMat.uniforms.uTime.value   = t;
    dustMat.uniforms.uTime.value = t;

    /* pulse rings */
    ringTimer += dt;
    if (ringTimer > RING_INTERVAL) {
      ringTimer = 0;
      const src = nodes[Math.floor(Math.random() * NODE_COUNT)];
      spawnRing(src.pos.clone(), src.color);
    }
    for (let r = rings.length - 1; r >= 0; r--) {
      const ring = rings[r];
      ring.age += dt;
      const progress = ring.age / ring.maxAge;
      const scale = 1 + progress * 3.5;
      ring.mesh.scale.set(scale, scale, scale);
      ring.mesh.material.opacity = 0.4 * (1 - progress);
      ring.mesh.lookAt(camera.position);
      if (ring.age >= ring.maxAge) {
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        rings.splice(r, 1);
      }
    }

    renderer.render(scene, camera);
  }
  animate();
})();
