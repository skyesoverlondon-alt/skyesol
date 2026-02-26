exports.handler = async (event, context) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-kaixu-app,x-kaixu-build",
    "access-control-allow-methods": "POST,OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed. Use POST." })
    };
  }

  let payload = null;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Invalid JSON body." })
    };
  }

  const appHeader = event.headers["x-kaixu-app"] || event.headers["X-Kaixu-App"] || "";
  const buildHeader = event.headers["x-kaixu-build"] || event.headers["X-Kaixu-Build"] || "";

  const record = {
    receivedAt: new Date().toISOString(),
    requestId: context.awsRequestId || null,
    ip: event.headers["x-forwarded-for"] || event.headers["client-ip"] || null,
    appHeader,
    buildHeader,
    payload
  };

  // “Behavior”: accept client-side error reports, log them to Netlify function logs.
  // This keeps the repo drop-ready without needing a database.
  console.log("[client-error-report] received", JSON.stringify(record));

  return {
    statusCode: 200,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify({
      ok: true,
      receivedAt: record.receivedAt,
      requestId: record.requestId
    })
  };
};
