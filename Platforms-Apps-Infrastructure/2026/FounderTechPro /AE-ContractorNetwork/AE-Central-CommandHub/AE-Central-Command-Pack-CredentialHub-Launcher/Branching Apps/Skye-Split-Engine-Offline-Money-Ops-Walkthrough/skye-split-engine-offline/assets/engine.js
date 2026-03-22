import { bootPage, calcSplitPlan, downloadFile, formatCurrency, formatDate, getSettings, logActivity, maybeAutoSnapshot, toCSV, uid } from './app-core.js';
import { deleteOne, getAll, putOne } from './db.js';

let contacts = [];
let plans = [];
let settings;
let currentPlanId = null;

function methodLabel(method) {
  return {
    equal: 'Equal split',
    percent: 'Percent split',
    weight: 'Weighted split',
    fixed: 'Fixed payout'
  }[method] || 'Split';
}

function participantInputLabel(method) {
  if (method === 'percent') return 'Percent';
  if (method === 'weight') return 'Weight';
  if (method === 'fixed') return 'Fixed amount';
  return 'Value';
}

function createParticipantRow(data = {}) {
  const method = document.querySelector('#method').value;
  const wrapper = document.createElement('div');
  wrapper.className = 'participant-row';
  wrapper.innerHTML = `
    <div class="field">
      <label>Participant</label>
      <select class="participant-name">
        <option value="">Custom name</option>
        ${contacts.map((contact) => `<option value="${contact.id}" ${data.contactId === contact.id ? 'selected' : ''}>${contact.name}</option>`).join('')}
      </select>
      <input class="participant-custom" type="text" placeholder="Type a name" value="${data.name || ''}">
    </div>
    <div class="field participant-value-wrap ${method === 'equal' ? 'hidden' : ''}">
      <label>${participantInputLabel(method)}</label>
      <input class="participant-value" type="number" step="0.01" value="${data.value ?? ''}" placeholder="0.00">
    </div>
    <button type="button" class="btn-danger participant-remove">Remove</button>
  `;

  const select = wrapper.querySelector('.participant-name');
  const custom = wrapper.querySelector('.participant-custom');
  const valueInput = wrapper.querySelector('.participant-value');
  if (data.contactId) {
    const match = contacts.find((contact) => contact.id === data.contactId);
    if (match && !custom.value) custom.value = match.name;
    if (match && valueInput && data.value == null && match.defaultValue) valueInput.value = match.defaultValue;
  }

  select.addEventListener('change', () => {
    const match = contacts.find((contact) => contact.id === select.value);
    if (match) {
      custom.value = match.name;
      if (valueInput && !valueInput.value && match.defaultValue) valueInput.value = match.defaultValue;
    }
    renderSummary();
  });

  custom.addEventListener('input', renderSummary);
  if (valueInput) valueInput.addEventListener('input', renderSummary);
  wrapper.querySelector('.participant-remove').addEventListener('click', () => {
    wrapper.remove();
    renderSummary();
  });

  return wrapper;
}

function getPlanFromForm() {
  const form = document.querySelector('#splitForm');
  const participants = Array.from(document.querySelectorAll('.participant-row')).map((row) => ({
    contactId: row.querySelector('.participant-name').value,
    name: row.querySelector('.participant-custom').value.trim(),
    value: row.querySelector('.participant-value')?.value || 0
  })).filter((item) => item.name);

  return {
    id: currentPlanId || uid('split'),
    title: form.title.value.trim() || 'Untitled split plan',
    currency: form.currency.value,
    method: form.method.value,
    methodLabel: methodLabel(form.method.value),
    gross: Number(form.gross.value || 0),
    fees: Number(form.fees.value || 0),
    reserve: Number(form.reserve.value || 0),
    misc: Number(form.misc.value || 0),
    notes: form.notes.value.trim(),
    participants,
    createdAt: currentPlanId ? plans.find((item) => item.id === currentPlanId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function renderWarnings(warnings) {
  const target = document.querySelector('[data-split-warnings]');
  if (!warnings.length) {
    target.innerHTML = '<div class="success-box">Split math looks clean. Save the plan when you are ready.</div>';
    return;
  }
  target.innerHTML = warnings.map((warning) => `<div class="warning-box">${warning}</div>`).join('');
}

function renderResults(summary, currency) {
  const body = document.querySelector('[data-results-body]');
  body.innerHTML = summary.result.length ? summary.result.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td>${row.input}</td>
      <td>${formatCurrency(row.amount, currency)}</td>
    </tr>
  `).join('') : '<tr><td colspan="3">No result yet.</td></tr>';

  document.querySelector('[data-distributable]').textContent = formatCurrency(summary.distributable, currency);
  document.querySelector('[data-assigned]').textContent = formatCurrency(summary.assigned, currency);
  document.querySelector('[data-remainder]').textContent = formatCurrency(summary.remainder, currency);
}

function renderSummary() {
  const plan = getPlanFromForm();
  const summary = calcSplitPlan(plan);
  renderResults(summary, plan.currency);
  renderWarnings(summary.warnings);
  document.querySelector('[data-plan-method]').textContent = methodLabel(plan.method);
  document.querySelector('[data-plan-participants]').textContent = `${plan.participants.length} participants`;
  return { plan, summary };
}

async function savePlan() {
  const { plan, summary } = renderSummary();
  const payload = { ...plan, summary };
  await putOne('splits', payload);
  currentPlanId = payload.id;
  await logActivity(plans.find((item) => item.id === payload.id) ? 'Split plan updated' : 'Split plan saved', payload.title);
  await maybeAutoSnapshot('split-save');
  await loadPlans();
  alert('Plan saved locally.');
}

function fillForm(plan = null) {
  const form = document.querySelector('#splitForm');
  const container = document.querySelector('[data-participants]');
  container.innerHTML = '';
  currentPlanId = plan?.id || null;
  form.title.value = plan?.title || '';
  form.currency.value = plan?.currency || settings.currency || 'USD';
  form.method.value = plan?.method || 'equal';
  form.gross.value = plan?.gross ?? '';
  form.fees.value = plan?.fees ?? '';
  form.reserve.value = plan?.reserve ?? '';
  form.misc.value = plan?.misc ?? '';
  form.notes.value = plan?.notes || '';

  if (plan?.participants?.length) {
    plan.participants.forEach((person) => container.appendChild(createParticipantRow(person)));
  } else {
    container.appendChild(createParticipantRow());
    container.appendChild(createParticipantRow());
  }

  syncMethodUI();
  renderSummary();
}

function syncMethodUI() {
  const method = document.querySelector('#method').value;
  document.querySelectorAll('.participant-row').forEach((row) => {
    const wrap = row.querySelector('.participant-value-wrap');
    const label = wrap.querySelector('label');
    const input = wrap.querySelector('input');
    wrap.classList.toggle('hidden', method === 'equal');
    label.textContent = participantInputLabel(method);
    input.placeholder = method === 'percent' ? '25' : method === 'weight' ? '1' : '0.00';
  });
}

async function loadPlans() {
  plans = (await getAll('splits')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const target = document.querySelector('[data-plan-list]');
  target.innerHTML = plans.length ? plans.map((plan) => `
    <div class="plan-row">
      <div>
        <div class="split-label">${plan.title}</div>
        <div class="caption">${plan.methodLabel} · ${formatDate(plan.updatedAt)}</div>
        <div class="caption">${plan.participants?.length || 0} participants · ${formatCurrency(plan.summary?.distributable || 0, plan.currency || settings.currency)}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-load-plan="${plan.id}">Load</button>
        <button class="btn-soft" data-duplicate-plan="${plan.id}">Duplicate</button>
        <button class="btn-danger" data-delete-plan="${plan.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="empty">No saved plans yet. Create one on the left and save it.</div>';

  target.querySelectorAll('[data-load-plan]').forEach((button) => button.addEventListener('click', () => {
    const match = plans.find((plan) => plan.id === button.dataset.loadPlan);
    if (match) fillForm(match);
  }));
  target.querySelectorAll('[data-duplicate-plan]').forEach((button) => button.addEventListener('click', async () => {
    const match = plans.find((plan) => plan.id === button.dataset.duplicatePlan);
    if (!match) return;
    const copy = { ...match, id: uid('split'), title: `${match.title} Copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await putOne('splits', copy);
    await logActivity('Split plan duplicated', copy.title);
    await maybeAutoSnapshot('split-duplicate');
    await loadPlans();
  }));
  target.querySelectorAll('[data-delete-plan]').forEach((button) => button.addEventListener('click', async () => {
    const match = plans.find((plan) => plan.id === button.dataset.deletePlan);
    if (!match) return;
    if (!confirm(`Delete ${match.title}?`)) return;
    await deleteOne('splits', match.id);
    await logActivity('Split plan deleted', match.title);
    await maybeAutoSnapshot('split-delete');
    if (currentPlanId === match.id) fillForm(null);
    await loadPlans();
  }));
}

async function init() {
  settings = await bootPage('Split Engine');
  contacts = await getAll('contacts');
  const form = document.querySelector('#splitForm');

  form.method.addEventListener('change', () => {
    syncMethodUI();
    renderSummary();
  });

  ['gross', 'fees', 'reserve', 'misc', 'currency', 'title', 'notes'].forEach((name) => {
    form[name].addEventListener('input', renderSummary);
  });

  document.querySelector('[data-add-participant]').addEventListener('click', () => {
    document.querySelector('[data-participants]').appendChild(createParticipantRow());
    syncMethodUI();
  });

  document.querySelector('[data-save-plan]').addEventListener('click', savePlan);
  document.querySelector('[data-reset-plan]').addEventListener('click', () => fillForm(null));
  document.querySelector('[data-quick-6040]').addEventListener('click', () => {
    fillForm({
      method: 'percent',
      participants: [{ name: 'Primary', value: 60 }, { name: 'Partner', value: 40 }],
      currency: settings.currency
    });
  });
  document.querySelector('[data-quick-equal3]').addEventListener('click', () => {
    fillForm({
      method: 'equal',
      participants: [{ name: 'Party A' }, { name: 'Party B' }, { name: 'Party C' }],
      currency: settings.currency
    });
  });
  document.querySelector('[data-quick-weight]').addEventListener('click', () => {
    fillForm({
      method: 'weight',
      participants: [{ name: 'Lead', value: 3 }, { name: 'Support', value: 2 }, { name: 'Ops', value: 1 }],
      currency: settings.currency
    });
  });

  document.querySelector('[data-export-csv]').addEventListener('click', () => {
    const { plan, summary } = renderSummary();
    const rows = summary.result.map((row) => ({
      plan: plan.title,
      method: methodLabel(plan.method),
      participant: row.name,
      input: row.input,
      amount: Number(row.amount || 0).toFixed(2)
    }));
    rows.push({ plan: plan.title, method: 'Summary', participant: 'Distributable', input: '', amount: summary.distributable.toFixed(2) });
    rows.push({ plan: plan.title, method: 'Summary', participant: 'Assigned', input: '', amount: summary.assigned.toFixed(2) });
    rows.push({ plan: plan.title, method: 'Summary', participant: 'Remainder', input: '', amount: summary.remainder.toFixed(2) });
    downloadFile(`split-plan-${(plan.title || 'untitled').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, toCSV(rows), 'text/csv');
  });

  document.querySelector('[data-export-json]').addEventListener('click', () => {
    const { plan, summary } = renderSummary();
    downloadFile(`split-plan-${(plan.title || 'untitled').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, JSON.stringify({ ...plan, summary }, null, 2));
  });

  fillForm(null);
  await loadPlans();
}

init();
