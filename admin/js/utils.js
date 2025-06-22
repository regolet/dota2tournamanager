// Shared utilities and constants

// DEPRECATED: This is kept for compatibility but no longer used directly
// The application now uses static JSON files instead of API calls
const API_BASE_URL = '/api';

async function fetchWithAuth(endpoint, options = {}) {
    // The endpoint should be a full path from the root, e.g., '/.netlify/functions/...'
    const url = endpoint;
    
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

// Password management functions
function togglePasswordVisibility(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const iconElement = document.getElementById(fieldId + '-icon');
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        iconElement.className = 'bi bi-eye-slash';
    } else {
        passwordField.type = 'password';
        iconElement.className = 'bi bi-eye';
    }
}

function checkPasswordStrength(password) {
    let score = 0;
    let feedback = [];
    
    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('At least 8 characters');
    
    // Uppercase check
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Uppercase letter');
    
    // Lowercase check
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Lowercase letter');
    
    // Number check
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Number');
    
    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Special character');
    
    // Length bonus
    if (password.length >= 12) score += 1;
    
    const strength = {
        score: score,
        percentage: Math.min((score / 5) * 100, 100),
        level: score < 2 ? 'Weak' : score < 4 ? 'Fair' : score < 5 ? 'Good' : 'Strong',
        color: score < 2 ? 'danger' : score < 4 ? 'warning' : score < 5 ? 'info' : 'success',
        feedback: feedback
    };
    
    return strength;
}

function setupPasswordChangeModal() {
    const newPasswordField = document.getElementById('new-password');
    const confirmPasswordField = document.getElementById('confirm-password');
    const strengthIndicator = document.getElementById('password-strength');
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    const matchFeedback = document.getElementById('password-match-feedback');
    const passwordForm = document.getElementById('password-change-form');
    
    if (!newPasswordField) return; // Modal not present
    
    // Password strength checking
    newPasswordField.addEventListener('input', function() {
        const password = this.value;
        
        if (password.length > 0) {
            const strength = checkPasswordStrength(password);
            strengthIndicator.style.display = 'block';
            strengthBar.style.width = strength.percentage + '%';
            strengthBar.className = `progress-bar bg-${strength.color}`;
            strengthText.textContent = strength.level;
            
            if (strength.feedback.length > 0) {
                strengthText.textContent += ' - Missing: ' + strength.feedback.join(', ');
            }
        } else {
            strengthIndicator.style.display = 'none';
        }
        
        checkPasswordMatch();
    });
    
    // Password confirmation checking
    confirmPasswordField.addEventListener('input', checkPasswordMatch);
    
    function checkPasswordMatch() {
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;
        
        if (confirmPassword.length > 0) {
            if (newPassword === confirmPassword) {
                matchFeedback.textContent = '✓ Passwords match';
                matchFeedback.className = 'form-text text-success';
                confirmPasswordField.classList.remove('is-invalid');
                confirmPasswordField.classList.add('is-valid');
            } else {
                matchFeedback.textContent = '✗ Passwords do not match';
                matchFeedback.className = 'form-text text-danger';
                confirmPasswordField.classList.remove('is-valid');
                confirmPasswordField.classList.add('is-invalid');
            }
        } else {
            matchFeedback.textContent = '';
            confirmPasswordField.classList.remove('is-valid', 'is-invalid');
        }
    }
    
    // Form submission
    passwordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;
        const submitBtn = document.getElementById('change-password-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.spinner-border');
        
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('New password and confirmation do not match', 'error');
            return;
        }
        
        if (currentPassword === newPassword) {
            showNotification('New password must be different from current password', 'error');
            return;
        }
        
        const strength = checkPasswordStrength(newPassword);
        if (strength.score < 4) {
            showNotification('Password is not strong enough. Please meet all requirements.', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Changing...';
        spinner.classList.remove('d-none');
        
        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            const response = await fetch('/.netlify/functions/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Password changed successfully!', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('passwordChangeModal'));
                modal.hide();
                
                // Reset form
                passwordForm.reset();
                strengthIndicator.style.display = 'none';
                matchFeedback.textContent = '';
                confirmPasswordField.classList.remove('is-valid', 'is-invalid');
            } else {
                showNotification(result.message || 'Failed to change password', 'error');
            }
            
        } catch (error) {
            console.error('Password change error:', error);
            showNotification('Error changing password. Please try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.textContent = 'Change Password';
            spinner.classList.add('d-none');
        }
    });
}

// Initialize password change modal when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupPasswordChangeModal();
});

// Make functions globally available
window.API_BASE_URL = API_BASE_URL;
window.fetchWithAuth = fetchWithAuth;
window.showNotification = showNotification;
window.debounce = debounce;
window.togglePasswordVisibility = togglePasswordVisibility;

// Utils loaded and available globally
