import { q } from './db.js';

/**
 * Enforce install/device binding and seat limits.
 *
 * Inputs:
 * - keyRow contains: api_key_id, customer_id
 * - install_id: string|null
 */
export async function enforceDevice({ keyRow, install_id, ua, actor = 'gateway' }) {
  const requireInstall = !!(keyRow.require_install_id || keyRow.customer_require_install_id);
  const maxDevices = (Number.isFinite(keyRow.max_devices) ? keyRow.max_devices : null) ?? (Number.isFinite(keyRow.customer_max_devices_per_key) ? keyRow.customer_max_devices_per_key : null);

  if ((requireInstall || (maxDevices != null && maxDevices > 0)) && !install_id) {
    return { ok: false, status: 400, error: 'Missing x-kaixu-install-id (required for this key)' };
  }

  // No install id and no enforcement
  if (!install_id) return { ok: true };

  // Load existing record
  const existing = await q(
    `select api_key_id, install_id, first_seen_at, last_seen_at, revoked_at
     from key_devices
     where api_key_id=$1 and install_id=$2
     limit 1`,
    [keyRow.api_key_id, install_id]
  );

  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.revoked_at) {
      return { ok: false, status: 403, error: 'Device revoked for this key' };
    }
    // Update last seen (best-effort)
    await q(
      `update key_devices set last_seen_at=now(), last_seen_ua=coalesce($3,last_seen_ua)
       where api_key_id=$1 and install_id=$2`,
      [keyRow.api_key_id, install_id, ua || null]
    );
    return { ok: true };
  }

  // New device: seat check
  if (maxDevices != null && maxDevices > 0) {
    const activeCount = await q(
      `select count(*)::int as n
       from key_devices
       where api_key_id=$1 and revoked_at is null`,
      [keyRow.api_key_id]
    );
    const n = activeCount.rows?.[0]?.n ?? 0;
    if (n >= maxDevices) {
      return { ok: false, status: 403, error: `Device limit reached (${n}/${maxDevices}). Revoke an old device or raise seats.` };
    }
  }

  // Insert new device
  await q(
    `insert into key_devices(api_key_id, customer_id, install_id, last_seen_at, last_seen_ua)
     values ($1,$2,$3,now(),$4)
     on conflict (api_key_id, install_id)
     do update set last_seen_at=excluded.last_seen_at, last_seen_ua=coalesce(excluded.last_seen_ua,key_devices.last_seen_ua)`,
    [keyRow.api_key_id, keyRow.customer_id, install_id, ua || null]
  );

  return { ok: true };
}

export async function listDevicesForKey(api_key_id, limit = 200) {
  const res = await q(
    `select api_key_id, install_id, device_label, first_seen_at, last_seen_at, revoked_at, revoked_by, last_seen_ua
     from key_devices
     where api_key_id=$1
     order by last_seen_at desc nulls last, first_seen_at desc
     limit $2`,
    [api_key_id, limit]
  );
  return res.rows;
}

export async function setDeviceRevoked({ api_key_id, install_id, revoked, actor = 'admin' }) {
  if (revoked) {
    await q(
      `update key_devices
       set revoked_at=now(), revoked_by=$3
       where api_key_id=$1 and install_id=$2 and revoked_at is null`,
      [api_key_id, install_id, actor]
    );
  } else {
    await q(
      `update key_devices
       set revoked_at=null, revoked_by=null
       where api_key_id=$1 and install_id=$2 and revoked_at is not null`,
      [api_key_id, install_id]
    );
  }
}
