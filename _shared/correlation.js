(function () {
  function next(prefix = "skye") {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${String(prefix || "skye")}-${stamp}-${rand}`;
  }

  window.SkyeCorrelation = { next };
})();