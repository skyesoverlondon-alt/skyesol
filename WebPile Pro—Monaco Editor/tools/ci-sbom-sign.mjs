import fs from "fs";
import { execSync } from "child_process";

const priv = process.env.SBOM_SIGNING_PRIVATE_KEY_PEM;
const pub = process.env.SBOM_SIGNING_PUBLIC_KEY_PEM;

if (!priv || !pub) {
  console.error("SBOM signing keys are required in CI.");
  console.error("Set GitHub secrets: SBOM_SIGNING_PRIVATE_KEY_PEM and SBOM_SIGNING_PUBLIC_KEY_PEM.");
  process.exit(3);
}

execSync("node tools/sbom-sign.mjs", { stdio: "inherit", env: process.env });
execSync("node tools/sbom-verify.mjs", { stdio: "inherit", env: process.env });

if (!fs.existsSync("sbom.cdx.json.sig")) {
  console.error("SBOM signature file missing after signing step.");
  process.exit(4);
}
