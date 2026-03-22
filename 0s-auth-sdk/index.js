(function () {
  const storage = window.SkyeStandaloneSession;

  function loginUrl(returnTo) {
    const target = returnTo || window.location.pathname + window.location.search + window.location.hash;
    return "/0s-auth-sdk/0s-login.html?return_to=" + encodeURIComponent(target);
  }

  function currentSession() {
    return storage ? storage.getSession() : null;
  }

  function currentToken() {
    if (!storage) return "";
    return storage.getToken();
  }

  async function getSession() {
    return currentSession();
  }

  function getToken() {
    return currentToken();
  }

  function setSession(session, token) {
    if (!storage) return session;
    return storage.setSession(session, token);
  }

  function clearSession() {
    if (storage) storage.clearSession();
  }

  function requireSession(returnTo) {
    const session = currentSession();
    if (!session) {
      window.location.assign(loginUrl(returnTo));
      return false;
    }
    return true;
  }

  function logout(returnTo) {
    clearSession();
    window.location.assign(loginUrl(returnTo || "/"));
  }

  window.OmegaAuth = {
    getSession,
    getToken,
    setSession,
    clearSession,
    requireSession,
    logout,
  };
})();