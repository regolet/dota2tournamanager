// login.js - Handles admin login functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    // Login page loaded - no session checks, just login form

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const alertContainer = document.getElementById('alert-container');
        
        // Validate input
        if (!username || !password) {
            showAlert(alertContainer, 'danger', 'Username and password are required');
            return;
        }
        
        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Logging in...';
        
        try {
            // Send login request
            const response = await fetch('/.netlify/functions/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });
            
            const data = await response.json();
            
            if (data.success && data.sessionId) {
                // Store session ID in localStorage
                localStorage.setItem('adminSessionId', data.sessionId);
                
                // Store user info if available
                if (data.user) {
                    localStorage.setItem('adminUser', JSON.stringify(data.user));
                }
                
                // Store session expiration
                if (data.expiresAt) {
                    localStorage.setItem('adminSessionExpires', data.expiresAt);
                }
                
                // Show success message
                showAlert(alertContainer, 'success', 'Login successful! Redirecting...');
                
                // Redirect to admin panel (no sessionId in URL needed)
                setTimeout(() => {
                    window.location.href = '/admin/index.html';
                }, 1000);
            } else {
                // Show error message
                showAlert(alertContainer, 'danger', data.error || data.message || 'Login failed');
                
                // Reset button
                submitButton.disabled = false;
                submitButton.innerHTML = 'Login';
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert(alertContainer, 'danger', 'An error occurred during login');
            
            // Reset button
            submitButton.disabled = false;
            submitButton.innerHTML = 'Login';
        }
    });

    // Handle toggle password visibility
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = togglePassword.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            }
        });
    }
});

/**
 * Show an alert message
 * @param {HTMLElement} container - The container element
 * @param {string} type - The alert type (success, danger, warning, info)
 * @param {string} message - The alert message
 */
function showAlert(container, type, message) {
    if (!container) return;
    
    // Clear existing alerts
    container.innerHTML = '';
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.setAttribute('role', 'alert');
    
    // Add icon based on type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="bi bi-check-circle-fill me-2"></i>';
            break;
        case 'danger':
            icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
            break;
        case 'warning':
            icon = '<i class="bi bi-exclamation-circle-fill me-2"></i>';
            break;
        case 'info':
            icon = '<i class="bi bi-info-circle-fill me-2"></i>';
            break;
    }
    
    // Set alert content
    alert.innerHTML = `
        ${icon}
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add alert to container
    container.appendChild(alert);
}

/**
 * Check if user is logged in
 * @returns {Promise<boolean>} True if logged in, false otherwise
 */
async function checkLoginStatus() {
    try {
        const sessionId = localStorage.getItem('adminSessionId');
        if (!sessionId) return false;
        
        // Include session ID both as header and as URL parameter
        const url = new URL('/.netlify/functions/check-session', window.location.origin);
        url.searchParams.append('sessionId', sessionId);
        
        const response = await fetch(url, {
            headers: {
                'x-session-id': sessionId
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
} 