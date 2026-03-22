(function(){
  const canvas = document.createElement("canvas");
  canvas.id="sky3d";
  canvas.setAttribute("aria-hidden","true");
  Object.assign(canvas.style,{position:"fixed",inset:"0",width:"100%",height:"100%",zIndex:"-1",pointerEvents:"none"});
  document.body.prepend(canvas);

  const gl=canvas.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:true});
  if(!gl) return;

  const vsrc=`attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0);} `;
  const fsrc=`precision highp float; varying vec2 vUv; uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
    vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y; }
  float fbm(vec2 p){ float v=0.0; float a=0.55; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.55; } return v; }
  void main(){
    vec2 uv=vUv; vec2 p=(uv*2.0-1.0); p.x*=uRes.x/uRes.y; p += (uMouse-0.5)*0.25; float t=uTime*0.07;
    float n1=fbm(p*1.2+vec2(t,-t)); float n2=fbm(p*2.4+vec2(-t*1.2,t*0.9)); float neb=smoothstep(0.25,0.95,n1*0.75+n2*0.55);
    float s=pow(hash(floor((p+10.0)*120.0)),32.0); float s2=pow(hash(floor((p+20.0)*220.0+vec2(t*8.0,-t*6.0))),42.0);
    float stars=(s*1.0+s2*1.2);
    vec3 purple=vec3(0.69,0.36,1.0); vec3 gold=vec3(1.0,0.83,0.30); vec3 blue=vec3(0.12,0.78,1.0); vec3 base=vec3(0.02,0.01,0.04);
    vec3 col=base; col += neb * mix(purple, blue, clamp(n2,0.0,1.0)) * 0.55; col += neb * mix(gold, purple, clamp(n1,0.0,1.0)) * 0.20;
    col += stars * vec3(1.0,0.96,0.90) * 1.35; float v=smoothstep(1.35,0.25,length(p)); col*=v; gl_FragColor=vec4(col,1.0);
  }`;
  function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) return null; return s; }
  const vs=compile(gl.VERTEX_SHADER,vsrc), fs=compile(gl.FRAGMENT_SHADER,fsrc); if(!vs||!fs) return;
  const prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog); if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) return; gl.useProgram(prog);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(prog,"aPos"); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);
  const uRes=gl.getUniformLocation(prog,"uRes"), uTime=gl.getUniformLocation(prog,"uTime"), uMouse=gl.getUniformLocation(prog,"uMouse");
  let mouse={x:0.5,y:0.5}; window.addEventListener("pointermove",(e)=>{ mouse.x=e.clientX/window.innerWidth; mouse.y=1.0-(e.clientY/window.innerHeight); },{passive:true});
  function resize(){ const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1)); canvas.width=Math.floor(window.innerWidth*dpr); canvas.height=Math.floor(window.innerHeight*dpr);
    gl.viewport(0,0,canvas.width,canvas.height); gl.uniform2f(uRes,canvas.width,canvas.height); }
  window.addEventListener("resize",resize,{passive:true}); resize();
  const t0=performance.now(); (function frame(now){ gl.uniform1f(uTime,(now-t0)/1000.0); gl.uniform2f(uMouse,mouse.x,mouse.y); gl.drawArrays(gl.TRIANGLES,0,6); requestAnimationFrame(frame); })(t0);
})();
