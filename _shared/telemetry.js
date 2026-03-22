(function () {
  const STORAGE_KEY = "skye.telemetry.events";

  function readEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  async function emit(event) {
    const payload = {
      ...event,
      recordedAt: new Date().toISOString(),
    };
    const next = readEvents();
    next.unshift(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 100)));
    return payload;
  }

  window.SkyeTelemetry = { emit };
})();