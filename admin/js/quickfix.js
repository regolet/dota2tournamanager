// Quick fix for console logging and session issues
(function() {
    "use strict";

    // Override console.log to reduce excessive logging
    const originalConsoleLog = console.log;
    let logCount = 0;
    const maxLogs = 30;

    console.log = function(...args) {
        logCount++;
        if (logCount <= maxLogs) {
            originalConsoleLog.apply(console, args);
        }
    };

    // Fix for localStorage access - ensure session data is handled properly
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    
    // Session-related keys that should never be obfuscated
    const sessionKeys = ['adminSessionId', 'adminUser', 'adminSessionExpires', 'adminLoginTimestamp'];
    
    // Override localStorage to prevent any interference with session data
    localStorage.getItem = function(key) {
        try {
            const value = originalGetItem.call(this, key);
            // For session-related keys, always return the raw value
            if (sessionKeys.includes(key)) {
                return value;
            }
            return value;
        } catch (error) {
            console.warn('Failed to get stored value for key:', key);
            return null;
        }
    };
    
    localStorage.setItem = function(key, value) {
        try {
            // For session-related keys, store directly without any modification
            if (sessionKeys.includes(key)) {
                return originalSetItem.call(this, key, value);
            }
            return originalSetItem.call(this, key, value);
        } catch (error) {
            console.warn('Failed to set stored value for key:', key);
        }
    };

    // Override any decode attempts for session data
    window.decodeStoredValue = function(key) {
        if (sessionKeys.includes(key)) {
            return originalGetItem.call(localStorage, key);
        }
        return localStorage.getItem(key);
    };

    console.log("Quick fix applied - reduced logging and fixed session compatibility");
})();
