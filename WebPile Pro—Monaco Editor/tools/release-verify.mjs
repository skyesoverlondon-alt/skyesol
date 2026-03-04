import fs from "fs";
import crypto from "crypto";

const pubPem = process.env.RELEASE_SIGNING_PUBLIC_KEY_PEM;
if (!pubPem) {
  console.error("Missing RELEASE_SIGNING_PUBLIC_KEY_PEM");
  process.exit(1);
}

const data = fs.readFileSync("release.manifest.json");
const digest = crypto.createHash("sha256").update(data).digest();
const sigB64 = fs.readFileSync("release.manifest.json.sig", "utf8").trim();
const sig = Buffer.from(sigB64, "base64");
const keyObj = crypto.createPublicKey(pubPem);

const ok = crypto.verify(null, digest, keyObj, sig);
if (!ok) {
  console.error("Release signature verification FAILED");
  process.exit(2);
}
console.log("Release signature verified OK");
