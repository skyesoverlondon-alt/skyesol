export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = {
  runnerId: process.env.RUNNER_ID || 'hetzner-runner-1',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 4000),
  controlDbUrl: requireEnv('CONTROL_DATABASE_URL'),
  dataDbUrl: requireEnv('DATA_DATABASE_URL'),
  appEncryptionKey: requireEnv('APP_ENCRYPTION_KEY'),
  publicDbHost: requireEnv('PUBLIC_DB_HOST'),
  publicDbPort: Number(process.env.PUBLIC_DB_PORT || 5432),
  publicDbSslMode: process.env.PUBLIC_DB_SSLMODE || 'require',
  backupTempDir: process.env.BACKUP_TEMP_DIR || '/tmp/skyedb-backups',
  r2Endpoint: requireEnv('R2_ENDPOINT'),
  r2Region: process.env.R2_REGION || 'auto',
  r2AccessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  r2Bucket: requireEnv('R2_BUCKET'),
};
