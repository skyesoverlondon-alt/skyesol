import fs from "fs";
import crypto from "crypto";

const privPem = process.env.SBOM_SIGNING_PRIVATE_KEY_PEM;
if (!privPem) {
  console.error("Missing SBOM_SIGNING_PRIVATE_KEY_PEM (PEM).");
  process.exit(1);
}

const sbom = fs.readFileSync("sbom.cdx.json");
const digest = crypto.createHash("sha256").update(sbom).digest();

const keyObj = crypto.createPrivateKey(privPem);
const sig = crypto.sign(null, digest, keyObj); // Ed25519 uses null algorithm

fs.writeFileSync("sbom.cdx.json.sig", sig.toString("base64") + "\n", "utf8");
console.log("SBOM signed: sbom.cdx.json.sig (base64 Ed25519 over SHA-256 digest)");
