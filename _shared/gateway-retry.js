(function () {
  async function fetchWithRetry(input, init = {}, config = {}) {
    const retries = Number.isFinite(config.retries) ? config.retries : 2;
    const backoffMs = Number.isFinite(config.backoffMs) ? config.backoffMs : 300;

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(input, init);
        if (response.ok || attempt === retries) return response;
        lastError = new Error("HTTP " + response.status);
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => window.setTimeout(resolve, backoffMs * (attempt + 1)));
    }

    throw lastError || new Error("Gateway request failed");
  }

  window.SkyeGatewayRetry = { fetch: fetchWithRetry };
})();