import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';

import { decryptText } from './crypto.js';
import { withControlClient, withDataClient, quoteIdent, terminateDbConnections } from './db-admin.js';
import { createR2Client, uploadFile, downloadFile } from './r2.js';

async function logAudit(control, actor, entityType, entityId, action, details = {}, orgId = null, actorUserId = null) {
  await control.query(
    'INSERT INTO audit_events (id, org_id, actor_user_id, actor, entity_type, entity_id, action, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [crypto.randomUUID(), orgId || null, actorUserId || null, actor, entityType, entityId || null, action, JSON.stringify(details)],
  );
}

async function logUsage(control, payload) {
  await control.query(
    `INSERT INTO usage_events (id, org_id, project_id, environment_id, instance_id, event_type, quantity, unit, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      crypto.randomUUID(),
      payload.org_id,
      payload.project_id || null,
      payload.environment_id || null,
      payload.instance_id || null,
      payload.event_type,
      payload.quantity ?? 1,
      payload.unit || 'count',
      JSON.stringify(payload.metadata || {}),
    ],
  );
}

function runCommand(command, args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...envOverrides } });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function connectionStringForDatabase(baseUrl, dbName) {
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function ensureTempDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  const { createReadStream } = await import('node:fs');
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function takeNextJob(controlDbUrl, runnerId) {
  return withControlClient(controlDbUrl, async (control) => {
    await control.query('BEGIN');
    try {
      const pick = await control.query(`
        SELECT id
        FROM jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const jobId = pick.rows[0]?.id;
      if (!jobId) {
        await control.query('ROLLBACK');
        return null;
      }
      const update = await control.query(`
        UPDATE jobs
        SET status = 'running', worker_id = $2, locked_at = now(), started_at = now(), error = NULL
        WHERE id = $1
        RETURNING *
      `, [jobId, runnerId]);
      await control.query('COMMIT');
      return update.rows[0];
    } catch (error) {
      await control.query('ROLLBACK');
      throw error;
    }
  });
}

async function finishJob(controlDbUrl, jobId, result) {
  return withControlClient(controlDbUrl, async (control) => {
    await control.query(`
      UPDATE jobs
      SET status = 'succeeded', result = $2, completed_at = now(), error = NULL
      WHERE id = $1
    `, [jobId, JSON.stringify(result || {})]);
  });
}

async function failJob(controlDbUrl, jobId, errorMessage) {
  return withControlClient(controlDbUrl, async (control) => {
    await control.query(`
      UPDATE jobs
      SET status = 'failed', error = $2, completed_at = now()
      WHERE id = $1
    `, [jobId, errorMessage]);
  });
}

async function handleCreateDatabase(config, job) {
  const payload = job.payload || {};
  const password = decryptText(config.appEncryptionKey, payload.password_ciphertext);
  const dbName = payload.db_name;
  const dbUser = payload.db_user;

  await withDataClient(config.dataDbUrl, 'postgres', async (data) => {
    await data.query(`CREATE ROLE ${quoteIdent(dbUser)} LOGIN PASSWORD $1`, [password]);
    await data.query(`CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(dbUser)} TEMPLATE template0 ENCODING 'UTF8'`);
  });

  await withControlClient(config.controlDbUrl, async (control) => {
    await control.query(`UPDATE database_instances SET status = 'ready' WHERE id = $1`, [job.instance_id]);
    await logAudit(control, job.requested_by, 'database_instance', job.instance_id, 'created', { db_name: dbName, db_user: dbUser }, job.org_id, job.requested_by_user_id);
    await logUsage(control, {
      org_id: job.org_id,
      project_id: job.project_id,
      environment_id: job.environment_id,
      instance_id: job.instance_id,
      event_type: 'database_created',
      quantity: 1,
      unit: 'database',
      metadata: { db_name: dbName },
    });
  });

  return { instance_id: job.instance_id, db_name: dbName, db_user: dbUser, status: 'ready' };
}

async function handleBranchDatabase(config, job) {
  const payload = job.payload || {};
  const sourceDbName = payload.source_db_name;
  const newDbName = payload.new_db_name;
  const newDbUser = payload.new_db_user;
  const password = decryptText(config.appEncryptionKey, payload.password_ciphertext);

  await withDataClient(config.dataDbUrl, 'postgres', async (data) => {
    await terminateDbConnections(data, sourceDbName);
    await data.query(`CREATE ROLE ${quoteIdent(newDbUser)} LOGIN PASSWORD $1`, [password]);
    await data.query(`CREATE DATABASE ${quoteIdent(newDbName)} OWNER ${quoteIdent(newDbUser)} TEMPLATE ${quoteIdent(sourceDbName)}`);
  });

  await withControlClient(config.controlDbUrl, async (control) => {
    await control.query(`UPDATE database_instances SET status = 'ready' WHERE id = $1`, [job.instance_id]);
    await logAudit(control, job.requested_by, 'database_instance', job.instance_id, 'branched', { source_db_name: sourceDbName, db_name: newDbName, db_user: newDbUser }, job.org_id, job.requested_by_user_id);
    await logUsage(control, {
      org_id: job.org_id,
      project_id: job.project_id,
      environment_id: job.environment_id,
      instance_id: job.instance_id,
      event_type: 'database_branched',
      quantity: 1,
      unit: 'database',
      metadata: { source_db_name: sourceDbName, db_name: newDbName },
    });
  });

  return { instance_id: job.instance_id, source_db_name: sourceDbName, db_name: newDbName, status: 'ready' };
}

async function handleRotatePassword(config, job) {
  const payload = job.payload || {};
  const newPassword = decryptText(config.appEncryptionKey, payload.new_password_ciphertext);
  const dbUser = payload.db_user;

  await withDataClient(config.dataDbUrl, 'postgres', async (data) => {
    await data.query(`ALTER ROLE ${quoteIdent(dbUser)} PASSWORD $1`, [newPassword]);
  });

  await withControlClient(config.controlDbUrl, async (control) => {
    await control.query(`
      UPDATE database_instances
      SET password_ciphertext = $2, last_rotation_at = now()
      WHERE id = $1
    `, [job.instance_id, payload.new_password_ciphertext]);
    await logAudit(control, job.requested_by, 'database_instance', job.instance_id, 'password_rotated', { db_user: dbUser }, job.org_id, job.requested_by_user_id);
    await logUsage(control, {
      org_id: job.org_id,
      project_id: job.project_id,
      environment_id: job.environment_id,
      instance_id: job.instance_id,
      event_type: 'password_rotated',
      quantity: 1,
      unit: 'operation',
      metadata: { db_user: dbUser },
    });
  });

  return { instance_id: job.instance_id, db_user: dbUser, rotated: true };
}

async function handleBackupDatabase(config, job) {
  const payload = job.payload || {};
  const backupId = payload.backup_id;
  const r2 = createR2Client(config);
  await ensureTempDir(config.backupTempDir);

  const controlData = await withControlClient(config.controlDbUrl, async (control) => {
    const result = await control.query('SELECT id, db_name FROM database_instances WHERE id = $1', [job.instance_id]);
    return result.rows[0];
  });
  if (!controlData) throw new Error('Instance not found for backup');

  const filePath = path.join(config.backupTempDir, `${controlData.db_name}-${backupId}.dump`);
  const dbConn = connectionStringForDatabase(config.dataDbUrl, controlData.db_name);
  await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--dbname', dbConn, '--file', filePath]);

  const checksum = await sha256File(filePath);
  const fileStats = await stat(filePath);
  const objectKey = `backups/${controlData.db_name}/${backupId}.dump`;
  await uploadFile(r2, config.r2Bucket, objectKey, filePath, 'application/octet-stream');

  await withControlClient(config.controlDbUrl, async (control) => {
    await control.query(`
      UPDATE backups
      SET status = 'succeeded', object_key = $2, size_bytes = $3, sha256 = $4, completed_at = now()
      WHERE id = $1
    `, [backupId, objectKey, fileStats.size, checksum]);
    await logAudit(control, job.requested_by, 'backup', backupId, 'backup_completed', { object_key: objectKey, size_bytes: fileStats.size, sha256: checksum }, job.org_id, job.requested_by_user_id);
    await logUsage(control, {
      org_id: job.org_id,
      project_id: job.project_id,
      environment_id: job.environment_id,
      instance_id: job.instance_id,
      event_type: 'backup_completed',
      quantity: fileStats.size,
      unit: 'bytes',
      metadata: { object_key: objectKey, backup_id: backupId },
    });
  });

  await rm(filePath, { force: true });
  return { backup_id: backupId, object_key: objectKey, size_bytes: fileStats.size, sha256: checksum };
}

async function handleRestoreDatabase(config, job) {
  const payload = job.payload || {};
  const restoreId = payload.restore_id;
  const backupId = payload.backup_id;
  const r2 = createR2Client(config);
  await ensureTempDir(config.backupTempDir);

  const data = await withControlClient(config.controlDbUrl, async (control) => {
    const result = await control.query(`
      SELECT di.id, di.db_name, di.db_user, b.object_key
      FROM database_instances di
      JOIN backups b ON b.id = $2 AND b.instance_id = di.id
      WHERE di.id = $1
    `, [job.instance_id, backupId]);
    return result.rows[0];
  });
  if (!data) throw new Error('Restore target or backup not found');

  const tempPath = path.join(config.backupTempDir, `${data.db_name}-${backupId}-restore.dump`);
  await downloadFile(r2, config.r2Bucket, data.object_key, tempPath);

  await withDataClient(config.dataDbUrl, 'postgres', async (db) => {
    await terminateDbConnections(db, data.db_name);
    await db.query(`DROP DATABASE IF EXISTS ${quoteIdent(data.db_name)}`);
    await db.query(`CREATE DATABASE ${quoteIdent(data.db_name)} OWNER ${quoteIdent(data.db_user)} TEMPLATE template0 ENCODING 'UTF8'`);
  });

  const restoreConn = connectionStringForDatabase(config.dataDbUrl, data.db_name);
  await runCommand('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', restoreConn, tempPath]);

  await withControlClient(config.controlDbUrl, async (control) => {
    await control.query(`UPDATE restores SET status = 'succeeded', completed_at = now() WHERE id = $1`, [restoreId]);
    await logAudit(control, job.requested_by, 'restore', restoreId, 'restore_completed', { backup_id: backupId, object_key: data.object_key, db_name: data.db_name }, job.org_id, job.requested_by_user_id);
    await logUsage(control, {
      org_id: job.org_id,
      project_id: job.project_id,
      environment_id: job.environment_id,
      instance_id: job.instance_id,
      event_type: 'restore_completed',
      quantity: 1,
      unit: 'operation',
      metadata: { backup_id: backupId, restore_id: restoreId },
    });
  });

  await rm(tempPath, { force: true });
  return { restore_id: restoreId, backup_id: backupId, db_name: data.db_name, restored: true };
}

async function processJob(config, job) {
  switch (job.job_type) {
    case 'create_database':
      return handleCreateDatabase(config, job);
    case 'branch_database':
      return handleBranchDatabase(config, job);
    case 'rotate_password':
      return handleRotatePassword(config, job);
    case 'backup_database':
      return handleBackupDatabase(config, job);
    case 'restore_database':
      return handleRestoreDatabase(config, job);
    default:
      throw new Error(`Unsupported job type: ${job.job_type}`);
  }
}

export async function pollAndRun(config) {
  const job = await takeNextJob(config.controlDbUrl, config.runnerId);
  if (!job) return false;

  try {
    const result = await processJob(config, job);
    await finishJob(config.controlDbUrl, job.id, result);
  } catch (error) {
    await failJob(config.controlDbUrl, job.id, error.message || 'Runner failure');
    if (job.job_type === 'backup_database') {
      const payload = job.payload || {};
      if (payload.backup_id) {
        await withControlClient(config.controlDbUrl, async (control) => {
          await control.query(`UPDATE backups SET status = 'failed' WHERE id = $1`, [payload.backup_id]);
        });
      }
    }
    if (job.job_type === 'restore_database') {
      const payload = job.payload || {};
      if (payload.restore_id) {
        await withControlClient(config.controlDbUrl, async (control) => {
          await control.query(`UPDATE restores SET status = 'failed' WHERE id = $1`, [payload.restore_id]);
        });
      }
    }
    throw error;
  }
  return true;
}
