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
       smart-route the user based on role and first-visit status.      */
    identity.on("login", function (user) {
      /* Drop the token hash from the URL to prevent accidental replay. */
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      var roles = (user && user.app_metadata && user.app_metadata.roles) || [];

      /* Admins always go to the admin console. */
      if (roles.indexOf("admin") !== -1) {
        document.location.href = "/admin/";
        return;
      }

      /* First-time members get the welcome/onboarding page;
         returning members go straight to the member hub.             */
      var seen = localStorage.getItem("sol_welcome_seen");
      if (!seen) {
        localStorage.setItem("sol_welcome_seen", "1");
        document.location.href = "/welcome/";
      } else {
        document.location.href = "/members/";
      }
    });
  });
})();
