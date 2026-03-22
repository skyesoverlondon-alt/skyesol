import { bootPage, escapeHTML, formatDate, getCounts, getRecentActivity } from './app-core.js';
import { getAll } from './db.js';

const STORAGE_KEY = 'skye-split-walkthrough-progress-v1';

const STEPS = [
  {
    id: 'settings',
    title: 'Set the shell first',
    page: 'settings.html',
    button: 'Open settings',
    why: 'This makes the app yours before you start creating records.',
    exact: [
      'Set Company name and App name.',
      'Pick the default currency you actually use.',
      'Choose a background mode or upload a background image.',
      'Set auto snapshots to the interval you want.'
    ],
    pass: 'Save settings once so the shell, currency, and snapshot behavior are locked in.'
  },
  {
    id: 'contacts',
    title: 'Add people before you split money',
    page: 'contacts.html',
    button: 'Open contacts',
    why: 'Later forms are faster when recipients already exist.',
    exact: [
      'Add at least one payout person, vendor, or contractor.',
      'Use role and company so records stay readable later.',
      'Add phone or email only if it helps you tie real operations back to the record.'
    ],
    pass: 'One saved contact is enough to complete this tutorial step.'
  },
  {
    id: 'split',
    title: 'Build one reusable split plan',
    page: 'engine.html',
    button: 'Open split engine',
    why: 'This is the core math. Everything else downstream becomes cleaner once the split logic is saved.',
    exact: [
      'Enter a plan title that means something operationally.',
      'Choose the split mode: equal, percent, weighted, or fixed payout.',
      'Enter gross, fees, reserve, and misc deductions.',
      'Add participants and save the plan.'
    ],
    pass: 'At least one saved split plan means the app can power real recurring runs.'
  },
  {
    id: 'template',
    title: 'Turn a saved plan into recurring money ops',
    page: 'ops.html',
    button: 'Open money ops',
    why: 'Templates stop you from rebuilding the same payout run over and over.',
    exact: [
      'Pick a source split plan.',
      'Set cadence and next run date.',
      'Optionally set a default gross for future runs.',
      'Save the template, then use Run now when you want a fresh payout instance.'
    ],
    pass: 'One recurring payout template completes this step.'
  },
  {
    id: 'deal',
    title: 'Track the real money record in the ledger',
    page: 'ops.html',
    button: 'Open ledger form',
    why: 'Templates are patterns. Deals are the actual rows that tell you what money moved, for whom, and when.',
    exact: [
      'Create a deal title and client or internal label.',
      'Set gross, fees, reserve, and misc values.',
      'Link the split plan and recurring template when relevant.',
      'Use due date and status so the row can be acted on later.'
    ],
    pass: 'One saved deal ledger row means your operating records have started.'
  },
  {
    id: 'receipt',
    title: 'Issue a settlement receipt',
    page: 'receipts.html',
    button: 'Open receipts',
    why: 'This is proof. It turns the operation into something printable, exportable, and archivable.',
    exact: [
      'Create a receipt number and recipient.',
      'Set settlement date and amount.',
      'Link a deal or split when it fits.',
      'Save it, then print or export it.'
    ],
    pass: 'One saved receipt completes the proof lane.'
  },
  {
    id: 'backup',
    title: 'Protect the whole app with the vault',
    page: 'vault.html',
    button: 'Open backup vault',
    why: 'Offline is powerful only when recovery is real.',
    exact: [
      'Create a local snapshot before major imports or cleanup passes.',
      'Export a plain JSON backup for portability.',
      'Export an encrypted backup when the file may travel or sit in cloud storage.'
    ],
    pass: 'At least one snapshot means your local system has a recovery point.'
  }
];

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function stepIsCompleted(stepId, counts) {
  if (stepId === 'settings') return true;
  if (stepId === 'contacts') return counts.contacts > 0;
  if (stepId === 'split') return counts.splits > 0;
  if (stepId === 'template') return counts.templates > 0;
  if (stepId === 'deal') return counts.deals > 0;
  if (stepId === 'receipt') return counts.receipts > 0;
  if (stepId === 'backup') return counts.snapshots > 0;
  return false;
}

function completionLabel(done) {
  return done ? 'Completed' : 'Mark done';
}

function recommendedStep(counts) {
  if (!counts.contacts) return { short: 'Contacts', long: 'Add your first payout person so later forms move faster.' };
  if (!counts.splits) return { short: 'Split plan', long: 'Build one real split plan before touching recurring ops.' };
  if (!counts.templates) return { short: 'Template', long: 'Create one recurring payout template from the saved split plan.' };
  if (!counts.deals) return { short: 'Ledger', long: 'Create your first deal ledger row so actual operations are tracked.' };
  if (!counts.receipts) return { short: 'Receipt', long: 'Issue a settlement receipt so your proof lane exists.' };
  if (!counts.snapshots) return { short: 'Backup', long: 'Create a vault snapshot so the offline workflow is protected.' };
  return { short: 'Done', long: 'You have the full money-ops chain running locally.' };
}

function readinessItems(counts, settings) {
  return [
    ['Settings saved', 'Base shell exists and can be edited any time.', true],
    ['Contacts', counts.contacts > 0 ? `${counts.contacts} saved` : 'No contacts yet', counts.contacts > 0],
    ['Split plans', counts.splits > 0 ? `${counts.splits} saved` : 'No split plans yet', counts.splits > 0],
    ['Recurring templates', counts.templates > 0 ? `${counts.templates} saved` : 'No recurring templates yet', counts.templates > 0],
    ['Deal ledger', counts.deals > 0 ? `${counts.deals} rows` : 'No ledger rows yet', counts.deals > 0],
    ['Receipts', counts.receipts > 0 ? `${counts.receipts} saved` : 'No receipts yet', counts.receipts > 0],
    ['Vault snapshots', counts.snapshots > 0 ? `${counts.snapshots} saved` : 'No snapshots yet', counts.snapshots > 0],
    ['Currency', settings.currency || 'USD', true]
  ];
}

function renderReadiness(target, items) {
  target.innerHTML = items.map(([title, detail, ok]) => `
    <div class="checkline ${ok ? 'ok' : ''}">
      <div>
        <div class="split-label">${escapeHTML(title)}</div>
        <div class="caption">${escapeHTML(detail)}</div>
      </div>
      <div class="step-state">${ok ? 'Ready' : 'Pending'}</div>
    </div>
  `).join('');
}

function renderSteps(target, counts, progress) {
  target.innerHTML = STEPS.map((step, index) => {
    const autoCompleted = stepIsCompleted(step.id, counts);
    const manuallyCompleted = Boolean(progress[step.id]);
    const done = autoCompleted || manuallyCompleted;
    return `
      <article class="step-card ${done ? 'done' : ''}">
        <div class="step-top">
          <div class="step-num">${index + 1}</div>
          <div>
            <div class="kicker">${escapeHTML(step.why)}</div>
            <h3>${escapeHTML(step.title)}</h3>
          </div>
        </div>
        <div class="note-box">${escapeHTML(step.pass)}</div>
        <div class="step-state-row">
          <div class="step-state ${done ? 'done' : ''}">${done ? 'Completed' : 'Pending'}</div>
          <div class="caption">${autoCompleted ? 'Detected from saved data' : manuallyCompleted ? 'Marked by user' : 'Not completed yet'}</div>
        </div>
        <div class="step-list">
          ${step.exact.map((item) => `<div class="checkline"><div class="caption">${escapeHTML(item)}</div></div>`).join('')}
        </div>
        <div class="hero-actions" style="margin-top:16px;">
          <a class="btn" href="${escapeHTML(step.page)}">${escapeHTML(step.button)}</a>
          <button class="btn-soft" type="button" data-step-toggle="${escapeHTML(step.id)}">${completionLabel(done)}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function init() {
  const settings = await bootPage('Walkthrough Tutorial');
  const counts = await getCounts();
  const snapshots = (await getAll('snapshots')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const activity = await getRecentActivity(10);
  const progress = loadProgress();
  const recommended = recommendedStep(counts);
  const readyItems = readinessItems(counts, settings);
  const completeCount = STEPS.filter((step) => stepIsCompleted(step.id, counts) || progress[step.id]).length;
  const readinessScore = Math.round((readyItems.filter((item) => item[2]).length / readyItems.length) * 100);

  document.querySelector('[data-walkthrough-progress]').textContent = `${completeCount} / ${STEPS.length}`;
  document.querySelector('[data-recommended-short]').textContent = recommended.short;
  document.querySelector('[data-recommended-long]').textContent = recommended.long;
  document.querySelector('[data-readiness-score]').textContent = `${readinessScore}%`;
  document.querySelector('[data-last-snapshot-short]').textContent = snapshots[0]?.createdAt ? formatDate(snapshots[0].createdAt) : 'Never';
  document.querySelector('[data-last-snapshot-long]').textContent = snapshots[0]?.label ? snapshots[0].label : 'Create a vault recovery point after setup.';

  renderReadiness(document.querySelector('[data-readiness-list]'), readyItems);
  renderSteps(document.querySelector('[data-steps]'), counts, progress);

  document.querySelector('[data-walkthrough-activity]').innerHTML = activity.length ? activity.map((item) => `
    <div class="activity-item">
      <div>
        <div class="split-label">${escapeHTML(item.message)}</div>
        <div class="caption">${escapeHTML(item.detail || '—')}</div>
      </div>
      <div class="caption">${formatDate(item.createdAt)}</div>
    </div>
  `).join('') : '<div class="empty">No activity yet. Use the app and this lane will become a live trail of what you have done.</div>';

  document.querySelectorAll('[data-step-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const stepId = button.dataset.stepToggle;
      const current = loadProgress();
      current[stepId] = !current[stepId];
      saveProgress(current);
      init();
    });
  });

  document.querySelector('[data-reset-walkthrough]').onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    init();
  };
}

init();
