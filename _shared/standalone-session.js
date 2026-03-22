(function () {
  const SESSION_KEY = "skye.omega.session";
  const TOKEN_KEY = "skye.omega.token";

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSession() {
    return readJson(SESSION_KEY);
  }

  function getToken() {
    return String(localStorage.getItem(TOKEN_KEY) || "");
  }

  function setSession(session, token) {
    const nextSession = session && typeof session === "object" ? session : {};
    writeJson(SESSION_KEY, nextSession);
    if (typeof token === "string" && token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else if (typeof nextSession.token === "string" && nextSession.token) {
      localStorage.setItem(TOKEN_KEY, nextSession.token);
    }
    return nextSession;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  window.SkyeStandaloneSession = {
    keys: { session: SESSION_KEY, token: TOKEN_KEY },
    getSession,
    getToken,
    setSession,
    clearSession,
  };
})();