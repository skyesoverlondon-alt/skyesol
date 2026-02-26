// Minimal theme hook for editorials.
// Some editorials include this file for future theme/UI controls.
// Keep it lightweight and safe to load on any page.

(function () {
  try {
    window.SOL_EDITORIALS_THEME = window.SOL_EDITORIALS_THEME || { loaded: true };
  } catch {
    // no-op
  }
})();
