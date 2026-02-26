// Example: Client Error Reporter (browser)
// Send front-end errors to the gateway monitor feed (kind=client_error).
//
// You can:
//  - call KaixuClient.reportClientError(...) manually
//  - or install global hooks once and let it auto-capture.

KaixuClient.installGlobalErrorHooks({
  apiBase: localStorage.getItem("KAIXU_API_BASE") || "", // optional
  app: "SkyIDE",
  build: "skyide-2026.02.21",
  // token: "<optional if CLIENT_ERROR_TOKEN is set on gateway>"
});

// Manual report example:
document.getElementById("sendTest").addEventListener("click", async ()=>{
  try {
    throw new Error("Test client error: button clicked");
  } catch (e) {
    const res = await KaixuClient.reportClientError({
      app: "SkyIDE",
      build: "skyide-2026.02.21",
      error: e,
      context: { page: location.pathname, feature: "test" }
    });
    console.log("report result", res);
  }
});
