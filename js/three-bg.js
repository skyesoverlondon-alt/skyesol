/* ══════════════════════════════════════════════
   Three.js Liquid Gold Background
   ══════════════════════════════════════════════ */
(function(){
  const canvas = document.getElementById('three-bg');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050508, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  // Lights
  scene.add(new THREE.AmbientLight(0x1a1410, 0.4));
  const kL = new THREE.PointLight(0xc9a84c, 2.5, 50); kL.position.set(3, 3, 4); scene.add(kL);
  const rL = new THREE.PointLight(0xe8d48b, 1.8, 40); rL.position.set(-4, 1, 2); scene.add(rL);
  const bL = new THREE.PointLight(0x3a2a0a, 1.2, 30); bL.position.set(0, -4, 2); scene.add(bL);
  const aL = new THREE.PointLight(0x2a4080, 0.6, 35); aL.position.set(-2, 3, -3); scene.add(aL);

  // Noise GLSL
  const noiseGLSL = `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }`;

  const vertSh = noiseGLSL + `
  uniform float uTime; uniform vec2 uMouse;
  varying vec3 vNormal; varying vec3 vWorldPos; varying float vDisplacement; varying vec3 vViewDir;
  void main(){
    float t=uTime*.25;
    float n1=snoise(position*1.2+t*.6)*.35;
    float n2=snoise(position*2.4+t*.4+10.)*.15;
    float n3=snoise(position*4.8+t*.8+20.)*.06;
    float mI=snoise(position*1.5+vec3(uMouse*2.,t*.3))*.12;
    float displacement=n1+n2+n3+mI; vDisplacement=displacement;
    vec3 newPos=position+normal*displacement;
    float eps=.01;
    float dx=snoise((position+vec3(eps,0,0))*1.2+t*.6)*.35+snoise((position+vec3(eps,0,0))*2.4+t*.4+10.)*.15;
    float dy=snoise((position+vec3(0,eps,0))*1.2+t*.6)*.35+snoise((position+vec3(0,eps,0))*2.4+t*.4+10.)*.15;
    vec3 pN=normalize(normal+vec3((displacement-dx)/eps*.3,(displacement-dy)/eps*.3,0.));
    vNormal=normalize(normalMatrix*pN);
    vec4 wP=modelMatrix*vec4(newPos,1.); vWorldPos=wP.xyz;
    vViewDir=normalize(cameraPosition-wP.xyz);
    gl_Position=projectionMatrix*viewMatrix*wP;
  }`;

  const fragSh = `
  uniform vec3 uLightPos1; uniform vec3 uLightPos2; uniform vec3 uLightPos3;
  uniform vec3 uGoldBase; uniform vec3 uGoldHighlight; uniform vec3 uGoldDeep; uniform float uTime;
  varying vec3 vNormal; varying vec3 vWorldPos; varying float vDisplacement; varying vec3 vViewDir;
  void main(){
    vec3 N=normalize(vNormal); vec3 V=normalize(vViewDir);
    float fresnel=pow(1.-max(dot(N,V),0.),3.5);
    vec3 L1=normalize(uLightPos1-vWorldPos); vec3 L2=normalize(uLightPos2-vWorldPos); vec3 L3=normalize(uLightPos3-vWorldPos);
    float d1=max(dot(N,L1),0.); float d2=max(dot(N,L2),0.); float d3=max(dot(N,L3),0.);
    vec3 H1=normalize(L1+V); vec3 H2=normalize(L2+V);
    float s1=pow(max(dot(N,H1),0.),80.)*1.5; float s2=pow(max(dot(N,H2),0.),60.)*.8;
    float c=vDisplacement*2.+.5;
    vec3 bc=mix(uGoldDeep,uGoldBase,smoothstep(-.2,.3,c)); bc=mix(bc,uGoldHighlight,smoothstep(.3,.8,c));
    vec3 diff=bc*(d1*.7+d2*.4+d3*.15+.08); vec3 spec=uGoldHighlight*(s1+s2);
    vec3 rim=mix(uGoldHighlight,vec3(1.,.92,.7),.5)*fresnel*.6;
    float ir=sin(vDisplacement*12.+uTime*.5)*.03; diff+=vec3(ir,ir*.5,-ir);
    vec3 fc=diff+spec+rim; fc=fc/(fc+.5);
    gl_FragColor=vec4(fc,.92);
  }`;

  function makeBlob(r, det, gb, gh, gd) {
    const g = new THREE.IcosahedronGeometry(r, det);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() },
        uLightPos1: { value: kL.position }, uLightPos2: { value: rL.position }, uLightPos3: { value: aL.position },
        uGoldBase: { value: new THREE.Color(...gb) },
        uGoldHighlight: { value: new THREE.Color(...gh) },
        uGoldDeep: { value: new THREE.Color(...gd) }
      },
      vertexShader: vertSh, fragmentShader: fragSh, transparent: true
    });
    return new THREE.Mesh(g, m);
  }

  const blob = makeBlob(1.6, 64, [.45,.34,.08], [.95,.82,.38], [.22,.15,.03]); scene.add(blob);
  const b2 = makeBlob(.6, 48, [.3,.22,.05], [.8,.65,.25], [.15,.1,.02]); scene.add(b2);
  const b3 = makeBlob(.35, 32, [.55,.42,.12], [1,.9,.5], [.25,.18,.04]); scene.add(b3);

  // Gold dust
  const dC = 400, dG = new THREE.BufferGeometry();
  const dP = new Float32Array(dC * 3), dS = new Float32Array(dC);
  for (let i = 0; i < dC; i++) {
    dP[i*3] = (Math.random()-.5)*20; dP[i*3+1] = (Math.random()-.5)*14; dP[i*3+2] = (Math.random()-.5)*14;
    dS[i] = Math.random()*2+.3;
  }
  dG.setAttribute('position', new THREE.BufferAttribute(dP, 3));
  dG.setAttribute('size', new THREE.BufferAttribute(dS, 1));
  const dM = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float size;uniform float uTime;uniform float uPixelRatio;varying float vA;void main(){vec3 p=position;p.y+=sin(uTime*.2+position.x*.5)*.3;p.x+=cos(uTime*.15+position.z*.3)*.2;vec4 mv=modelViewMatrix*vec4(p,1.);vA=smoothstep(20.,3.,-mv.z)*(.3+sin(uTime*.8+position.y*3.)*.15);gl_PointSize=size*uPixelRatio*(40./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,0.,d)*vA;gl_FragColor=vec4(.85,.7,.3,a);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(dG, dM));

  // Events
  window.addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / window.innerWidth - .5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
  });
  window.addEventListener('scroll', () => { scrollY = window.pageYOffset; }, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * .04;
    mouse.y += (mouse.ty - mouse.y) * .04;
    camera.position.x = mouse.x * 1.5;
    camera.position.y = -mouse.y * 1 - scrollY * .003;
    camera.position.z = 5 - scrollY * .002;
    camera.lookAt(0, -scrollY * .001, 0);

    blob.material.uniforms.uTime.value = t;
    blob.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    blob.rotation.y = t * .08 + mouse.x * .15;
    blob.rotation.x = Math.sin(t * .05) * .2 + mouse.y * .1;

    b2.material.uniforms.uTime.value = t * 1.3;
    b2.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    b2.position.set(Math.cos(t*.2)*3.2, Math.sin(t*.25)*1.5, Math.sin(t*.2)*2);
    b2.rotation.y = t * .15;

    b3.material.uniforms.uTime.value = t * 1.6;
    b3.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    b3.position.set(Math.sin(t*.3+2)*2.5, Math.cos(t*.22+1)*2.2, Math.cos(t*.28)*1.5-1);
    b3.rotation.y = -t * .2;

    kL.position.x = 3 + Math.sin(t*.3)*1.5;
    kL.position.y = 3 + Math.cos(t*.2);
    rL.position.x = -4 + Math.sin(t*.25+2);
    rL.position.y = 1 + Math.cos(t*.3+1)*1.5;
    kL.intensity = 2.5 + Math.sin(t*.4)*.5;
    rL.intensity = 1.8 + Math.sin(t*.3+1)*.4;
    dM.uniforms.uTime.value = t;

    renderer.render(scene, camera);
  }
  animate();
})();
