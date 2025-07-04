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

// Utility to wait for an element to exist in the DOM
async function waitForElement(id, maxAttempts = 10, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            const el = document.getElementById(id);
            if (el) return resolve(el);
            attempts++;
            if (attempts >= maxAttempts) return reject(new Error('Element not found: ' + id));
            setTimeout(check, interval);
        };
        check();
    });
}

let registrationInitAttempts = 0;
const MAX_REGISTRATION_INIT_ATTEMPTS = 10;

// Add a module-level variable to track the last loaded session count
let lastLoadedSessionCount = null;

// Initialize registration module
async function initRegistration() {
    try {
        // Always re-initialize when called (for tab switching)
        state.initialized = false;
        state.registrationSessions = [];
        state.currentUser = null;
        window.registrationModuleLoaded = false;
        registrationInitAttempts = 0;
        
        setupEventListeners();
        
        try {
            await waitForElement('registration-sessions-table-body', 20, 100);
        } catch (e) {
            registrationInitAttempts++;
            if (registrationInitAttempts < MAX_REGISTRATION_INIT_ATTEMPTS) {
                setTimeout(initRegistration, 200);
                return;
            } else {
                return;
            }
        }
        
        await loadRegistrationSessions();
        state.initialized = true;
        window.registrationModuleLoaded = true;
    } catch (error) {
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
        
        // Event delegation for dynamically created buttons
        const tableBody = document.getElementById('registration-sessions-table-body');
        if (tableBody) {
            tableBody.addEventListener('click', function(e) {
                const target = e.target.closest('button');
                if (!target) return;
                
                const sessionId = target.dataset.sessionId;
                const sessionTitle = target.dataset.sessionTitle;
                
                if (target.classList.contains('copy-session-link')) {
                    copySessionLink(sessionId);
                } else if (target.classList.contains('open-session-link')) {
                    openSessionLink(sessionId);
                } else if (target.classList.contains('edit-session')) {
                    editSession(sessionId);
                } else if (target.classList.contains('close-session')) {
                    closeSession(sessionId, sessionTitle);
                } else if (target.classList.contains('reopen-session')) {
                    reopenSession(sessionId, sessionTitle);
                } else if (target.classList.contains('delete-session')) {
                    deleteSession(sessionId, sessionTitle);
                } else if (target.classList.contains('send-discord-message')) {
                    sendDiscordRegistrationMessage(sessionId);
                }
            });
        }
    }
    
    async function loadRegistrationSessions() {
        try {
            const tableBody = document.getElementById('registration-sessions-table-body');
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
            // Use the new robust loader from utils.js
            const data = await window.utils.loadRegistrationSessionsWithRetry(3, 1000);
            if (data.success && data.sessions) {
                state.registrationSessions = data.sessions;
                displayRegistrationSessions();
                if (state.registrationSessions.length !== lastLoadedSessionCount) {
                    window.utils.showNotification(`Loaded ${state.registrationSessions.length} registration sessions`, 'success', 2000);
                    lastLoadedSessionCount = state.registrationSessions.length;
                }
            } else {
                window.utils.showNotification(data.message || 'Failed to load registration sessions', 'error');
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center py-4 text-danger">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                Failed to load registration sessions
                                <br><small>Please try refreshing or check your connection</small>
                                <br><small class="text-muted">Error: ${data.error || data.message}</small>
                            </td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            window.utils.handleRegistrationSessionError(error, 'in loadRegistrationSessions');
            const tableBody = document.getElementById('registration-sessions-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4 text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Failed to load registration sessions
                            <br><small>Please try refreshing or check your connection</small>
                            <br><small class="text-muted">Error: ${error.message}</small>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    function displayRegistrationSessions() {
        const tableBody = document.getElementById('registration-sessions-table-body');
        
        if (!tableBody) {
            return;
        }
        
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
        
        // Get current user info for permission checks
        const currentUser = window.sessionManager?.getUser();
        const isSuperAdmin = currentUser?.role === 'superadmin';
        
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
            
            // Permission checks
            const canModify = isSuperAdmin || session.adminUserId === currentUser?.userId;
            const canDelete = isSuperAdmin; // Only superadmins can delete
            
            row.innerHTML = `
                <td>
                    <div class="fw-bold">${escapeHtml(session.title)}</div>
                    <small class="text-muted">ID: ${session.sessionId}</small>
                    ${!isSuperAdmin && session.adminUsername !== currentUser?.username ? 
                        `<br><small class="text-info">Created by: ${escapeHtml(session.adminUsername)}</small>` : ''}
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
                    <small>${session.startTime ? formatDate(session.startTime) : '-'}</small>
                </td>
                <td>
                    <small>${session.expiresAt ? formatDate(session.expiresAt) : session.expiry ? formatDate(session.expiry) : 'Never'}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary copy-session-link" data-session-id="${session.sessionId}" title="Copy Link">
                            <i class="bi bi-clipboard"></i>
                        </button>
                        <button class="btn btn-outline-secondary open-session-link" data-session-id="${session.sessionId}" title="Open Link">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </button>
                        <button class="btn btn-outline-discord send-discord-message" data-session-id="${session.sessionId}" title="Send to Discord">
                            <i class="bi bi-discord"></i>
                        </button>
                        ${canModify ? `
                            <button class="btn btn-outline-info edit-session" data-session-id="${session.sessionId}" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            ${session.isActive ? 
                                `<button class="btn btn-outline-warning close-session" data-session-id="${session.sessionId}" data-session-title="${escapeHtml(session.title)}" title="Close Registration">
                                    <i class="bi bi-stop-circle"></i>
                                </button>` : 
                                `<button class="btn btn-outline-success reopen-session" data-session-id="${session.sessionId}" data-session-title="${escapeHtml(session.title)}" title="Reopen Registration">
                                    <i class="bi bi-play-circle"></i>
                                </button>`
                            }
                        ` : ''}
                        ${canDelete ? `
                            <button class="btn btn-outline-danger delete-session" data-session-id="${session.sessionId}" data-session-title="${escapeHtml(session.title)}" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    function showCreateSessionModal() {
        // Set default start time to now in PH timezone
        function getPHISOString(offsetMinutes = 0) {
            try {
                const now = new Date();
                const phDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
                if (offsetMinutes) phDate.setMinutes(phDate.getMinutes() + offsetMinutes);
                const year = phDate.getFullYear();
                const month = String(phDate.getMonth() + 1).padStart(2, '0');
                const day = String(phDate.getDate()).padStart(2, '0');
                const hours = String(phDate.getHours()).padStart(2, '0');
                const minutes = String(phDate.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (error) {
                const now = new Date();
                if (offsetMinutes) now.setMinutes(now.getMinutes() + offsetMinutes);
                return now.toISOString().slice(0, 16);
            }
        }
        document.getElementById('session-start-time').value = getPHISOString();
        document.getElementById('session-expires-at').value = getPHISOString(120);
        
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
    
    // Helper to convert UTC/ISO to PH datetime-local string (copied from attendance.js)
    function toPHLocalInput(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '';
            }
            
            // Convert to PH timezone properly
            const phTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
            
            // Get components in PH time
            const year = phTime.getFullYear();
            const month = String(phTime.getMonth() + 1).padStart(2, '0');
            const day = String(phTime.getDate()).padStart(2, '0');
            const hours = String(phTime.getHours()).padStart(2, '0');
            const minutes = String(phTime.getMinutes()).padStart(2, '0');
            
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            return '';
        }
    }
    // Helper to convert PH local datetime-local input to UTC ISO string (copied from attendance.js pattern)
    function toUTCISOStringFromPHLocal(input) {
        if (!input) return null;
        try {
            // Treat input as PH time
            const [date, time] = input.split('T');
            const [year, month, day] = date.split('-');
            const [hour, minute] = time.split(':');
            // Create a Date object in PH time
            const phDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
            return phDate.toISOString();
        } catch (error) {
            return null;
        }
    }
    
    async function handleSessionSave(e) {
        e.preventDefault();
        
        const sessionId = document.getElementById('edit-session-id').value;
        const isEdit = !!sessionId;
        
        const startInput = document.getElementById('session-start-time').value;
        const expiryInput = document.getElementById('session-expires-at').value;
        const startTime = toUTCISOStringFromPHLocal(startInput);
        const expiry = toUTCISOStringFromPHLocal(expiryInput);

        // --- ADDED VALIDATION ---
        if (!startInput || !startTime) {
            showSessionAlert('Please select a valid start time for registration.', 'danger');
            return;
        }
        // --- END VALIDATION ---
        
        const sessionData = {
            title: document.getElementById('session-title').value,
            description: document.getElementById('session-description').value,
            maxPlayers: parseInt(document.getElementById('session-max-players').value),
            startTime,
            expiresAt: expiry  // Backend expects expiresAt, not expiry
        };
        
        if (isEdit) {
            sessionData.sessionId = sessionId;
        }
        
        const saveButton = document.getElementById('save-session-btn');
        const originalText = saveButton.textContent;
        
        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            
            const url = isEdit
                ? `/.netlify/functions/registration-sessions?sessionId=${encodeURIComponent(sessionId)}`
                : '/.netlify/functions/registration-sessions';
            const method = isEdit ? 'PUT' : 'POST';
            
            const data = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
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
            const data = await fetchWithAuth(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`);
            
            if (data.success && data.session) {
                const session = data.session;
                
                // Check if current user can modify this session
                const currentUser = window.sessionManager?.getUser();
                const canModify = currentUser?.role === 'superadmin' || session.adminUserId === currentUser?.userId;
                
                if (!canModify) {
                    showAlert('You do not have permission to edit this registration session. You can only edit your own sessions.', 'warning');
                    return;
                }
                
                // Fill form
                document.getElementById('edit-session-id').value = session.sessionId;
                document.getElementById('session-title').value = session.title;
                document.getElementById('session-description').value = session.description || '';
                document.getElementById('session-max-players').value = session.maxPlayers;

                // Support all possible expiration field names
                const expiresValue = session.expiry || session.expiresAt || session.expires_at;
                
                if (session.startTime) {
                    const phStartTime = toPHLocalInput(session.startTime);
                    document.getElementById('session-start-time').value = phStartTime;
                } else {
                    // PATCH: Always set to now if missing
                    function getPHISOString(offsetMinutes = 0) {
                        try {
                            const now = new Date();
                            const phDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
                            if (offsetMinutes) phDate.setMinutes(phDate.getMinutes() + offsetMinutes);
                            const year = phDate.getFullYear();
                            const month = String(phDate.getMonth() + 1).padStart(2, '0');
                            const day = String(phDate.getDate()).padStart(2, '0');
                            const hours = String(phDate.getHours()).padStart(2, '0');
                            const minutes = String(phDate.getMinutes()).padStart(2, '0');
                            return `${year}-${month}-${day}T${hours}:${minutes}`;
                        } catch (error) {
                            const now = new Date();
                            if (offsetMinutes) now.setMinutes(now.getMinutes() + offsetMinutes);
                            return now.toISOString().slice(0, 16);
                        }
                    }
                    document.getElementById('session-start-time').value = getPHISOString();
                }
                
                if (expiresValue) {
                    const phExpiryTime = toPHLocalInput(expiresValue);
                    document.getElementById('session-expires-at').value = phExpiryTime;
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
            if (error.message.includes('Forbidden') || error.message.includes('403')) {
                showAlert('You do not have permission to edit this registration session. You can only edit your own sessions.', 'warning');
            } else {
                showAlert('Error loading registration session', 'danger');
            }
        }
    }
    
    async function deleteSession(sessionId, title) {
        // Superadmin check
        const user = window.sessionManager?.getUser();
        if (!user || user.role !== 'superadmin') {
            showAlert('You do not have permission to delete registration links.', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const result = await fetchWithAuth(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`, {
                method: 'DELETE'
            });

            if (result.success) {
                showAlert(`Registration "${title}" has been deleted.`, 'success');
                loadRegistrationSessions();
                notifyPlayerListsToRefresh('deleted');
            } else {
                throw new Error(result.error || 'Failed to delete registration link');
            }
        } catch (error) {
            showAlert(`Error: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Close registration session
     */
    async function closeSession(sessionId, title) {
        if (!confirm(`Are you sure you want to close the registration for "${title}"?`)) {
            return;
        }

        try {
            const result = await fetchWithAuth(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: false })
            });

            if (result.success) {
                showAlert(`Registration for "${title}" has been closed.`, 'success');
                loadRegistrationSessions();
                notifyPlayerListsToRefresh('closed');
            } else {
                throw new Error(result.error || 'Failed to close registration');
            }
        } catch (error) {
            if (error.message.includes('Forbidden') || error.message.includes('403')) {
                showAlert('You do not have permission to modify this registration session. You can only modify your own sessions.', 'warning');
            } else {
                showAlert(`Error: ${error.message}`, 'danger');
            }
        }
    }

    /**
     * Reopen registration session
     */
    async function reopenSession(sessionId, title) {
        if (!confirm(`Are you sure you want to reopen the registration for "${title}"?`)) {
            return;
        }

        try {
            const result = await fetchWithAuth(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: true })
            });

            if (result.success) {
                showAlert(`Registration for "${title}" has been reopened.`, 'success');
                loadRegistrationSessions();
                notifyPlayerListsToRefresh('reopened');
            } else {
                throw new Error(result.error || 'Failed to reopen registration');
            }
        } catch (error) {
            if (error.message.includes('Forbidden') || error.message.includes('403')) {
                showAlert('You do not have permission to modify this registration session. You can only modify your own sessions.', 'warning');
            } else {
                showAlert(`Error: ${error.message}`, 'danger');
            }
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
        window.utils.showNotification(message, type === 'danger' ? 'error' : type);
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
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }
            
            // Try to get user's timezone, fallback to local
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                timeZoneName: 'short'
            };
            
            return date.toLocaleString(undefined, options);
        } catch (error) {
            return 'Invalid date';
        }
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Function to reset registration module (for cleanup)
    function resetRegistrationModule() {
        // Reset state variables
        state.initialized = false;
        state.registrationSessions = [];
        state.currentUser = null;
        window.registrationModuleLoaded = false;
        registrationInitAttempts = 0;
        
        // Clear DOM content
        const tableBody = document.getElementById('registration-sessions-table-body');
        if (tableBody) tableBody.innerHTML = '';
        
        // Clear any modals that might be open
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        });
    }
    
    /**
     * Notify other admin components to refresh their player lists
     * This ensures all player-related components stay in sync when registration settings change
     */
    function notifyPlayerListsToRefresh(actionType = 'updated') {
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
            // Refresh Player List if loaded and DOM elements exist
            if (typeof window.loadPlayers === 'function' && document.getElementById('players-table-body')) {
                window.loadPlayers(true);
            } else if (window.playerListModule && typeof window.playerListModule.loadPlayers === 'function' && document.getElementById('players-table-body')) {
                window.playerListModule.loadPlayers(true);
            }
            
            // Refresh Team Balancer if loaded and DOM elements exist
            if (typeof window.loadPlayersForBalancer === 'function' && document.getElementById('available-players-list')) {
                window.loadPlayersForBalancer();
            } else if (window.teamBalancerModule && typeof window.teamBalancerModule.loadPlayersForBalancer === 'function' && document.getElementById('available-players-list')) {
                window.teamBalancerModule.loadPlayersForBalancer();
            }
            
            // Refresh Random Picker if loaded and DOM elements exist
            if (typeof window.loadPlayersForPicker === 'function' && document.getElementById('random-picker-players')) {
                window.loadPlayersForPicker();
            } else if (window.randomPickerModule && typeof window.randomPickerModule.loadPlayersForPicker === 'function' && document.getElementById('random-picker-players')) {
                window.randomPickerModule.loadPlayersForPicker();
            }
            
            // Refresh main tournament index page if it's open (for public users)
            if (typeof window.loadTournaments === 'function') {
                window.loadTournaments();
            }
            
            // Refresh navigation tournament counter if available
            if (typeof window.updateNavigationStats === 'function') {
                window.updateNavigationStats();
            }
            
            // Show success notification
            if (window.showNotification) {
                window.showNotification(
                    `Registration ${actionType} - Player lists refreshed where available`, 
                    'info'
                );
            }
        }, 500); // Small delay to ensure registration changes are processed
    }
    
    // Expose functions globally that need to be called from HTML
    window.initRegistration = initRegistration;
    window.resetRegistrationModule = resetRegistrationModule;
    window.cleanupRegistration = resetRegistrationModule; // Alias for navigation system
    window.notifyPlayerListsToRefresh = notifyPlayerListsToRefresh;
    
    // Add the sendDiscordRegistrationMessage function at module scope
    async function sendDiscordRegistrationMessage(sessionId) {
        try {
            // Find the session data
            const session = state.registrationSessions.find(s => s.sessionId === sessionId);
            if (!session) {
                window.utils.showNotification('Registration session not found.', 'error');
                return;
            }
            
            // Fetch webhooks from backend
            const res = await fetch('/.netlify/functions/discord-webhooks', {
                headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
            });
            
            if (!res.ok) {
                window.utils.showNotification('Failed to fetch Discord webhooks from server.', 'error');
                return;
            }
            
            const data = await res.json();
            if (!data.success || !Array.isArray(data.webhooks)) {
                window.utils.showNotification('No Discord webhooks found for your account.', 'warning');
                return;
            }
            
            // Find registration webhook and template
            const webhookObj = data.webhooks.find(w => w.type === 'registration');
            const webhookUrl = webhookObj ? webhookObj.url : '';
            const template = webhookObj && webhookObj.template ? webhookObj.template : '';
            if (!webhookUrl) {
                window.utils.showNotification('No Discord webhook URL set for registration. Please configure it in the Discord tab.', 'warning');
                return;
            }
            if (!template) {
                window.utils.showNotification('No Discord message template set for registration. Please configure it in the Discord tab.', 'warning');
                return;
            }
            // Try to parse as JSON (embed)
            let bodyToSend = null;
            try {
                let embedObj = JSON.parse(template);
                // Recursively fill variables in all string fields
                function fillVars(obj) {
                    if (typeof obj === 'string') {
                        return obj
                            .replace('{tournament_name}', session.title)
                            .replace('{player_count}', `${session.playerCount}/${session.maxPlayers}`)
                            .replace('{created_date}', formatDate(session.createdAt))
                            .replace('{tournament_id}', session.sessionId);
                    } else if (Array.isArray(obj)) {
                        return obj.map(fillVars);
                    } else if (typeof obj === 'object' && obj !== null) {
                        const newObj = {};
                        for (const key in obj) {
                            newObj[key] = fillVars(obj[key]);
                        }
                        return newObj;
                    }
                    return obj;
                }
                embedObj = fillVars(embedObj);
                bodyToSend = embedObj;
            } catch (e) {
                // Not valid JSON, fallback to plain text
                bodyToSend = {
                    content: template
                        .replace('{tournament_name}', session.title)
                        .replace('{player_count}', `${session.playerCount}/${session.maxPlayers}`)
                        .replace('{created_date}', formatDate(session.createdAt))
                        .replace('{tournament_id}', session.sessionId),
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
                window.utils.showNotification('Registration link sent to Discord!', 'success');
            } else {
                const errorText = await sendRes.text();
                window.utils.showNotification('Failed to send to Discord. ' + errorText, 'error');
            }
        } catch (error) {
            window.utils.showNotification('Error sending to Discord: ' + error.message, 'error');
        }
    }
    
})(); 