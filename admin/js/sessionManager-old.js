/**
 * Centralized Session Manager for Admin Panel
 * Handles all authentication logic in one place
 */

class SessionManager {
    constructor() {
        this.sessionId = null;
        this.userInfo = null;
        this.isAuthenticated = false;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * Initialize session management
     * @returns {Promise<boolean>} True if authenticated, false otherwise
     */
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._performInit();
        return this.initPromise;
    }

    async _performInit() {
        // SessionManager: Initializing
        
        // Prevent multiple initializations
        if (this.isInitialized) {
            // SessionManager: Already initialized, returning current state
            return this.isAuthenticated;
        }

        try {
            // Get session ID from all possible sources
            const urlSessionId = new URLSearchParams(window.location.search).get('sessionId');
            const localSessionId = localStorage.getItem('adminSessionId');
            const persistentAuth = localStorage.getItem('adminPersistentAuth');
            
            let sessionId = urlSessionId || localSessionId || persistentAuth;
            
                    // SessionManager: Session ID sources

            if (!sessionId) {
                // SessionManager: No session ID found
                this._redirectToLogin();
                return false;
            }

            // Save URL session to localStorage
            if (urlSessionId && urlSessionId !== localSessionId) {
                localStorage.setItem('adminSessionId', urlSessionId);
                // SessionManager: Saved URL session to localStorage
                sessionId = urlSessionId;
            }

            // Verify session with server
            const sessionData = await this._verifySession(sessionId);
            
            if (sessionData.valid) {
                this.sessionId = sessionId;
                this.userInfo = sessionData.user;
                this.isAuthenticated = true;
                this.isInitialized = true;
                
                // Clean up URL parameters
                if (urlSessionId) {
                    const cleanUrl = new URL(window.location);
                    cleanUrl.searchParams.delete('sessionId');
                    window.history.replaceState({}, document.title, cleanUrl.toString());
                }
                
                // SessionManager: Authentication successful
                return true;
            } else {
                // SessionManager: Session verification failed - session is invalid
                
                // Session is invalid on server, clear everything immediately
                this._clearAuthData();
                
                // Use location.replace with cache busting to ensure clean state
                // SessionManager: Redirecting to login due to invalid session
                window.location.replace('/admin/login.html?invalid=true&t=' + Date.now());
                return false;
            }
        } catch (error) {
            // SessionManager: Error during initialization
            this._clearAuthData();
            this._redirectToLogin();
            return false;
        }
    }

    /**
     * Verify session with server
     * @param {string} sessionId 
     * @returns {Promise<object>}
     */
    async _verifySession(sessionId) {
        try {
            const url = new URL('/.netlify/functions/check-session', window.location.origin);
            url.searchParams.append('sessionId', sessionId);
            
            const response = await fetch(url, {
                headers: {
                    'x-session-id': sessionId
                }
            });
            
            if (!response.ok) {
                return { valid: false };
            }
            
            const data = await response.json();
            if (data.success === true && data.user) {
                return { 
                    valid: true, 
                    user: data.user 
                };
            }
            
            return { valid: false };
        } catch (error) {
            // SessionManager: Error verifying session
            return { valid: false };
        }
    }

    /**
     * Get current session ID
     * @returns {string|null}
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuth() {
        return this.isAuthenticated;
    }

    /**
     * Get current user information
     * @returns {object|null}
     */
    getUserInfo() {
        return this.userInfo;
    }

    /**
     * Make authenticated fetch request
     * @param {string} url 
     * @param {object} options 
     * @returns {Promise<Response>}
     */
    async authenticatedFetch(url, options = {}) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        const headers = {
            'X-Session-Id': this.sessionId,
            ...options.headers
        };

        return fetch(url, {
            ...options,
            headers
        });
    }

    /**
     * Logout user
     */
    async logout() {
        // SessionManager: Starting logout process
        try {
            if (this.sessionId) {
                // SessionManager: Calling server logout API
                await this.authenticatedFetch('/admin/api/logout', {
                    method: 'POST'
                });
                // SessionManager: Server logout successful
            }
        } catch (error) {
            // SessionManager: Error during logout
        } finally {
            this._clearAuthData();
            
            // Force page reload to ensure all state is cleared
            // SessionManager: Forcing complete logout with page reload
            
            // Use location.replace to prevent going back
            window.location.replace('/admin/login.html?logout=true&t=' + Date.now());
        }
    }

    /**
     * Clear all authentication data
     */
    _clearAuthData() {
        // SessionManager: Clearing all authentication data
        this.sessionId = null;
        this.userInfo = null;
        this.isAuthenticated = false;
        this.isInitialized = false;
        this.initPromise = null;
        
        // Clear all possible localStorage keys
        localStorage.removeItem('adminSessionId');
        localStorage.removeItem('adminPersistentAuth');
        
        // Clear any session-related data from sessionStorage as well
        sessionStorage.removeItem('adminSessionId');
        sessionStorage.removeItem('adminPersistentAuth');
        
        // SessionManager: All authentication data cleared
    }

    /**
     * Redirect to login page
     */
    _redirectToLogin() {
        if (!window.location.pathname.includes('login.html')) {
            // SessionManager: Redirecting to login page
            window.location.href = '/admin/login.html';
        }
    }
}

// Create singleton instance and make it globally available
window.sessionManager = new SessionManager();

// SessionManager loaded and available globally 