const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function json(statusCode, body){
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function requireEnv(name){
  const v = process.env[name];
  if(!v) throw new Error(`${name} env var missing.`);
  return v;
}

function getBearer(event){
  const h = event.headers && (event.headers.authorization || event.headers.Authorization);
  if(!h) return "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function verifyAuth(event){
  const token = getBearer(event);
  if(!token) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  const secret = requireEnv("JWT_SECRET");
  try{
    return jwt.verify(token, secret);
  }catch(e){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

function parseJson(event){
  try{
    return event.body ? JSON.parse(event.body) : {};
  }catch(e){
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

function getClientIp(event){
  const h = event.headers || {};
  const xf = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if(xf) return String(xf).split(",")[0].trim();
  const xr = h["x-real-ip"] || h["X-Real-IP"];
  if(xr) return String(xr).trim();
  return "0.0.0.0";
}

function randomToken(bytes=32){
  return crypto.randomBytes(bytes).toString("base64url");
}

async function enforceRateLimit({ countIpWindow, countHandleWindow, ipLimit, handleLimit, ipWindowLabel, handleWindowLabel }){
  const [ipCount, handleCount] = await Promise.all([countIpWindow(), countHandleWindow()]);
  if(ipCount >= ipLimit){
    const err = new Error(`Rate limit exceeded: too many requests from this IP (${ipWindowLabel}).`);
    err.statusCode = 429;
    throw err;
  }
  if(handleCount >= handleLimit){
    const err = new Error(`Rate limit exceeded: recipient is receiving too many messages (${handleWindowLabel}).`);
    err.statusCode = 429;
    throw err;
  }
}

function hybridEncryptNode(publicKeyPem, payloadObj){
  const plaintext = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ctPlus = Buffer.concat([ct, tag]);

  const encKey = crypto.publicEncrypt(
    { key: publicKeyPem, oaepHash: "sha256", padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  return {
    encrypted_key_b64: encKey.toString("base64"),
    iv_b64: iv.toString("base64"),
    ciphertext_b64: ctPlus.toString("base64")
  };
}

function hybridEncryptBytesNode(publicKeyPem, bytesBuffer){
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([cipher.update(bytesBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ctPlus = Buffer.concat([ct, tag]);

  const encKey = crypto.publicEncrypt(
    { key: publicKeyPem, oaepHash: "sha256", padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  return {
    encrypted_key_b64: encKey.toString("base64"),
    iv_b64: iv.toString("base64"),
    ciphertext: ctPlus
  };
}


function getTokenCipherKey(){
  const seed = String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || requireEnv("JWT_SECRET"));
  return crypto.createHash("sha256").update(seed).digest();
}

function sealSecret(value){
  const iv = crypto.randomBytes(12);
  const key = getTokenCipherKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function openSecret(blob){
  if(!blob) return '';
  const raw = Buffer.from(String(blob), 'base64');
  const iv = raw.subarray(0,12);
  const tag = raw.subarray(12,28);
  const ct = raw.subarray(28);
  const key = getTokenCipherKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = {
  json, requireEnv, getBearer, verifyAuth, parseJson,
  getClientIp, randomToken, enforceRateLimit,
  hybridEncryptNode, hybridEncryptBytesNode,
  sealSecret, openSecret
};
