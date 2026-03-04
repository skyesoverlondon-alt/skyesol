import fs from "fs";
import path from "path";
import crypto from "crypto";

function sha256(buf){ return crypto.createHash("sha256").update(buf).digest("hex"); }

function listFiles(dir){
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".netlify") continue;
      out.push(...listFiles(p));
    } else {
      // skip release artifacts
      if (ent.name.endsWith(".zip") || ent.name.endsWith(".sig") || ent.name.endsWith(".sha256")) continue;
      out.push(p);
    }
  }
  return out;
}

// Minimal "bundle" = deterministic manifest + checksum list (actual zip is created by GitHub release workflow or externally).
const files = listFiles(process.cwd()).map(p => p.replace(process.cwd()+path.sep, "")).sort();
const manifest = [];
for (const f of files) {
  const b = fs.readFileSync(f);
  manifest.push({ file: f, sha256: sha256(b), bytes: b.length });
}
fs.writeFileSync("release.manifest.json", JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2) + "\n");
fs.writeFileSync("release.manifest.json.sha256", sha256(Buffer.from(JSON.stringify({ files: manifest }))) + "  release.manifest.json\n");
console.log("Wrote release.manifest.json + sha256");
