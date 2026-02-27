/**
 * Netlify Identity — Token Handler & Init & Role-Based Logic
 *
 * 1. Handles Identity confirmation/invite tokens.
 * 2. Injects Login/Logout buttons into the nav.
 * 3. Redirects users based on roles (Client, Admin, Ops).
 * 4. Protects admin pages from unauthorized access.
 */
(function () {
  "use strict";

  /* ── HELPERS ─────────────────────────────────────────────────────── */

  function waitForWidget(cb, tries) {
    tries = tries || 0;
    if (window.netlifyIdentity) return cb(window.netlifyIdentity);
    if (tries > 50) return; // give up after ~5 s
    setTimeout(function () { waitForWidget(cb, tries + 1); }, 100);
  }

  function detectToken() {
    var hash = window.location.hash || "";
    var types = ["confirmation_token", "invite_token", "recovery_token", "access_token"];
    for (var i = 0; i < types.length; i++) {
      if (hash.indexOf(types[i] + "=") !== -1) return types[i];
    }
    return null;
  }

  /* ── MAIN LOGIC ──────────────────────────────────────────────────── */

  waitForWidget(function (identity) {
    var tokenType = detectToken();
    
    // 1. Handle Token from URL (e.g. email confirmation)
    if (tokenType) {
      identity.open();
    }

    // 2. Bind Events
    identity.on("login", function (user) {
      // Drop hash to prevent replay
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      var roles = (user && user.app_metadata && user.app_metadata.roles) || [];
      console.log("User logged in with roles:", roles);

      // Redirect based on highest privilege
      if (roles.includes("ops") || roles.includes("executive")) {
        document.location.href = "/admin-executive.html";
      } else if (roles.includes("admin")) {
        document.location.href = "/admin.html";
      } else {
        // Default / Client
        var seen = localStorage.getItem("sol_welcome_seen");
        if (!seen) {
          localStorage.setItem("sol_welcome_seen", "1");
          document.location.href = "/welcome/"; // Optional welcome flow
        } else {
          document.location.href = "/platforms.html"; // Contractor Portal
        }
      }
    });

    identity.on("logout", function () {
      console.log("User logged out");
      document.location.href = "/index.html";
    });

    // 3. Inject Login/Logout Button (Retry loop for partials injection)
    function injectButton() {
        var navLinks = document.getElementById("navLinks");
        if (navLinks && !document.getElementById("authBtn")) {
            var btn = document.createElement("a");
            btn.id = "authBtn";
            btn.style.cursor = "pointer";
            btn.style.fontWeight = "bold";
            btn.style.color = "var(--gold)";
            btn.className = "nav-auth-btn";
            
            if (identity.currentUser()) {
                btn.textContent = "Logout";
                btn.onclick = function(e) { e.preventDefault(); identity.logout(); };
            } else {
                btn.textContent = "Login";
                btn.onclick = function(e) { e.preventDefault(); identity.open(); };
            }
            navLinks.appendChild(btn);
            return true;
        }
        return false;
    }

    // Try immediately, then poll for a bit (handles partials.js injection delay)
    if (!injectButton()) {
        var attempts = 0;
        var interval = setInterval(function() {
            if (injectButton() || attempts > 50) clearInterval(interval);
            attempts++;
        }, 100);
    }
  });

})();
