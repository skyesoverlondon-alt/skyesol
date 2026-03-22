import { bootPage, escapeHTML, formatCurrency, formatDate, getCounts, getRecentActivity, registerServiceWorker } from './app-core.js';
import { getAll } from './db.js';

async function init() {
  const settings = await bootPage('Money Ops Dashboard');
  await registerServiceWorker();
  const counts = await getCounts();
  const activity = await getRecentActivity(8);
  const splits = (await getAll('splits')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);
  const snapshots = (await getAll('snapshots')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  const deals = (await getAll('deals')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);
  const receipts = (await getAll('receipts')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);
  const templates = (await getAll('templates')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);

  document.querySelector('[data-metric-contacts]').textContent = counts.contacts;
  document.querySelector('[data-metric-splits]').textContent = counts.splits;
  document.querySelector('[data-metric-snapshots]').textContent = counts.snapshots;
  document.querySelector('[data-metric-total]').textContent = formatCurrency(counts.totalPlanned, settings.currency);
  document.querySelector('[data-metric-templates]').textContent = counts.templates;
  document.querySelector('[data-metric-deals]').textContent = counts.deals;
  document.querySelector('[data-metric-receipts]').textContent = counts.receipts;
  document.querySelector('[data-metric-pipeline]').textContent = formatCurrency(counts.totalPipeline, settings.currency);
  document.querySelector('[data-metric-last-snapshot]').textContent = settings.lastSnapshotAt ? formatDate(settings.lastSnapshotAt) : 'Not yet';

  document.querySelector('[data-recent-splits]').innerHTML = splits.length ? splits.map((plan) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(plan.title || 'Untitled split plan')}</div>
        <div class="caption">${escapeHTML(plan.methodLabel || plan.method || 'Split')} · ${formatDate(plan.updatedAt)}</div>
      </div>
      <div>
        <div>${formatCurrency(plan.summary?.distributable || 0, plan.currency || settings.currency)}</div>
        <div class="caption">${plan.participants?.length || 0} participants</div>
      </div>
    </div>
  `).join('') : '<div class="empty">No split plans saved yet.</div>';

  document.querySelector('[data-recent-snapshots]').innerHTML = snapshots.length ? snapshots.map((snap) => `
    <div class="snapshot-item">
      <div>
        <div class="split-label">${escapeHTML(snap.label || 'Snapshot')}</div>
        <div class="caption">${formatDate(snap.createdAt)}</div>
      </div>
      <div class="caption">Local vault</div>
    </div>
  `).join('') : '<div class="empty">No local snapshots yet.</div>';

  document.querySelector('[data-recent-deals]').innerHTML = deals.length ? deals.map((deal) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(deal.title || 'Untitled deal')}</div>
        <div class="caption">${escapeHTML(deal.client || 'No client')} · ${escapeHTML(deal.status || 'open')}</div>
      </div>
      <div>
        <div>${formatCurrency(deal.net || 0, settings.currency)}</div>
        <div class="caption">${deal.dueDate ? formatDate(deal.dueDate) : 'No due date'}</div>
      </div>
    </div>
  `).join('') : '<div class="empty">No deal ledger entries yet.</div>';

  document.querySelector('[data-recent-receipts]').innerHTML = receipts.length ? receipts.map((receipt) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(receipt.receiptNumber || 'Receipt')}</div>
        <div class="caption">${escapeHTML(receipt.recipient || 'No recipient')} · ${escapeHTML(receipt.status || 'issued')}</div>
      </div>
      <div>
        <div>${formatCurrency(receipt.amount || 0, settings.currency)}</div>
        <div class="caption">${receipt.settlementDate ? formatDate(receipt.settlementDate) : 'No settlement date'}</div>
      </div>
    </div>
  `).join('') : '<div class="empty">No settlement receipts saved yet.</div>';

  document.querySelector('[data-recent-templates]').innerHTML = templates.length ? templates.map((template) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(template.title || 'Template')}</div>
        <div class="caption">${escapeHTML(template.cadence || 'manual')} · ${escapeHTML(template.status || 'active')}</div>
      </div>
      <div class="caption">${template.nextRunDate ? formatDate(template.nextRunDate) : 'No next run'}</div>
    </div>
  `).join('') : '<div class="empty">No recurring payout templates yet.</div>';

  document.querySelector('[data-activity]').innerHTML = activity.length ? activity.map((item) => `
    <div class="activity-item">
      <div>
        <div class="split-label">${escapeHTML(item.message)}</div>
        <div class="caption">${escapeHTML(item.detail || '—')}</div>
      </div>
      <div class="caption">${formatDate(item.createdAt)}</div>
    </div>
  `).join('') : '<div class="empty">Activity will appear here as you work.</div>';
}

init();
