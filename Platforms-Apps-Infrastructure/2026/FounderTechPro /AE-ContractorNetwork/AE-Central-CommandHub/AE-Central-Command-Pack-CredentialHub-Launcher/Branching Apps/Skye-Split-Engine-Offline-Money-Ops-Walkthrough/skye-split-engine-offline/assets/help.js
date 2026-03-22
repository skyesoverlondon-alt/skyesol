import { bootPage, escapeHTML, formatDate, getRecentActivity } from './app-core.js';

async function init() {
  await bootPage('Offline Help');
  const activity = await getRecentActivity(10);
  const target = document.querySelector('[data-help-activity]');
  target.innerHTML = activity.length ? activity.map((item) => `
    <div class="activity-item">
      <div>
        <div class="split-label">${escapeHTML(item.message)}</div>
        <div class="caption">${escapeHTML(item.detail || '—')}</div>
      </div>
      <div class="caption">${formatDate(item.createdAt)}</div>
    </div>
  `).join('') : '<div class="empty">No activity yet. Once you use the app, your local activity lane will appear here.</div>';
}

init();
