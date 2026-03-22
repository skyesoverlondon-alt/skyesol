import { Client } from 'pg';

export async function withControlClient(connectionString, handler) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

export async function withDataClient(connectionString, databaseName, handler) {
  const url = new URL(connectionString);
  if (databaseName) {
    url.pathname = `/${databaseName}`;
  }
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

export function quoteIdent(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe identifier: ${value}`);
  }
  return `"${value}"`;
}

export async function terminateDbConnections(client, dbName) {
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [dbName],
  );
}
