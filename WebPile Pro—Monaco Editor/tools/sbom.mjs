import fs from "fs";
import crypto from "crypto";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePurl(name, version) {
  // Minimal purl for npm packages
  const n = encodeURIComponent(String(name || "").replace(/^@/, "").replace("/", "%2F"));
  const scope = String(name || "").startsWith("@") ? String(name).split("/")[0].slice(1) : null;
  const base = scope ? `pkg:npm/%40${encodeURIComponent(scope)}%2F${encodeURIComponent(String(name).split("/")[1] || "")}` : `pkg:npm/${encodeURIComponent(String(name))}`;
  return version ? `${base}@${encodeURIComponent(String(version))}` : base;
}

function componentsFromLock(lock) {
  const comps = [];
  const packages = lock.packages || {};
  for (const [k, v] of Object.entries(packages)) {
    if (k === "") continue;
    const name = v.name || k.replace(/^node_modules\//, "");
    const version = v.version || "";
    if (!name || !version) continue;

    comps.push({
      type: "library",
      name,
      version,
      purl: normalizePurl(name, version),
      hashes: v.integrity ? [] : [],
    });
  }
  // De-dup by name@version
  const uniq = new Map();
  for (const c of comps) uniq.set(`${c.name}@${c.version}`, c);
  return Array.from(uniq.values()).sort((a,b)=> (a.name+a.version).localeCompare(b.name+b.version));
}

function main() {
  const pkgPath = "package.json";
  const lockPath = "package-lock.json";
  if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath)) {
    console.error("Missing package.json or package-lock.json");
    process.exit(1);
  }

  const pkg = readJson(pkgPath);
  const lock = readJson(lockPath);

  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: "urn:uuid:" + crypto.randomUUID(),
    version: 1,
    metadata: {
      timestamp: nowIso(),
      tools: [{ vendor: "WebPile Pro", name: "sbom.mjs", version: "1.0.0" }],
      component: {
        type: "application",
        name: pkg.name || "webpile-pro",
        version: pkg.version || "0.0.0",
      }
    },
    components: componentsFromLock(lock),
  };

  const out = JSON.stringify(sbom, null, 2) + "\n";
  fs.writeFileSync("sbom.cdx.json", out, "utf8");

  const digest = sha256(Buffer.from(out, "utf8"));
  fs.writeFileSync("sbom.cdx.json.sha256", digest + "  sbom.cdx.json\n", "utf8");

  console.log("SBOM generated: sbom.cdx.json");
}

main();
