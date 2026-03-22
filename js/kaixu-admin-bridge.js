(function () {
  const adminToken = () => {
    try {
      return (globalThis.sessionStorage?.getItem("KAIXU_ADMIN_TOKEN") || "").trim();
    } catch {
      return "";
    }
  };

  const founderLinks = () => Array.from(document.querySelectorAll("[data-founder-admin-link]"));

  function revealFounderLinks() {
    founderLinks().forEach((link) => {
      link.hidden = false;
      link.style.removeProperty("display");
    });
  }

  function hideFounderLinks() {
    founderLinks().forEach((link) => {
      link.hidden = true;
    });
  }

  function mountGuardOverlay() {
    if (document.getElementById("kaixu-founder-admin-guard")) return;
    const overlay = document.createElement("div");
    overlay.id = "kaixu-founder-admin-guard";
    overlay.hidden = true;
    overlay.innerHTML = [
      '<div class="kaixu-founder-admin-guard__card">',
      '<div class="kaixu-founder-admin-guard__eyebrow">Founder Admin Required</div>',
      '<h2>This cohort founder lane is tied to Gateway admin access.</h2>',
      '<p>Regular users should not be able to open the founder board. Log into Gateway admin first, then come back here to unlock the founder-only cohort command surfaces on this device.</p>',
      '<div class="kaixu-founder-admin-guard__actions">',
      '<a class="kaixu-founder-admin-guard__button" href="/gateway/">Open Gateway Admin</a>',
      '<a class="kaixu-founder-admin-guard__button kaixu-founder-admin-guard__button--ghost" href="/account/">Open Account</a>',
      '</div>',
      '</div>'
    ].join("");

    const style = document.createElement("style");
    style.textContent = `
      #kaixu-founder-admin-guard {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(8, 11, 19, 0.78);
        backdrop-filter: blur(10px);
      }
      #kaixu-founder-admin-guard[hidden] {
        display: none;
      }
      .kaixu-founder-admin-guard__card {
        width: min(720px, 100%);
        padding: 28px;
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(10, 14, 28, 0.96), rgba(22, 28, 48, 0.94));
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
        color: #f5f8ff;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .kaixu-founder-admin-guard__eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(159, 212, 255, 0.88);
      }
      .kaixu-founder-admin-guard__card h2 {
        margin: 12px 0 10px;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.04;
      }
      .kaixu-founder-admin-guard__card p {
        margin: 0;
        color: rgba(245, 248, 255, 0.8);
        line-height: 1.7;
      }
      .kaixu-founder-admin-guard__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }
      .kaixu-founder-admin-guard__button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        background: #f4c95d;
        color: #111827;
        text-decoration: none;
        font-weight: 700;
      }
      .kaixu-founder-admin-guard__button--ghost {
        background: transparent;
        color: #f5f8ff;
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }

  async function validateAdminSession() {
    const token = adminToken();
    if (!token) return false;

    try {
      const response = await fetch("/.netlify/functions/admin-session-check", {
        headers: { authorization: `Bearer ${token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function boot() {
    const needsFounderGuard = document.body?.dataset?.kaixuAdminGuard === "founder";
    const isAdmin = await validateAdminSession();

    if (isAdmin) {
      revealFounderLinks();
    } else {
      hideFounderLinks();
    }

    if (!needsFounderGuard) return;
    mountGuardOverlay();
    const overlay = document.getElementById("kaixu-founder-admin-guard");
    if (overlay) overlay.hidden = isAdmin;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();