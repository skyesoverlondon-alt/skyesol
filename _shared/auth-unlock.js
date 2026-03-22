(function () {
  function buildLoginUrl(returnTo) {
    const target = returnTo || window.location.pathname + window.location.search + window.location.hash;
    return "/0s-auth-sdk/0s-login.html?return_to=" + encodeURIComponent(target);
  }

  function hasSession() {
    return Boolean(window.SkyeStandaloneSession && window.SkyeStandaloneSession.getSession());
  }

  function redirectToLogin(returnTo) {
    window.location.assign(buildLoginUrl(returnTo));
  }

  function requireSession(returnTo) {
    if (!hasSession()) {
      redirectToLogin(returnTo);
      return false;
    }
    return true;
  }

  window.SkyeAuthUnlock = {
    buildLoginUrl,
    hasSession,
    redirectToLogin,
    requireSession,
  };
})();