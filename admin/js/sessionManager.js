// Simple Session Manager - bypasses complex session logic
(function() {
    "use strict";

    // Simple session validation
    async function validateCurrentSession() {
        try {
            const sessionId = localStorage.getItem("adminSessionId");
            
            if (!sessionId) {
                console.log("No session ID found, redirecting to login");
                redirectToLogin();
                return false;
            }

            console.log("Found session ID:", sessionId);

            // Add a small delay to ensure session is established server-side
            await new Promise(resolve => setTimeout(resolve, 150));

            // Try validation with retries for race conditions
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`Session validation attempt ${attempt}/3`);
                    
                    const response = await fetch("/.netlify/functions/check-session", {
                        headers: {
                            "x-session-id": sessionId
                        }
                    });

                    console.log("Session check response status:", response.status);

                    if (response.ok) {
                        const data = await response.json();
                        console.log("Session check response data:", data);
                        
                        if (data.success) {
                            console.log("Session valid for user:", data.user.username);
                            // Store/update user info
                            localStorage.setItem("adminUser", JSON.stringify(data.user));
                            return true;
                        } else {
                            console.log("Session invalid:", data.error || data.message);
                            if (attempt === 3) {
                                redirectToLogin();
                                return false;
                            }
                        }
                    } else {
                        console.log("Session check failed - response not ok, status:", response.status);
                        if (attempt === 3) {
                            redirectToLogin();
                            return false;
                        }
                    }
                } catch (fetchError) {
                    console.log(`Session check attempt ${attempt} failed:`, fetchError.message);
                    lastError = fetchError;
                    if (attempt === 3) {
                        throw fetchError;
                    }
                }
                
                // Wait before retry (increasing delay)
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 300));
                }
            }
            
            // If we get here, all attempts failed
            redirectToLogin();
            return false;
        } catch (error) {
            console.error("Session validation error:", error);
            
            // For network errors, try once more before giving up
            try {
                console.log("Retrying session validation after error...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                
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
                        console.log("Session valid on error retry for user:", data.user.username);
                        localStorage.setItem("adminUser", JSON.stringify(data.user));
                        return true;
                    }
                }
            } catch (retryError) {
                console.error("Session validation retry also failed:", retryError);
            }
            
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        // Clear invalid session data
        localStorage.removeItem("adminSessionId");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("adminSessionExpires");
        
        // Only redirect if we are not already on the login page
        if (!window.location.pathname.includes("login.html")) {
            console.log("Redirecting to login page");
            window.location.href = "/admin/login.html";
        }
    }

    // Initialize session check on page load
    document.addEventListener("DOMContentLoaded", async function() {
        // Skip session check if we are on the login page
        if (window.location.pathname.includes("login.html")) {
            return;
        }

        // Check if we just came from a successful login (grace period)
        const loginTimestamp = localStorage.getItem("adminLoginTimestamp");
        const now = Date.now();
        const isRecentLogin = loginTimestamp && (now - parseInt(loginTimestamp)) < 5000; // 5 second grace period
        
        if (isRecentLogin) {
            console.log("Recent login detected, giving extra time for session establishment");
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log("Simple session manager: Checking session...");
        const isValid = await validateCurrentSession();
        
        if (isValid) {
            console.log("Session valid - proceeding with page load");
            // Clear login timestamp since session is now valid
            localStorage.removeItem("adminLoginTimestamp");
            // Dispatch event to let other modules know session is ready
            window.dispatchEvent(new CustomEvent("sessionReady"));
        }
    });

    // Expose simple session utilities
    window.simpleSessionManager = {
        validateCurrentSession,
        getSessionId: () => localStorage.getItem("adminSessionId"),
        getUser: () => {
            try {
                return JSON.parse(localStorage.getItem("adminUser") || "{}");
            } catch {
                return {};
            }
        },
        logout: () => {
            localStorage.removeItem("adminSessionId");
            localStorage.removeItem("adminUser");
            localStorage.removeItem("adminSessionExpires");
            window.location.href = "/admin/login.html";
        },
        // Add compatibility methods
        init: async () => {
            console.log("Session manager init() called - using simple session manager");
            return await validateCurrentSession();
        },
        checkSession: () => validateCurrentSession(),
        isLoggedIn: () => !!localStorage.getItem("adminSessionId")
    };

    // Also expose as window.sessionManager for backward compatibility
    window.sessionManager = window.simpleSessionManager;

})();
