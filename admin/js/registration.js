// Registration Sessions Manager - IIFE Pattern to prevent redeclaration
(function() {
    'use strict';
    
    // Prevent multiple loads
    if (window.registrationModuleLoaded) {
        return;
    }
    window.registrationModuleLoaded = true;
    
    // Module state
    const state = {
        registrationSessions: [],
        currentUser: null,
        initialized: false
    };

// Initialize registration module
async function initRegistration() {
    try {
            console.log('Registration module initialization starting...');
            
            // If already initialized, just refresh data
            if (state.initialized) {
                console.log('Registration module already initialized, refreshing data...');
                await loadRegistrationSessions();
                return;
            }
            
            // Get current user info from session manager
            state.currentUser = window.sessionManager?.getUserInfo();
            
            // Setup event listeners
            setupEventListeners();
            
            // Load registration sessions
            await loadRegistrationSessions();
            
            // Mark as initialized
            state.initialized = true;
            
            console.log('Registration module initialized successfully');
        } catch (error) {
            console.error('Error initializing registration module:', error);
            showAlert('Failed to initialize registration module', 'danger');
            // Reset state on error
            state.initialized = false;
        }
    }
    
    function setupEventListeners() {
        // Create new registration link button
        const createBtn = document.getElementById('create-registration-link');
        if (createBtn) {
            createBtn.addEventListener('click', showCreateSessionModal);
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-registration-sessions');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadRegistrationSessions);
        }
        
        // Registration session form
        const sessionForm = document.getElementById('registration-session-form');
        if (sessionForm) {
            sessionForm.addEventListener('submit', handleSessionSave);
        }
        
        // Copy URL button
        const copyBtn = document.getElementById('copy-url-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyRegistrationUrl);
        }
    }
    
    async function loadRegistrationSessions() {
        try {
            console.log('Loading registration sessions...');
            
            // Show loading state
            const tableBody = document.getElementById('registration-sessions-table');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Loading registration sessions...
                        </td>
                    </tr>
                `;
            }
            
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            if (!sessionId) {
                showAlert('Session expired. Please login again.', 'danger');
                return;
            }
            
            const response = await fetch('/.netlify/functions/registration-sessions', {
                headers: {
                    'x-session-id': sessionId
                }
            });
            
        if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
            const data = await response.json();
            
            if (data.success && data.sessions) {
                state.registrationSessions = data.sessions;
                displayRegistrationSessions();
                console.log(`Loaded ${data.sessions.length} registration sessions`);
            } else {
                console.error('Failed to load registration sessions:', data);
                showAlert(data.message || 'Failed to load registration sessions', 'danger');
            }
        } catch (error) {
            console.error('Error loading registration sessions:', error);
            showAlert(`Error loading registration sessions: ${error.message}`, 'danger');
            
            // Show error state in table
            const tableBody = document.getElementById('registration-sessions-table');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4 text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Failed to load registration sessions
                            <br><small>Please try refreshing or check your connection</small>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    function displayRegistrationSessions() {
        const tableBody = document.getElementById('registration-sessions-table');
        
        if (!tableBody) return;
        
        if (state.registrationSessions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox me-2"></i>
                        No registration links created yet.
                        <br><small>Click "Create New Link" to get started.</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        
        state.registrationSessions.forEach(session => {
            const row = document.createElement('tr');
            
            // Status determination
            let statusBadge = '';
            let statusClass = '';
            
            if (!session.isActive) {
                statusBadge = 'Inactive';
                statusClass = 'bg-secondary';
            } else if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                statusBadge = 'Expired';
                statusClass = 'bg-warning';
            } else if (session.playerCount >= session.maxPlayers) {
                statusBadge = 'Full';
                statusClass = 'bg-danger';
            } else {
                statusBadge = 'Active';
                statusClass = 'bg-success';
            }
            
            // Progress calculation
            const progress = Math.min((session.playerCount / session.maxPlayers) * 100, 100);
            
            row.innerHTML = `
                <td>
                    <div class="fw-bold">${escapeHtml(session.title)}</div>
                    <small class="text-muted">ID: ${session.sessionId}</small>
                </td>
                <td>
                    <div class="text-truncate" style="max-width: 200px;" title="${escapeHtml(session.description || '')}">
                        ${escapeHtml(session.description || '-')}
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="me-2">${session.playerCount}/${session.maxPlayers}</span>
                        <div class="progress flex-grow-1" style="height: 6px; width: 60px;">
                            <div class="progress-bar ${progress >= 100 ? 'bg-danger' : 'bg-primary'}" 
                                 style="width: ${progress}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${statusClass}">${statusBadge}</span>
                </td>
                <td>
                    <small>${formatDate(session.createdAt)}</small>
                </td>
                <td>
                    <small>${session.expiresAt ? formatDate(session.expiresAt) : 'Never'}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="copySessionLink('${session.sessionId}')" title="Copy Link">
                            <i class="bi bi-clipboard"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="openSessionLink('${session.sessionId}')" title="Open Link">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="editSession('${session.sessionId}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        ${session.isActive ? 
                            `<button class="btn btn-outline-warning" onclick="closeSession('${session.sessionId}', '${escapeHtml(session.title).replace(/'/g, '\\\'')}')" title="Close Registration">
                                <i class="bi bi-stop-circle"></i>
                            </button>` : 
                            `<button class="btn btn-outline-success" onclick="reopenSession('${session.sessionId}', '${escapeHtml(session.title).replace(/'/g, '\\\'')}')" title="Reopen Registration">
                                <i class="bi bi-play-circle"></i>
                            </button>`
                        }
                        <button class="btn btn-outline-danger" onclick="deleteSession('${session.sessionId}', '${escapeHtml(session.title).replace(/'/g, '\\\'')}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    function showCreateSessionModal() {
        // Reset form
        document.getElementById('registration-session-form').reset();
        document.getElementById('edit-session-id').value = '';
        
        // Update modal title and button
        document.getElementById('registrationSessionModalLabel').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Create Registration Link';
        document.getElementById('save-session-btn').textContent = 'Create Link';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('registrationSessionModal'));
        modal.show();
    }
    
    async function handleSessionSave(e) {
        e.preventDefault();
        
        const sessionId = document.getElementById('edit-session-id').value;
        const isEdit = !!sessionId;
        
        const sessionData = {
            title: document.getElementById('session-title').value,
            description: document.getElementById('session-description').value,
            maxPlayers: parseInt(document.getElementById('session-max-players').value),
            expiresAt: document.getElementById('session-expires-at').value || null
        };
        
        if (isEdit) {
            sessionData.sessionId = sessionId;
        }
        
        const saveButton = document.getElementById('save-session-btn');
        const originalText = saveButton.textContent;
        
        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            
            const adminSessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const url = '/.netlify/functions/registration-sessions';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': adminSessionId
                },
                body: JSON.stringify(sessionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSessionAlert(`Registration link ${isEdit ? 'updated' : 'created'} successfully`, 'success');
                
                if (!isEdit && data.sessionId && data.registrationUrl) {
                    // Show the registration link modal
                    showRegistrationLinkModal(data.registrationUrl);
                }
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('registrationSessionModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Reload sessions list
                await loadRegistrationSessions();
                
                // Notify other components to refresh their player lists
                // This ensures Player List, Team Balancer, and Random Picker get updated data
                notifyPlayerListsToRefresh(isEdit ? 'updated' : 'created');
            } else {
                showSessionAlert(data.message || `Failed to ${isEdit ? 'update' : 'create'} registration link`, 'danger');
            }
        } catch (error) {
            console.error('Error saving registration session:', error);
            showSessionAlert('Error saving registration link', 'danger');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }
    
    function showRegistrationLinkModal(url) {
        document.getElementById('registration-url').value = url;
        const modal = new bootstrap.Modal(document.getElementById('registrationLinkModal'));
        modal.show();
    }
    
    async function editSession(sessionId) {
        try {
            const adminSessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const response = await fetch(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`, {
                headers: {
                    'x-session-id': adminSessionId
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.session) {
                const session = data.session;
                
                // Fill form
                document.getElementById('edit-session-id').value = session.sessionId;
                document.getElementById('session-title').value = session.title;
                document.getElementById('session-description').value = session.description || '';
                document.getElementById('session-max-players').value = session.maxPlayers;
                
                if (session.expiresAt) {
                    // Convert to local datetime-local format
                    const date = new Date(session.expiresAt);
                    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    document.getElementById('session-expires-at').value = localDateTime;
                } else {
                    document.getElementById('session-expires-at').value = '';
                }
                
                // Update modal title and button
                document.getElementById('registrationSessionModalLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Registration Link';
                document.getElementById('save-session-btn').textContent = 'Update Link';
                
                // Show modal
                const modal = new bootstrap.Modal(document.getElementById('registrationSessionModal'));
                modal.show();
            } else {
                showAlert(data.message || 'Failed to load registration session', 'danger');
        }
    } catch (error) {
            console.error('Error loading registration session:', error);
            showAlert('Error loading registration session', 'danger');
        }
    }
    
    async function deleteSession(sessionId, title) {
        if (!confirm(`Are you sure you want to delete the registration link for "${title}"?`)) {
        return;
    }
    
        try {
            const adminSessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const response = await fetch('/.netlify/functions/registration-sessions', {
                method: 'DELETE',
            headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': adminSessionId
                },
                body: JSON.stringify({ sessionId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert(`Registration link "${title}" deleted successfully`, 'success');
                await loadRegistrationSessions();
                
                // Notify other components about the deletion
                notifyPlayerListsToRefresh('deleted');
        } else {
                showAlert(data.message || 'Failed to delete registration link', 'danger');
        }
    } catch (error) {
            console.error('Error deleting registration session:', error);
            showAlert('Error deleting registration link', 'danger');
        }
    }
    
    /**
     * Close registration session
     */
    async function closeSession(sessionId, title) {
        if (!confirm(`Are you sure you want to close registration for "${title}"?`)) {
            return;
        }
        
        try {
            const adminSessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const response = await fetch(`/.netlify/functions/registration-sessions`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': adminSessionId
                },
                body: JSON.stringify({ 
                    sessionId: sessionId,
                    isActive: false
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert(`Registration "${title}" closed successfully`, 'success');
                loadRegistrationSessions(); // Reload the list
                notifyPlayerListsToRefresh('closed');
            } else {
                showAlert(data.message || 'Failed to close registration', 'danger');
            }
        } catch (error) {
            console.error('Error closing registration session:', error);
            showAlert('Error closing registration', 'danger');
        }
    }

    /**
     * Reopen registration session
     */
    async function reopenSession(sessionId, title) {
        if (!confirm(`Are you sure you want to reopen registration for "${title}"?`)) {
            return;
        }
        
        try {
            const adminSessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const response = await fetch(`/.netlify/functions/registration-sessions`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': adminSessionId
                },
                body: JSON.stringify({ 
                    sessionId: sessionId,
                    isActive: true
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert(`Registration "${title}" reopened successfully`, 'success');
                loadRegistrationSessions(); // Reload the list
                notifyPlayerListsToRefresh('reopened');
            } else {
                showAlert(data.message || 'Failed to reopen registration', 'danger');
            }
        } catch (error) {
            console.error('Error reopening registration session:', error);
            showAlert('Error reopening registration', 'danger');
        }
    }

    function copySessionLink(sessionId) {
        const url = `${window.location.origin}/register/?session=${sessionId}`;
        copyToClipboard(url);
        showAlert('Registration link copied to clipboard!', 'success');
    }
    
    function openSessionLink(sessionId) {
        const url = `${window.location.origin}/register/?session=${sessionId}`;
        window.open(url, '_blank');
    }
    
    function copyRegistrationUrl() {
        const urlInput = document.getElementById('registration-url');
        copyToClipboard(urlInput.value);
        
        const copyBtn = document.getElementById('copy-url-btn');
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="bi bi-check me-1"></i>Copied!';
        copyBtn.classList.add('btn-success');
        copyBtn.classList.remove('btn-outline-secondary');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
            copyBtn.classList.remove('btn-success');
            copyBtn.classList.add('btn-outline-secondary');
        }, 2000);
    }
    
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }
    
    function showAlert(message, type = 'info') {
        const alertArea = document.getElementById('registration-alert-area');
        if (!alertArea) return;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        alertArea.appendChild(alertDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    function showSessionAlert(message, type = 'info') {
        const alertDiv = document.getElementById('session-alert');
        if (alertDiv) {
            alertDiv.className = `alert alert-${type}`;
            alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}-fill me-2"></i>${message}`;
            alertDiv.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    alertDiv.style.display = 'none';
                }, 3000);
            }
        }
    }
    
    function formatDate(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        const now = new Date();
        
        // If it's today, show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If it's this year, show month and day
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        
        // Otherwise show full date
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Function to reset registration module (for cleanup)
    function resetRegistrationModule() {
        state.initialized = false;
        state.registrationSessions = [];
        state.currentUser = null;
        window.registrationModuleLoaded = false;
    }
    
    /**
     * Notify other admin components to refresh their player lists
     * This ensures all player-related components stay in sync when registration settings change
     */
    function notifyPlayerListsToRefresh(actionType = 'updated') {
        console.log(`🔄 Registration ${actionType}: Notifying player list components to refresh`);
        
        // Create a custom event for player list refresh
        const refreshEvent = new CustomEvent('registrationUpdated', {
            detail: {
                action: actionType,
                timestamp: new Date().toISOString()
            }
        });
        
        // Dispatch the event globally
        window.dispatchEvent(refreshEvent);
        
        // Also try direct function calls for immediate refresh
        setTimeout(() => {
            // Refresh Player List if loaded
            if (typeof window.loadPlayers === 'function') {
                console.log('📋 Refreshing Player List...');
                window.loadPlayers(true);
            } else if (window.playerListModule && typeof window.playerListModule.loadPlayers === 'function') {
                console.log('📋 Refreshing Player List module...');
                window.playerListModule.loadPlayers(true);
            }
            
            // Refresh Team Balancer if loaded
            if (typeof window.loadPlayersForBalancer === 'function') {
                console.log('⚖️ Refreshing Team Balancer...');
                window.loadPlayersForBalancer();
            } else if (window.teamBalancerModule && typeof window.teamBalancerModule.loadPlayersForBalancer === 'function') {
                console.log('⚖️ Refreshing Team Balancer module...');
                window.teamBalancerModule.loadPlayersForBalancer();
            }
            
            // Refresh Random Picker if loaded
            if (typeof window.loadPlayersForPicker === 'function') {
                console.log('🎲 Refreshing Random Picker...');
                window.loadPlayersForPicker();
            } else if (window.randomPickerModule && typeof window.randomPickerModule.loadPlayersForPicker === 'function') {
                console.log('🎲 Refreshing Random Picker module...');
                window.randomPickerModule.loadPlayersForPicker();
            }
            
            // Refresh main tournament index page if it's open (for public users)
            if (typeof window.loadTournaments === 'function') {
                console.log('🏠 Refreshing main tournament index...');
                window.loadTournaments();
            }
            
            // Refresh navigation tournament counter if available
            if (typeof window.updateNavigationStats === 'function') {
                console.log('📊 Updating navigation statistics...');
                window.updateNavigationStats();
            }
            
            // Show success notification
            if (window.showNotification) {
                window.showNotification(
                    `Registration ${actionType} - All player lists and tournament data refreshed`, 
                    'info'
                );
            }
        }, 500); // Small delay to ensure registration changes are processed
    }
    
    // Expose functions globally that need to be called from HTML
    window.initRegistration = initRegistration;
    window.editSession = editSession;
    window.deleteSession = deleteSession;
    window.closeSession = closeSession;
    window.reopenSession = reopenSession;
    window.copySessionLink = copySessionLink;
    window.openSessionLink = openSessionLink;
    window.resetRegistrationModule = resetRegistrationModule;
    window.notifyPlayerListsToRefresh = notifyPlayerListsToRefresh;
    
})(); 