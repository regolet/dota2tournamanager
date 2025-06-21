// login.js - Handles admin login functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

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
                
                // Store login timestamp for grace period
                localStorage.setItem('adminLoginTimestamp', Date.now().toString());
                
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
                
                // Wait a moment for session to be fully established
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Verify session is working before redirect with retries
                let sessionVerified = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`Verifying session attempt ${attempt}/3`);
                        const verifyResponse = await fetch('/.netlify/functions/check-session', {
                            headers: {
                                'x-session-id': data.sessionId
                            }
                        });
                        
                        if (verifyResponse.ok) {
                            const verifyData = await verifyResponse.json();
                            
                            if (verifyData.success) {
                                console.log('Session verified successfully for user:', verifyData.user.username);
                                sessionVerified = true;
                                break;
                            } else {
                                console.log(`Session verification failed on attempt ${attempt}:`, verifyData.error || verifyData.message);
                            }
                        } else {
                            console.log(`Session verification response not ok on attempt ${attempt}:`, verifyResponse.status);
                        }
                    } catch (verifyError) {
                        console.warn(`Session verification attempt ${attempt} failed:`, verifyError);
                    }
                    
                    // Wait before retry (except on last attempt)
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
                
                // Redirect with appropriate delay
                if (sessionVerified) {
                    // Session verified, redirect immediately
                    window.location.href = '/admin/index.html';
                } else {
                    // Session not verified, redirect with delay and hope for the best
                    console.warn('Session could not be verified, redirecting with delay');
                    setTimeout(() => {
                        window.location.href = '/admin/index.html';
                    }, 750);
                }
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

function showAlert(container, type, message) {
    if (!container) return;
    
    container.innerHTML = '';
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.setAttribute('role', 'alert');
    
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
    
    alert.innerHTML = `
        ${icon}
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    container.appendChild(alert);
}

async function checkLoginStatus() {
    try {
        const sessionId = localStorage.getItem('adminSessionId');
        if (!sessionId) return false;
        
        const response = await fetch('/.netlify/functions/check-session', {
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
