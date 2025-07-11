// profile.js - Handles profile management functionality
// Used by profile.html

// Module state object to avoid variable redeclaration conflicts
if (!window.profileState) {
    window.profileState = {};
}

// Profile Management

// Guard against redeclaration for SPA navigation
if (typeof window.profileCurrentUser === 'undefined') {
    window.profileCurrentUser = null;
}
if (typeof window.profileStats === 'undefined') {
    window.profileStats = {};
}

// Use the global variables to avoid redeclaration
if (typeof currentUser === 'undefined') {
    var currentUser = window.profileCurrentUser;
}
if (typeof profileStats === 'undefined') {
    var profileStats = window.profileStats;
}

// Add fetchWithAuth function if not already available
if (typeof fetchWithAuth === 'undefined') {
    async function fetchWithAuth(url, options = {}) {
        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            if (!sessionId) {
                throw new Error('No session ID found. Please login again.');
            }

            if (!options.headers) {
                options.headers = {};
            }
            options.headers['x-session-id'] = sessionId;

            const response = await fetch(url, options);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                }

                if (response.status === 401) {
                    window.showNotification('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        window.location.href = '/admin/login.html';
                    }, 2000);
                    throw new Error('Session expired');
                } else if (response.status === 403) {
                    window.showNotification('Access denied. You do not have permission for this action.', 'warning');
                    throw new Error('Access denied');
                }

                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return response;
            }
        } catch (error) {
            console.error('fetchWithAuth error:', error);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                window.showNotification('Network error. Please check your connection.', 'error');
            } else if (!error.message.includes('Session expired') && !error.message.includes('Access denied')) {
                window.showNotification(`Request failed: ${error.message}`, 'error');
            }
            
            throw error;
        }
    }
}

/**
 * Initialize the Profile module
 */
async function initProfile() {
    try {
        // Get current user info from session manager
        currentUser = window.sessionManager?.getUserInfo();
        window.profileCurrentUser = currentUser;
        
        // Load user profile information
        await loadUserProfile();
        
        // Load profile statistics
        await loadProfileStats();
        
        // Setup event listeners
        setupEventListeners();
        
        // Update UI with user info
        updateProfileUI();
        
    } catch (error) {
        console.error('❌ Profile: Error initializing:', error);
        window.showNotification('Failed to initialize profile module', 'error');
    }
}

/**
 * Load user profile information
 */
async function loadUserProfile() {
    try {
        // For now, use session manager data
        // In the future, this could fetch more detailed profile info from API
        if (window.sessionManager) {
            const userInfo = window.sessionManager.getUserInfo();
            if (userInfo) {
                currentUser = userInfo;
                window.profileCurrentUser = currentUser;
            }
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        window.showNotification('Failed to load profile information', 'error');
    }
}

/**
 * Load profile statistics
 */
async function loadProfileStats() {
    try {
        // Load basic stats - tournaments and players managed
        const [tournamentsData, playersData] = await Promise.all([
            fetchWithAuth('/.netlify/functions/registration-sessions').catch(() => ({ sessions: [] })),
            fetchWithAuth('/.netlify/functions/api-players?limit=1000').catch(() => ({ players: [] }))
        ]);

        profileStats = {
            totalLogins: Math.floor(Math.random() * 50) + 10, // Placeholder
            activeSessions: 1, // Current session
            tournamentsManaged: tournamentsData.sessions?.length || 0,
            playersManaged: playersData.players?.length || 0
        };

        window.profileStats = profileStats;
        
    } catch (error) {
        console.error('Error loading profile stats:', error);
        // Set default stats on error
        profileStats = {
            totalLogins: '-',
            activeSessions: '1',
            tournamentsManaged: '-',
            playersManaged: '-'
        };
        window.profileStats = profileStats;
    }
}

/**
 * Update profile UI with user information
 */
function updateProfileUI() {
    // Update user display name
    const usernameElement = document.getElementById('current-username');
    if (usernameElement) {
        usernameElement.textContent = currentUser?.username || 'Admin User';
    }

    // Update role
    const roleElement = document.getElementById('current-role');
    if (roleElement) {
        roleElement.textContent = currentUser?.role || 'Administrator';
    }

    // Update last login
    const lastLoginElement = document.getElementById('last-login');
    if (lastLoginElement) {
        const lastLogin = currentUser?.lastLogin ? 
            formatDateWithTimezone(currentUser.lastLogin) : 
            'Current session';
        lastLoginElement.textContent = `Last login: ${lastLogin}`;
    }

    // Update stats
    updateStatsDisplay();

    // Update account info modal
    updateAccountInfoModal();
}

/**
 * Update statistics display
 */
function updateStatsDisplay() {
    const elements = {
        'total-logins': profileStats.totalLogins,
        'active-sessions': profileStats.activeSessions,
        'tournaments-managed': profileStats.tournamentsManaged,
        'players-managed': profileStats.playersManaged
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

/**
 * Update account info modal
 */
function updateAccountInfoModal() {
    const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
    
    const infoElements = {
        'info-username': currentUser?.username || 'Admin User',
        'info-role': currentUser?.role || 'Administrator',
        'info-created': currentUser?.createdAt ? formatDateWithTimezone(currentUser.createdAt) : 'Unknown',
        'info-last-login': currentUser?.lastLogin ? formatDateWithTimezone(currentUser.lastLogin) : 'Current session',
        'info-session-id': sessionId ? sessionId.substring(0, 16) + '...' : 'N/A',
        'info-ip': 'Hidden for security',
        'info-user-agent': navigator.userAgent.substring(0, 50) + '...'
    };

    Object.entries(infoElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Change password button
    const savePasswordBtn = document.getElementById('save-password-btn');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', handlePasswordChange);
    }

    // View sessions button
    const viewSessionsBtn = document.getElementById('view-sessions-btn');
    if (viewSessionsBtn) {
        viewSessionsBtn.addEventListener('click', viewActiveSessions);
    }

    // Admin tools buttons
    const adminUsersBtn = document.getElementById('admin-users-btn');
    if (adminUsersBtn) {
        adminUsersBtn.addEventListener('click', manageAdminUsers);
    }

    const systemLogsBtn = document.getElementById('system-logs-btn');
    if (systemLogsBtn) {
        systemLogsBtn.addEventListener('click', viewSystemLogs);
    }

    const logoutAllBtn = document.getElementById('logout-all-btn');
    if (logoutAllBtn) {
        logoutAllBtn.addEventListener('click', logoutAllSessions);
    }

    // Form validation for password change
    setupPasswordFormValidation();
    
    // Admin users modal event listeners
    setupAdminUsersEventListeners();
    
    // System logs modal event listeners
    setupSystemLogsEventListeners();
}

/**
 * Setup password form validation
 */
function setupPasswordFormValidation() {
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (newPasswordInput && confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const newPassword = newPasswordInput.value;
            const confirmPassword = this.value;

            if (confirmPassword && newPassword !== confirmPassword) {
                this.setCustomValidity('Passwords do not match');
                this.classList.add('is-invalid');
            } else {
                this.setCustomValidity('');
                this.classList.remove('is-invalid');
            }
        });

        newPasswordInput.addEventListener('input', function() {
            const password = this.value;
            if (password.length > 0 && password.length < 8) {
                this.setCustomValidity('Password must be at least 8 characters long');
                this.classList.add('is-invalid');
            } else {
                this.setCustomValidity('');
                this.classList.remove('is-invalid');
            }

            // Revalidate confirm password
            const confirmPassword = confirmPasswordInput.value;
            if (confirmPassword) {
                confirmPasswordInput.dispatchEvent(new Event('input'));
            }
        });
    }
}

/**
 * Handle password change
 */
async function handlePasswordChange() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
        window.showNotification('Please fill in all password fields', 'warning');
        return;
    }

    if (newPassword.length < 8) {
        window.showNotification('New password must be at least 8 characters long', 'warning');
        return;
    }

    if (newPassword !== confirmPassword) {
        window.showNotification('New passwords do not match', 'warning');
        return;
    }

    const saveButton = document.getElementById('save-password-btn');
    const originalText = saveButton ? saveButton.innerHTML : '';

    try {
        // Show loading state
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Updating...';
        }

        const data = await fetchWithAuth('/.netlify/functions/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (data.success) {
            window.showNotification('Password updated successfully', 'success');
            
            // Close the modal
            const modal = document.getElementById('changePasswordModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            }
            
            // Clear the form
            document.getElementById('change-password-form').reset();
            
        } else {
            window.showNotification(data.message || 'Failed to update password', 'error');
        }

    } catch (error) {
        console.error('Error changing password:', error);
        window.showNotification('Error updating password: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }
}

/**
 * View active sessions
 */
function viewActiveSessions() {
    const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
    
    const sessionInfo = `
        <div class="alert alert-info">
            <h6><i class="bi bi-info-circle me-2"></i>Current Session</h6>
            <p><strong>Session ID:</strong> ${sessionId ? sessionId.substring(0, 16) + '...' : 'N/A'}</p>
            <p><strong>Started:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="badge bg-success">Active</span></p>
        </div>
        <p class="text-muted">Only current session is shown. Multiple session management would require additional backend implementation.</p>
    `;

    // Create a temporary modal to show session info
    showInfoModal('Active Sessions', sessionInfo);
}

/**
 * Manage admin users
 */
async function manageAdminUsers() {
    try {
        // Show the admin users modal
        const modal = document.getElementById('adminUsersModal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            // Load admin users when modal opens
            await loadAdminUsers();
        }
    } catch (error) {
        console.error('Error opening admin users modal:', error);
        window.showNotification('Error opening admin user management', 'error');
    }
}

/**
 * View system logs
 */
async function viewSystemLogs() {
    try {
        // Show the system logs modal
        const modal = document.getElementById('systemLogsModal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            // Load system logs when modal opens
            await loadSystemLogs();
        }
    } catch (error) {
        console.error('Error opening system logs modal:', error);
        window.showNotification('Error opening system logs', 'error');
    }
}

/**
 * Logout all sessions
 */
async function logoutAllSessions() {
    const confirmed = confirm('Are you sure you want to logout from all sessions? This will end your current session as well.');
    
    if (!confirmed) {
        return;
    }

    try {
        // For now, just logout current session
        if (window.sessionManager && typeof window.sessionManager.logout === 'function') {
            await window.sessionManager.logout();
            window.showNotification('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/admin/login.html';
            }, 1500);
        } else {
            // Fallback logout
            localStorage.removeItem('adminSessionId');
            sessionStorage.clear();
            window.showNotification('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/admin/login.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Error during logout:', error);
        window.showNotification('Error during logout: ' + error.message, 'error');
    }
}

/**
 * Show info modal with custom content
 */
function showInfoModal(title, content) {
    // Create temporary modal if it doesn't exist
    let modal = document.getElementById('tempInfoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tempInfoModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="tempInfoModalTitle"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="tempInfoModalBody">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update modal content
    document.getElementById('tempInfoModalTitle').innerHTML = title;
    document.getElementById('tempInfoModalBody').innerHTML = content;

    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/**
 * Setup admin users modal event listeners
 */
function setupAdminUsersEventListeners() {
    // Add admin user button
    const addAdminUserBtn = document.getElementById('add-admin-user-btn');
    if (addAdminUserBtn) {
        addAdminUserBtn.addEventListener('click', showAddAdminUserModal);
    }

    // Save admin user button
    const saveAdminUserBtn = document.getElementById('save-admin-user-btn');
    if (saveAdminUserBtn) {
        saveAdminUserBtn.addEventListener('click', saveAdminUser);
    }

    // Admin user search
    const adminUserSearch = document.getElementById('admin-user-search');
    if (adminUserSearch) {
        adminUserSearch.addEventListener('input', handleAdminUserSearch);
    }
}

/**
 * Setup system logs modal event listeners
 */
function setupSystemLogsEventListeners() {
    // Refresh logs button
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', loadSystemLogs);
    }

    // Export logs button
    const exportLogsBtn = document.getElementById('export-logs-btn');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', exportSystemLogs);
    }

    // Log level filter
    const logLevelFilter = document.getElementById('log-level-filter');
    if (logLevelFilter) {
        logLevelFilter.addEventListener('change', loadSystemLogs);
    }

    // Log date filter
    const logDateFilter = document.getElementById('log-date-filter');
    if (logDateFilter) {
        logDateFilter.addEventListener('change', loadSystemLogs);
    }
}

/**
 * Load admin users
 */
async function loadAdminUsers() {
    try {
        const tableBody = document.getElementById('admin-users-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading admin users...</p>
                    </td>
                </tr>
            `;
        }

        const data = await fetchWithAuth('/.netlify/functions/admin-users');

        if (data.success && Array.isArray(data.users)) {
            displayAdminUsers(data.users);
        } else {
            showAdminUsersAlert('No admin users found', 'info');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-muted">
                            <i class="bi bi-people display-6 d-block mb-3 opacity-25"></i>
                            <h5>No Admin Users Found</h5>
                            <p class="mb-0">Add the first admin user to get started</p>
                        </td>
                    </tr>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading admin users:', error);
        showAdminUsersAlert('Error loading admin users: ' + error.message, 'danger');
        
        const tableBody = document.getElementById('admin-users-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Error loading admin users
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Display admin users in table
 */
function displayAdminUsers(users) {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="bi bi-people display-6 d-block mb-3 opacity-25"></i>
                    <h5>No Admin Users Found</h5>
                    <p class="mb-0">Add the first admin user to get started</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(user.username || 'N/A')}</strong></td>
            <td>${escapeHtml(user.fullName || 'N/A')}</td>
            <td>${escapeHtml(user.email || 'N/A')}</td>
            <td>
                <span class="badge bg-${getRoleBadgeColor(user.role)}">${escapeHtml(user.role || 'N/A')}</span>
            </td>
            <td>
                <span class="badge bg-${user.isActive ? 'success' : 'secondary'}">${user.isActive ? 'Active' : 'Inactive'}</span>
            </td>
            <td>
                <small class="text-muted">${user.createdAt ? formatDateWithTimezone(user.createdAt) : 'N/A'}</small>
            </td>
            <td>
                <small class="text-muted">${user.lastLogin ? formatDateWithTimezone(user.lastLogin) : 'Never'}</small>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary edit-admin-user" data-user-id="${user.userId}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger delete-admin-user" data-user-id="${user.userId}" data-username="${user.username}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Setup action buttons
    setupAdminUserActionButtons();
}

/**
 * Setup admin user action buttons
 */
function setupAdminUserActionButtons() {
    // Edit buttons
    document.querySelectorAll('.edit-admin-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            editAdminUser(userId);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-admin-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            deleteAdminUser(userId, username);
        });
    });
}

/**
 * Get role badge color
 */
function getRoleBadgeColor(role) {
    switch (role) {
        case 'admin': return 'primary';
        case 'moderator': return 'warning';
        case 'viewer': return 'info';
        default: return 'secondary';
    }
}

/**
 * Show add admin user modal
 */
function showAddAdminUserModal() {
    // Clear the form
    document.getElementById('add-edit-admin-form').reset();
    document.getElementById('admin-user-id').value = '';
    
    // Update modal title
    const modalTitle = document.getElementById('addEditAdminModalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Add New Admin User';
    }

    // Show the modal
    const modal = document.getElementById('addEditAdminModal');
    if (modal) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

/**
 * Edit admin user
 */
async function editAdminUser(userId) {
    try {
        // Fetch user details from the loaded users list in the table (if available)
        let user = null;
        const tableRows = document.querySelectorAll('#admin-users-table-body tr');
        for (const row of tableRows) {
            if (row.querySelector('.edit-admin-user') && row.querySelector('.edit-admin-user').getAttribute('data-user-id') === userId) {
                // Extract data from table cells
                const cells = row.querySelectorAll('td');
                user = {
                    userId: userId,
                    username: cells[0]?.textContent.trim() || '',
                    fullName: cells[1]?.textContent.trim() || '',
                    email: cells[2]?.textContent.trim() || '',
                    role: cells[3]?.textContent.trim().toLowerCase() || '',
                    isActive: (cells[4]?.textContent.trim() || '').toLowerCase() === 'active'
                };
                break;
            }
        }
        // If not found in table, fetch from backend
        if (!user) {
            const data = await fetchWithAuth(`/.netlify/functions/admin-users?userId=${encodeURIComponent(userId)}`);
            if (data.success && data.user) {
                user = data.user;
            }
        }
        if (!user) {
            window.showNotification('User data not found', 'error');
            return;
        }
        // Populate form fields
        document.getElementById('admin-user-id').value = user.userId || user.id || '';
        document.getElementById('admin-username').value = user.username || '';
        document.getElementById('admin-full-name').value = user.fullName || '';
        document.getElementById('admin-email').value = user.email || '';
        document.getElementById('admin-role').value = user.role || '';
        document.getElementById('admin-active').checked = !!user.isActive;
        // Clear password field
        const passwordField = document.getElementById('admin-password');
        if (passwordField) {
            passwordField.value = '';
            passwordField.removeAttribute('required');
            passwordField.placeholder = 'Leave blank to keep current password';
        }
        // Update modal title
        const modalTitle = document.getElementById('addEditAdminModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="bi bi-pencil-fill me-2"></i>Edit Admin User';
        }
        // Show the modal
        const modal = document.getElementById('addEditAdminModal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    } catch (error) {
        console.error('Error editing admin user:', error);
        window.showNotification('Error editing admin user', 'error');
    }
}

/**
 * Delete admin user
 */
async function deleteAdminUser(userId, username) {
    if (!confirm(`Are you sure you want to delete admin user "${username}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const data = await fetchWithAuth('/.netlify/functions/admin-users', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (data.success) {
            window.showNotification(`Admin user "${username}" deleted successfully`, 'success');
            await loadAdminUsers();
        } else {
            showAdminUsersAlert(data.message || 'Failed to delete admin user', 'danger');
        }
    } catch (error) {
        console.error('Error deleting admin user:', error);
        showAdminUsersAlert('Error deleting admin user', 'danger');
    }
}

/**
 * Save admin user (add or edit)
 */
async function saveAdminUser() {
    const userId = document.getElementById('admin-user-id').value;
    const isEdit = !!userId;

    const userData = {
        username: document.getElementById('admin-username').value.trim(),
        password: document.getElementById('admin-password').value,
        fullName: document.getElementById('admin-full-name').value.trim(),
        email: document.getElementById('admin-email').value.trim(),
        role: document.getElementById('admin-role').value,
        isActive: document.getElementById('admin-active').checked
    };

    // Validate required fields
    if (!userData.username) {
        showAddEditAdminAlert('Username is required', 'danger');
        return;
    }

    if (!isEdit && !userData.password) {
        showAddEditAdminAlert('Password is required for new users', 'danger');
        return;
    }

    if (userData.password && userData.password.length < 8) {
        showAddEditAdminAlert('Password must be at least 8 characters long', 'danger');
        return;
    }

    if (!userData.role) {
        showAddEditAdminAlert('Role is required', 'danger');
        return;
    }

    // For editing, password is optional
    if (isEdit && !userData.password) {
        delete userData.password;
        userData.userId = userId;
    }

    const saveButton = document.getElementById('save-admin-user-btn');
    const originalText = saveButton ? saveButton.innerHTML : '';

    try {
        // Show loading state
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';
        }

        const method = isEdit ? 'PUT' : 'POST';
        const data = await fetchWithAuth('/.netlify/functions/admin-users', {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (data.success) {
            window.showNotification(`Admin user ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            
            // Close the modal
            const modal = document.getElementById('addEditAdminModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            }
            
            // Reload admin users
            await loadAdminUsers();
        } else {
            showAddEditAdminAlert(data.message || `Failed to ${isEdit ? 'update' : 'create'} admin user`, 'danger');
        }
    } catch (error) {
        console.error('Error saving admin user:', error);
        showAddEditAdminAlert('Error saving admin user', 'danger');
    } finally {
        // Restore button state
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }
}

/**
 * Handle admin user search
 */
function handleAdminUserSearch() {
    const searchTerm = document.getElementById('admin-user-search').value.toLowerCase();
    const rows = document.querySelectorAll('#admin-users-table-body tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Load system logs
 */
async function loadSystemLogs() {
    try {
        const tableBody = document.getElementById('system-logs-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading system logs...</p>
                    </td>
                </tr>
            `;
        }

        // Get filter values
        const logLevel = document.getElementById('log-level-filter')?.value || '';
        const logDate = document.getElementById('log-date-filter')?.value || '';

        // Generate mock logs for demonstration
        const mockLogs = generateMockLogs(logLevel, logDate);
        displaySystemLogs(mockLogs);
        
        showSystemLogsAlert(`Loaded ${mockLogs.length} log entries`, 'info');
    } catch (error) {
        console.error('Error loading system logs:', error);
        showSystemLogsAlert('Error loading system logs: ' + error.message, 'danger');
        
        const tableBody = document.getElementById('system-logs-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Error loading system logs
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Generate mock system logs for demonstration
 */
function generateMockLogs(levelFilter = '', dateFilter = '') {
    const levels = ['info', 'warning', 'error', 'debug'];
    const categories = ['Authentication', 'User Management', 'Tournament', 'Database', 'API'];
    const users = ['admin', 'system', 'moderator'];
    
    const messages = {
        info: [
            'User logged in successfully',
            'Tournament created',
            'Player registered',
            'Database backup completed',
            'API request processed'
        ],
        warning: [
            'High memory usage detected',
            'Slow database query',
            'Rate limit approaching',
            'Configuration missing',
            'Cache miss rate high'
        ],
        error: [
            'Database connection failed',
            'Authentication error',
            'API request failed',
            'File upload error',
            'Invalid tournament data'
        ],
        debug: [
            'Debug: Function executed',
            'Debug: Variable value checked',
            'Debug: Database query logged',
            'Debug: API response logged',
            'Debug: Memory usage logged'
        ]
    };

    const logs = [];
    const now = new Date();
    
    for (let i = 0; i < 50; i++) {
        const randomDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
        const level = levels[Math.floor(Math.random() * levels.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const user = users[Math.floor(Math.random() * users.length)];
        const message = messages[level][Math.floor(Math.random() * messages[level].length)];

        // Apply filters
        if (levelFilter && level !== levelFilter) continue;
        if (dateFilter && randomDate.toISOString().split('T')[0] !== dateFilter) continue;

        logs.push({
            timestamp: randomDate.toISOString(),
            level: level,
            category: category,
            message: message,
            user: user
        });
    }

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Display system logs
 */
function displaySystemLogs(logs) {
    const tableBody = document.getElementById('system-logs-table-body');
    if (!tableBody) return;

    if (!logs || logs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    <i class="bi bi-journal-text display-6 d-block mb-3 opacity-25"></i>
                    <h5>No Log Entries Found</h5>
                    <p class="mb-0">No logs match the current filters</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <small class="text-muted">${formatDateWithTimezone(log.timestamp)}</small>
            </td>
            <td>
                <span class="badge bg-${getLogLevelColor(log.level)}">${log.level.toUpperCase()}</span>
            </td>
            <td>
                <small class="text-muted">${escapeHtml(log.category)}</small>
            </td>
            <td>${escapeHtml(log.message)}</td>
            <td>
                <small class="text-muted">${escapeHtml(log.user)}</small>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Get log level color
 */
function getLogLevelColor(level) {
    switch (level) {
        case 'error': return 'danger';
        case 'warning': return 'warning';
        case 'info': return 'info';
        case 'debug': return 'secondary';
        default: return 'primary';
    }
}

/**
 * Export system logs
 */
function exportSystemLogs() {
    const logs = [];
    const rows = document.querySelectorAll('#system-logs-table-body tr');
    
    rows.forEach(row => {
        if (row.cells.length === 5) {
            logs.push({
                timestamp: row.cells[0].textContent.trim(),
                level: row.cells[1].textContent.trim(),
                category: row.cells[2].textContent.trim(),
                message: row.cells[3].textContent.trim(),
                user: row.cells[4].textContent.trim()
            });
        }
    });

    if (logs.length === 0) {
        window.showNotification('No logs to export', 'warning');
        return;
    }

    // Convert to CSV
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'User'];
    const csvContent = [headers, ...logs.map(log => [
        log.timestamp,
        log.level,
        log.category,
        log.message,
        log.user
    ])].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `system-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showNotification('System logs exported successfully', 'success');
}

/**
 * Show admin users alert
 */
function showAdminUsersAlert(message, type) {
    const alertDiv = document.getElementById('admin-users-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 5000);
        }
    }
}

/**
 * Show add/edit admin alert
 */
function showAddEditAdminAlert(message, type) {
    const alertDiv = document.getElementById('add-edit-admin-alert');
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

/**
 * Show system logs alert
 */
function showSystemLogsAlert(message, type) {
    const alertDiv = document.getElementById('system-logs-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 5000);
        }
    }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format date with timezone information
 */
function formatDateWithTimezone(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
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
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}

/**
 * Cleanup function for profile when switching tabs
 */
function cleanupProfile() {
    // Reset state variables
    window.profileCurrentUser = null;
    window.profileStats = {};
    
    // Clear any modals
    const tempModal = document.getElementById('tempInfoModal');
    if (tempModal) {
        tempModal.remove();
    }
}

// Initialize when DOM is loaded OR when explicitly called by navigation system
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the profile page and DOM is ready
    if (document.getElementById('profile-management') || window.location.pathname.includes('profile.html')) {
        initProfile();
    }
});

// Also allow explicit initialization for template-based loading
window.initProfileWhenReady = function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProfile);
    } else {
        setTimeout(initProfile, 10);
    }
};

// Expose functions globally for compatibility
window.profileModule = {
    initProfile,
    loadUserProfile,
    loadProfileStats,
    updateProfileUI
};

// Expose init function globally for navigation system
window.initProfile = initProfile;

// Expose cleanup function globally for navigation system
window.cleanupProfile = cleanupProfile; 