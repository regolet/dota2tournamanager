// Prevent redeclaration in SPA reloads
if (!window.discordModuleInitialized) {
  window.discordModuleInitialized = true;

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
      }
    });
    
    // Set up template editing functionality
    setupTemplateEditing();
  }

  // Cleanup function for Discord module
  function cleanupDiscord() {
    console.log('Cleaning up Discord module...');
    
    // Remove event listeners
    webhookTypes.forEach(({ type, input, save, del, test }) => {
      const saveBtn = document.getElementById(save);
      const delBtn = document.getElementById(del);
      const testBtn = document.getElementById(test);
      
      if (saveBtn) {
        saveBtn.replaceWith(saveBtn.cloneNode(true));
      }
      
      if (delBtn) {
        delBtn.replaceWith(delBtn.cloneNode(true));
      }
      
      if (testBtn) {
        testBtn.replaceWith(testBtn.cloneNode(true));
      }
    });
    
    // Remove template editing event listeners
    const templateButtons = document.querySelectorAll('[data-template-type]');
    templateButtons.forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
  }

  // Template editing functionality
  function setupTemplateEditing() {
    const templateButtons = document.querySelectorAll('[data-template-type]');
    templateButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const templateType = btn.getAttribute('data-template-type');
        openEditTemplateModal(templateType);
      });
    });
  }

  async function openEditTemplateModal(type) {
    // Create modal if it doesn't exist
    if (!document.getElementById('template-edit-modal')) {
      const modalHTML = `
        <div class="modal fade" id="template-edit-modal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Discord Template</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label for="template-content" class="form-label">Template Content</label>
                  <textarea class="form-control" id="template-content" rows="10" placeholder="Enter your Discord message template..."></textarea>
                  <div class="form-text">Use {{variable}} syntax for dynamic content</div>
                </div>
                <div class="mb-3">
                  <h6>Available Variables:</h6>
                  <div id="template-variables" class="small text-muted"></div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="save-template-btn">Save Template</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('template-edit-modal'));
    modal.show();
  }

  function fillTemplateVars(obj, vars) {
    let result = JSON.stringify(obj);
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, vars[key]);
    });
    return JSON.parse(result);
  }

  async function sendDiscordMessage(type, vars) {
    try {
      const res = await fetch('/.netlify/functions/discord-webhooks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-session-id': localStorage.getItem('adminSessionId') 
        },
        body: JSON.stringify({ type, message: vars })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      if (data.success) {
        showDiscordNotification('Discord message sent successfully!', 'success');
      } else {
        showDiscordNotification(data.message || 'Failed to send Discord message.', 'error');
      }
    } catch (error) {
      console.error('Error sending Discord message:', error);
      showDiscordNotification('Failed to send Discord message. Please try again.', 'error');
    }
  }

  // Expose functions globally
  window.initDiscord = initDiscord;
  window.cleanupDiscord = cleanupDiscord;
  window.sendDiscordMessage = sendDiscordMessage;
} 