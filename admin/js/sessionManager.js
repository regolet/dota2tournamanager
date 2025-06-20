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
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await fetch("/.netlify/functions/check-session", {
                headers: {
                    "x-session-id": sessionId
                }
            });

            console.log("Session check response status:", response.status);

            if (!response.ok) {
                console.log("Session check failed - response not ok, status:", response.status);
                
                // Try one more time with a longer delay for race conditions
                console.log("Retrying session check...");
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const retryResponse = await fetch("/.netlify/functions/check-session", {
                    headers: {
                        "x-session-id": sessionId
                    }
                });
                
                if (!retryResponse.ok) {
                    console.log("Session check failed on retry, redirecting to login");
                    redirectToLogin();
                    return false;
                }
                
                const retryData = await retryResponse.json();
                if (retryData.success) {
                    console.log("Session valid on retry for user:", retryData.user.username);
                    localStorage.setItem("adminUser", JSON.stringify(retryData.user));
                    return true;
                } else {
                    console.log("Session invalid on retry:", retryData.message);
                    redirectToLogin();
                    return false;
                }
            }

            const data = await response.json();
            console.log("Session check response data:", data);
            
            if (data.success) {
                console.log("Session valid for user:", data.user.username);
                // Store/update user info
                localStorage.setItem("adminUser", JSON.stringify(data.user));
                return true;
            } else {
                console.log("Session invalid:", data.message);
                redirectToLogin();
                return false;
            }
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

        console.log("Simple session manager: Checking session...");
        const isValid = await validateCurrentSession();
        
        if (isValid) {
            console.log("Session valid - proceeding with page load");
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
