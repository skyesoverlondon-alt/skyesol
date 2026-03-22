(function () {
  function buildKey(options) {
    const appId = String(options.appId || "workspace").trim() || "workspace";
    const recordApp = String(options.recordApp || "default").trim() || "default";
    const wsId = String(options.wsId || "primary").trim() || "primary";
    return ["skye.workspace", appId, recordApp, wsId].join(":");
  }

  function parseStored(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  window.SkyeWorkspaceRecordSync = {
    create(options = {}) {
      const storageKey = buildKey(options);
      const getState = typeof options.getState === "function" ? options.getState : () => ({});
      const applyState = typeof options.applyState === "function" ? options.applyState : () => {};
      const serialize = typeof options.serialize === "function" ? options.serialize : (model) => model;
      const deserialize = typeof options.deserialize === "function" ? options.deserialize : (payload) => payload;

      return {
        async load() {
          try {
            const stored = parseStored(storageKey);
            if (!stored) return null;
            const payload = deserialize(stored.payload);
            applyState(payload);
            return payload;
          } catch (error) {
            if (typeof options.onLoadError === "function") options.onLoadError(error);
            throw error;
          }
        },
        async save(meta = {}) {
          try {
            const payload = serialize(getState());
            const record = {
              title: typeof options.getTitle === "function" ? options.getTitle() : "Workspace",
              savedAt: new Date().toISOString(),
              meta,
              payload,
            };
            localStorage.setItem(storageKey, JSON.stringify(record));
            return record;
          } catch (error) {
            if (typeof options.onSaveError === "function") options.onSaveError(error);
            throw error;
          }
        },
        clear() {
          localStorage.removeItem(storageKey);
        },
      };
    },
  };
})();