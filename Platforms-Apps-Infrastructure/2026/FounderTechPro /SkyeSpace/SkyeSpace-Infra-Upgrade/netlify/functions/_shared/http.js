function json(statusCode, body){
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function ok(body){ return json(200, body); }
function badRequest(message, extra){ return json(400, Object.assign({ ok:false, error: message }, extra || {})); }
function serverError(error){ return json(500, { ok:false, error: error?.message || 'Server error' }); }

module.exports = { json, ok, badRequest, serverError };
