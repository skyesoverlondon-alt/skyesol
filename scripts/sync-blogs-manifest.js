import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const blogsDir = path.join(rootDir, 'Blogs');
const outFile = path.join(blogsDir, 'blog-manifest.json');

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function extractMeta(content, attrs) {
  const attrsPattern = Object.entries(attrs)
    .map(([k, v]) => `(?=[^>]*${k}=["']${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])`)
    .join('');
  const regex = new RegExp(`<meta${attrsPattern}[^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const match = regex.exec(content);
  return match ? match[1].trim() : null;
}

function extractTitle(content) {
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(content);
  if (!titleMatch) return null;
  return titleMatch[1].replace(/\s+/g, ' ').trim();
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function toSlug(relPath) {
  const normalized = relPath
    .replace(/\.html$/i, '')
    .replaceAll(path.sep, '/')
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9/\-_\s]/g, '')
    .replaceAll('/', '-')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferTags(relPath, keywordMeta) {
  const tags = new Set();
  const parts = relPath.replaceAll(path.sep, '/').split('/').slice(0, -1);
  parts.forEach((part) => {
    const cleaned = normalizeWhitespace(part.replace(/[-_]+/g, ' '));
    if (cleaned && cleaned.toLowerCase() !== 'blogs') tags.add(cleaned);
  });

  if (keywordMeta) {
    keywordMeta
      .split(',')
      .map((t) => normalizeWhitespace(t))
      .filter(Boolean)
      .slice(0, 8)
      .forEach((t) => tags.add(t));
  }

  return [...tags];
}

async function collectHtmlFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) {
      continue;
    }

    const relPath = path.relative(blogsDir, absolutePath).replaceAll(path.sep, '/');
    if (relPath.toLowerCase() === 'template.html') {
      continue;
    }

    files.push({ absolutePath, relPath });
  }

  return files;
}

async function buildManifestEntry(fileRecord) {
  const { absolutePath, relPath } = fileRecord;
  const html = await fs.readFile(absolutePath, 'utf8');
  const stats = await fs.stat(absolutePath);

  const ogTitle = extractMeta(html, { property: 'og:title' });
  const twTitle = extractMeta(html, { name: 'twitter:title' });
  const title = normalizeWhitespace(ogTitle || twTitle || extractTitle(html) || path.basename(relPath, '.html'));

  const ogDesc = extractMeta(html, { property: 'og:description' });
  const twDesc = extractMeta(html, { name: 'twitter:description' });
  const desc = normalizeWhitespace(ogDesc || twDesc || extractMeta(html, { name: 'description' }) || '');

  const publishedRaw =
    extractMeta(html, { property: 'article:published_time' }) ||
    extractMeta(html, { name: 'article:published_time' }) ||
    extractMeta(html, { property: 'article:modified_time' }) ||
    extractMeta(html, { name: 'article:modified_time' });

  const publishedAt = safeDate(publishedRaw) || stats.mtime.toISOString();
  const keywordMeta = extractMeta(html, { name: 'keywords' });

  return {
    slug: toSlug(relPath),
    title,
    excerpt: desc,
    published_at: publishedAt,
    tags: inferTags(relPath, keywordMeta),
    staticUrl: `Blogs/${relPath.replaceAll(' ', '%20')}`,
  };
}

async function run() {
  const files = await collectHtmlFiles(blogsDir);
  const entries = await Promise.all(files.map((fileRecord) => buildManifestEntry(fileRecord)));

  entries.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  await fs.writeFile(outFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), posts: entries }, null, 2)}\n`, 'utf8');
  console.log(`Synced ${entries.length} blog files into Blogs/blog-manifest.json`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
