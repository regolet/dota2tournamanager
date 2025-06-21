// Simple Session Manager - bypasses complex session logic
(function() {
    "use strict";

    // Debug flag - set to false now that session is working
    let debugMode = false;
    
    function debugLog(...args) {
        if (debugMode) {
            console.log('[SessionManager]', ...args);
        }
    }

    // Simple session validation
    async function validateCurrentSession() {
        try {
            debugLog('Starting session validation...');
            
            // Check if we're coming from a login redirect
            const urlParams = new URLSearchParams(window.location.search);
            const fromLogin = urlParams.get('from') === 'login';
            if (fromLogin) {
                debugLog('Detected redirect from login page, giving extra time...');
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
                    debugLog(`Attempt ${i+1} to get sessionId failed:`, e);
                }
            }
            
            if (!sessionId) {
                debugLog("No session ID found after multiple attempts");
                // Only redirect if we haven't just come from login
                if (!fromLogin) {
                    debugLog("Redirecting to login - no session found");
                    redirectToLogin();
                }
                return false;
            }

            debugLog("Found session ID:", sessionId);

            // Check if we just came from a successful login (grace period)
            const loginTimestamp = localStorage.getItem("adminLoginTimestamp");
            const now = Date.now();
            const isRecentLogin = loginTimestamp && (now - parseInt(loginTimestamp)) < 10000; // 10 second grace period
            
            if (isRecentLogin) {
                debugLog("Recent login detected, giving extra time for session establishment");
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Add a small delay to ensure session is established server-side
            await new Promise(resolve => setTimeout(resolve, 300));

            // Try validation with retries for race conditions
            let lastError = null;
            for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                    debugLog(`Session validation attempt ${attempt}/5`);
                    
                    const response = await fetch("/.netlify/functions/check-session", {
                        headers: {
                            "x-session-id": sessionId
                        }
                    });

                    debugLog("Session check response status:", response.status);

                    if (response.ok) {
                        const data = await response.json();
                        debugLog("Session check response data:", data);
                        
                        if (data.success) {
                            debugLog("Session valid for user:", data.user.username);
                            // Store/update user info
                            try {
                                localStorage.setItem("adminUser", JSON.stringify(data.user));
                                localStorage.removeItem("adminLoginTimestamp"); // Clear login timestamp
                            } catch (e) {
                                debugLog("Failed to update user info:", e);
                            }
                            return true;
                        } else {
                            debugLog("Session invalid:", data.error || data.message);
                            if (attempt === 5) {
                                redirectToLogin();
                                return false;
                            }
                        }
                    } else {
                        debugLog("Session check failed - response not ok, status:", response.status);
                        if (attempt === 5) {
                            redirectToLogin();
                            return false;
                        }
                    }
                } catch (fetchError) {
                    debugLog(`Session check attempt ${attempt} failed:`, fetchError.message);
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
            debugLog("All session validation attempts failed");
            redirectToLogin();
            return false;
        } catch (error) {
            debugLog("Session validation error:", error);
            
            // For network errors, try once more before giving up
            try {
                debugLog("Retrying session validation after error...");
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                const sessionId = localStorage.getItem("adminSessionId");
                if (!sessionId) {
                    redirectToLogin();
                    return false;
                }
                
                const response = await fetch("/.netlify/functions/check-session", {
                    headers: {
                        "x-session-id": sessionId
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        debugLog("Session valid on error retry for user:", data.user.username);
                        localStorage.setItem("adminUser", JSON.stringify(data.user));
                        return true;
                    }
                }
            } catch (retryError) {
                debugLog("Session validation retry also failed:", retryError);
            }
            
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        debugLog("Preparing to redirect to login...");
        
        // Clear invalid session data
        try {
            localStorage.removeItem("adminSessionId");
            localStorage.removeItem("adminUser");
            localStorage.removeItem("adminSessionExpires");
            localStorage.removeItem("adminLoginTimestamp");
        } catch (e) {
            debugLog("Error clearing localStorage:", e);
        }
        
        // Only redirect if we are not already on the login page
        if (!window.location.pathname.includes("login.html")) {
            debugLog("Redirecting to login page");
            window.location.href = "/admin/login.html";
        }
    }

    // Initialize session check on page load
    document.addEventListener("DOMContentLoaded", async function() {
        debugLog("DOM Content Loaded - Session Manager initializing...");
        
        // Skip session check if we are on the login page
        if (window.location.pathname.includes("login.html")) {
            debugLog("On login page, skipping session check");
            return;
        }

        debugLog("Starting session validation...");
        const isValid = await validateCurrentSession();
        
        if (isValid) {
            debugLog("Session valid - proceeding with page load");
            // Dispatch event to let other modules know session is ready
            window.dispatchEvent(new CustomEvent("sessionReady"));
        } else {
            debugLog("Session validation failed");
        }
    });

    // Expose simple session utilities
    window.simpleSessionManager = {
        validateCurrentSession,
        getSessionId: () => {
            try {
                return localStorage.getItem("adminSessionId");
            } catch (e) {
                debugLog("Error getting session ID:", e);
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
            debugLog("Logging out...");
            try {
                localStorage.removeItem("adminSessionId");
                localStorage.removeItem("adminUser");
                localStorage.removeItem("adminSessionExpires");
                localStorage.removeItem("adminLoginTimestamp");
            } catch (e) {
                debugLog("Error during logout:", e);
            }
            window.location.href = "/admin/login.html";
        },
        // Add compatibility methods
        init: async () => {
            debugLog("Session manager init() called - using simple session manager");
            return await validateCurrentSession();
        },
        checkSession: () => validateCurrentSession(),
        isLoggedIn: () => {
            try {
                return !!localStorage.getItem("adminSessionId");
            } catch (e) {
                debugLog("Error checking login status:", e);
                return false;
            }
        }
    };

    // Also expose as window.sessionManager for backward compatibility
    window.sessionManager = window.simpleSessionManager;

    debugLog("Session Manager loaded and ready");

})();
