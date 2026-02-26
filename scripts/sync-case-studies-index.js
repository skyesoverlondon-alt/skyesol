import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const caseStudiesDir = path.join(rootDir, 'Case Studies');
const indexFile = path.join(caseStudiesDir, 'index.html');

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

    const relPath = path.relative(caseStudiesDir, absolutePath).replaceAll(path.sep, '/');
    if (relPath.toLowerCase() === 'index.html') {
      continue;
    }

    files.push(relPath);
  }

  return files;
}

function toFilesBlock(files) {
  const lines = files.map((file) => `      '${file.replaceAll("'", "\\'")}',`);
  return `    const FILES = [\n${lines.join('\n')}\n    ];`;
}

async function run() {
  const files = (await collectHtmlFiles(caseStudiesDir)).sort((a, b) => a.localeCompare(b));
  const indexHtml = await fs.readFile(indexFile, 'utf8');

  const pattern = /const FILES = \[[\s\S]*?\];/;
  if (!pattern.test(indexHtml)) {
    throw new Error('Could not find `const FILES = [...]` block in Case Studies/index.html');
  }

  const nextIndexHtml = indexHtml.replace(pattern, toFilesBlock(files));
  await fs.writeFile(indexFile, nextIndexHtml, 'utf8');

  console.log(`Synced ${files.length} case study files into Case Studies/index.html`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
