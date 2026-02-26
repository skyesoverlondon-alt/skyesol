import crypto from "crypto";

function configError(message, hint) {
  const err = new Error(message);
  err.code = "CONFIG";
  err.status = 500;
  if (hint) err.hint = hint;
  return err;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function unbase64url(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

function encKey() {
  // Prefer a dedicated encryption key. Fall back to JWT_SECRET for drop-friendly installs.
  const raw = (process.env.DB_ENCRYPTION_KEY || process.env.JWT_SECRET || "").toString();
  if (!raw) {
    throw configError(
      "Missing DB_ENCRYPTION_KEY (or JWT_SECRET fallback)",
      "Set DB_ENCRYPTION_KEY (recommended) or at minimum JWT_SECRET in Netlify env vars."
    );
  }
  // Derive a stable 32-byte key.
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt small secrets for DB storage (AES-256-GCM).
 * Format: v1:<iv_b64url>:<tag_b64url>:<cipher_b64url>
 */
export function encryptSecret(plaintext) {
  const key = encKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${base64url(iv)}:${base64url(tag)}:${base64url(ct)}`;
}

export function decryptSecret(enc) {
  const s = String(enc || "");
  if (!s.startsWith("v1:")) return null;
  const parts = s.split(":");
  if (parts.length !== 4) return null;
  const [, ivB, tagB, ctB] = parts;
  const key = encKey();
  const iv = unbase64url(ivB);
  const tag = unbase64url(tagB);
  const ct = unbase64url(ctB);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function randomKey(prefix = "kx_live_") {
  const bytes = crypto.randomBytes(32);
  return prefix + base64url(bytes).slice(0, 48);
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(secret, input) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

/**
 * Key hashing strategy:
 * - Default: SHA-256(key)
 * - If KEY_PEPPER is set: HMAC-SHA256(KEY_PEPPER, key)
 *
 * IMPORTANT: Pepper is optional and can be enabled later.
 * Auth code will auto-migrate legacy hashes on first successful lookup.
 */
export function keyHashHex(input) {
  const pepper = process.env.KEY_PEPPER;
  if (pepper) return hmacSha256Hex(pepper, input);
  return sha256Hex(input);
}

export function legacyKeyHashHex(input) {
  return sha256Hex(input);
}

export function signJwt(payload, ttlSeconds = 3600) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw configError(
      "Missing JWT_SECRET",
      "Set JWT_SECRET in Netlify → Site configuration → Environment variables (use a long random string)."
    );
  }

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };

  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = base64url(crypto.createHmac("sha256", secret).update(data).digest());

  return `${data}.${sig}`;
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw configError(
      "Missing JWT_SECRET",
      "Set JWT_SECRET in Netlify → Site configuration → Environment variables (use a long random string)."
    );
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = base64url(crypto.createHmac("sha256", secret).update(data).digest());

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(s);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
