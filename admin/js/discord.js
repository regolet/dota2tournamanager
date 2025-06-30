// Discord Webhooks Management UI
const webhookTypes = [
  { type: 'registration', input: 'webhook-registration', save: 'save-webhook-registration', del: 'delete-webhook-registration', test: 'test-webhook-registration' },
  { type: 'teams', input: 'webhook-teams', save: 'save-webhook-teams', del: 'delete-webhook-teams', test: 'test-webhook-teams' },
  { type: 'bracket', input: 'webhook-bracket', save: 'save-webhook-bracket', del: 'delete-webhook-bracket', test: 'test-webhook-bracket' },
  { type: 'updates', input: 'webhook-updates', save: 'save-webhook-updates', del: 'delete-webhook-updates', test: 'test-webhook-updates' }
];

// Use centralized notification system instead of local status
function showNotification(message, type = 'info') {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    // Fallback to console if notification system not available
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

async function loadWebhooks() {
  try {
    showNotification('Loading webhook configuration...', 'info');
    
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
      showNotification('Webhook configuration loaded successfully', 'success');
    } else {
      showNotification(data.message || 'Failed to load webhook configuration', 'error');
    }
  } catch (error) {
    console.error('Error loading webhooks:', error);
    showNotification('Failed to load webhook configuration. Please try again.', 'error');
  }
}

async function saveWebhook(type, inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) {
    showNotification('Please enter a webhook URL.', 'warning');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    showNotification('Please enter a valid webhook URL.', 'warning');
    return;
  }
  
  try {
    showNotification('Saving webhook...', 'info');
    
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
      showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook saved successfully!`, 'success');
    } else {
      showNotification(data.message || 'Failed to save webhook.', 'error');
    }
  } catch (error) {
    console.error('Error saving webhook:', error);
    showNotification('Failed to save webhook. Please try again.', 'error');
  }
}

async function deleteWebhook(type, inputId) {
  try {
    showNotification('Deleting webhook...', 'info');
    
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
      showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook deleted successfully.`, 'success');
    } else {
      showNotification(data.message || 'Failed to delete webhook.', 'error');
    }
  } catch (error) {
    console.error('Error deleting webhook:', error);
    showNotification('Failed to delete webhook. Please try again.', 'error');
  }
}

async function testWebhook(inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) {
    showNotification('Please enter a webhook URL to test.', 'warning');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    showNotification('Please enter a valid webhook URL.', 'warning');
    return;
  }
  
  try {
    showNotification('Sending test message...', 'info');
    
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
      showNotification('Test message sent successfully! Check your Discord channel.', 'success');
    } else {
      const errorText = await res.text();
      showNotification(`Failed to send test message. Discord returned: ${res.status}`, 'error');
      console.error('Discord webhook error:', errorText);
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    showNotification('Failed to send test message. Please check your webhook URL and try again.', 'error');
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

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initDiscord, cleanupDiscord };
} else {
  window.initDiscord = initDiscord;
  window.cleanupDiscord = cleanupDiscord;
} 