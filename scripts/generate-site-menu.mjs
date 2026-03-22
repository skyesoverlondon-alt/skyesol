import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_DIR_NAMES_ANYWHERE = new Set(["node_modules", ".git", ".github", ".netlify"]);
const SKIP_PATHS_RELATIVE = new Set(["netlify/functions"]);

// Directories to exclude from the admin menu (dev notes, secrets, internal-only)
const SKIP_DIR_NAMES_EXACT = new Set(["xxDEVONLY", "AI DIRECTIVES"]);

// File basenames to exclude (templates, secrets, dev-only files)
const SKIP_FILE_BASENAMES = new Set([
  "template.html", "TEMPLATE.html",
  "env.template", ".env",
]);

// Relative paths to exclude explicitly
const SKIP_FILES_RELATIVE = new Set([
  "Platforms-Apps-Infrastructure/kAIxUGateway13/.env",
  "Platforms-Apps-Infrastructure/kAIxUGateway13/env.template",
  "Services/WebBuilds/WebBuilds.html",
]);
const SKIP_PATH_PREFIXES = [
  "Platforms-Apps-Infrastructure/2026/FounderTechPro /Full-EMAIL-Service-Database-Gmail+Neon-Replacements/skymail-mega-build/apps/skymail-web/",
];

function slash(p) {
  return p.replace(/\\/g, "/");
}

async function shouldSkipRelativeFile(relativePath) {
  const rel = slash(relativePath);
  if (SKIP_FILES_RELATIVE.has(rel)) return true;
  if (SKIP_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  if (!rel.startsWith("Services/") || !rel.endsWith("/index.html")) return false;

  const siblingHtml = rel.slice(0, -"/index.html".length) + ".html";
  try {
    await fs.access(path.join(ROOT, siblingHtml));
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntitiesBasic(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

async function collectAllFiles(dir, out) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = slash(path.relative(ROOT, full));

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES_ANYWHERE.has(entry.name)) continue;
      if (SKIP_DIR_NAMES_EXACT.has(entry.name)) continue;
      if (SKIP_PATHS_RELATIVE.has(rel)) continue;
      await collectAllFiles(full, out);
      continue;
    }

    if (entry.isFile()) {
      // Skip template files, env files, and other dev-only artifacts
      if (SKIP_FILE_BASENAMES.has(entry.name)) continue;
      if (await shouldSkipRelativeFile(rel)) continue;
      out.push({ fullPath: full, relative: rel, ext: path.extname(entry.name).toLowerCase() });
    }
  }
}

function encodeUrlPathFromRelativeHtml(relativeHtmlPath) {
  const rel = slash(relativeHtmlPath).replace(/^\/+/, "");
  const parts = rel.split("/");
  return (
    "/" +
    parts
      .map((p) => encodeURIComponent(p))
      .join("/")
      // keep slashes, but encodeURIComponent doesn't touch them anyway
  );
}

function guessCategory(relativeHtmlPath) {
  const rel = slash(relativeHtmlPath);
  const first = rel.split("/")[0] || "";
  if (!first || !first.includes(".")) return first || "root";
  return "root";
}

async function extractTitle(fullPath) {
  try {
    const html = await fs.readFile(fullPath, "utf-8");
    const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    if (!m) return null;
    return decodeHtmlEntitiesBasic(m[1]);
  } catch {
    return null;
  }
}

function buildPrettyPath(relativeHtmlPath) {
  const rel = slash(relativeHtmlPath);
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) {
    const dir = rel.slice(0, -"/index.html".length);
    return "/" + dir.split("/").map(encodeURIComponent).join("/") + "/";
  }
  return null;
}

async function run() {
  const allFiles = [];
  await collectAllFiles(ROOT, allFiles);

  const items = [];
  for (const f of allFiles) {
    let urlPath = null;
    let prettyPath = null;
    let title = null;
    if (f.ext === ".html") {
      urlPath = encodeUrlPathFromRelativeHtml(f.relative);
      prettyPath = buildPrettyPath(f.relative);
      title = await extractTitle(f.fullPath);
    }
    const category = guessCategory(f.relative);
    items.push({
      urlPath,
      prettyPath,
      file: f.relative,
      title,
      ext: f.ext,
      category,
    });
  }

  items.sort((a, b) => {
    const aa = a.urlPath || a.file;
    const bb = b.urlPath || b.file;
    return aa.localeCompare(bb);
  });

  const categories = new Map();
  for (const item of items) {
    const key = item.category || "root";
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(item);
  }

  const categoryNames = [...categories.keys()].sort((a, b) => {
    if (a === "root") return -1;
    if (b === "root") return 1;
    return a.localeCompare(b);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    categories: categoryNames.map((name) => ({
      name,
      count: categories.get(name).length,
      items: categories.get(name),
    })),
  };

  const outDir = path.join(ROOT, "netlify/functions/_generated");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "site-menu-data.mjs");
  const content = `// AUTO-GENERATED by scripts/generate-site-menu.mjs
// Do not hand-edit.

export const SITE_MENU = ${JSON.stringify(payload, null, 2)};
`;
  await fs.writeFile(outFile, content);

  console.log(`Generated site menu data: ${slash(path.relative(ROOT, outFile))} (${items.length} pages)`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
