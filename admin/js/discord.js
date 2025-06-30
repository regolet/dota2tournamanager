// Discord Webhooks Management UI
const webhookTypes = [
  { type: 'registration', input: 'webhook-registration', save: 'save-webhook-registration', del: 'delete-webhook-registration', test: 'test-webhook-registration' },
  { type: 'teams', input: 'webhook-teams', save: 'save-webhook-teams', del: 'delete-webhook-teams', test: 'test-webhook-teams' },
  { type: 'bracket', input: 'webhook-bracket', save: 'save-webhook-bracket', del: 'delete-webhook-bracket', test: 'test-webhook-bracket' },
  { type: 'updates', input: 'webhook-updates', save: 'save-webhook-updates', del: 'delete-webhook-updates', test: 'test-webhook-updates' }
];

const statusDiv = document.getElementById('discord-webhooks-status');

function showStatus(msg, type = 'info') {
  statusDiv.innerHTML = `<div class="alert alert-${type} py-2">${msg}</div>`;
  setTimeout(() => { statusDiv.innerHTML = ''; }, 4000);
}

async function loadWebhooks() {
  const res = await fetch('/.netlify/functions/discord-webhooks', {
    headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
  });
  const data = await res.json();
  if (data.success) {
    webhookTypes.forEach(({ type, input }) => {
      const wh = data.webhooks.find(w => w.type === type);
      document.getElementById(input).value = wh ? wh.url : '';
    });
  }
}

function saveWebhook(type, inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) return showStatus('Please enter a webhook URL.', 'warning');
  fetch('/.netlify/functions/discord-webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': localStorage.getItem('adminSessionId') },
    body: JSON.stringify({ type, url })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) showStatus('Webhook saved!', 'success');
      else showStatus('Failed to save webhook.', 'danger');
    });
}

function deleteWebhook(type, inputId) {
  fetch('/.netlify/functions/discord-webhooks', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-session-id': localStorage.getItem('adminSessionId') },
    body: JSON.stringify({ type })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById(inputId).value = '';
        showStatus('Webhook deleted.', 'success');
      } else showStatus('Failed to delete webhook.', 'danger');
    });
}

function testWebhook(inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) return showStatus('Please enter a webhook URL to test.', 'warning');
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '✅ This is a test message from the Tournament Manager admin panel.' })
  })
    .then(res => {
      if (res.ok) showStatus('Test message sent!', 'success');
      else showStatus('Failed to send test message.', 'danger');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.getElementById('discord-tab').addEventListener('click', () => {
    document.querySelectorAll('main > .container > .row > .col-12 > div').forEach(div => div.classList.add('d-none'));
    document.getElementById('discord-webhooks-section').classList.remove('d-none');
    loadWebhooks();
  });
  // Button handlers
  webhookTypes.forEach(({ type, input, save, del, test }) => {
    document.getElementById(save).addEventListener('click', () => saveWebhook(type, input));
    document.getElementById(del).addEventListener('click', () => deleteWebhook(type, input));
    document.getElementById(test).addEventListener('click', () => testWebhook(input));
  });
}); 