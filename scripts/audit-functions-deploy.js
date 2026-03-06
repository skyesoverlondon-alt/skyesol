import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fnDir = path.join(root, "netlify", "functions");

const scanExt = new Set([".html", ".js", ".mjs", ".ts", ".tsx", ".md"]);
const skipDir = new Set([".git", "node_modules", ".netlify"]);

const refs = new Set();
const refsToCallers = new Map();

function addCaller(endpoint, filePath) {
  const callers = refsToCallers.get(endpoint) || new Set();
  callers.add(filePath);
  refsToCallers.set(endpoint, callers);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (skipDir.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!scanExt.has(path.extname(ent.name))) continue;

    let txt = "";
    try {
      txt = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }

    const re = /\.netlify\/functions\/([A-Za-z0-9_-]+)/g;
    let m;
    while ((m = re.exec(txt))) {
      const endpoint = m[1];
      refs.add(endpoint);
      addCaller(endpoint, path.relative(root, full));
    }
  }
}

function implementedFunctionMap() {
  const out = new Map();
  const entries = fs.readdirSync(fnDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!/\.(js|mjs|ts)$/i.test(ent.name)) continue;
    const endpoint = ent.name.replace(/\.(js|mjs|ts)$/i, "");
    out.set(endpoint, path.join("netlify", "functions", ent.name));
  }
  return out;
}

walk(root);
const impl = implementedFunctionMap();
const allRefs = [...refs].sort();
const missing = allRefs.filter((name) => !impl.has(name));

function printMap() {
  console.log(`[functions-map] Endpoints referenced: ${allRefs.length}`);
  console.log(`[functions-map] Missing implementations: ${missing.length}`);
  console.log("");

  for (const endpoint of allRefs) {
    const fnFile = impl.get(endpoint) || "(missing)";
    const callers = [...(refsToCallers.get(endpoint) || [])].sort();
    const status = impl.has(endpoint) ? "OK" : "MISSING";

    console.log(`${status} endpoint: /.netlify/functions/${endpoint}`);
    console.log(`  function: ${fnFile}`);
    if (!callers.length) {
      console.log("  callers: (none found)");
    } else {
      console.log("  callers:");
      for (const caller of callers) {
        console.log(`    - ${caller}`);
      }
    }
    console.log("");
  }
}

function mapPayload() {
  const endpoints = allRefs.map((endpoint) => ({
    endpoint: `/.netlify/functions/${endpoint}`,
    name: endpoint,
    status: impl.has(endpoint) ? "ok" : "missing",
    functionFile: impl.get(endpoint) || null,
    callers: [...(refsToCallers.get(endpoint) || [])].sort()
  }));

  return {
    summary: {
      referencedEndpoints: allRefs.length,
      missingImplementations: missing.length,
      generatedAt: new Date().toISOString()
    },
    endpoints
  };
}

function printJson() {
  const payload = mapPayload();
  const outArg = process.argv.find((arg) => arg.startsWith("--out="));
  if (outArg) {
    const outPath = outArg.slice("--out=".length).trim();
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    }
  }
  console.log(JSON.stringify(payload, null, 2));
}

const mode = process.argv.includes("--json") ? "json" : (process.argv.includes("--map") ? "map" : "audit");

if (mode === "map") {
  printMap();
  process.exit(missing.length ? 1 : 0);
}

if (mode === "json") {
  printJson();
  process.exit(missing.length ? 1 : 0);
}

if (!missing.length) {
  console.log(`[functions-audit] OK: ${refs.size} referenced endpoint(s), 0 missing in netlify/functions.`);
  process.exit(0);
}

console.error(`[functions-audit] FAIL: ${missing.length} referenced endpoint(s) missing from netlify/functions:`);
for (const name of missing) {
  console.error(` - ${name}`);
}
process.exit(1);
