import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const root = process.cwd();
const functionsDir = path.join(root, "netlify", "functions");
const packageJsonPath = path.join(root, "package.json");
const skipDirs = new Set([".git", ".netlify", "node_modules"]);
const scanExtensions = [".js", ".mjs", ".cjs", ".ts", ".tsx"];
const builtinSet = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => name.replace(/^node:/, ""))
]);

const importPattern = /(?:import\s+(?:[^"'`]+?\s+from\s+)?|export\s+[^"'`]+?\s+from\s+|import\s*\()\s*["']([^"']+)["']/g;
const requirePattern = /require\(\s*["']([^"']+)["']\s*\)/g;

function isLocalSpecifier(specifier) {
  return specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("#");
}

function normalizePackageName(specifier) {
  if (!specifier || specifier.startsWith("node:")) return null;
  if (isLocalSpecifier(specifier)) return null;

  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }

  const [name] = specifier.split("/");
  return name || null;
}

function resolveLocalSpecifier(fromFile, specifier) {
  const basePath = specifier.startsWith("/")
    ? path.join(root, specifier)
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [];
  const ext = path.extname(basePath);

  if (ext) {
    candidates.push(basePath);
  } else {
    candidates.push(basePath);
    for (const extension of scanExtensions) {
      candidates.push(`${basePath}${extension}`);
    }
    for (const extension of scanExtensions) {
      candidates.push(path.join(basePath, `index${extension}`));
    }
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function scanFile(filePath, dependencyToFiles, visitedFiles) {
  const realPath = fs.realpathSync(filePath);
  if (visitedFiles.has(realPath)) return;
  visitedFiles.add(realPath);

  const content = fs.readFileSync(realPath, "utf8");
  const relativePath = path.relative(root, filePath);

  for (const pattern of [importPattern, requirePattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const specifier = match[1];
      if (isLocalSpecifier(specifier)) {
        const resolved = resolveLocalSpecifier(realPath, specifier);
        if (resolved) scanFile(resolved, dependencyToFiles, visitedFiles);
        continue;
      }

      const packageName = normalizePackageName(specifier);
      if (!packageName || builtinSet.has(packageName)) continue;

      const files = dependencyToFiles.get(packageName) || new Set();
      files.add(relativePath);
      dependencyToFiles.set(packageName, files);
    }
  }
}

const missingLocalImports = new Map();

function addMissingLocalImport(filePath, specifier) {
  const imports = missingLocalImports.get(filePath) || new Set();
  imports.add(specifier);
  missingLocalImports.set(filePath, imports);
}

function walk(dir, dependencyToFiles, visitedFiles) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, dependencyToFiles, visitedFiles);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!scanExtensions.includes(path.extname(entry.name))) continue;
    scanFile(fullPath, dependencyToFiles, visitedFiles);
  }
}

if (!fs.existsSync(functionsDir)) {
  console.log("[function-deps-audit] SKIP: netlify/functions directory not found.");
  process.exit(0);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const declaredDependencies = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.optionalDependencies || {})
]);
const dependencyToFiles = new Map();
const visitedFiles = new Set();

walk(functionsDir, dependencyToFiles, visitedFiles);

const referencedDependencies = [...dependencyToFiles.keys()].sort();
const missingDependencies = referencedDependencies.filter((name) => !declaredDependencies.has(name));

for (const visitedFile of visitedFiles) {
  const content = fs.readFileSync(visitedFile, "utf8");
  const relativePath = path.relative(root, visitedFile);
  for (const pattern of [importPattern, requirePattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const specifier = match[1];
      if (!isLocalSpecifier(specifier)) continue;
      const resolved = resolveLocalSpecifier(visitedFile, specifier);
      if (!resolved) addMissingLocalImport(relativePath, specifier);
    }
  }
}

const missingLocalFiles = [...missingLocalImports.keys()].sort();

if (missingLocalFiles.length) {
  console.error(`[function-deps-audit] FAIL: ${missingLocalFiles.length} file(s) in the Netlify function graph have unresolved local imports:`);
  for (const filePath of missingLocalFiles) {
    console.error(` - ${filePath}`);
    for (const specifier of [...(missingLocalImports.get(filePath) || [])].sort()) {
      console.error(`   - ${specifier}`);
    }
  }
  process.exit(1);
}

if (!missingDependencies.length) {
  console.log(`[function-deps-audit] OK: ${referencedDependencies.length} external dependency reference(s), 0 missing from package.json dependencies.`);
  process.exit(0);
}

console.error(`[function-deps-audit] FAIL: ${missingDependencies.length} package(s) referenced by netlify/functions are missing from package.json dependencies:`);
for (const dependency of missingDependencies) {
  console.error(` - ${dependency}`);
  for (const filePath of [...(dependencyToFiles.get(dependency) || [])].sort()) {
    console.error(`   - ${filePath}`);
  }
}
process.exit(1);