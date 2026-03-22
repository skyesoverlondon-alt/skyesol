(function(global){
  const TOKEN_KEY = "KAIXU_VIRTUAL_KEY";
  const LEGACY_TOKEN_KEY = "kaixu_session";
  const LAST4_KEY = "kaixu_key_last4";

  function readLocal(key){
    try { return global.localStorage ? global.localStorage.getItem(key) || "" : ""; } catch { return ""; }
  }

  function writeLocal(key, value){
    try {
      if (!global.localStorage) return;
      if (value) global.localStorage.setItem(key, value);
      else global.localStorage.removeItem(key);
    } catch {}
  }

  function readSession(key){
    try { return global.sessionStorage ? global.sessionStorage.getItem(key) || "" : ""; } catch { return ""; }
  }

  function writeSession(key, value){
    try {
      if (!global.sessionStorage) return;
      if (value) global.sessionStorage.setItem(key, value);
      else global.sessionStorage.removeItem(key);
    } catch {}
  }

  function migrateLegacy(){
    const token = readLocal(TOKEN_KEY) || readLocal(LEGACY_TOKEN_KEY) || readSession(TOKEN_KEY) || readSession(LEGACY_TOKEN_KEY);
    if (!token) return "";
    writeLocal(TOKEN_KEY, token);
    writeLocal(LEGACY_TOKEN_KEY, token);
    writeSession(TOKEN_KEY, token);
    writeSession(LEGACY_TOKEN_KEY, token);
    return token;
  }

  const api = {
    tokenKey: TOKEN_KEY,
    getToken(){
      return migrateLegacy();
    },
    setToken(token){
      const next = String(token || "").trim();
      writeLocal(TOKEN_KEY, next);
      writeLocal(LEGACY_TOKEN_KEY, next);
      writeSession(TOKEN_KEY, next);
      writeSession(LEGACY_TOKEN_KEY, next);
      return next;
    },
    getKeyLast4(){
      return readLocal(LAST4_KEY) || readSession(LAST4_KEY);
    },
    setKeyLast4(last4){
      const next = String(last4 || "").trim();
      writeLocal(LAST4_KEY, next);
      writeSession(LAST4_KEY, next);
      return next;
    },
    setSession(token, keyLast4){
      this.setToken(token);
      if (typeof keyLast4 !== "undefined") this.setKeyLast4(keyLast4);
      return this.getToken();
    },
    clear(){
      writeLocal(TOKEN_KEY, "");
      writeLocal(LEGACY_TOKEN_KEY, "");
      writeLocal(LAST4_KEY, "");
      writeSession(TOKEN_KEY, "");
      writeSession(LEGACY_TOKEN_KEY, "");
      writeSession(LAST4_KEY, "");
    },
    isAuthenticated(){
      return !!this.getToken();
    }
  };

  migrateLegacy();
  global.KaixuSession = api;
})(globalThis);