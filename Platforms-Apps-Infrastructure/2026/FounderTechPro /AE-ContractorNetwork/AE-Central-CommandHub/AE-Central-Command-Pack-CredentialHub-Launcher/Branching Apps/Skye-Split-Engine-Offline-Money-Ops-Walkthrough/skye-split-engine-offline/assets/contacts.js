import { bootPage, formatDate, logActivity, maybeAutoSnapshot, uid } from './app-core.js';
import { deleteOne, getAll, putOne } from './db.js';

let contacts = [];
let editingId = null;

function contactCard(contact) {
  return `
    <div class="contact-row">
      <div>
        <div class="split-label">${contact.name}</div>
        <div class="caption">${contact.role || 'Role not set'}${contact.company ? ` · ${contact.company}` : ''}</div>
        <div class="caption">${contact.email || 'No email'}${contact.phone ? ` · ${contact.phone}` : ''}</div>
      </div>
      <div class="inline-actions">
        <button class="btn-soft" data-edit-id="${contact.id}">Edit</button>
        <button class="btn-danger" data-delete-id="${contact.id}">Delete</button>
      </div>
    </div>
  `;
}

function fillForm(contact = null) {
  const form = document.querySelector('#contactForm');
  editingId = contact?.id || null;
  form.name.value = contact?.name || '';
  form.role.value = contact?.role || '';
  form.company.value = contact?.company || '';
  form.email.value = contact?.email || '';
  form.phone.value = contact?.phone || '';
  form.defaultValue.value = contact?.defaultValue ?? '';
  form.notes.value = contact?.notes || '';
  document.querySelector('[data-form-heading]').textContent = editingId ? 'Edit contact' : 'Add contact';
}

function renderList(filter = '') {
  const target = document.querySelector('[data-contact-list]');
  const filtered = contacts.filter((contact) => {
    const text = `${contact.name} ${contact.role || ''} ${contact.company || ''} ${contact.email || ''}`.toLowerCase();
    return text.includes(filter.toLowerCase());
  });

  target.innerHTML = filtered.length ? filtered.map(contactCard).join('') : '<div class="empty">No contacts yet. Save a few people, payout recipients, or vendors here.</div>';
  target.querySelectorAll('[data-edit-id]').forEach((button) => button.addEventListener('click', () => {
    const match = contacts.find((contact) => contact.id === button.dataset.editId);
    if (match) fillForm(match);
  }));
  target.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', async () => {
    const match = contacts.find((contact) => contact.id === button.dataset.deleteId);
    if (!match) return;
    const okay = confirm(`Delete ${match.name}?`);
    if (!okay) return;
    await deleteOne('contacts', match.id);
    await logActivity('Contact deleted', match.name);
    await maybeAutoSnapshot('contact-delete');
    await loadContacts();
  }));
}

async function loadContacts() {
  contacts = (await getAll('contacts')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  document.querySelector('[data-contact-count]').textContent = `${contacts.length} saved`;
  document.querySelector('[data-last-contact-update]').textContent = contacts[0] ? formatDate(contacts[0].updatedAt) : 'No contacts yet';
  renderList(document.querySelector('#contactSearch').value || '');
}

async function init() {
  await bootPage('Contacts Hub');
  const form = document.querySelector('#contactForm');
  const search = document.querySelector('#contactSearch');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: editingId || uid('contact'),
      name: form.name.value.trim(),
      role: form.role.value.trim(),
      company: form.company.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      defaultValue: form.defaultValue.value.trim(),
      notes: form.notes.value.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: editingId ? contacts.find((contact) => contact.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString()
    };
    if (!payload.name) {
      alert('Name is required.');
      return;
    }
    await putOne('contacts', payload);
    await logActivity(editingId ? 'Contact updated' : 'Contact added', payload.name);
    await maybeAutoSnapshot('contact-save');
    fillForm(null);
    form.reset();
    await loadContacts();
  });

  document.querySelector('[data-reset-contact-form]').addEventListener('click', () => {
    editingId = null;
    form.reset();
    fillForm(null);
  });

  search.addEventListener('input', () => renderList(search.value));

  document.querySelector('[data-export-contacts]').addEventListener('click', () => {
    const data = JSON.stringify(contacts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skye-split-contacts-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  fillForm(null);
  await loadContacts();
}

init();
