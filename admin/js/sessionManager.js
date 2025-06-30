// Optimized Session Manager
(function() {
    "use strict";

    // Cache for session data to prevent redundant calls
    const sessionCache = {
        sessionId: null,
        userData: null,
        lastValidation: 0,
        validationInProgress: false,
        cacheExpiry: 30000 // 30 seconds cache
    };

    // Simple session validation with caching
    async function validateCurrentSession() {
        try {
            console.log('🔐 SessionManager: Starting validateCurrentSession...');
            
            // Check cache first
            const now = Date.now();
            if (sessionCache.sessionId && 
                sessionCache.userData && 
                (now - sessionCache.lastValidation) < sessionCache.cacheExpiry) {
                console.log('✅ SessionManager: Using cached session data');
                return true;
            }

            // Prevent concurrent validation
            if (sessionCache.validationInProgress) {
                console.log('⏳ SessionManager: Validation already in progress, waiting...');
                while (sessionCache.validationInProgress) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                return sessionCache.sessionId && sessionCache.userData;
            }

            sessionCache.validationInProgress = true;
            
            // Check if we're coming from a login redirect
            const urlParams = new URLSearchParams(window.location.search);
            const fromLogin = urlParams.get('from') === 'login';
            
            // Reduced wait time for login redirect
            if (fromLogin) {
                console.log('🔐 SessionManager: Coming from login redirect, waiting 500ms...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Get session ID with single attempt (localStorage is usually immediate)
            const sessionId = localStorage.getItem("adminSessionId");
            console.log('🔐 SessionManager: Session ID check:', {
                hasSessionId: !!sessionId,
                sessionId: sessionId ? `${sessionId.substring(0, 10)}...` : 'null'
            });
            
            if (!sessionId) {
                console.error('❌ SessionManager: No session ID found');
                if (!fromLogin) {
                    redirectToLogin();
                }
                sessionCache.validationInProgress = false;
                return false;
            }

            // Check if we just came from a successful login (reduced grace period)
            const loginTimestamp = localStorage.getItem("adminLoginTimestamp");
            const isRecentLogin = loginTimestamp && (now - parseInt(loginTimestamp)) < 5000; // 5 second grace period
            
            if (isRecentLogin) {
                console.log('🔐 SessionManager: Recent login detected, waiting 300ms...');
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Single validation attempt with shorter timeout
            try {
                console.log('🔐 SessionManager: Validating session...');
                const response = await fetch("/.netlify/functions/check-session", {
                    headers: {
                        "x-session-id": sessionId
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.user) {
                        // Update cache
                        sessionCache.sessionId = sessionId;
                        sessionCache.userData = data.user;
                        sessionCache.lastValidation = now;
                        
                        // Store user info
                        try {
                            localStorage.setItem("adminUser", JSON.stringify(data.user));
                            localStorage.removeItem("adminLoginTimestamp");
                            console.log('✅ SessionManager: Session validated and cached');
                        } catch (e) {
                            console.error('❌ SessionManager: Error storing user info:', e);
                        }
                        
                        sessionCache.validationInProgress = false;
                        return true;
                    } else {
                        console.warn('⚠️ SessionManager: Session validation failed:', data);
                        redirectToLogin();
                        sessionCache.validationInProgress = false;
                        return false;
                    }
                } else {
                    console.warn('⚠️ SessionManager: HTTP error:', response.status, response.statusText);
                    redirectToLogin();
                    sessionCache.validationInProgress = false;
                    return false;
                }
            } catch (fetchError) {
                console.error('❌ SessionManager: Fetch error:', fetchError);
                redirectToLogin();
                sessionCache.validationInProgress = false;
                return false;
            }
            
        } catch (error) {
            console.error('❌ SessionManager: Critical error in validateCurrentSession:', error);
            sessionCache.validationInProgress = false;
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        // Clear cache and invalid session data
        sessionCache.sessionId = null;
        sessionCache.userData = null;
        sessionCache.lastValidation = 0;
        
        try {
            localStorage.removeItem("adminSessionId");
            localStorage.removeItem("adminUser");
            localStorage.removeItem("adminSessionExpires");
            localStorage.removeItem("adminLoginTimestamp");
        } catch (e) {
            // Silent fail
        }
        
        // Only redirect if we are not already on the login page
        if (!window.location.pathname.includes("login.html")) {
            window.location.href = "/admin/login.html";
        }
    }

    // Initialize session check on page load
    document.addEventListener("DOMContentLoaded", async function() {
        // Skip session check if we are on the login page
        if (window.location.pathname.includes("login.html")) {
            return;
        }

        const isValid = await validateCurrentSession();
        
        if (isValid) {
            // Dispatch event to let other modules know session is ready
            window.dispatchEvent(new CustomEvent("sessionReady"));
        }
    });

    // Optimized session utilities with caching
    window.simpleSessionManager = {
        validateCurrentSession,
        getSessionId: () => {
            // Return cached session ID if available
            if (sessionCache.sessionId) {
                return sessionCache.sessionId;
            }
            
            try {
                const sessionId = localStorage.getItem("adminSessionId");
                if (sessionId) {
                    sessionCache.sessionId = sessionId;
                }
                return sessionId;
            } catch (e) {
                console.error('❌ SessionManager: Error in getSessionId:', e);
                return null;
            }
        },
        getUser: () => {
            // Return cached user data if available
            if (sessionCache.userData) {
                return sessionCache.userData;
            }
            
            try {
                const userData = JSON.parse(localStorage.getItem("adminUser") || "{}");
                if (userData && Object.keys(userData).length > 0) {
                    sessionCache.userData = userData;
                }
                return userData;
            } catch (error) {
                console.error('❌ SessionManager: Error in getUser:', error);
                return {};
            }
        },
        clearCache: () => {
            sessionCache.sessionId = null;
            sessionCache.userData = null;
            sessionCache.lastValidation = 0;
            sessionCache.validationInProgress = false;
        },
        refreshSession: async () => {
            sessionCache.clearCache();
            return await validateCurrentSession();
        }
    };

    // Legacy compatibility
    window.sessionManager = window.simpleSessionManager;

})();
