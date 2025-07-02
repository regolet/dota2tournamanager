// Discord Webhooks Management UI
const webhookTypes = [
  { type: 'registration', input: 'webhook-registration', save: 'save-webhook-registration', del: 'delete-webhook-registration', test: 'test-webhook-registration' },
  { type: 'teams', input: 'webhook-teams', save: 'save-webhook-teams', del: 'delete-webhook-teams', test: 'test-webhook-teams' },
  { type: 'bracket', input: 'webhook-bracket', save: 'save-webhook-bracket', del: 'delete-webhook-bracket', test: 'test-webhook-bracket' },
  { type: 'updates', input: 'webhook-updates', save: 'save-webhook-updates', del: 'delete-webhook-updates', test: 'test-webhook-updates' },
  { type: 'attendance', input: 'webhook-attendance', save: 'save-webhook-attendance', del: 'delete-webhook-attendance', test: 'test-webhook-attendance' }
];

// Use centralized notification system instead of local status
function showDiscordNotification(message, type = 'info') {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    // Fallback to console if notification system not available
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

async function loadWebhooks() {
  try {
    showDiscordNotification('Loading webhook configuration...', 'info');
    
    const res = await fetch('/.netlify/functions/discord-webhooks', {
      headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (data.success) {
      webhookTypes.forEach(({ type, input }) => {
        const wh = data.webhooks.find(w => w.type === type);
        document.getElementById(input).value = wh ? wh.url : '';
      });
      showDiscordNotification('Webhook configuration loaded successfully', 'success');
    } else {
      showDiscordNotification(data.message || 'Failed to load webhook configuration', 'error');
    }
  } catch (error) {
    console.error('Error loading webhooks:', error);
    showDiscordNotification('Failed to load webhook configuration. Please try again.', 'error');
  }
}

async function saveWebhook(type, inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) {
    showDiscordNotification('Please enter a webhook URL.', 'warning');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    showDiscordNotification('Please enter a valid webhook URL.', 'warning');
    return;
  }
  
  try {
    showDiscordNotification('Saving webhook...', 'info');
    
    const res = await fetch('/.netlify/functions/discord-webhooks', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-session-id': localStorage.getItem('adminSessionId') 
      },
      body: JSON.stringify({ type, url })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (data.success) {
      showDiscordNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook saved successfully!`, 'success');
    } else {
      showDiscordNotification(data.message || 'Failed to save webhook.', 'error');
    }
  } catch (error) {
    console.error('Error saving webhook:', error);
    showDiscordNotification('Failed to save webhook. Please try again.', 'error');
  }
}

async function deleteWebhook(type, inputId) {
  try {
    showDiscordNotification('Deleting webhook...', 'info');
    
    const res = await fetch('/.netlify/functions/discord-webhooks', {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json', 
        'x-session-id': localStorage.getItem('adminSessionId') 
      },
      body: JSON.stringify({ type })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (data.success) {
      document.getElementById(inputId).value = '';
      showDiscordNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook deleted successfully.`, 'success');
    } else {
      showDiscordNotification(data.message || 'Failed to delete webhook.', 'error');
    }
  } catch (error) {
    console.error('Error deleting webhook:', error);
    showDiscordNotification('Failed to delete webhook. Please try again.', 'error');
  }
}

async function testWebhook(inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) {
    showDiscordNotification('Please enter a webhook URL to test.', 'warning');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    showDiscordNotification('Please enter a valid webhook URL.', 'warning');
    return;
  }
  
  try {
    showDiscordNotification('Sending test message...', 'info');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: '✅ **Test Message**\nThis is a test message from the Tournament Manager admin panel.\n\n*If you can see this message, your webhook is working correctly!*',
        username: 'Tournament Manager',
        avatar_url: 'https://cdn.discordapp.com/emojis/1234567890.png' // You can add a custom avatar URL here
      })
    });
    
    if (res.ok) {
      showDiscordNotification('Test message sent successfully! Check your Discord channel.', 'success');
    } else {
      const errorText = await res.text();
      showDiscordNotification(`Failed to send test message. Discord returned: ${res.status}`, 'error');
      console.error('Discord webhook error:', errorText);
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    showDiscordNotification('Failed to send test message. Please check your webhook URL and try again.', 'error');
  }
}

// Initialize Discord webhook management
function initDiscord() {
  console.log('Initializing Discord webhook management...');
  
  // Load existing webhooks
  loadWebhooks();
  
  // Set up button handlers
  webhookTypes.forEach(({ type, input, save, del, test }) => {
    const saveBtn = document.getElementById(save);
    const delBtn = document.getElementById(del);
    const testBtn = document.getElementById(test);
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveWebhook(type, input));
      // Add loading state
      saveBtn.addEventListener('click', function() {
        const originalText = this.innerHTML;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Saving...';
        this.disabled = true;
        
        setTimeout(() => {
          this.innerHTML = originalText;
          this.disabled = false;
        }, 2000);
      });
    }
    
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this webhook?')) {
          deleteWebhook(type, input);
        }
      });
    }
    
    if (testBtn) {
      testBtn.addEventListener('click', () => testWebhook(input));
      // Add loading state
      testBtn.addEventListener('click', function() {
        const originalText = this.innerHTML;
        this.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Testing...';
        this.disabled = true;
        
        setTimeout(() => {
          this.innerHTML = originalText;
          this.disabled = false;
        }, 3000);
      });
    }
  });

  // Edit Template button handlers
  document.getElementById('edit-template-registration').addEventListener('click', () => openEditTemplateModal('registration'));
  document.getElementById('edit-template-teams').addEventListener('click', () => openEditTemplateModal('teams'));
  document.getElementById('edit-template-bracket').addEventListener('click', () => openEditTemplateModal('bracket'));
  document.getElementById('edit-template-updates').addEventListener('click', () => openEditTemplateModal('updates'));
  document.getElementById('edit-template-attendance').addEventListener('click', () => openEditTemplateModal('attendance'));

  // Save template
  document.getElementById('edit-template-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const type = document.getElementById('edit-template-type').value;
    const content = document.getElementById('edit-template-content').value;
    // Get the current webhook URL for this type from the input
    const inputId = webhookTypes.find(w => w.type === type).input;
    const url = document.getElementById(inputId).value.trim();
    if (!url) {
      showDiscordNotification('Please enter a webhook URL.', 'warning');
      return;
    }
    try {
      showDiscordNotification('Saving webhook...', 'info');
      const res = await fetch('/.netlify/functions/discord-webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('adminSessionId')
        },
        body: JSON.stringify({ type, url, template: content })
      });
      if (!res.ok) throw new Error('Failed to save webhook');
      const data = await res.json();
      if (data.success) {
        showDiscordNotification('Template saved!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editTemplateModal')).hide();
      } else {
        showDiscordNotification(data.message || 'Failed to save webhook.', 'error');
      }
    } catch (error) {
      showDiscordNotification('Failed to save webhook. Please try again.', 'error');
    }
  });

  // Reset to default
  document.getElementById('reset-template-btn').addEventListener('click', function() {
    document.getElementById('edit-template-content').value = '';
  });

  return true;
}

// Cleanup function for Discord module
function cleanupDiscord() {
  console.log('Cleaning up Discord webhook management...');
  
  // Remove event listeners
  webhookTypes.forEach(({ type, input, save, del, test }) => {
    const saveBtn = document.getElementById(save);
    const delBtn = document.getElementById(del);
    const testBtn = document.getElementById(test);
    
    if (saveBtn) saveBtn.replaceWith(saveBtn.cloneNode(true));
    if (delBtn) delBtn.replaceWith(delBtn.cloneNode(true));
    if (testBtn) testBtn.replaceWith(testBtn.cloneNode(true));
  });
  
  // Clear status area
  const statusDiv = document.getElementById('discord-webhooks-status');
  if (statusDiv) {
    statusDiv.innerHTML = '';
  }
}

// Modal logic
async function openEditTemplateModal(type) {
  const modal = new bootstrap.Modal(document.getElementById('editTemplateModal'));
  document.getElementById('edit-template-type').value = type;
  // Fetch template from backend
  try {
    const res = await fetch('/.netlify/functions/discord-webhooks', {
      headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
    });
    if (!res.ok) throw new Error('Failed to fetch webhooks');
    const data = await res.json();
    let template = '';
    if (data.success && Array.isArray(data.webhooks)) {
      const wh = data.webhooks.find(w => w.type === type);
      template = wh && wh.template ? wh.template : '';
    }
    document.getElementById('edit-template-content').value = template;
  } catch (e) {
    document.getElementById('edit-template-content').value = '';
  }
  // Set modal title
  const label = {
    registration: 'Registration Link',
    teams: 'Teams',
    bracket: 'Bracket',
    updates: 'Bracket Updates',
    attendance: 'Attendance'
  }[type] || 'Template';
  document.getElementById('editTemplateModalLabel').innerHTML = `<i class="bi bi-pencil-square me-2"></i>Edit Discord Message Template: <span class="text-primary">${label}</span>`;
  modal.show();
}

// Utility to fill variables recursively in a template object
function fillTemplateVars(obj, vars) {
  if (typeof obj === 'string') {
    let result = obj;
    for (const key in vars) {
      result = result.replaceAll(`{${key}}`, vars[key]);
    }
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(item => fillTemplateVars(item, vars));
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = fillTemplateVars(obj[key], vars);
    }
    return newObj;
  }
  return obj;
}

// Generalized function to send a Discord message for any type
async function sendDiscordMessage(type, vars) {
  try {
    // Fetch webhooks from backend
    const res = await fetch('/.netlify/functions/discord-webhooks', {
      headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
    });
    if (!res.ok) {
      showDiscordNotification('Failed to fetch Discord webhooks from server.', 'error');
      return;
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.webhooks)) {
      showDiscordNotification('No Discord webhooks found for your account.', 'warning');
      return;
    }
    // Find webhook and template for this type
    const webhookObj = data.webhooks.find(w => w.type === type);
    const webhookUrl = webhookObj ? webhookObj.url : '';
    const template = webhookObj && webhookObj.template ? webhookObj.template : '';
    if (!webhookUrl) {
      showDiscordNotification(`No Discord webhook URL set for ${type}. Please configure it in the Discord tab.`, 'warning');
      return;
    }
    if (!template) {
      showDiscordNotification(`No Discord message template set for ${type}. Please configure it in the Discord tab.`, 'warning');
      return;
    }
    // Try to parse as JSON (embed)
    let bodyToSend = null;
    try {
      let embedObj = JSON.parse(template);
      embedObj = fillTemplateVars(embedObj, vars);
      bodyToSend = embedObj;
    } catch (e) {
      // Not valid JSON, fallback to plain text
      bodyToSend = {
        content: fillTemplateVars(template, vars),
        username: 'Tournament Manager',
        avatar_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
      };
    }
    // Send to Discord webhook
    const sendRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyToSend)
    });
    if (sendRes.ok) {
      showDiscordNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} message sent to Discord!`, 'success');
    } else {
      const errorText = await sendRes.text();
      showDiscordNotification(`Failed to send to Discord. ${errorText}`, 'error');
    }
  } catch (error) {
    showDiscordNotification(`Error sending to Discord: ${error.message}`, 'error');
  }
}

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initDiscord, cleanupDiscord };
} else {
  window.initDiscord = initDiscord;
  window.cleanupDiscord = cleanupDiscord;
} 