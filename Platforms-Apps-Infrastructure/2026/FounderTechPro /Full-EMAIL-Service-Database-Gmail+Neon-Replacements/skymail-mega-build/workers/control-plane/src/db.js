import { Client } from 'pg';

export async function withClient(env, handler) {
  const client = new Client({
    connectionString: env.HYPERDRIVE?.connectionString || env.DATABASE_URL,
  });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

export async function transaction(client, handler) {
  await client.query('BEGIN');
  try {
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
