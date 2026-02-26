// Shared client script shim.
// Some standalone app pages reference /assets/app.js for future shared behaviors.
// Keep it safe and dependency-free.

(function () {
  try {
    window.SOL_ASSETS_APP = window.SOL_ASSETS_APP || { loaded: true };
  } catch {
    // no-op
  }
})();
