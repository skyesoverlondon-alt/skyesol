const btn = document.getElementById("btn");
const pw = document.getElementById("pw");
const msg = document.getElementById("msg");
function setMsg(t, good=false){ msg.textContent=t; msg.style.color = good ? "rgba(46,255,182,.92)" : "rgba(255,77,125,.92)"; }
async function unlock(){
  const passphrase=(pw.value||"").trim();
  if(!passphrase) return setMsg("Enter the passphrase.");
  btn.disabled=true; btn.textContent="Verifying…";
  try{
    const r=await fetch("/.netlify/functions/ae-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passphrase}),credentials:"include"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok || !data.ok) throw new Error(data.error || "Verification failed");
    setMsg("Unlocked. Redirecting…", true);
    setTimeout(()=>location.href="/ae/sop/",450);
  }catch(e){ setMsg(e.message || "Verification failed."); }
  finally{ btn.disabled=false; btn.textContent="Unlock SOP"; }
}
btn.addEventListener("click", unlock);
pw.addEventListener("keydown",(e)=>{ if(e.key==="Enter") unlock(); });
(async function(){
  try{
    const r=await fetch("/.netlify/functions/ae-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"include"});
    const data=await r.json().catch(()=>({}));
    if(r.ok && data.ok) location.replace("/ae/sop/");
  }catch(e){}
})();
