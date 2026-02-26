/**
 * Netlify Identity — Token Handler & Init
 *
 * When a user clicks a verification / invite / recovery link from Netlify
 * Identity, the URL contains a hash fragment like:
 *   #confirmation_token=...
 *   #invite_token=...
 *   #recovery_token=...
 *   #access_token=...  (implicit grant)
 *
 * This script:
 *   1. Detects the token in location.hash
 *   2. Ensures the Netlify Identity widget is loaded
 *   3. Opens the widget with the correct action so GoTrue can process
 *      the token and complete the flow (verify email, accept invite, etc.)
 *   4. After successful login / confirmation, redirects the user to /admin/
 */
(function () {
  "use strict";

  /* ── helpers ─────────────────────────────────────────────────────── */

  /** Wait for `window.netlifyIdentity` to exist (widget may load async). */
  function waitForWidget(cb, tries) {
    tries = tries || 0;
    if (window.netlifyIdentity) return cb(window.netlifyIdentity);
    if (tries > 50) return;                       // give up after ~5 s
    setTimeout(function () { waitForWidget(cb, tries + 1); }, 100);
  }

  /** Extract the first recognised token type from location.hash. */
  function detectToken() {
    var hash = window.location.hash || "";
    var types = [
      "confirmation_token",
      "invite_token",
      "recovery_token",
      "access_token"
    ];
    for (var i = 0; i < types.length; i++) {
      if (hash.indexOf(types[i] + "=") !== -1) return types[i];
    }
    return null;
  }

  /* ── main ────────────────────────────────────────────────────────── */

  var tokenType = detectToken();

  waitForWidget(function (identity) {
    /* If a token was found in the URL hash, open the widget so the
       Identity service can consume it and complete the action.        */
    if (tokenType) {
      /* The widget auto-detects the hash and chooses the right view
         (confirm / invite / recovery) when we call .open().           */
      identity.open();
    }

    /* After any login (including the one triggered by confirmation),
       redirect the user to a useful authenticated page.               */
    identity.on("login", function () {
      /* Use replaceState to drop the token hash from the URL so the
         user can't accidentally re-trigger it on a page refresh.      */
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      document.location.href = "/admin/";
    });
  });
})();
