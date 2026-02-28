/* ══════════════════════════════════════════════
   Three.js Aurora Particle Background
   gold + purple · flowing waves · 2800 particles
   ══════════════════════════════════════════════ */
(function(){
  const canvas = document.getElementById('three-bg');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // transparent — boot sequence shows through
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 12);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  // ── PARTICLES ──────────────────────────────────────────────────────
  const COUNT = 2800;
  const pPos    = new Float32Array(COUNT * 3);
  const pColor  = new Float32Array(COUNT * 3);
  const pSize   = new Float32Array(COUNT);
  const pSpeed  = new Float32Array(COUNT);
  const pOffset = new Float32Array(COUNT);

  const goldPal   = [[0.85,0.68,0.22],[0.95,0.85,0.42],[1.0,0.93,0.58]];
  const purplePal = [[0.55,0.40,1.0],[0.62,0.48,0.94],[0.74,0.60,1.0]];

  for (let i = 0; i < COUNT; i++) {
    pPos[i*3]   = (Math.random() - 0.5) * 34;
    pPos[i*3+1] = (Math.random() - 0.5) * 22;
    pPos[i*3+2] = (Math.random() - 0.5) * 14 - 4;
    pSize[i]   = Math.random() * 2.8 + 0.4;
    pSpeed[i]  = Math.random() * 0.35 + 0.08;
    pOffset[i] = Math.random() * Math.PI * 2;
    const pal = Math.random() < 0.58 ? goldPal : purplePal;
    const c   = pal[Math.floor(Math.random() * pal.length)];
    pColor[i*3] = c[0]; pColor[i*3+1] = c[1]; pColor[i*3+2] = c[2];
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,    3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColor,  3));
  pGeo.setAttribute('size',     new THREE.BufferAttribute(pSize,   1));
  pGeo.setAttribute('aSpeed',   new THREE.BufferAttribute(pSpeed,  1));
  pGeo.setAttribute('aOffset',  new THREE.BufferAttribute(pOffset, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float size; attribute float aSpeed; attribute float aOffset; attribute vec3 color;
      uniform float uTime; uniform float uPixelRatio;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color;
        vec3 pos = position;
        pos.y += sin(uTime * aSpeed + aOffset + pos.x * 0.28) * 0.9;
        pos.x += cos(uTime * aSpeed * 0.65 + aOffset * 1.4 + pos.y * 0.18) * 0.45;
        pos.z += sin(uTime * aSpeed * 0.5  + aOffset * 0.9) * 0.3;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        float dist = -mv.z;
        vAlpha = smoothstep(22.0, 4.0, dist) * (0.35 + sin(uTime * aSpeed + aOffset) * 0.18 + 0.4);
        gl_PointSize = size * uPixelRatio * (55.0 / dist);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float s = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, s * vAlpha);
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, vertexColors: true
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // ── AURORA BANDS ───────────────────────────────────────────────────
  function makeAurora(w, h, segs, colA, colB, z, y, spd, phase, tiltX) {
    const geo = new THREE.PlaneGeometry(w, h, segs, Math.max(1, Math.floor(segs / 4)));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:   { value: 0 },
        uColorA: { value: new THREE.Color(...colA) },
        uColorB: { value: new THREE.Color(...colB) },
        uSpeed:  { value: spd },
        uPhase:  { value: phase }
      },
      vertexShader: `
        uniform float uTime; uniform float uSpeed; uniform float uPhase;
        varying vec2 vUv; varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float w1 = sin(pos.x * 0.38 + uTime * uSpeed + uPhase) * 1.4;
          float w2 = sin(pos.x * 0.75 + uTime * uSpeed * 1.4 + uPhase * 1.8) * 0.55;
          float w3 = cos(pos.x * 0.18 + uTime * uSpeed * 0.55 + uPhase * 0.6) * 0.85;
          pos.y += (w1 + w2 + w3) * uv.y;
          vWave = (w1 + w2) * 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColorA; uniform vec3 uColorB;
        uniform float uTime; uniform float uPhase;
        varying vec2 vUv; varying float vWave;
        void main() {
          float ef   = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
          float sf   = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float t    = clamp(vUv.x + vWave * 0.18 + sin(uTime * 0.28 + uPhase) * 0.1, 0.0, 1.0);
          vec3  col  = mix(uColorA, uColorB, t);
          float shim = sin(vUv.x * 18.0 + uTime * 1.8 + uPhase) * 0.07 + 0.93;
          col *= shim;
          gl_FragColor = vec4(col, ef * sf * 0.22);
        }`,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, z);
    mesh.rotation.x = tiltX;
    return mesh;
  }

  const a1 = makeAurora(42, 7,  130, [0.55,0.40,1.0],  [0.85,0.68,0.22], -2,  1.8,  0.38, 0.0,  -0.08);
  const a2 = makeAurora(38, 5,  110, [0.85,0.68,0.22],  [0.55,0.40,1.0],  -4, -0.6,  0.28, 2.1,   0.05);
  const a3 = makeAurora(46, 6,  150, [0.74,0.60,1.0],   [1.0, 0.93,0.58], -6,  3.2,  0.22, 4.3,  -0.12);
  const a4 = makeAurora(40, 4,  100, [0.85,0.68,0.22],  [0.74,0.60,1.0],  -3, -2.8,  0.32, 1.5,   0.06);
  scene.add(a1, a2, a3, a4);

  // ── EVENTS ─────────────────────────────────────────────────────────
  window.addEventListener('mousemove', e => {
    mouse.tx =  (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('scroll', () => { scrollY = window.pageYOffset; }, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── ANIMATE ────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.03;
    mouse.y += (mouse.ty - mouse.y) * 0.03;

    camera.position.x = mouse.x * 0.9;
    camera.position.y = mouse.y * 0.55 - scrollY * 0.002;
    camera.lookAt(0, -scrollY * 0.001, 0);

    pMat.uniforms.uTime.value = t;
    a1.material.uniforms.uTime.value = t;
    a2.material.uniforms.uTime.value = t;
    a3.material.uniforms.uTime.value = t;
    a4.material.uniforms.uTime.value = t;

    // subtle mouse parallax drift on aurora bands
    a1.position.x = -mouse.x * 0.5;
    a2.position.x =  mouse.x * 0.3;
    a3.position.x = -mouse.x * 0.7;
    a4.position.x =  mouse.x * 0.4;

    renderer.render(scene, camera);
  }
  animate();
})();
