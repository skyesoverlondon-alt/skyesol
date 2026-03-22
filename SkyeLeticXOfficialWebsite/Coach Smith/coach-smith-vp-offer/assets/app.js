
document.querySelectorAll('.stat-number[data-count]').forEach((el)=>{
  const targetRaw = el.getAttribute('data-count') || '0';
  const target = Number(targetRaw);
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 45));
  const format = el.getAttribute('data-format') || 'int';
  const tick = ()=>{
    current += step;
    if(current >= target) current = target;
    let text = String(current);
    if(format === 'money') text = '$' + current.toLocaleString();
    if(format === 'plus') text = current.toLocaleString() + '+';
    if(format === 'mplus') text = current + 'M+';
    el.textContent = text;
    if(current < target) requestAnimationFrame(tick);
  };
  tick();
});
