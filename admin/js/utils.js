// Shared utilities and constants

// DEPRECATED: This is kept for compatibility but no longer used directly
// The application now uses static JSON files instead of API calls
const API_BASE_URL = '/api';

// Utility functions for the admin panel
// Floating notification system and error handling

// Global notification system
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('floating-notifications')) {
            this.container = document.createElement('div');
            this.container.id = 'floating-notifications';
            this.container.className = 'position-fixed top-0 end-0 p-3';
            this.container.style.cssText = `
                z-index: 9999;
                max-width: 400px;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('floating-notifications');
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
        notification.style.cssText = `
            pointer-events: auto;
            margin-bottom: 0.5rem;
            border: none;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        // Get icon based on type
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-exclamation-triangle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill',
            danger: 'bi-exclamation-triangle-fill'
        };

        const icon = icons[type] || icons.info;
        const iconColor = type === 'success' ? 'text-success' : 
                         type === 'error' || type === 'danger' ? 'text-danger' :
                         type === 'warning' ? 'text-warning' : 'text-info';

        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${icon} ${iconColor} me-2 fs-5"></i>
                <div class="flex-grow-1">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-sm" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        this.container.appendChild(notification);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        // Add click to dismiss
        notification.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-close') || e.target.closest('.btn-close')) {
                this.remove(notification);
            }
        });

        return notification;
    }

    remove(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Global notification instance
window.notificationSystem = new NotificationSystem();

// Utility function to show notifications
function showNotification(message, type = 'info', duration = 5000) {
    if (window.notificationSystem) {
        return window.notificationSystem.show(message, type, duration);
    }
    // Fallback to console if notification system not available
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Enhanced fetchWithAuth with better error handling
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
        
        // Handle different response types
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // If response is not JSON, use status text
            }

            // Handle specific error cases
            if (response.status === 401) {
                showNotification('Session expired. Please login again.', 'error');
                // Redirect to login after a delay
                setTimeout(() => {
                    window.location.href = '/admin/login.html';
                }, 2000);
                throw new Error('Session expired');
            } else if (response.status === 403) {
                showNotification('Access denied. You do not have permission for this action.', 'warning');
                throw new Error('Access denied');
            } else if (response.status === 404) {
                showNotification('Resource not found. Please check the URL.', 'error');
                throw new Error('Resource not found');
            } else if (response.status >= 500) {
                showNotification('Server error. Please try again later.', 'error');
                throw new Error('Server error');
            }

            throw new Error(errorMessage);
        }

        // Try to parse JSON response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return response;
        }
    } catch (error) {
        console.error('fetchWithAuth error:', error);
        
        // Show user-friendly error message
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showNotification('Network error. Please check your connection.', 'error');
        } else if (!error.message.includes('Session expired') && !error.message.includes('Access denied')) {
            showNotification(`Request failed: ${error.message}`, 'error');
        }
        
        throw error;
    }
}

// Registration session error handler
async function handleRegistrationSessionError(error, context = '') {
    console.error(`Registration session error ${context}:`, error);
    
    let userMessage = 'Failed to load registration sessions';
    
    if (error.message.includes('Session expired')) {
        userMessage = 'Session expired. Please login again.';
        showNotification(userMessage, 'error');
        setTimeout(() => {
            window.location.href = '/admin/login.html';
        }, 2000);
    } else if (error.message.includes('Access denied')) {
        userMessage = 'You do not have permission to access registration sessions.';
        showNotification(userMessage, 'warning');
    } else if (error.message.includes('Network error')) {
        userMessage = 'Network error. Please check your connection and try again.';
        showNotification(userMessage, 'error');
    } else if (error.message.includes('Server error')) {
        userMessage = 'Server error. Please try again later.';
        showNotification(userMessage, 'error');
    } else {
        userMessage = `Error loading registration sessions: ${error.message}`;
        showNotification(userMessage, 'error');
    }
    
    return { success: false, message: userMessage, error: error.message };
}

// Enhanced registration session loader with retry logic
async function loadRegistrationSessionsWithRetry(maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempting to load registration sessions (attempt ${attempt}/${maxRetries})`);
            
            const response = await fetchWithAuth('/.netlify/functions/registration-sessions');
            
            if (response.success && Array.isArray(response.sessions)) {
                console.log(`✅ Registration sessions loaded successfully on attempt ${attempt}`);
                return response;
            } else {
                throw new Error(response.message || 'Invalid response format');
            }
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                showNotification(`Retrying... (${attempt}/${maxRetries})`, 'info', 2000);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    
    // All attempts failed
    return await handleRegistrationSessionError(lastError, `after ${maxRetries} attempts`);
}

// Utility function to check if user has permission
function hasPermission(requiredRole, userRole) {
    if (!userRole) return false;
    
    const roleHierarchy = {
        'superadmin': 3,
        'admin': 2,
        'user': 1
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Utility function to format dates
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        return 'Invalid date';
    }
}

// Utility function to copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            textArea.remove();
            return Promise.resolve();
        } catch (error) {
            textArea.remove();
            return Promise.reject(error);
        }
    }
}

// Add CSS animations for notifications
function addNotificationStyles() {
    if (document.getElementById('notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        #floating-notifications .alert {
            transition: all 0.3s ease;
        }
        
        #floating-notifications .alert:hover {
            transform: translateX(-5px);
        }
    `;
    document.head.appendChild(style);
}

// Initialize notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    addNotificationStyles();
});

// Export functions for use in other modules
window.utils = {
    showNotification,
    fetchWithAuth,
    handleRegistrationSessionError,
    loadRegistrationSessionsWithRetry,
    hasPermission,
    formatDate,
    copyToClipboard
};

// Utils loaded and available globally
