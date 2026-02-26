import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_DIR_NAMES_ANYWHERE = new Set([
  "node_modules",
  ".git",
  ".github",
  ".netlify",
]);

const SKIP_PATHS_RELATIVE = new Set(["netlify/functions"]);

const SKIP_TOP_LEVEL_DIRS = new Set(["node_modules", ".git", ".github", ".netlify"]);

function slash(p) {
  return p.replace(/\\/g, "/");
}

function stripHashAndQuery(url) {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  const cutIndex = [hashIndex, queryIndex].filter((v) => v >= 0).sort((a, b) => a - b)[0];
  return cutIndex === undefined ? url : url.slice(0, cutIndex);
}

function isSkippableHref(raw) {
  const href = String(raw || "").trim();
  if (!href) return true;
  if (href === "#") return true;
  if (href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("tel:")) return true;
  if (href.startsWith("sms:")) return true;
  if (href.startsWith("javascript:")) return true;
  if (href.startsWith("data:")) return true;
  if (href.includes("${")) return true;
  return false;
}

function isExternalHref(raw) {
  const href = String(raw || "").trim();
  if (/^https?:\/\//i.test(href)) return true;
  if (href.startsWith("//")) return true;
  return false;
}

function decodePathname(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

function decodeHtmlEntitiesBasic(value) {
  // Minimal decoding for common entities found in authored href/src values.
  // (We only need a small subset for accurate path resolution.)
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

async function readText(filePath) {
  return await fs.readFile(filePath, "utf-8");
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function collectHtmlFiles(dir, out) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = slash(path.relative(ROOT, full));

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES_ANYWHERE.has(entry.name)) continue;
      // Skip nested netlify/functions
      if (SKIP_PATHS_RELATIVE.has(rel)) continue;
      await collectHtmlFiles(full, out);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push({ fullPath: full, relative: rel });
    }
  }
}

function extractBaseHref(html) {
  const m = /<base\s+[^>]*href=(['"])(.*?)\1/i.exec(html);
  if (!m) return null;
  const href = String(m[2] || "").trim();
  return href || null;
}

function extractLinks(html) {
  const links = [];
  const patterns = [
    { type: "a", re: /<a\s+[^>]*href=(['"])(.*?)\1/gi },
    { type: "link", re: /<link\s+[^>]*href=(['"])(.*?)\1/gi },
    { type: "script", re: /<script\s+[^>]*src=(['"])(.*?)\1/gi },
    { type: "img", re: /<img\s+[^>]*src=(['"])(.*?)\1/gi },
    { type: "source", re: /<source\s+[^>]*src=(['"])(.*?)\1/gi },
    { type: "iframe", re: /<iframe\s+[^>]*src=(['"])(.*?)\1/gi },
    { type: "form", re: /<form\s+[^>]*action=(['"])(.*?)\1/gi },
  ];
  for (const { type, re } of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      links.push({ type, raw: m[2] });
    }
  }
  return links;
}

function parseRedirects(content) {
  const exact = new Set();
  const wildcardPrefixes = [];
  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const src = parts[0];
    // Skip special rules
    if (!src.startsWith("/")) continue;
    if (src.includes("*")) {
      wildcardPrefixes.push(src.split("*")[0]);
    } else {
      exact.add(src);
    }
  }
  wildcardPrefixes.sort((a, b) => b.length - a.length);
  return { exact, wildcardPrefixes };
}

function matchesRedirect(redirects, urlPath) {
  if (!redirects) return false;
  if (redirects.exact.has(urlPath)) return true;
  const noSlash = urlPath.endsWith("/") ? urlPath.slice(0, -1) : urlPath;
  if (redirects.exact.has(noSlash)) return true;
  for (const prefix of redirects.wildcardPrefixes) {
    if (urlPath.startsWith(prefix)) return true;
  }
  return false;
}

function buildCandidatePaths(urlPath) {
  if (urlPath === "/") {
    return ["index.html"];
  }

  const p = urlPath.replace(/^\//, "");
  const decoded = decodePathname(p);
  const candidates = [];

  if (!decoded) return candidates;

  // Exact path
  candidates.push(decoded);

  // If path ends with '/', treat as directory index
  if (decoded.endsWith("/")) {
    candidates.push(path.join(decoded, "index.html"));
    return candidates;
  }

  // If the link points at a directory without trailing slash
  candidates.push(path.join(decoded, "index.html"));

  // Pretty URL (no extension) might map to .html
  if (!path.extname(decoded)) {
    candidates.push(decoded + ".html");
  }

  return candidates;
}

function resolveHrefToUrlPath(sourceFileRelative, baseHref, rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return null;

  // External links are validated separately (optional)
  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      return u.pathname || "/";
    } catch {
      return null;
    }
  }

  if (href.startsWith("/")) {
    // Normalize encoding (e.g., spaces) so redirect matching is reliable
    try {
      return new URL(href, "https://local").pathname;
    } catch {
      return href;
    }
  }

  // If a <base href="/"> exists, treat relative links as root-relative
  if (baseHref && baseHref.startsWith("/")) {
    const base = baseHref.endsWith("/") ? baseHref : baseHref + "/";
    return new URL(href, "https://local" + base).pathname;
  }

  // Otherwise, resolve relative to the file's directory
  const dir = slash(path.dirname(sourceFileRelative));
  const dirPart = dir === "." ? "" : dir.replace(/^\/+/, "").replace(/\/+$/, "");
  const fileDirUrl = "https://local/" + (dirPart ? dirPart + "/" : "");
  return new URL(href, fileDirUrl).pathname;
}

async function run() {
  const htmlFiles = [];
  await collectHtmlFiles(ROOT, htmlFiles);

  const redirectsRaw = await fileExists(path.join(ROOT, "_redirects"))
    ? await readText(path.join(ROOT, "_redirects"))
    : "";
  const redirects = parseRedirects(redirectsRaw);

  // Build set of known publishable files for fast lookup
  const publishable = new Set();
  for (const f of htmlFiles) {
    publishable.add(f.relative);
  }

  const errors = [];

  for (const file of htmlFiles) {
    const html = await readText(file.fullPath);
    const baseHref = extractBaseHref(html);
    const links = extractLinks(html);

    for (const link of links) {
      const raw = String(link.raw || "");
      const decodedRaw = decodeHtmlEntitiesBasic(raw);
      if (isSkippableHref(decodedRaw)) continue;

      // For now: only validate internal paths (external links can be added later)
      if (isExternalHref(decodedRaw)) {
        // If it points back to this site, treat as internal
        try {
          const u = new URL(decodedRaw);
          if (u.hostname !== "skyesol.netlify.app") continue;
        } catch {
          continue;
        }
      }

      const hrefNoHash = stripHashAndQuery(decodedRaw);
      if (!hrefNoHash) continue;

      const urlPath = resolveHrefToUrlPath(file.relative, baseHref, hrefNoHash);
      if (!urlPath) continue;

      // Ignore Netlify function endpoints in link audit (they are runtime)
      if (urlPath.startsWith("/.netlify/functions/")) continue;

      // Accept if there is a redirect rule for this path
      if (matchesRedirect(redirects, urlPath)) {
        continue;
      }

      // Map URL path to candidate filesystem targets
      const candidates = buildCandidatePaths(urlPath);
      let ok = false;
      for (const candidate of candidates) {
        const rel = slash(candidate);
        const full = path.join(ROOT, rel);
        if (await fileExists(full)) {
          // If it's a directory, require index.html
          if (await isDir(full)) {
            const idx = path.join(full, "index.html");
            if (await fileExists(idx)) {
              ok = true;
              break;
            }
          } else {
            ok = true;
            break;
          }
        }

        // Also accept if candidate resolves to a known .html file
        if (publishable.has(rel)) {
          ok = true;
          break;
        }
      }

      if (!ok) {
        errors.push({ source: file.relative, type: link.type, href: raw, resolvedPath: urlPath });
      }
    }
  }

  const report = {
    root: ROOT,
    checkedFiles: htmlFiles.length,
    errors,
    errorCount: errors.length,
    generatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.join(ROOT, "reports"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "reports", "internal-link-audit.json"), JSON.stringify(report, null, 2));

  if (errors.length) {
    const byTarget = new Map();
    for (const e of errors) {
      const k = e.resolvedPath;
      byTarget.set(k, (byTarget.get(k) || 0) + 1);
    }
    const top = [...byTarget.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

    console.error(`Internal link audit failed: ${errors.length} broken internal refs across ${htmlFiles.length} HTML files.`);
    console.error("Top missing targets:");
    for (const [target, count] of top) {
      console.error(`  ${String(count).padStart(3, " ")} × ${target}`);
    }
    process.exit(1);
  }

  console.log(`Internal link audit OK: ${htmlFiles.length} HTML files, 0 broken internal refs.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
