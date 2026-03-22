const { json } = require("./_utils");

/*
  Returns the admin recovery PUBLIC key (PEM) if configured.
  This allows the signup page to encrypt an optional recovery blob without
  baking any placeholder keys into the client.

  Env:
    - ADMIN_RECOVERY_PUBLIC_KEY_PEM (optional)
*/
exports.handler = async () => {
  const pem = process.env.ADMIN_RECOVERY_PUBLIC_KEY_PEM;
  if(!pem) return json(200, { enabled:false, public_key_pem:null });
  return json(200, { enabled:true, public_key_pem:String(pem) });
};
