import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://skyesol.netlify.app';

const pageMetadata = new Map([
  ['/', { changefreq: 'weekly', priority: '1.0' }],
  ['/about.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/platforms.html', { changefreq: 'monthly', priority: '0.8' }],
  ['/network.html', { changefreq: 'monthly', priority: '0.8' }],
  ['/credibility.html', { changefreq: 'monthly', priority: '0.8' }],
  ['/blog.html', { changefreq: 'weekly', priority: '0.9' }],
  ['/status.html', { changefreq: 'daily', priority: '0.6' }],
  ['/contact.html', { changefreq: 'monthly', priority: '0.7' }],
  ['/markets/index.html', { changefreq: 'weekly', priority: '0.8' }],
  ['/markets/phoenix-arizona/index.html', { changefreq: 'weekly', priority: '0.8' }],
  ['/markets/houston-texas/index.html', { changefreq: 'weekly', priority: '0.8' }],
  ['/markets/chicago-illinois/index.html', { changefreq: 'weekly', priority: '0.8' }],
  ['/markets/denver-colorado/index.html', { changefreq: 'weekly', priority: '0.8' }],
  ['/privacy.html', { changefreq: 'yearly', priority: '0.3' }],
  ['/terms.html', { changefreq: 'yearly', priority: '0.3' }],
  ['/sitemap-visual.html', { changefreq: 'monthly', priority: '0.5' }],
  ['/SkyeDocx/homepage.html', { changefreq: 'monthly', priority: '0.8' }],
  ['/SkyeDocx/index.html', { changefreq: 'monthly', priority: '0.7' }],
  ['/SkyeFlow/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeArchive/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeCollab/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeSheets/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeLedger/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeOps/index.html', { changefreq: 'monthly', priority: '0.9' }],
  ['/SkyeDrive/index.html', { changefreq: 'monthly', priority: '0.9' }]
]);

const skipDirs = new Set(['node_modules', 'css', 'js', 'netlify', '.git', '.github']);
const skipFiles = new Set(['Services/WebBuilds/WebBuilds.html']);
const skipPathPrefixes = [
  'Platforms-Apps-Infrastructure/2026/FounderTechPro /Full-EMAIL-Service-Database-Gmail+Neon-Replacements/skymail-mega-build/apps/skymail-web/'
];

async function shouldSkipFile(relativePath) {
  if (skipFiles.has(relativePath)) return true;
  if (skipPathPrefixes.some((prefix) => relativePath.startsWith(prefix))) return true;
  if (!relativePath.startsWith('Services/') || !relativePath.endsWith('/index.html')) return false;

  const siblingHtml = relativePath.slice(0, -'/index.html'.length) + '.html';
  try {
    await fs.access(path.join(root, siblingHtml));
    return true;
  } catch {
    return false;
  }
}

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
      const relative = path.relative(root, entryPath).replace(/\\/g, '/');
      if (await shouldSkipFile(relative)) continue;
      list.push({ fullPath: entryPath, relative });
    }
  }
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function extractMetaDate(content, property) {
  const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = regex.exec(content);
  return match ? match[1] : null;
}

function escapeXmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generate() {
  const pageFiles = [];
  await collectHtml(root, pageFiles);
  const blogFiles = pageFiles.filter((file) => file.relative.startsWith('Blogs/'));
  const otherFiles = pageFiles.filter((file) => !file.relative.startsWith('Blogs/'));

  const urlEntries = [];

  for (const file of otherFiles) {
    let route = '/' + file.relative;
    if (route === '/index.html') {
      route = '/';
    }
    const stats = await fs.stat(file.fullPath);
    const metadata = pageMetadata.get(route) ?? { changefreq: 'monthly', priority: '0.5' };
    const loc = new URL(route, siteUrl).toString();
    urlEntries.push({ loc, lastmod: formatDate(stats.mtime), ...metadata });
  }

  for (const file of blogFiles) {
    const content = await fs.readFile(file.fullPath, 'utf-8');
    const published = extractMetaDate(content, 'article:published_time');
    const modified = extractMetaDate(content, 'article:modified_time');
    let lastmodValue = modified ?? published;
    if (lastmodValue) {
      const parsed = new Date(lastmodValue);
      if (!Number.isNaN(parsed.getTime())) {
        lastmodValue = formatDate(parsed);
      } else {
        lastmodValue = null;
      }
    }
    if (!lastmodValue) {
      lastmodValue = formatDate((await fs.stat(file.fullPath)).mtime);
    }
    const relativeUrl = '/' + file.relative;
    const loc = new URL(relativeUrl, siteUrl).toString();
    urlEntries.push({ loc, lastmod: lastmodValue, changefreq: 'yearly', priority: '0.6' });
  }

  urlEntries.sort((a, b) => a.loc.localeCompare(b.loc));

  const xml = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`];
  for (const entry of urlEntries) {
    xml.push('  <url>');
    xml.push(`    <loc>${escapeXmlText(entry.loc)}</loc>`);
    if (entry.lastmod) {
      xml.push(`    <lastmod>${escapeXmlText(entry.lastmod)}</lastmod>`);
    }
    if (entry.changefreq) {
      xml.push(`    <changefreq>${escapeXmlText(entry.changefreq)}</changefreq>`);
    }
    if (entry.priority) {
      xml.push(`    <priority>${escapeXmlText(entry.priority)}</priority>`);
    }
    xml.push('  </url>');
  }
  xml.push('</urlset>');

  await fs.writeFile(path.join(root, 'sitemap.xml'), xml.join('\n') + '\n');
  console.log(`Generated sitemap with ${urlEntries.length} URLs.`);
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
