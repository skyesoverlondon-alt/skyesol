// assets/common.js
(function(){
  function setYear(){
    const el = document.getElementById('y');
    if(el) el.textContent = new Date().getFullYear();
  }
  window.SkyeCommon = { setYear };
})();
