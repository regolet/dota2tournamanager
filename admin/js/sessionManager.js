// Simple Session Manager
(function() {
    "use strict";

    // Simple session validation
    async function validateCurrentSession() {
        try {
            // Check if we're coming from a login redirect
            const urlParams = new URLSearchParams(window.location.search);
            const fromLogin = urlParams.get('from') === 'login';
            if (fromLogin) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Multiple attempts to get session ID due to potential localStorage issues
            let sessionId = null;
            for (let i = 0; i < 3; i++) {
                try {
                    sessionId = localStorage.getItem("adminSessionId");
                    if (sessionId) break;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {
                    // Silent retry
                }
            }
            
            if (!sessionId) {
                if (!fromLogin) {
                    redirectToLogin();
                }
                return false;
            }

            // Check if we just came from a successful login (grace period)
            const loginTimestamp = localStorage.getItem("adminLoginTimestamp");
            const now = Date.now();
            const isRecentLogin = loginTimestamp && (now - parseInt(loginTimestamp)) < 10000; // 10 second grace period
            
            if (isRecentLogin) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Add a small delay to ensure session is established server-side
            await new Promise(resolve => setTimeout(resolve, 300));

            // Try validation with retries for race conditions
            let lastError = null;
            for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                    const response = await fetch("/.netlify/functions/check-session", {
                        headers: {
                            "x-session-id": sessionId
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data.success) {
                            // Store/update user info
                            try {
                                localStorage.setItem("adminUser", JSON.stringify(data.user));
                                localStorage.removeItem("adminLoginTimestamp");
                            } catch (e) {
                                // Silent fail
                            }
                            return true;
                        } else {
                            if (attempt === 5) {
                                redirectToLogin();
                                return false;
                            }
                        }
                    } else {
                        if (attempt === 5) {
                            redirectToLogin();
                            return false;
                        }
                    }
                } catch (fetchError) {
                    lastError = fetchError;
                    if (attempt === 5) {
                        throw fetchError;
                    }
                }
                
                // Wait before retry (increasing delay)
                if (attempt < 5) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 400));
                }
            }
            
            // If we get here, all attempts failed
            redirectToLogin();
            return false;
            
        } catch (error) {
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        // Clear invalid session data
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

    // Expose simple session utilities
    window.simpleSessionManager = {
        validateCurrentSession,
        getSessionId: () => {
            try {
                return localStorage.getItem("adminSessionId");
            } catch (e) {
                return null;
            }
        },
        getUser: () => {
            try {
                return JSON.parse(localStorage.getItem("adminUser") || "{}");
            } catch {
                return {};
            }
        },
        getUserInfo: () => {
            try {
                return JSON.parse(localStorage.getItem("adminUser") || "{}");
            } catch {
                return {};
            }
        },
        logout: () => {
            try {
                localStorage.removeItem("adminSessionId");
                localStorage.removeItem("adminUser");
                localStorage.removeItem("adminSessionExpires");
                localStorage.removeItem("adminLoginTimestamp");
            } catch (e) {
                // Silent fail
            }
            window.location.href = "/admin/login.html";
        },
        // Add compatibility methods
        init: async () => {
            return await validateCurrentSession();
        },
        checkSession: () => validateCurrentSession(),
        isLoggedIn: () => {
            try {
                return !!localStorage.getItem("adminSessionId");
            } catch (e) {
                return false;
            }
        }
    };

    // Also expose as window.sessionManager for backward compatibility
    window.sessionManager = window.simpleSessionManager;

})();
