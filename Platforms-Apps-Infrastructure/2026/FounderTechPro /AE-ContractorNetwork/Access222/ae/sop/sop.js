(async function requireAuth(){
  try{
    const r=await fetch("/.netlify/functions/ae-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"include"});
    const data=await r.json().catch(()=>({}));
    if(!(r.ok && data.ok)) throw new Error("unauth");
  }catch(e){ location.replace("/ae/portal/"); }
})();
document.getElementById("lock").addEventListener("click", async (e)=>{
  e.preventDefault();
  try{ await fetch("/.netlify/functions/ae-logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"include"}); }catch(e){}
  location.replace("/ae/");
});
