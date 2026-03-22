import { config } from './config.js';
import { withControlClient } from './db-admin.js';
import { pollAndRun } from './job-runner.js';

async function ensureControlSchema() {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const schemaPath = resolve(currentDir, '../../../database/control-schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  await withControlClient(config.controlDbUrl, async (client) => {
    await client.query(schema);
  });
}

async function main() {
  console.log('[runner] booting', { runnerId: config.runnerId });
  await ensureControlSchema();
  console.log('[runner] schema ready');

  for (;;) {
    try {
      const worked = await pollAndRun(config);
      if (worked) {
        console.log('[runner] job processed');
        continue;
      }
    } catch (error) {
      console.error('[runner] job failure', error);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error('[runner] fatal boot error', error);
  process.exit(1);
});
