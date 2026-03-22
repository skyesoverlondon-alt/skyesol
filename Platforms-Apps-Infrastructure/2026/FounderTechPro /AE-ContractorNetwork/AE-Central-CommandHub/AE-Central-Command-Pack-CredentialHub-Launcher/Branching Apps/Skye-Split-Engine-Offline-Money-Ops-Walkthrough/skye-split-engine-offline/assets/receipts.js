import { bootPage, downloadFile, escapeHTML, formatCurrency, formatDate, logActivity, maybeAutoSnapshot, parseCSV, slugify, toCSV, uid } from './app-core.js';
import { batchPut, deleteOne, getAll, putOne } from './db.js';

let settings;
let deals = [];
let splits = [];
let receipts = [];
let editingReceiptId = null;

function makeReceiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REC-${stamp}-${tail}`;
}

function parseLineItems(text = '', fallbackAmount = 0) {
  const lines = String(text).split(/
+/).map((line) => line.trim()).filter(Boolean);
  const items = lines.map((line) => {
    const [label, amount] = line.split('|').map((part) => part.trim());
    return { label: label || 'Settlement line', amount: Number(amount || 0) };
  });
  if (!items.length) return [{ label: 'Settlement', amount: Number(fallbackAmount || 0) }];
  return items;
}

function totalLineItems(items = []) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function fillReceiptForm(receipt = null) {
  const form = document.querySelector('#receiptForm');
  editingReceiptId = receipt?.id || null;
  form.receiptNumber.value = receipt?.receiptNumber || makeReceiptNumber();
  form.settlementDate.value = receipt?.settlementDate ? new Date(receipt.settlementDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  form.payer.value = receipt?.payer || '';
  form.recipient.value = receipt?.recipient || '';
  form.relatedDealId.innerHTML = '<option value="">Link deal ledger row</option>' + deals.map((deal) => `<option value="${escapeHTML(deal.id)}">${escapeHTML(deal.title)}</option>`).join('');
  form.relatedSplitId.innerHTML = '<option value="">Link split plan</option>' + splits.map((split) => `<option value="${escapeHTML(split.id)}">${escapeHTML(split.title)}</option>`).join('');
  form.relatedDealId.value = receipt?.relatedDealId || '';
  form.relatedSplitId.value = receipt?.relatedSplitId || '';
  form.amount.value = receipt?.amount ?? '';
  form.status.value = receipt?.status || 'issued';
  form.lineItems.value = receipt?.lineItems?.map((item) => `${item.label} | ${item.amount}`).join('
') || '';
  form.memo.value = receipt?.memo || '';
  renderReceiptPreview();
}

function renderReceiptPreview() {
  const form = document.querySelector('#receiptForm');
  const items = parseLineItems(form.lineItems.value, form.amount.value);
  const total = form.amount.value ? Number(form.amount.value || 0) : totalLineItems(items);
  document.querySelectorAll('[data-receipt-total]').forEach((node) => { node.textContent = formatCurrency(total, settings.currency); });
  const summaryNode = document.querySelector('[data-receipt-total-summary]');
  if (summaryNode) summaryNode.textContent = formatCurrency(total, settings.currency);
  document.querySelector('[data-receipt-lines]').innerHTML = items.map((item) => `<div class="list-item"><div>${escapeHTML(item.label)}</div><div>${formatCurrency(item.amount, settings.currency)}</div></div>`).join('');
}

function receiptHtml(receipt) {
  const logoHref = new URL('./assets/media/skydexia-logo.png', location.href).href;
  const items = receipt.lineItems?.length ? receipt.lineItems : [{ label: 'Settlement', amount: receipt.amount || 0 }];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(receipt.receiptNumber)}</title>
<style>
body{margin:0;background:#09070f;color:#f7f3ff;font-family:Inter,Arial,sans-serif;padding:28px} .sheet{max-width:860px;margin:0 auto;background:linear-gradient(180deg,rgba(21,15,37,.94),rgba(12,8,22,.96));border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.45)} .head{display:flex;justify-content:space-between;gap:20px;align-items:center} .head img{width:160px;filter:drop-shadow(0 0 20px rgba(243,201,108,.28))} .meta,.row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid rgba(255,255,255,.08)} .meta:first-of-type,.row:first-of-type{border-top:0}.label{color:#ccbfe2;font-size:.95rem}.value{font-weight:700} table{width:100%;border-collapse:collapse;margin-top:18px} th,td{text-align:left;padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.08)} th{color:#ccbfe2} .total{font-size:1.4rem;font-weight:800}.footer{margin-top:24px;color:#ccbfe2}
</style>
</head>
<body>
<div class="sheet">
<div class="head">
<div><h1 style="margin:0 0 8px;font-size:2rem;">Settlement Receipt</h1><div class="label">Skyes Over London · Skye Split Engine Ops</div></div>
<img src="${logoHref}" alt="Skyes Over London logo">
</div>
<div class="meta"><div><div class="label">Receipt</div><div class="value">${escapeHTML(receipt.receiptNumber)}</div></div><div><div class="label">Date</div><div class="value">${formatDate(receipt.settlementDate)}</div></div></div>
<div class="meta"><div><div class="label">Payer</div><div class="value">${escapeHTML(receipt.payer || '—')}</div></div><div><div class="label">Recipient</div><div class="value">${escapeHTML(receipt.recipient || '—')}</div></div></div>
<table>
<thead><tr><th>Description</th><th>Amount</th></tr></thead>
<tbody>${items.map((item) => `<tr><td>${escapeHTML(item.label)}</td><td>${formatCurrency(item.amount, receipt.currency || 'USD')}</td></tr>`).join('')}</tbody>
</table>
<div class="meta"><div><div class="label">Status</div><div class="value">${escapeHTML(receipt.status || 'issued')}</div></div><div><div class="label">Total</div><div class="value total">${formatCurrency(receipt.amount || totalLineItems(items), receipt.currency || 'USD')}</div></div></div>
<div class="footer">${escapeHTML(receipt.memo || '')}<br><br>Skyes Over London · SkyesOverLondonLC@solenterprises.org · (480) 469-5416 · SOLEnterprises.org</div>
</div>
</body>
</html>`;
}

function renderReceiptList() {
  const target = document.querySelector('[data-receipt-list]');
  const query = (document.querySelector('#receiptSearch').value || '').trim().toLowerCase();
  const filtered = [...receipts].filter((receipt) => `${receipt.receiptNumber} ${receipt.payer} ${receipt.recipient} ${receipt.status}`.toLowerCase().includes(query));
  filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  target.innerHTML = filtered.length ? filtered.map((receipt) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${escapeHTML(receipt.receiptNumber)}</div>
        <div class="caption">${escapeHTML(receipt.recipient || 'No recipient')} · ${escapeHTML(receipt.status || 'issued')}</div>
        <div class="caption">${receipt.settlementDate ? formatDate(receipt.settlementDate) : 'No date'} · ${formatCurrency(receipt.amount || 0, settings.currency)}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-receipt-load="${receipt.id}">Load</button>
        <button class="btn-soft" data-receipt-print="${receipt.id}">Print</button>
        <button class="btn-soft" data-receipt-json="${receipt.id}">JSON</button>
        <button class="btn-danger" data-receipt-delete="${receipt.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="empty">No receipts saved yet.</div>';

  target.querySelectorAll('[data-receipt-load]').forEach((button) => button.addEventListener('click', () => {
    const match = receipts.find((item) => item.id === button.dataset.receiptLoad);
    if (match) fillReceiptForm(match);
  }));
  target.querySelectorAll('[data-receipt-print]').forEach((button) => button.addEventListener('click', () => {
    const receipt = receipts.find((item) => item.id === button.dataset.receiptPrint);
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    printWindow.document.write(receiptHtml(receipt));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }));
  target.querySelectorAll('[data-receipt-json]').forEach((button) => button.addEventListener('click', () => {
    const receipt = receipts.find((item) => item.id === button.dataset.receiptJson);
    if (!receipt) return;
    downloadFile(`${slugify(receipt.receiptNumber || 'receipt')}.json`, JSON.stringify(receipt, null, 2));
  }));
  target.querySelectorAll('[data-receipt-delete]').forEach((button) => button.addEventListener('click', async () => {
    const receipt = receipts.find((item) => item.id === button.dataset.receiptDelete);
    if (!receipt) return;
    if (!confirm(`Delete ${receipt.receiptNumber}?`)) return;
    await deleteOne('receipts', receipt.id);
    await logActivity('Settlement receipt deleted', receipt.receiptNumber);
    await maybeAutoSnapshot('receipt-delete');
    await loadAll();
  }));
}

async function loadAll() {
  [settings, deals, splits, receipts] = await Promise.all([
    settings ? Promise.resolve(settings) : bootPage('Settlement Receipts'),
    getAll('deals'),
    getAll('splits'),
    getAll('receipts')
  ]);
  deals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  splits.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  receipts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  renderReceiptList();
  fillReceiptForm(editingReceiptId ? receipts.find((item) => item.id === editingReceiptId) : null);
  document.querySelector('[data-receipt-count]').textContent = `${receipts.length} saved receipts`;
}

async function init() {
  settings = await bootPage('Settlement Receipts');
  await loadAll();
  const form = document.querySelector('#receiptForm');

  if (location.hash) {
    const linkedDeal = location.hash.replace('#', '');
    form.relatedDealId.value = linkedDeal;
    const deal = deals.find((item) => item.id === linkedDeal);
    if (deal) {
      form.payer.value = deal.client || '';
      form.amount.value = deal.net || 0;
      form.memo.value = deal.notes || '';
      form.lineItems.value = `${deal.title} settlement | ${deal.net || 0}`;
      renderReceiptPreview();
    }
  }

  form.relatedDealId.addEventListener('change', () => {
    const deal = deals.find((item) => item.id === form.relatedDealId.value);
    if (!deal) return;
    if (!form.payer.value) form.payer.value = deal.client || '';
    if (!form.amount.value) form.amount.value = deal.net || 0;
    if (!form.lineItems.value) form.lineItems.value = `${deal.title} settlement | ${deal.net || 0}`;
    renderReceiptPreview();
  });

  form.relatedSplitId.addEventListener('change', () => {
    const split = splits.find((item) => item.id === form.relatedSplitId.value);
    if (!split) return;
    if (!form.amount.value) form.amount.value = split.summary?.distributable || 0;
    if (!form.lineItems.value) form.lineItems.value = `${split.title} payout | ${split.summary?.distributable || 0}`;
    renderReceiptPreview();
  });

  form.lineItems.addEventListener('input', renderReceiptPreview);
  form.amount.addEventListener('input', renderReceiptPreview);
  document.querySelector('#receiptSearch').addEventListener('input', renderReceiptList);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const lineItems = parseLineItems(form.lineItems.value, form.amount.value);
    const payload = {
      id: editingReceiptId || uid('receipt'),
      receiptNumber: form.receiptNumber.value.trim() || makeReceiptNumber(),
      settlementDate: form.settlementDate.value ? new Date(form.settlementDate.value).toISOString() : new Date().toISOString(),
      payer: form.payer.value.trim(),
      recipient: form.recipient.value.trim(),
      relatedDealId: form.relatedDealId.value,
      relatedSplitId: form.relatedSplitId.value,
      amount: Number(form.amount.value || totalLineItems(lineItems)),
      status: form.status.value,
      lineItems,
      memo: form.memo.value.trim(),
      currency: settings.currency,
      createdAt: editingReceiptId ? receipts.find((item) => item.id === editingReceiptId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!payload.recipient) {
      alert('Recipient is required.');
      return;
    }
    await putOne('receipts', payload);
    await logActivity(editingReceiptId ? 'Settlement receipt updated' : 'Settlement receipt created', payload.receiptNumber);
    await maybeAutoSnapshot('receipt-save');
    document.querySelector('[data-receipt-result]').innerHTML = `<div class="success-box">Saved receipt <strong>${escapeHTML(payload.receiptNumber)}</strong>.</div>`;
    editingReceiptId = payload.id;
    await loadAll();
  });

  document.querySelector('[data-receipt-reset]').addEventListener('click', () => {
    editingReceiptId = null;
    fillReceiptForm(null);
    document.querySelector('[data-receipt-result]').innerHTML = '';
  });

  document.querySelector('[data-export-receipts]').addEventListener('click', () => {
    const rows = receipts.map((receipt) => ({ id: receipt.id, receiptNumber: receipt.receiptNumber, settlementDate: receipt.settlementDate, payer: receipt.payer, recipient: receipt.recipient, relatedDealId: receipt.relatedDealId || '', relatedSplitId: receipt.relatedSplitId || '', amount: receipt.amount || 0, status: receipt.status || 'issued', memo: receipt.memo || '', lineItems: JSON.stringify(receipt.lineItems || []), createdAt: receipt.createdAt || '', updatedAt: receipt.updatedAt || '' }));
    if (!rows.length) {
      document.querySelector('[data-receipt-result]').innerHTML = '<div class="warning-box">No receipts to export yet.</div>';
      return;
    }
    downloadFile(`skye-settlement-receipts-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows), 'text/csv');
  });

  document.querySelector('[data-import-receipts]').addEventListener('click', async () => {
    const file = document.querySelector('#receiptCsv').files?.[0];
    if (!file) {
      alert('Choose a CSV file first.');
      return;
    }
    const rows = parseCSV(await file.text());
    if (!rows.length) {
      document.querySelector('[data-receipt-result]').innerHTML = '<div class="warning-box">That CSV had no valid rows.</div>';
      return;
    }
    const now = new Date().toISOString();
    const mapped = rows.map((row) => {
      let lineItems = [];
      try { lineItems = row.lineItems ? JSON.parse(row.lineItems) : []; } catch (error) { lineItems = parseLineItems(row.lineItems || '', row.amount || 0); }
      return {
        id: row.id || uid('receipt'),
        receiptNumber: row.receiptNumber || makeReceiptNumber(),
        settlementDate: row.settlementDate || now,
        payer: row.payer || '',
        recipient: row.recipient || '',
        relatedDealId: row.relatedDealId || '',
        relatedSplitId: row.relatedSplitId || '',
        amount: Number(row.amount || totalLineItems(lineItems)),
        status: row.status || 'issued',
        memo: row.memo || '',
        lineItems,
        currency: settings.currency,
        createdAt: row.createdAt || now,
        updatedAt: now
      };
    }).filter((item) => item.recipient);
    if (!mapped.length) {
      document.querySelector('[data-receipt-result]').innerHTML = '<div class="warning-box">No valid receipt rows were found.</div>';
      return;
    }
    await batchPut('receipts', mapped);
    await logActivity('Receipt CSV import completed', `${mapped.length} rows`);
    await maybeAutoSnapshot('receipt-csv-import');
    document.querySelector('[data-receipt-result]').innerHTML = `<div class="success-box">Imported ${mapped.length} receipt rows.</div>`;
    await loadAll();
  });
}

init();
