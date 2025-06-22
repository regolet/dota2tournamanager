// Simple Session Manager
(function() {
    "use strict";

    // Simple session validation
    async function validateCurrentSession() {
        try {
            console.log('🔐 SessionManager: Starting validateCurrentSession...');
            
            // Check if we're coming from a login redirect
            const urlParams = new URLSearchParams(window.location.search);
            const fromLogin = urlParams.get('from') === 'login';
            if (fromLogin) {
                console.log('🔐 SessionManager: Coming from login redirect, waiting 1 second...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Multiple attempts to get session ID due to potential localStorage issues
            let sessionId = null;
            for (let i = 0; i < 3; i++) {
                try {
                    sessionId = localStorage.getItem("adminSessionId");
                    console.log(`🔐 SessionManager: Attempt ${i + 1} to get session ID:`, {
                        attempt: i + 1,
                        sessionId: sessionId ? `${sessionId.substring(0, 10)}...` : 'null'
                    });
                    if (sessionId) break;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {
                    console.error(`🔐 SessionManager: Error on attempt ${i + 1}:`, e);
                    // Silent retry
                }
            }
            
            if (!sessionId) {
                console.error('❌ SessionManager: No session ID found after all attempts');
                if (!fromLogin) {
                    console.log('🔐 SessionManager: Redirecting to login...');
                    redirectToLogin();
                }
                return false;
            }

            // Check if we just came from a successful login (grace period)
            const loginTimestamp = localStorage.getItem("adminLoginTimestamp");
            const now = Date.now();
            const isRecentLogin = loginTimestamp && (now - parseInt(loginTimestamp)) < 10000; // 10 second grace period
            
            if (isRecentLogin) {
                console.log('🔐 SessionManager: Recent login detected, waiting 800ms...');
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Add a small delay to ensure session is established server-side
            console.log('🔐 SessionManager: Waiting 300ms for session establishment...');
            await new Promise(resolve => setTimeout(resolve, 300));

            // Try validation with retries for race conditions
            let lastError = null;
            for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                    console.log(`🔐 SessionManager: Validation attempt ${attempt}/5...`);
                    const response = await fetch("/.netlify/functions/check-session", {
                        headers: {
                            "x-session-id": sessionId
                        }
                    });

                    console.log(`🔐 SessionManager: Check session response:`, {
                        attempt: attempt,
                        status: response.status,
                        ok: response.ok
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`🔐 SessionManager: Check session data:`, {
                            attempt: attempt,
                            success: data.success,
                            hasUser: !!data.user,
                            userRole: data.user?.role
                        });
                        
                        if (data.success) {
                            // Store/update user info
                            try {
                                localStorage.setItem("adminUser", JSON.stringify(data.user));
                                localStorage.removeItem("adminLoginTimestamp");
                                console.log('✅ SessionManager: Session validated successfully');
                            } catch (e) {
                                console.error('❌ SessionManager: Error storing user info:', e);
                                // Silent fail
                            }
                            return true;
                        } else {
                            console.warn(`⚠️ SessionManager: Session validation failed on attempt ${attempt}:`, data);
                            if (attempt === 5) {
                                console.error('❌ SessionManager: All validation attempts failed, redirecting to login');
                                redirectToLogin();
                                return false;
                            }
                        }
                    } else {
                        console.warn(`⚠️ SessionManager: HTTP error on attempt ${attempt}:`, response.status, response.statusText);
                        if (attempt === 5) {
                            console.error('❌ SessionManager: All HTTP attempts failed, redirecting to login');
                            redirectToLogin();
                            return false;
                        }
                    }
                } catch (fetchError) {
                    lastError = fetchError;
                    console.error(`❌ SessionManager: Fetch error on attempt ${attempt}:`, fetchError);
                    if (attempt === 5) {
                        throw fetchError;
                    }
                }
                
                // Wait before retry (increasing delay)
                if (attempt < 5) {
                    const delay = attempt * 400;
                    console.log(`🔐 SessionManager: Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            // If we get here, all attempts failed
            console.error('❌ SessionManager: All validation attempts failed, redirecting to login');
            redirectToLogin();
            return false;
            
        } catch (error) {
            console.error('❌ SessionManager: Critical error in validateCurrentSession:', error);
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
                const sessionId = localStorage.getItem("adminSessionId");
                console.log('🔐 SessionManager: getSessionId called:', {
                    sessionId: sessionId ? `${sessionId.substring(0, 10)}...` : 'null',
                    hasSessionId: !!sessionId
                });
                return sessionId;
            } catch (e) {
                console.error('❌ SessionManager: Error in getSessionId:', e);
                return null;
            }
        },
        getUser: () => {
            try {
                const userData = JSON.parse(localStorage.getItem("adminUser") || "{}");
                console.log('🔐 SessionManager: getUser called:', {
                    hasUserData: !!userData,
                    userData: userData,
                    userId: userData?.id,
                    username: userData?.username,
                    role: userData?.role
                });
                return userData;
            } catch (error) {
                console.error('❌ SessionManager: Error in getUser:', error);
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
