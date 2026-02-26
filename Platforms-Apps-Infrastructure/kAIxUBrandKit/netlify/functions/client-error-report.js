exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    console.error("CLIENT_ERROR_REPORT", {
      ts: new Date().toISOString(),
      ...body,
    });
  } catch (e) {
    console.error("CLIENT_ERROR_REPORT_PARSE_FAIL", String(e?.message || e));
  }

  return {
    statusCode: 204,
    headers: { "Cache-Control": "no-store" },
    body: "",
  };
};
