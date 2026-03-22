#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const baseUrl = process.env.SITE_BASE_URL || 'https://skyesol.netlify.app';
const checkOnly = process.argv.includes('--check');

const managedRoots = ['.', 'Services', 'contact', 'leadership', 'resources', 'status', 'markets'];
const skipDirs = new Set(['node_modules', '.git', '.github', 'netlify', 'css', 'js']);

const defaultMeta = {
  title: 'Skyes Over London LC — SOLEnterprises Ecosystem',
  description: 'Skyes Over London LC builds AI systems, web platforms, ecommerce flows, intake automation, and SEO content for operators across Phoenix, Houston, Chicago, and Denver.',
  image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
  keywords: 'Skyes Over London LC, Phoenix web development, Houston AI systems, Chicago business automation, Denver SEO content, portals, ecommerce, intake routing, SOLEnterprises',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
};

const pageMeta = {
  'index.html': {
    title: 'Skyes Over London LC — SOLEnterprises Ecosystem',
    description: 'Phoenix, Houston, Chicago, and Denver operator systems: governed AI platforms, policy enforcement, billing, web infrastructure, and execution-first delivery across the SOLEnterprises ecosystem.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Phoenix AI company, Houston web development, Chicago automation, Denver SEO, AI platforms, portals, ecommerce systems, Skyes Over London LC'
  },
  'about.html': {
    title: 'About Skyes Over London LC | Phoenix AI, Web, and Operations Infrastructure',
    description: 'Executive operator, systems builder, and AI product engineer behind Skyes Over London LC, the public face of the SOLEnterprises ecosystem serving Phoenix, Houston, Chicago, and Denver.',
    image: 'https://cdn1.sharemyimage.com/2026/03/03/Gemini_Generated_Image_5aft6s5aft6s5aft-1.png',
    keywords: 'About Skyes Over London LC, SOLEnterprises ecosystem, Phoenix AI founder, Houston operations systems, Chicago digital platforms, Denver automation'
  },
  'platforms.html': {
    title: 'Platforms — Kaixu AI Division',
    description: 'Gateway13, SkAIxu IDE, and Kaixu Push deliver governed AI routing, offline-first builds, and operator workflows for teams in Phoenix, Houston, Chicago, and Denver.',
    image: 'https://cdn1.sharemyimage.com/2026/02/17/Logo-2-1.png',
    keywords: 'AI platforms Phoenix, Houston AI governance, Chicago workflow automation, Denver operator tools, Gateway13, SkAIxu IDE, Kaixu Push'
  },
  'blog.html': {
    title: 'Blog — SOLEnterprises Ecosystem',
    description: 'Research, field notes, market pages, and operational briefs covering Phoenix, Houston, Chicago, Denver, AI systems, web builds, and automation.',
    image: 'https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png',
    keywords: 'Phoenix SEO blog, Houston AI editorial, Chicago business systems content, Denver technology editorial, Skyes Over London LC blog'
  },
  'network.html': {
    title: 'Network — SOL Ecosystem',
    description: 'Explore the SOLEnterprises network: 13+ active portals with governed AI, client vaults, operator tooling, and multi-state service coverage.',
    image: 'https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png',
    keywords: 'SOLEnterprises network, governed AI portals, Phoenix operator systems, Houston automation network, Chicago and Denver digital infrastructure'
  },
  'contact.html': {
    title: 'Contact Skyes Over London LC | Phoenix, Houston, Chicago, Denver',
    description: 'Contact Skyes Over London LC for AI systems, web platforms, ecommerce, intake routing, SEO content, and multi-state operations in Phoenix, Houston, Chicago, and Denver.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'contact Skyes Over London LC, Phoenix web development contact, Houston AI systems contact, Chicago automation contact, Denver SEO contact'
  },
  'contact/index.html': {
    title: 'Contact Skyes Over London LC | Phoenix, Houston, Chicago, Denver',
    description: 'Reach Skyes Over London LC for governed AI, web builds, portals, ecommerce, automation, and SEO execution across Phoenix, Houston, Chicago, and Denver.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Skyes Over London contact, Phoenix AI systems, Houston web build, Chicago workflow automation, Denver SEO execution'
  },
  'markets/index.html': {
    title: 'Service Areas — Phoenix, Houston, Chicago, Denver | Skyes Over London LC',
    description: 'Service-area hub for Skyes Over London LC across Phoenix, Houston, Chicago, and Denver covering AI systems, web development, portals, ecommerce, and SEO content.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'service areas Phoenix Houston Chicago Denver, AI systems, web development, ecommerce, SEO content'
  },
  'markets/phoenix-arizona/index.html': {
    title: 'Phoenix, Arizona AI Systems, Web Development, and SEO | Skyes Over London LC',
    description: 'Phoenix, Arizona AI systems, web development, SEO, client portals, ecommerce builds, and intake automation for service businesses, founder-led brands, and operator teams across Phoenix, Scottsdale, Tempe, Mesa, and Glendale.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Phoenix Arizona AI systems, Phoenix web development for service businesses, Phoenix SEO for local companies, Scottsdale web design, Tempe automation systems, Mesa intake automation, Glendale ecommerce development'
  },
  'markets/houston-texas/index.html': {
    title: 'Houston, Texas AI Systems, Web Development, and SEO | Skyes Over London LC',
    description: 'Houston, Texas AI systems, web development, portals, SEO, and intake automation for industrial teams, field operations, logistics groups, healthcare operators, and B2B service companies across Houston, Sugar Land, Katy, The Woodlands, and Pearland.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Houston Texas AI systems, Houston web development for B2B service companies, Houston workflow automation, Houston portal development, Sugar Land web development, Katy operations systems, The Woodlands SEO content'
  },
  'markets/chicago-illinois/index.html': {
    title: 'Chicago, Illinois AI Systems, Web Development, and SEO | Skyes Over London LC',
    description: 'Chicago, Illinois AI systems, web development, portals, SEO, and intake automation for professional services, multi-location businesses, ecommerce operators, and growth-stage teams across Chicago, Naperville, Schaumburg, Evanston, and Oak Brook.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Chicago Illinois AI systems, Chicago web development for professional services, Chicago SEO for local businesses, Chicago ecommerce development, Naperville portal development, Schaumburg intake automation, Oak Brook growth systems'
  },
  'markets/denver-colorado/index.html': {
    title: 'Denver, Colorado AI Systems, Web Development, and SEO | Skyes Over London LC',
    description: 'Denver, Colorado AI systems, web development, portals, SEO, and automation for service businesses, SaaS operators, founder-led brands, and regional teams across Denver, Boulder, Aurora, Lakewood, and Colorado Springs.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png',
    keywords: 'Denver Colorado AI systems, Denver web development for service businesses, Denver SEO content strategy, Denver portal development, Boulder automation systems, Aurora ecommerce development, Colorado Springs web strategy'
  }
};

const legacyDescriptions = new Set([
  'Governed AI platforms, multi-state operations, and execution-first leadership across the SOLEnterprises ecosystem.',
  'SKYE·OPS // An Intelligence Ecosystem: governed AI platforms, policy enforcement, billing, and operator-grade UX across 13+ active portals.'
]);

const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildCanonical(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized === 'index.html') return `${baseUrl}/`;
  if (normalized.endsWith('/index.html')) {
    return `${baseUrl}/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `${baseUrl}/${normalized}`;
}

function upsertTag(html, key, value) {
  const tag = `<meta ${key.attr}="${key.name}" content="${value}">`;
  const re = new RegExp(`<meta[^>]+(?:name|property)="${escapeRegExp(key.name)}"[^>]*>`, 'i');
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return insertAfterHead(html, tag);
}

function upsertLink(html, rel, href) {
  const tag = `<link rel="${rel}" href="${href}">`;
  const re = new RegExp(`<link[^>]+rel=\"${escapeRegExp(rel)}\"[^>]*>`, 'i');
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return insertAfterHead(html, tag);
}

function insertAfterHead(html, snippet) {
  const headMatch = html.match(/<head[^>]*>/i);
  if (!headMatch) return html;
  const insertPos = headMatch.index + headMatch[0].length;
  return html.slice(0, insertPos) + '\n  ' + snippet + html.slice(insertPos);
}

function sanitize(str) {
  return String(str || '').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
}

function getMetaContent(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${escapeRegExp(name)}"[^>]+content="([^"]*)"[^>]*>`, 'i');
  const match = html.match(re);
  return match ? sanitize(match[1]) : '';
}

function getTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? sanitize(match[1]) : '';
}

function upsertTitle(html, value) {
  const tag = `<title>${value}</title>`;
  if (/<title>[^<]*<\/title>/i.test(html)) {
    return html.replace(/<title>[^<]*<\/title>/i, tag);
  }
  return insertAfterHead(html, tag);
}

function deriveDescription(relPath, title) {
  const cleanedTitle = sanitize(title || '').replace(/\s*[|\-:].*$/, '');
  const routeName = relPath
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]+/g, ' ');
  const subject = cleanedTitle || routeName || 'This page';
  return `${subject} from Skyes Over London LC — AI systems, web development, portals, ecommerce, intake automation, and SEO content for Phoenix, Houston, Chicago, and Denver.`;
}

function applyMeta(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const raw = fs.readFileSync(filePath, 'utf8');
  const override = pageMeta[rel] || {};
  const existingTitle = getTitle(raw);
  const existingDescription = getMetaContent(raw, 'description');
  const existingKeywords = getMetaContent(raw, 'keywords');
  const existingRobots = getMetaContent(raw, 'robots');
  const existingImage = getMetaContent(raw, 'og:image') || getMetaContent(raw, 'twitter:image');
  const title = sanitize(override.title || existingTitle || defaultMeta.title);
  const description = sanitize(
    override.description ||
    (!existingDescription || legacyDescriptions.has(existingDescription)
      ? deriveDescription(rel, title)
      : existingDescription)
  );
  const image = sanitize(override.image || existingImage || defaultMeta.image);
  const keywords = sanitize(override.keywords || existingKeywords || defaultMeta.keywords);
  const robots = sanitize(override.robots || existingRobots || defaultMeta.robots);
  const url = buildCanonical(rel);
  const ogType = rel.startsWith('Blogs/') ? 'article' : 'website';

  const tags = [
    { attr: 'name', name: 'description', value: description },
    { attr: 'name', name: 'keywords', value: keywords },
    { attr: 'name', name: 'robots', value: robots },
    { attr: 'property', name: 'og:title', value: title },
    { attr: 'property', name: 'og:description', value: description },
    { attr: 'property', name: 'og:type', value: ogType },
    { attr: 'property', name: 'og:image', value: image },
    { attr: 'property', name: 'og:url', value: url },
    { attr: 'name', name: 'twitter:card', value: 'summary_large_image' },
    { attr: 'name', name: 'twitter:title', value: title },
    { attr: 'name', name: 'twitter:description', value: description },
    { attr: 'name', name: 'twitter:image', value: image }
  ];

  let updated = raw;
  updated = upsertTitle(updated, title);
  tags.forEach(t => { updated = upsertTag(updated, t, t.value); });
  updated = upsertLink(updated, 'canonical', url);

  return { changed: updated !== raw, output: updated };
}

function collectHtmlFiles(dir, bucket) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (entry.name.startsWith('.')) return;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) return;
      collectHtmlFiles(path.join(dir, entry.name), bucket);
      return;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      bucket.push(path.join(dir, entry.name));
    }
  });
}

function getHtmlFiles() {
  const files = [];
  managedRoots.forEach(target => {
    const absolute = path.join(root, target);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      if (target === '.') {
        fs.readdirSync(absolute, { withFileTypes: true }).forEach(entry => {
          if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(path.join(absolute, entry.name));
          }
        });
        return;
      }
      collectHtmlFiles(absolute, files);
      return;
    }
    if (stat.isFile() && absolute.endsWith('.html')) {
      files.push(absolute);
    }
  });
  return Array.from(new Set(files)).sort();
}

function run() {
  const files = getHtmlFiles();
  if (!files.length) {
    console.log('No HTML files found to process.');
    return;
  }
  const changed = [];
  files.forEach(file => {
    const { changed: isChanged, output } = applyMeta(file);
    if (isChanged) {
      if (!checkOnly) fs.writeFileSync(file, output, 'utf8');
      changed.push(path.relative(root, file));
    }
  });

  if (changed.length) {
    if (checkOnly) {
      console.error(`Metadata drift detected in: ${changed.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log(`Injected/updated metadata for: ${changed.join(', ')}`);
    }
  } else {
    console.log('Metadata already up to date.');
  }
}

run();
