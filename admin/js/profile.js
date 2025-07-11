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
function manageAdminUsers() {
    const content = `
        <div class="alert alert-info">
            <h6><i class="bi bi-people-fill me-2"></i>Admin User Management</h6>
            <p>This feature allows you to manage administrator accounts.</p>
        </div>
        <div class="text-center py-4">
            <i class="bi bi-tools display-1 text-muted"></i>
            <h5 class="mt-3">Feature Coming Soon</h5>
            <p class="text-muted">Admin user management functionality will be implemented in a future update.</p>
        </div>
    `;

    showInfoModal('Manage Admin Users', content);
}

/**
 * View system logs
 */
function viewSystemLogs() {
    const content = `
        <div class="alert alert-warning">
            <h6><i class="bi bi-journal-text me-2"></i>System Logs</h6>
            <p>System logs help monitor and troubleshoot application issues.</p>
        </div>
        <div class="text-center py-4">
            <i class="bi bi-file-earmark-text display-1 text-muted"></i>
            <h5 class="mt-3">Feature Coming Soon</h5>
            <p class="text-muted">System logs viewing functionality will be implemented in a future update.</p>
        </div>
    `;

    showInfoModal('System Logs', content);
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