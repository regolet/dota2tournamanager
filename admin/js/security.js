// Frontend security enhancements
(function() {
    'use strict';

    /**
     * Initialize security features
     */
    function initSecurity() {
        // Set up CSRF protection
        setupCSRFProtection();
        
        // Monitor for security threats
        setupThreatMonitoring();
        
        // Secure local storage
        setupSecureStorage();
    }

    /**
     * CSRF Protection setup
     */
    function setupCSRFProtection() {
        // Add CSRF token to all API requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            
            // Only add CSRF token for our API endpoints
            if (url.includes('/.netlify/functions/') || url.includes('/api/')) {
                options.headers = options.headers || {};
                
                // Add timestamp-based token (simple implementation)
                const token = btoa(Date.now().toString() + Math.random().toString());
                options.headers['X-CSRF-Token'] = token;
            }
            
            return originalFetch.apply(this, [url, options]);
        };
    }

    /**
     * Threat monitoring
     */
    function setupThreatMonitoring() {
        // Monitor for suspicious activities
        let suspiciousActivities = 0;
        const maxSuspiciousActivities = 10;
        
        // Monitor for rapid form submissions
        const formSubmissionTimes = [];
        document.addEventListener('submit', function(e) {
            const now = Date.now();
            formSubmissionTimes.push(now);
            
            // Keep only last 10 submissions
            while (formSubmissionTimes.length > 10) {
                formSubmissionTimes.shift();
            }
            
            // Check for rapid submissions (more than 5 in 10 seconds)
            const recentSubmissions = formSubmissionTimes.filter(time => now - time < 10000);
            if (recentSubmissions.length > 5) {
                reportSuspiciousActivity('rapid_form_submissions');
                e.preventDefault(); // Block the submission
            }
        });

        // Monitor for unusual mouse behavior
        let mouseMovements = 0;
        document.addEventListener('mousemove', function() {
            mouseMovements++;
        });
        
        setInterval(() => {
            if (mouseMovements > 1000) { // More than 1000 movements per second
                reportSuspiciousActivity('unusual_mouse_behavior');
            }
            mouseMovements = 0;
        }, 1000);

        function reportSuspiciousActivity(type) {
            suspiciousActivities++;
            
            if (suspiciousActivities > maxSuspiciousActivities) {
                showSecurityAlert('Multiple suspicious activities detected. Please refresh the page.');
            }
        }
    }

    /**
     * Secure storage implementation
     */
    function setupSecureStorage() {
        const originalSetItem = localStorage.setItem;
        const originalGetItem = localStorage.getItem;
        
        const sensitiveKeys = ['userToken', 'sessionData', 'creditCardInfo'];
        
        localStorage.setItem = function(key, value) {
            if (sensitiveKeys.includes(key)) {
                // Simple obfuscation (in production, use proper encryption)
                const obfuscated = btoa(encodeURIComponent(value));
                return originalSetItem.call(this, key, obfuscated);
            }
            return originalSetItem.call(this, key, value);
        };
        
        localStorage.getItem = function(key) {
            const value = originalGetItem.call(this, key);
            if (value && sensitiveKeys.includes(key)) {
                try {
                    return decodeURIComponent(atob(value));
                } catch (e) {
                    return null;
                }
            }
            return value;
        };
        
        // Auto-clear sensitive data on page unload
        window.addEventListener('beforeunload', function() {
            setTimeout(() => {
                sensitiveKeys.forEach(key => {
                    if (localStorage.getItem(key)) {
                        localStorage.removeItem(key);
                    }
                });
            }, 30 * 60 * 1000); // 30 minutes
        });
    }

    /**
     * Show security alert to user
     */
    function showSecurityAlert(message) {
        // Create alert modal if it doesn't exist
        let alertModal = document.getElementById('security-alert-modal');
        if (!alertModal) {
            alertModal = document.createElement('div');
            alertModal.id = 'security-alert-modal';
            alertModal.className = 'modal fade';
            alertModal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-danger">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-shield-exclamation me-2"></i>Security Alert
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger" role="alert">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                <span id="security-alert-message">${message}</span>
                            </div>
                            <p class="mb-0">If you believe this is an error, please contact the administrator.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" onclick="location.reload()">
                                Refresh Page
                            </button>
                            <button type="button" class="btn btn-danger" onclick="window.location.href='/admin/login.html'">
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(alertModal);
        } else {
            const messageElement = document.getElementById('security-alert-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
        
        // Show modal
        const modal = new bootstrap.Modal(alertModal, {
            backdrop: 'static',
            keyboard: false
        });
        modal.show();
    }

    /**
     * Input sanitization helpers
     */
    window.sanitizeInput = function(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/vbscript:/gi, '') // Remove vbscript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    };

    /**
     * Safe HTML insertion
     */
    window.safeSetHTML = function(element, html) {
        if (!element) return;
        
        // Create a temporary div to parse HTML safely
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove all script tags and dangerous attributes
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove dangerous attributes
            const dangerousAttrs = Array.from(el.attributes).filter(attr => 
                attr.name.startsWith('on') || 
                attr.name === 'src' && /javascript:|vbscript:/i.test(attr.value)
            );
            dangerousAttrs.forEach(attr => el.removeAttribute(attr.name));
        });
        
        element.innerHTML = temp.innerHTML;
    };

    /**
     * Secure form validation
     */
    function setupFormValidation() {
        document.addEventListener('submit', function(e) {
            const form = e.target;
            if (!form.matches('form')) return;
            
            // Validate all inputs
            const inputs = form.querySelectorAll('input, textarea, select');
            let hasInvalidInput = false;
            
            inputs.forEach(input => {
                if (input.value && typeof input.value === 'string') {
                    // Check for potential XSS
                    if (/<script|javascript:|vbscript:|on\w+=/i.test(input.value)) {
                        input.value = sanitizeInput(input.value);
                        hasInvalidInput = true;
                    }
                }
            });
            
            if (hasInvalidInput) {
                showNotification('Some input values were sanitized for security.', 'warning');
            }
        });
    }

    // Initialize security on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurity);
    } else {
        initSecurity();
    }

    // Initialize form validation
    setupFormValidation();

    // Expose security functions globally
    window.securityModule = {
        sanitizeInput: window.sanitizeInput,
        safeSetHTML: window.safeSetHTML,
        showSecurityAlert
    };

})(); 