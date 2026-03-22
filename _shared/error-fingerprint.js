(function () {
  function fingerprint(error, context = {}) {
    const name = String((error && error.name) || "Error");
    const message = String((error && error.message) || "unknown");
    const scope = Object.entries(context)
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
    const seed = `${name}|${message}|${scope}`;
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(index);
      hash |= 0;
    }
    return "E-" + Math.abs(hash).toString(36).toUpperCase();
  }

  window.SkyeError = { fingerprint };
})();