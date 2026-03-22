import { bootPage, calcSplitPlan, downloadFile, escapeHTML, formatCurrency, formatDate, logActivity, maybeAutoSnapshot, parseCSV, slugify, toCSV, uid } from './app-core.js';
import { batchPut, deleteOne, getAll, putOne } from './db.js';

let settings;
let splits = [];
let contacts = [];
let templates = [];
let deals = [];
let editingTemplateId = null;
let editingDealId = null;

function addDays(dateInput, days) {
  const date = new Date(dateInput || new Date());
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function nextDateByCadence(dateInput, cadence) {
  const date = new Date(dateInput || new Date());
  if (cadence === 'weekly') date.setDate(date.getDate() + 7);
  else if (cadence === 'biweekly') date.setDate(date.getDate() + 14);
  else if (cadence === 'monthly') date.setMonth(date.getMonth() + 1);
  else if (cadence === 'quarterly') date.setMonth(date.getMonth() + 3);
  else if (cadence === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function valueOrEmpty(v) {
  return v == null ? '' : v;
}

function getTemplateSourceOptions() {
  return splits.map((plan) => `<option value="${escapeHTML(plan.id)}">${escapeHTML(plan.title || 'Untitled split plan')}</option>`).join('');
}

function getContactOptions() {
  return contacts.map((contact) => `<option value="${escapeHTML(contact.id)}">${escapeHTML(contact.name)}</option>`).join('');
}

function templateSummaryCard() {
  const active = templates.filter((t) => (t.status || 'active') === 'active').length;
  const due = templates.filter((t) => t.nextRunDate && new Date(t.nextRunDate) <= new Date()).length;
  const gross = templates.reduce((sum, item) => sum + Number(item.defaultGross || 0), 0);
  return `
    <div class="small-card metric"><div class="label">Templates</div><div class="value">${templates.length}</div><div class="caption">${active} active</div></div>
    <div class="small-card metric"><div class="label">Due now</div><div class="value">${due}</div><div class="caption">Ready to run</div></div>
    <div class="small-card metric"><div class="label">Ledger rows</div><div class="value">${deals.length}</div><div class="caption">Open + closed deals</div></div>
    <div class="small-card metric"><div class="label">Template gross</div><div class="value">${formatCurrency(gross, settings.currency)}</div><div class="caption">Across saved templates</div></div>
  `;
}

function dealNet(payload) {
  return Number(payload.gross || 0) - Number(payload.fees || 0) - Number(payload.reserve || 0) - Number(payload.misc || 0);
}

function fillTemplateForm(template = null) {
  const form = document.querySelector('#templateForm');
  editingTemplateId = template?.id || null;
  form.templateTitle.value = template?.title || '';
  form.sourcePlanId.innerHTML = '<option value="">Choose saved split plan</option>' + getTemplateSourceOptions();
  form.sourcePlanId.value = template?.sourcePlanId || '';
  form.cadence.value = template?.cadence || 'monthly';
  form.startDate.value = template?.startDate ? new Date(template.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  form.nextRunDate.value = template?.nextRunDate ? new Date(template.nextRunDate).toISOString().slice(0, 10) : addDays(new Date(), 30).slice(0, 10);
  form.defaultGross.value = valueOrEmpty(template?.defaultGross);
  form.status.value = template?.status || 'active';
  form.templateNotes.value = template?.notes || '';
}

function fillDealForm(deal = null) {
  const form = document.querySelector('#dealForm');
  editingDealId = deal?.id || null;
  form.dealTitle.value = deal?.title || '';
  form.client.value = deal?.client || '';
  form.ownerContactId.innerHTML = '<option value="">Choose contact</option>' + getContactOptions();
  form.ownerContactId.value = deal?.ownerContactId || '';
  form.status.value = deal?.status || 'open';
  form.gross.value = valueOrEmpty(deal?.gross);
  form.fees.value = valueOrEmpty(deal?.fees);
  form.reserve.value = valueOrEmpty(deal?.reserve);
  form.misc.value = valueOrEmpty(deal?.misc);
  form.linkedSplitId.innerHTML = '<option value="">Link split plan</option>' + getTemplateSourceOptions();
  form.linkedSplitId.value = deal?.linkedSplitId || '';
  form.sourceTemplateId.innerHTML = '<option value="">Link recurring template</option>' + templates.map((template) => `<option value="${escapeHTML(template.id)}">${escapeHTML(template.title)}</option>`).join('');
  form.sourceTemplateId.value = deal?.sourceTemplateId || '';
  form.dueDate.value = deal?.dueDate ? new Date(deal.dueDate).toISOString().slice(0, 10) : '';
  form.closedDate.value = deal?.closedDate ? new Date(deal.closedDate).toISOString().slice(0, 10) : '';
  form.dealNotes.value = deal?.notes || '';
  renderDealNetPreview();
}

function renderDealNetPreview() {
  const form = document.querySelector('#dealForm');
  const net = dealNet({ gross: form.gross.value, fees: form.fees.value, reserve: form.reserve.value, misc: form.misc.value });
  document.querySelector('[data-deal-net]').textContent = formatCurrency(net, settings.currency);
}

function renderTemplateList() {
  const target = document.querySelector('[data-template-list]');
  const sorted = [...templates].sort((a, b) => new Date(a.nextRunDate || 0) - new Date(b.nextRunDate || 0));
  target.innerHTML = sorted.length ? sorted.map((template) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(template.title)}</div>
        <div class="caption">${escapeHTML(template.cadence)} · ${escapeHTML(template.status || 'active')} · ${template.defaultGross ? formatCurrency(template.defaultGross, settings.currency) : 'Uses source split gross'}</div>
        <div class="caption">Next run ${template.nextRunDate ? formatDate(template.nextRunDate) : 'not set'}${template.lastRunAt ? ` · last run ${formatDate(template.lastRunAt)}` : ''}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-template-load="${template.id}">Load</button>
        <button class="btn-soft" data-template-run="${template.id}">Run now</button>
        <button class="btn-danger" data-template-delete="${template.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="empty">No recurring payout templates yet.</div>';

  target.querySelectorAll('[data-template-load]').forEach((button) => button.addEventListener('click', () => {
    const match = templates.find((item) => item.id === button.dataset.templateLoad);
    if (match) fillTemplateForm(match);
  }));

  target.querySelectorAll('[data-template-delete]').forEach((button) => button.addEventListener('click', async () => {
    const match = templates.find((item) => item.id === button.dataset.templateDelete);
    if (!match) return;
    if (!confirm(`Delete ${match.title}?`)) return;
    await deleteOne('templates', match.id);
    await logActivity('Recurring template deleted', match.title);
    await maybeAutoSnapshot('template-delete');
    await loadAll();
  }));

  target.querySelectorAll('[data-template-run]').forEach((button) => button.addEventListener('click', async () => {
    const template = templates.find((item) => item.id === button.dataset.templateRun);
    if (!template) return;
    const sourcePlan = splits.find((plan) => plan.id === template.sourcePlanId);
    if (!sourcePlan) {
      alert('That template is missing its source split plan.');
      return;
    }
    const runDate = new Date().toISOString();
    const newPlan = structuredClone(sourcePlan);
    newPlan.id = uid('split');
    newPlan.title = `${template.title} · ${new Date(runDate).toLocaleDateString()}`;
    if (template.defaultGross) newPlan.gross = Number(template.defaultGross);
    newPlan.createdAt = runDate;
    newPlan.updatedAt = runDate;
    newPlan.summary = calcSplitPlan(newPlan);
    await putOne('splits', newPlan);

    const deal = {
      id: uid('deal'),
      title: `${template.title} payout run`,
      client: 'Recurring payout run',
      ownerContactId: '',
      ownerName: '',
      status: 'scheduled',
      gross: Number(newPlan.gross || 0),
      fees: Number(newPlan.fees || 0),
      reserve: Number(newPlan.reserve || 0),
      misc: Number(newPlan.misc || 0),
      net: Number(newPlan.summary?.distributable || 0),
      linkedSplitId: newPlan.id,
      sourceTemplateId: template.id,
      dueDate: template.nextRunDate || runDate,
      closedDate: '',
      notes: template.notes || '',
      createdAt: runDate,
      updatedAt: runDate
    };
    await putOne('deals', deal);

    template.lastRunAt = runDate;
    template.nextRunDate = nextDateByCadence(template.nextRunDate || runDate, template.cadence || 'monthly');
    template.updatedAt = runDate;
    await putOne('templates', template);
    await logActivity('Recurring payout run created', template.title);
    await maybeAutoSnapshot('template-run');
    document.querySelector('[data-template-result]').innerHTML = `<div class="success-box">Created split plan <strong>${escapeHTML(newPlan.title)}</strong> and ledger row <strong>${escapeHTML(deal.title)}</strong>.</div>`;
    await loadAll();
  }));
}

function renderDealList() {
  const target = document.querySelector('[data-deal-list]');
  const query = (document.querySelector('#dealSearch').value || '').trim().toLowerCase();
  const filtered = [...deals].filter((deal) => `${deal.title} ${deal.client} ${deal.status} ${deal.ownerName || ''}`.toLowerCase().includes(query));
  filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  target.innerHTML = filtered.length ? filtered.map((deal) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(deal.title || 'Untitled deal')}</div>
        <div class="caption">${escapeHTML(deal.client || 'No client')} · ${escapeHTML(deal.status || 'open')} · ${deal.ownerName ? escapeHTML(deal.ownerName) : 'No owner'}</div>
        <div class="caption">Net ${formatCurrency(deal.net || 0, settings.currency)}${deal.dueDate ? ` · due ${formatDate(deal.dueDate)}` : ''}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-deal-load="${deal.id}">Load</button>
        <button class="btn-soft" data-deal-receipt="${deal.id}">Receipt</button>
        <button class="btn-danger" data-deal-delete="${deal.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="empty">No ledger entries yet.</div>';

  target.querySelectorAll('[data-deal-load]').forEach((button) => button.addEventListener('click', () => {
    const match = deals.find((item) => item.id === button.dataset.dealLoad);
    if (match) fillDealForm(match);
  }));
  target.querySelectorAll('[data-deal-delete]').forEach((button) => button.addEventListener('click', async () => {
    const match = deals.find((item) => item.id === button.dataset.dealDelete);
    if (!match) return;
    if (!confirm(`Delete ${match.title}?`)) return;
    await deleteOne('deals', match.id);
    await logActivity('Deal ledger row deleted', match.title);
    await maybeAutoSnapshot('deal-delete');
    await loadAll();
  }));
  target.querySelectorAll('[data-deal-receipt]').forEach((button) => button.addEventListener('click', () => {
    const deal = deals.find((item) => item.id === button.dataset.dealReceipt);
    if (!deal) return;
    const url = new URL('receipts.html', location.href);
    url.hash = deal.id;
    location.href = url.href;
  }));

  const pipeline = filtered.reduce((sum, item) => sum + Number(item.net || 0), 0);
  document.querySelector('[data-deal-count]').textContent = `${filtered.length} rows`;
  document.querySelector('[data-deal-pipeline]').textContent = formatCurrency(pipeline, settings.currency);
}

function exportStoreRows(targetName) {
  if (targetName === 'contacts') {
    return contacts.map((item) => ({ id: item.id, name: item.name, role: item.role || '', company: item.company || '', email: item.email || '', phone: item.phone || '', defaultValue: item.defaultValue || '', notes: item.notes || '', createdAt: item.createdAt || '', updatedAt: item.updatedAt || '' }));
  }
  if (targetName === 'deals') {
    return deals.map((item) => ({ id: item.id, title: item.title || '', client: item.client || '', ownerContactId: item.ownerContactId || '', ownerName: item.ownerName || '', status: item.status || '', gross: item.gross || 0, fees: item.fees || 0, reserve: item.reserve || 0, misc: item.misc || 0, net: item.net || 0, linkedSplitId: item.linkedSplitId || '', sourceTemplateId: item.sourceTemplateId || '', dueDate: item.dueDate || '', closedDate: item.closedDate || '', notes: item.notes || '', createdAt: item.createdAt || '', updatedAt: item.updatedAt || '' }));
  }
  if (targetName === 'templates') {
    return templates.map((item) => ({ id: item.id, title: item.title || '', sourcePlanId: item.sourcePlanId || '', cadence: item.cadence || '', startDate: item.startDate || '', nextRunDate: item.nextRunDate || '', status: item.status || '', defaultGross: item.defaultGross || '', lastRunAt: item.lastRunAt || '', notes: item.notes || '', createdAt: item.createdAt || '', updatedAt: item.updatedAt || '' }));
  }
  if (targetName === 'receipts') {
    return [];
  }
  return splits.map((item) => ({ id: item.id, title: item.title || '', currency: item.currency || '', method: item.method || '', gross: item.gross || 0, fees: item.fees || 0, reserve: item.reserve || 0, misc: item.misc || 0, notes: item.notes || '', participantsJson: JSON.stringify(item.participants || []), createdAt: item.createdAt || '', updatedAt: item.updatedAt || '' }));
}

async function importRowsToStore(targetName, rows) {
  const now = new Date().toISOString();
  if (!rows.length) throw new Error('CSV file had no rows.');
  let mapped = [];
  let storeName = targetName;
  if (targetName === 'contacts') {
    mapped = rows.map((row) => ({ id: row.id || uid('contact'), name: (row.name || '').trim(), role: row.role || '', company: row.company || '', email: row.email || '', phone: row.phone || '', defaultValue: row.defaultValue || '', notes: row.notes || '', createdAt: row.createdAt || now, updatedAt: now })).filter((item) => item.name);
  } else if (targetName === 'deals') {
    mapped = rows.map((row) => {
      const mappedDeal = { id: row.id || uid('deal'), title: (row.title || '').trim(), client: row.client || '', ownerContactId: row.ownerContactId || '', ownerName: row.ownerName || '', status: row.status || 'open', gross: Number(row.gross || 0), fees: Number(row.fees || 0), reserve: Number(row.reserve || 0), misc: Number(row.misc || 0), linkedSplitId: row.linkedSplitId || '', sourceTemplateId: row.sourceTemplateId || '', dueDate: row.dueDate || '', closedDate: row.closedDate || '', notes: row.notes || '', createdAt: row.createdAt || now, updatedAt: now };
      mappedDeal.net = dealNet(mappedDeal);
      return mappedDeal;
    }).filter((item) => item.title);
  } else if (targetName === 'templates') {
    mapped = rows.map((row) => ({ id: row.id || uid('tmpl'), title: (row.title || '').trim(), sourcePlanId: row.sourcePlanId || '', cadence: row.cadence || 'monthly', startDate: row.startDate || now, nextRunDate: row.nextRunDate || now, status: row.status || 'active', defaultGross: row.defaultGross ? Number(row.defaultGross) : '', lastRunAt: row.lastRunAt || '', notes: row.notes || '', createdAt: row.createdAt || now, updatedAt: now })).filter((item) => item.title);
  } else if (targetName === 'splits') {
    storeName = 'splits';
    mapped = rows.map((row) => {
      let participants = [];
      try { participants = row.participantsJson ? JSON.parse(row.participantsJson) : []; } catch (error) { participants = []; }
      const payload = { id: row.id || uid('split'), title: (row.title || '').trim(), currency: row.currency || settings.currency, method: row.method || 'equal', gross: Number(row.gross || 0), fees: Number(row.fees || 0), reserve: Number(row.reserve || 0), misc: Number(row.misc || 0), notes: row.notes || '', participants, createdAt: row.createdAt || now, updatedAt: now };
      payload.summary = calcSplitPlan(payload);
      payload.methodLabel = payload.method;
      return payload;
    }).filter((item) => item.title);
  } else {
    throw new Error('Unsupported CSV target.');
  }

  if (!mapped.length) throw new Error('No valid rows were found in the CSV.');
  await batchPut(storeName, mapped);
  await logActivity('CSV import completed', `${targetName} · ${mapped.length} rows`);
  await maybeAutoSnapshot(`csv-import-${targetName}`);
  return mapped.length;
}

async function loadAll() {
  [settings, splits, contacts, templates, deals] = await Promise.all([
    settings ? Promise.resolve(settings) : bootPage('Money Operations'),
    getAll('splits'),
    getAll('contacts'),
    getAll('templates'),
    getAll('deals')
  ]);
  splits.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  contacts.sort((a, b) => new Date((b.updatedAt || b.createdAt || 0)) - new Date((a.updatedAt || a.createdAt || 0)));
  templates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  deals = deals.map((item) => ({ ...item, net: item.net ?? dealNet(item) }));
  deals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  document.querySelector('[data-ops-metrics]').innerHTML = templateSummaryCard();
  renderTemplateList();
  renderDealList();
  fillTemplateForm(editingTemplateId ? templates.find((item) => item.id === editingTemplateId) : null);
  fillDealForm(editingDealId ? deals.find((item) => item.id === editingDealId) : null);
  document.querySelector('[data-template-source-count]').textContent = `${splits.length} saved split plans available`;
}

async function init() {
  settings = await bootPage('Money Operations');
  await loadAll();

  const templateForm = document.querySelector('#templateForm');
  const dealForm = document.querySelector('#dealForm');

  templateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: editingTemplateId || uid('tmpl'),
      title: templateForm.templateTitle.value.trim(),
      sourcePlanId: templateForm.sourcePlanId.value,
      cadence: templateForm.cadence.value,
      startDate: templateForm.startDate.value ? new Date(templateForm.startDate.value).toISOString() : new Date().toISOString(),
      nextRunDate: templateForm.nextRunDate.value ? new Date(templateForm.nextRunDate.value).toISOString() : nextDateByCadence(new Date(), templateForm.cadence.value),
      defaultGross: templateForm.defaultGross.value ? Number(templateForm.defaultGross.value) : '',
      status: templateForm.status.value,
      notes: templateForm.templateNotes.value.trim(),
      createdAt: editingTemplateId ? templates.find((item) => item.id === editingTemplateId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!payload.title) {
      const source = splits.find((plan) => plan.id === payload.sourcePlanId);
      payload.title = source ? `${source.title} recurring` : '';
    }
    if (!payload.title || !payload.sourcePlanId) {
      alert('Choose a source split plan and give the template a title.');
      return;
    }
    await putOne('templates', payload);
    await logActivity(editingTemplateId ? 'Recurring template updated' : 'Recurring template added', payload.title);
    await maybeAutoSnapshot('template-save');
    document.querySelector('[data-template-result]').innerHTML = `<div class="success-box">Saved template <strong>${escapeHTML(payload.title)}</strong>.</div>`;
    editingTemplateId = payload.id;
    await loadAll();
  });

  document.querySelector('[data-template-reset]').addEventListener('click', () => {
    editingTemplateId = null;
    fillTemplateForm(null);
  });

  dealForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const owner = contacts.find((contact) => contact.id === dealForm.ownerContactId.value);
    const payload = {
      id: editingDealId || uid('deal'),
      title: dealForm.dealTitle.value.trim(),
      client: dealForm.client.value.trim(),
      ownerContactId: dealForm.ownerContactId.value,
      ownerName: owner?.name || '',
      status: dealForm.status.value,
      gross: Number(dealForm.gross.value || 0),
      fees: Number(dealForm.fees.value || 0),
      reserve: Number(dealForm.reserve.value || 0),
      misc: Number(dealForm.misc.value || 0),
      linkedSplitId: dealForm.linkedSplitId.value,
      sourceTemplateId: dealForm.sourceTemplateId.value,
      dueDate: dealForm.dueDate.value ? new Date(dealForm.dueDate.value).toISOString() : '',
      closedDate: dealForm.closedDate.value ? new Date(dealForm.closedDate.value).toISOString() : '',
      notes: dealForm.dealNotes.value.trim(),
      createdAt: editingDealId ? deals.find((item) => item.id === editingDealId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    payload.net = dealNet(payload);
    if (!payload.title) {
      alert('Deal title is required.');
      return;
    }
    await putOne('deals', payload);
    await logActivity(editingDealId ? 'Deal ledger row updated' : 'Deal ledger row added', payload.title);
    await maybeAutoSnapshot('deal-save');
    document.querySelector('[data-deal-result]').innerHTML = `<div class="success-box">Saved ledger row <strong>${escapeHTML(payload.title)}</strong>.</div>`;
    editingDealId = payload.id;
    await loadAll();
  });

  document.querySelector('[data-deal-reset]').addEventListener('click', () => {
    editingDealId = null;
    fillDealForm(null);
  });

  ['gross','fees','reserve','misc'].forEach((name) => {
    dealForm[name].addEventListener('input', renderDealNetPreview);
  });

  document.querySelector('#dealSearch').addEventListener('input', renderDealList);

  document.querySelector('[data-export-deals]').addEventListener('click', () => {
    const rows = exportStoreRows('deals');
    downloadFile(`skye-deal-ledger-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows), 'text/csv');
  });

  document.querySelector('[data-export-templates]').addEventListener('click', () => {
    const rows = exportStoreRows('templates');
    downloadFile(`skye-recurring-templates-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows), 'text/csv');
  });

  document.querySelector('[data-batch-export]').addEventListener('click', () => {
    const target = document.querySelector('#batchTarget').value;
    const rows = exportStoreRows(target);
    if (!rows.length) {
      document.querySelector('[data-batch-result]').innerHTML = '<div class="warning-box">Nothing to export for that target yet.</div>';
      return;
    }
    downloadFile(`skye-${slugify(target)}-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows), 'text/csv');
    document.querySelector('[data-batch-result]').innerHTML = `<div class="success-box">Exported ${rows.length} ${escapeHTML(target)} rows.</div>`;
  });

  document.querySelector('[data-batch-import]').addEventListener('click', async () => {
    const target = document.querySelector('#batchTarget').value;
    const file = document.querySelector('#batchFile').files?.[0];
    if (!file) {
      alert('Choose a CSV file first.');
      return;
    }
    const text = await file.text();
    const rows = parseCSV(text);
    try {
      const count = await importRowsToStore(target, rows);
      document.querySelector('[data-batch-result]').innerHTML = `<div class="success-box">Imported ${count} rows into ${escapeHTML(target)}.</div>`;
      await loadAll();
    } catch (error) {
      document.querySelector('[data-batch-result]').innerHTML = `<div class="warning-box">${escapeHTML(error.message)}</div>`;
    }
  });
}

init();
