#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const baseUrl = process.env.SITE_BASE_URL || 'https://skyesol.netlify.app';
const checkOnly = process.argv.includes('--check');

const defaultMeta = {
  title: 'Skyes Over London LC — SOLEnterprises Ecosystem',
  description: 'Governed AI platforms, multi-state operations, and execution-first leadership across the SOLEnterprises ecosystem.',
  image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png'
};

const pageMeta = {
  'index.html': {
    title: 'Skyes Over London LC — SOLEnterprises Ecosystem',
    description: 'SKYE·OPS // An Intelligence Ecosystem: governed AI platforms, policy enforcement, billing, and operator-grade UX across 13+ active portals.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png'
  },
  'about.html': {
    title: 'Founder — Skyes Over London LC',
    description: 'Executive operator, systems builder, and AI product engineer leading the SOLEnterprises ecosystem.',
    image: 'https://cdn1.sharemyimage.com/2026/02/23/ChatGPTImageFeb23202610_24_00AM.png'
  },
  'platforms.html': {
    title: 'Platforms — Kaixu AI Division',
    description: 'Gateway13, SkAIxu IDE, and Kaixu Push: governed AI routing, offline-first build suite, and patch-driven AI editor.',
    image: 'https://cdn1.sharemyimage.com/2026/02/17/Logo-2-1.png'
  },
  'blog.html': {
    title: 'Blog — SOLEnterprises Ecosystem',
    description: 'Research, field notes, and operational briefs from the SOLEnterprises network across Phoenix, Houston, and AI platforms.',
    image: 'https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png'
  },
  'network.html': {
    title: 'Network — SOL Ecosystem',
    description: 'Explore the SOLEnterprises network: 13+ active portals with governed AI, client vaults, and operator tooling.',
    image: 'https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png'
  }
};

const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildCanonical(relPath) {
  if (relPath === 'index.html') return `${baseUrl}/`;
  return `${baseUrl}/${relPath}`.replace(/\\/g, '/');
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
  return (str || '').replace(/"/g, "'");
}

function applyMeta(filePath) {
  const rel = path.relative(root, filePath);
  const file = path.basename(rel);
  const raw = fs.readFileSync(filePath, 'utf8');
  const meta = { ...defaultMeta, ...(pageMeta[file] || {}) };
  const url = buildCanonical(rel.replace(/^\.\//, ''));

  const tags = [
    { attr: 'name', name: 'description', value: sanitize(meta.description) },
    { attr: 'property', name: 'og:title', value: sanitize(meta.title) },
    { attr: 'property', name: 'og:description', value: sanitize(meta.description) },
    { attr: 'property', name: 'og:type', value: 'website' },
    { attr: 'property', name: 'og:image', value: meta.image },
    { attr: 'property', name: 'og:url', value: url },
    { attr: 'name', name: 'twitter:card', value: 'summary_large_image' },
    { attr: 'name', name: 'twitter:title', value: sanitize(meta.title) },
    { attr: 'name', name: 'twitter:description', value: sanitize(meta.description) },
    { attr: 'name', name: 'twitter:image', value: meta.image }
  ];

  let updated = raw;
  tags.forEach(t => { updated = upsertTag(updated, t, t.value); });
  updated = upsertLink(updated, 'canonical', url);

  return { changed: updated !== raw, output: updated };
}

function getHtmlFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(dir, f));
}

function run() {
  const files = getHtmlFiles(root);
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
