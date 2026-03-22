import { bootPage, decryptBackupObject, downloadFile, encryptBackupObject, exportAll, formatDate, getSettings, logActivity, readFileAsText, saveSettings, uid } from './app-core.js';
import { deleteOne, getAll, putOne, replaceAll } from './db.js';

async function renderSnapshotList() {
  const snapshots = (await getAll('snapshots')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const target = document.querySelector('[data-snapshot-list]');
  document.querySelector('[data-snapshot-count]').textContent = `${snapshots.length} in local vault`;
  target.innerHTML = snapshots.length ? snapshots.map((snap) => `
    <div class="snapshot-item">
      <div>
        <div class="split-label">${snap.label}</div>
        <div class="caption">${formatDate(snap.createdAt)}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-download-snapshot="${snap.id}">Download</button>
        <button class="btn-soft" data-restore-snapshot="${snap.id}">Restore</button>
        <button class="btn-danger" data-delete-snapshot="${snap.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="empty">No snapshots yet. Create one before large changes or before importing a backup.</div>';

  target.querySelectorAll('[data-download-snapshot]').forEach((button) => button.addEventListener('click', async () => {
    const snap = snapshots.find((item) => item.id === button.dataset.downloadSnapshot);
    if (!snap) return;
    downloadFile(`${snap.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, JSON.stringify(snap.payload, null, 2));
  }));

  target.querySelectorAll('[data-restore-snapshot]').forEach((button) => button.addEventListener('click', async () => {
    const snap = snapshots.find((item) => item.id === button.dataset.restoreSnapshot);
    if (!snap) return;
    const okay = confirm(`Restore ${snap.label}? This replaces current local data.`);
    if (!okay) return;
    await replaceAll(snap.payload);
    await logActivity('Snapshot restored', snap.label);
    document.querySelector('[data-restore-result]').innerHTML = `<div class="success-box">Restored ${snap.label}. Reload pages if you want to see refreshed counts immediately.</div>`;
  }));

  target.querySelectorAll('[data-delete-snapshot]').forEach((button) => button.addEventListener('click', async () => {
    const snap = snapshots.find((item) => item.id === button.dataset.deleteSnapshot);
    if (!snap) return;
    if (!confirm(`Delete ${snap.label}?`)) return;
    await deleteOne('snapshots', snap.id);
    await logActivity('Snapshot deleted', snap.label);
    await renderSnapshotList();
  }));
}

async function init() {
  const settings = await bootPage('Backup Vault');
  const exportStats = await exportAll();
  document.querySelector('[data-vault-stats]').textContent = `${exportStats.contacts.length} contacts · ${exportStats.splits.length} plans · ${exportStats.activity.length} activity records`;
  document.querySelector('[data-last-auto-snapshot]').textContent = settings.lastSnapshotAt ? formatDate(settings.lastSnapshotAt) : 'Never';

  document.querySelector('[data-create-snapshot]').addEventListener('click', async () => {
    const labelInput = document.querySelector('#snapshotLabel');
    const snapshot = {
      id: uid('snap'),
      label: labelInput.value.trim() || `Manual snapshot · ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      payload: await exportAll()
    };
    await putOne('snapshots', snapshot);
    await saveSettings({ lastSnapshotAt: snapshot.createdAt });
    await logActivity('Snapshot created', snapshot.label);
    labelInput.value = '';
    document.querySelector('[data-create-result]').innerHTML = `<div class="success-box">Created ${snapshot.label}.</div>`;
    await renderSnapshotList();
  });

  document.querySelector('[data-export-plain]').addEventListener('click', async () => {
    const payload = await exportAll();
    downloadFile(`skye-split-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
    await logActivity('Plain backup exported', 'JSON');
  });

  document.querySelector('[data-export-encrypted]').addEventListener('click', async () => {
    const passphrase = document.querySelector('#backupPassphrase').value;
    if (!passphrase || passphrase.length < 8) {
      alert('Use a passphrase with at least 8 characters.');
      return;
    }
    const payload = await exportAll();
    const encrypted = await encryptBackupObject(payload, passphrase);
    downloadFile(`skye-split-encrypted-backup-${new Date().toISOString().slice(0,10)}.skyevault`, JSON.stringify(encrypted, null, 2));
    await logActivity('Encrypted backup exported', 'AES-GCM');
    document.querySelector('[data-export-result]').innerHTML = '<div class="success-box">Encrypted backup exported. Keep the passphrase safe.</div>';
  });

  document.querySelector('[data-import-file]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      document.querySelector('[data-restore-result]').innerHTML = '<div class="warning-box">Could not parse that file.</div>';
      return;
    }

    try {
      let payload = parsed;
      if (parsed.kind === 'skye-split-encrypted-backup') {
        const passphrase = document.querySelector('#restorePassphrase').value;
        if (!passphrase) {
          alert('Enter the restore passphrase first.');
          return;
        }
        payload = await decryptBackupObject(parsed, passphrase);
      }
      if (!confirm('Restore this backup? Current local data will be replaced.')) return;
      await replaceAll(payload);
      await logActivity('Backup restored', file.name);
      document.querySelector('[data-restore-result]').innerHTML = `<div class="success-box">Restored backup from ${file.name}. Reload pages if needed.</div>`;
      await renderSnapshotList();
    } catch (error) {
      document.querySelector('[data-restore-result]').innerHTML = `<div class="warning-box">Restore failed. ${error.message}</div>`;
    }
  });

  await renderSnapshotList();
}

init();
