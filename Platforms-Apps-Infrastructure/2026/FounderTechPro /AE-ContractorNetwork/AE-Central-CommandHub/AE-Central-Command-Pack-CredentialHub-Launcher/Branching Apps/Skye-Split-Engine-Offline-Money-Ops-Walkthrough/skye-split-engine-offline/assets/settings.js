import { applyTheme, bootPage, getSettings, logActivity, readFileAsDataUrl, saveSettings } from './app-core.js';

async function init() {
  const settings = await bootPage('Settings + Visual Layer');
  const form = document.querySelector('#settingsForm');
  form.companyName.value = settings.companyName || 'Skyes Over London';
  form.appName.value = settings.appName || 'Skye Split Engine';
  form.currency.value = settings.currency || 'USD';
  form.backgroundMode.value = settings.backgroundMode || 'default';
  form.accentMode.value = settings.accentMode || 'gold-violet';
  form.autoSnapshot.checked = Boolean(settings.autoSnapshot);
  form.snapshotIntervalMinutes.value = settings.snapshotIntervalMinutes || 20;
  document.querySelector('#glassOpacity').value = settings.glassOpacity ?? 0.52;
  document.querySelector('#glassBlur').value = settings.glassBlur ?? 18;
  document.querySelector('[data-glass-opacity-value]').textContent = Number(settings.glassOpacity ?? 0.52).toFixed(2);
  document.querySelector('[data-glass-blur-value]').textContent = `${Number(settings.glassBlur ?? 18)}px`;

  document.querySelector('#glassOpacity').addEventListener('input', async (event) => {
    const value = Number(event.target.value);
    document.querySelector('[data-glass-opacity-value]').textContent = value.toFixed(2);
    applyTheme({ ...await getSettings(), glassOpacity: value });
  });

  document.querySelector('#glassBlur').addEventListener('input', async (event) => {
    const value = Number(event.target.value);
    document.querySelector('[data-glass-blur-value]').textContent = `${value}px`;
    applyTheme({ ...await getSettings(), glassBlur: value });
  });

  form.backgroundUpload.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const next = await saveSettings({ backgroundMode: 'upload', backgroundDataUrl: dataUrl });
    form.backgroundMode.value = 'upload';
    applyTheme(next);
    document.querySelector('[data-settings-result]').innerHTML = '<div class="success-box">Background saved locally in this browser.</div>';
    await logActivity('Background updated', file.name);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const next = await saveSettings({
      companyName: form.companyName.value.trim() || 'Skyes Over London',
      appName: form.appName.value.trim() || 'Skye Split Engine',
      currency: form.currency.value,
      backgroundMode: form.backgroundMode.value,
      accentMode: form.accentMode.value,
      autoSnapshot: form.autoSnapshot.checked,
      snapshotIntervalMinutes: Number(form.snapshotIntervalMinutes.value || 20),
      glassOpacity: Number(document.querySelector('#glassOpacity').value),
      glassBlur: Number(document.querySelector('#glassBlur').value)
    });
    applyTheme(next);
    document.querySelector('[data-settings-result]').innerHTML = '<div class="success-box">Settings saved locally.</div>';
    await logActivity('Settings updated', `${next.backgroundMode} · ${next.accentMode}`);
  });

  document.querySelector('[data-reset-background]').addEventListener('click', async () => {
    const next = await saveSettings({ backgroundMode: 'default', backgroundDataUrl: '' });
    form.backgroundMode.value = 'default';
    applyTheme(next);
    document.querySelector('[data-settings-result]').innerHTML = '<div class="success-box">Background reset to default.</div>';
    await logActivity('Background reset', 'default');
  });
}

init();
