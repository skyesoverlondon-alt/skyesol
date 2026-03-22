#!/usr/bin/env node

// Generates an RSA keypair suitable for ADMIN_RECOVERY_PUBLIC_KEY_PEM / ADMIN_RECOVERY_PRIVATE_KEY_PEM.
// Usage:
//   node tools/gen-admin-recovery-keys.js

const crypto = require("crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

console.log("\n=== ADMIN RECOVERY KEYPAIR (RSA-2048) ===\n");
console.log("ADMIN_RECOVERY_PUBLIC_KEY_PEM=\n" + publicKey.trim() + "\n");
console.log("ADMIN_RECOVERY_PRIVATE_KEY_PEM=\n" + privateKey.trim() + "\n");
console.log("Next steps:\n- Put BOTH values into Netlify Environment Variables (Site settings → Environment variables).\n- Set ADMIN_RECOVERY_TOKEN to a long random string if you intend to use recovery-export.\n");
