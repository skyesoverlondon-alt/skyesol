import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd();
const skipDirs = new Set(['node_modules', 'css', 'js', 'netlify', '.git', '.github']);

async function collectHtml(dir, list) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      await collectHtml(entryPath, list);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      list.push({ fullPath: entryPath, relative: path.relative(root, entryPath).replace(/\\/g, '/') });
    }
  }
}

function ensureNoreferrer(content) {
  let changed = false;
  const relPattern = /rel=(['"])([^'"]*)\1/gi;
  const updated = content.replace(relPattern, (match, quote, value) => {
    const tokens = value.split(/\s+/).filter(Boolean);
    const lowered = tokens.map((token) => token.toLowerCase());
    if (!lowered.includes('noopener')) return match;
    if (lowered.includes('noreferrer')) return match;
    changed = true;
    tokens.push('noreferrer');
    return `rel=${quote}${tokens.join(' ')}${quote}`;
  });
  return { content: updated, changed };
}

function stripHashAndQuery(href) {
  const hashIndex = href.indexOf('#');
  const queryIndex = href.indexOf('?');
  const cutIndex = [hashIndex, queryIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0];
  return cutIndex !== undefined ? href.slice(0, cutIndex) : href;
}

function normalizePath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRedirectPattern(sourcePattern) {
  const pattern = sourcePattern.trim();
  if (!pattern.startsWith('/')) return null;

  const regex = '^' + pattern
    .split('*')
    .map((segment) => escapeRegex(segment).replace(/\\:[A-Za-z0-9_-]+/g, '[^/]+'))
    .join('.*') + '$';

  return new RegExp(regex);
}

async function loadRedirectMatchers() {
  const redirectsPath = path.join(root, '_redirects');
  try {
    const content = await fs.readFile(redirectsPath, 'utf-8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[0])
      .map(compileRedirectPattern)
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function matchesRedirectSource(href, redirectMatchers) {
  const trimmed = String(href || '').trim();
  if (!trimmed) return false;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'skyesol.netlify.app') return false;
      pathname = url.pathname;
    } catch (error) {
      return false;
    }
  }

  if (!pathname.startsWith('/')) return false;
  return redirectMatchers.some((matcher) => matcher.test(pathname));
}

function resolveInternalLink(sourceFile, href) {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return null;
  }

  if (trimmed.includes('${')) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    const normalized = trimmed.replace(/^\//, '');
    return path.join(root, decodeURIComponent(normalized));
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'skyesol.netlify.app') return null;
      const relativePath = url.pathname.replace(/^\//, '');
      return path.join(root, decodeURIComponent(relativePath));
    } catch (error) {
      return null;
    }
  }

  try {
    const baseFile = pathToFileURL(sourceFile);
    const resolved = new URL(trimmed, baseFile);
    if (resolved.protocol === 'file:') {
      return fileURLToPath(resolved);
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function fixRelAttributes(htmlFiles, fixMode) {
  let totalChanges = 0;
  for (const file of htmlFiles) {
    const original = await fs.readFile(file.fullPath, 'utf-8');
    const { content: updated, changed } = ensureNoreferrer(original);
    if (!changed) continue;
    if (fixMode) {
      await fs.writeFile(file.fullPath, updated);
    }
    totalChanges += 1;
    console.log(`${fixMode ? 'Updated' : 'Detected'} rel attribute in ${file.relative}`);
  }
  return totalChanges;
}

async function checkBlogLinks(blogFiles, validPaths, redirectMatchers) {
  const errors = [];
  for (const file of blogFiles) {
    const content = await fs.readFile(file.fullPath, 'utf-8');
    const anchorPattern = /<a\s+[^>]*href=(['"])(.*?)\1/gi;
    let match;
    while ((match = anchorPattern.exec(content)) !== null) {
      const href = stripHashAndQuery(match[2]);
      if (!href) continue;
      const target = resolveInternalLink(file.fullPath, href);
      if (!target) continue;

      let normalizedTarget = normalizePath(target);
      try {
        const stats = await fs.stat(target);
        if (stats.isDirectory()) {
          const indexPath = path.join(target, 'index.html');
          normalizedTarget = normalizePath(indexPath);
        }
      } catch (error) {
        const indexPath = path.join(target, 'index.html');
        normalizedTarget = normalizePath(indexPath);
      }

      if (validPaths.has(normalizedTarget) === false && !matchesRedirectSource(href, redirectMatchers)) {
        errors.push({ source: file.relative, target: normalizedTarget });
      }
    }
  }
  return errors;
}

async function run() {
  const htmlFiles = [];
  await collectHtml(root, htmlFiles);
  const redirectMatchers = await loadRedirectMatchers();
  const blogFiles = htmlFiles.filter((file) => file.relative.startsWith('Blogs/'));
  const validPaths = new Set(htmlFiles.map((file) => normalizePath(file.fullPath)));
  const fixMode = process.argv.includes('--fix');

  if (blogFiles.length !== 84) {
    console.warn(`Indexed ${blogFiles.length} blog posts (expected ~84).`);
  }

  if (fixMode) {
    await fixRelAttributes(htmlFiles, true);
  } else {
    await fixRelAttributes(htmlFiles, false);
  }

  const linkErrors = await checkBlogLinks(blogFiles, validPaths, redirectMatchers);
  if (linkErrors.length) {
    console.error('Link checker found missing targets:');
    for (const error of linkErrors) {
      console.error(`  ${error.source} → ${error.target}`);
    }
  }

  console.log(`Validated ${blogFiles.length} blog posts.`);

  if (linkErrors.length) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
