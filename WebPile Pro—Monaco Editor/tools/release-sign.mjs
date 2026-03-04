import fs from "fs";
import crypto from "crypto";

const privPem = process.env.RELEASE_SIGNING_PRIVATE_KEY_PEM;
if (!privPem) {
  console.error("Missing RELEASE_SIGNING_PRIVATE_KEY_PEM");
  process.exit(1);
}

const data = fs.readFileSync("release.manifest.json");
const digest = crypto.createHash("sha256").update(data).digest();
const keyObj = crypto.createPrivateKey(privPem);
const sig = crypto.sign(null, digest, keyObj); // Ed25519 (recommended)
fs.writeFileSync("release.manifest.json.sig", sig.toString("base64") + "\n", "utf8");
console.log("Signed release.manifest.json -> release.manifest.json.sig");
