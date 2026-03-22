(function () {
  function keyFor(scope) {
    return "skye.app.storage:" + String(scope || "default");
  }

  function load(scope, fallback = null) {
    try {
      const raw = localStorage.getItem(keyFor(scope));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(scope, value) {
    localStorage.setItem(keyFor(scope), JSON.stringify(value));
    return value;
  }

  function clear(scope) {
    localStorage.removeItem(keyFor(scope));
  }

  window.SkyeAppStorageProtocol = { keyFor, load, save, clear };
})();