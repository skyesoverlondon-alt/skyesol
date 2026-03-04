import fs from "fs";
import crypto from "crypto";

const pubPem = process.env.SBOM_SIGNING_PUBLIC_KEY_PEM;
if (!pubPem) {
  console.error("Missing SBOM_SIGNING_PUBLIC_KEY_PEM (PEM).");
  process.exit(1);
}

const sbom = fs.readFileSync("sbom.cdx.json");
const digest = crypto.createHash("sha256").update(sbom).digest();

const sigB64 = fs.readFileSync("sbom.cdx.json.sig", "utf8").trim();
const sig = Buffer.from(sigB64, "base64");

const keyObj = crypto.createPublicKey(pubPem);
const ok = crypto.verify(null, digest, keyObj, sig);

if (!ok) {
  console.error("SBOM signature verification FAILED");
  process.exit(2);
}

console.log("SBOM signature verified OK");
