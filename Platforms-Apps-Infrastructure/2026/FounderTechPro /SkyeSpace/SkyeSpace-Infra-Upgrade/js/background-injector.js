
(function(){
  const shell = document.createElement('div');
  shell.id = 'bg-shell';
  shell.innerHTML = '<canvas id="bg-canvas"></canvas><img id="bg-brand" src="assets/logo.png" alt="Skye logo">';
  document.body.prepend(shell);
  const canvas = shell.querySelector('#bg-canvas');
  const ctx = canvas.getContext('2d');
  let w=0,h=0,stars=[],ribbons=[],nodes=[];

  function resize(){
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth+'px';
    canvas.style.height = window.innerHeight+'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    stars = Array.from({length: 160}, () => ({
      x: Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight,
      r: Math.random()*1.8+0.4,
      v: Math.random()*0.16+0.04,
      a: Math.random()*0.7+0.15
    }));
    ribbons = Array.from({length: 4}, (_,i) => ({
      amp: 50 + i*18,
      speed: .0005 + i*.00017,
      y: window.innerHeight*(.18 + i*.18),
      hue: [200, 45, 270, 320][i]
    }));
    nodes = Array.from({length: 16},()=>({
      x: Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight,
      vx:(Math.random()-.5)*.22,
      vy:(Math.random()-.5)*.22
    }));
  }

  function drawRibbon(t, rb){
    ctx.beginPath();
    for(let x=0; x<=window.innerWidth; x+=16){
      const y = rb.y + Math.sin((x*0.012)+(t*rb.speed*6000))*rb.amp + Math.cos((x*0.008)+(t*rb.speed*3200))*18;
      if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${rb.hue},92%,70%,0.12)`;
    ctx.shadowBlur = 24;
    ctx.shadowColor = `hsla(${rb.hue},92%,70%,0.24)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function draw(t){
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    const grad = ctx.createLinearGradient(0,0,0,window.innerHeight);
    grad.addColorStop(0,'rgba(5,8,22,0.2)');
    grad.addColorStop(1,'rgba(5,8,22,0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,window.innerWidth,window.innerHeight);

    stars.forEach(s => {
      s.y += s.v;
      if(s.y > window.innerHeight + 4){ s.y = -4; s.x = Math.random()*window.innerWidth; }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fill();
    });

    ribbons.forEach(rb => drawRibbon(t,rb));

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if(n.x < 0 || n.x > window.innerWidth) n.vx *= -1;
      if(n.y < 0 || n.y > window.innerHeight) n.vy *= -1;
    });

    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const d = Math.sqrt(dx*dx+dy*dy);
        if(d < 220){
          ctx.beginPath();
          ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle = `rgba(68,186,255,${(1-d/220)*0.08})`;
          ctx.stroke();
        }
      }
    }

    nodes.forEach((n, idx) => {
      const hue = idx % 3 === 0 ? 45 : idx % 3 === 1 ? 200 : 270;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue},100%,72%,0.75)`;
      ctx.arc(n.x,n.y,2.3,0,Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${hue},100%,72%,0.2)`;
      ctx.arc(n.x,n.y,16 + Math.sin(t*0.001+idx)*5,0,Math.PI*2);
      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
