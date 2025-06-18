// Shared utilities and constants

// DEPRECATED: This is kept for compatibility but no longer used directly
// The application now uses static JSON files instead of API calls
const API_BASE_URL = '/api';

async function fetchWithAuth(endpoint, options = {}) {
    // Remove leading slash from endpoint if present and handle API base URL
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // If endpoint already starts with api/, remove it to prevent duplication
    if (normalizedEndpoint.startsWith('api/')) {
        normalizedEndpoint = normalizedEndpoint.replace('api/', '');
    }
    
    const url = `${API_BASE_URL}/${normalizedEndpoint}`;
            // Making request
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include'
        });
        
        // Response status
        
        // Try to get response text first for debugging
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = responseText ? JSON.parse(responseText) : null;
        } catch (e) {
            // Failed to parse JSON response
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
        
        if (!response.ok) {
            const errorMessage = responseData?.message || 
                               responseData?.error || 
                               `HTTP ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        return responseData;
    } catch (error) {
        // API Error
        throw error;
    }
}

// Add styles for notifications if they don't exist
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1050;
            width: 320px;
            max-width: 90%;
        }
        
        .notification {
            position: relative;
            padding: 1rem 1.5rem 1rem 1rem;
            margin-bottom: 1rem;
            border-radius: 0.375rem;
            color: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: flex;
            align-items: center;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease-in-out;
            animation: slideIn 0.3s ease-out forwards;
        }
        
        .notification.show {
            opacity: 1;
            transform: translateX(0);
        }
        
        .notification.hide {
            animation: slideOut 0.3s ease-in forwards;
        }
        
        .notification i {
            margin-right: 0.75rem;
            font-size: 1.25rem;
        }
        
        .notification.success {
            background-color: #10b981;
            border-left: 4px solid #059669;
        }
        
        .notification.error {
            background-color: #ef4444;
            border-left: 4px solid #dc2626;
        }
        
        .notification.warning {
            background-color: #f59e0b;
            border-left: 4px solid #d97706;
        }
        
        .notification.info {
            background-color: #3b82f6;
            border-left: 4px solid #2563eb;
        }
        
        .notification-close {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            opacity: 0.7;
            padding: 0.25rem;
            font-size: 1rem;
            line-height: 1;
        }
        
        .notification-close:hover {
            opacity: 1;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
}

function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    
    // Add icon based on notification type
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="bi bi-check-circle-fill"></i>';
            break;
        case 'error':
            icon = '<i class="bi bi-x-circle-fill"></i>';
            break;
        case 'warning':
            icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
            break;
        default: // info
            icon = '<i class="bi bi-info-circle-fill"></i>';
    }
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close notification');
    closeButton.onclick = () => removeNotification(notification, container);
    
    // Set notification content
    notification.innerHTML = `${icon}<span>${message}</span>`;
    notification.appendChild(closeButton);
    
    // Add to container
    container.insertBefore(notification, container.firstChild);
    
    // Auto-remove after delay
    const timeoutId = setTimeout(() => {
        removeNotification(notification, container);
    }, 5000);
    
    // Pause auto-remove on hover
    notification.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
    });
    
    notification.addEventListener('mouseleave', () => {
        const newTimeoutId = setTimeout(() => {
            removeNotification(notification, container);
        }, 2000);
        notification.dataset.timeoutId = newTimeoutId;
    });
    
    // Store timeout ID on the element for cleanup
    notification.dataset.timeoutId = timeoutId;
}

function removeNotification(notification, container) {
    if (!notification) return;
    
    // Clear any pending timeout
    if (notification.dataset.timeoutId) {
        clearTimeout(parseInt(notification.dataset.timeoutId));
    }
    
    // Add hide class for exit animation
    notification.classList.remove('show');
    notification.classList.add('hide');
    
    // Remove after animation completes
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.remove();
            
            // Remove container if no more notifications
            if (container && container.children.length === 0) {
                container.remove();
            }
        }
    }, 300);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Make functions globally available
window.API_BASE_URL = API_BASE_URL;
window.fetchWithAuth = fetchWithAuth;
window.showNotification = showNotification;
window.debounce = debounce;

// Utils loaded and available globally
