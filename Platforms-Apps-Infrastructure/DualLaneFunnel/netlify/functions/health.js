const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  try {
    const hasDb = Boolean(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);
    let blobs = { available: false };
    try {
      const store = getStore('sol-intake');
      // lightweight write/read to confirm
      const key = `health/${Date.now()}`;
      await store.set(key, JSON.stringify({ ok: true }));
      blobs = { available: true, store: 'sol-intake' };
    } catch (e) {
      blobs = { available: false, error: 'Blobs not available or not configured in this environment.' };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        runtime: 'netlify-functions',
        db: { configured: hasDb, env: hasDb ? (process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' : 'DATABASE_URL') : null },
        blobs
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
