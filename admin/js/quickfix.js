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

    // Fix for security.js localStorage access - prevent decode errors
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
        try {
            const value = originalGetItem.call(this, key);
            // For session-related keys, return the raw value without decoding
            if (key === 'adminSessionId' || key === 'adminUser' || key === 'adminSessionExpires') {
                return value;
            }
            return value;
        } catch (error) {
            console.warn('Failed to get stored value for key:', key);
            return null;
        }
    };

    // Override any decode attempts for session data
    window.decodeStoredValue = function(key) {
        if (key === 'adminSessionId') {
            return localStorage.getItem('adminSessionId');
        }
        return localStorage.getItem(key);
    };

    console.log("Quick fix applied - reduced logging and fixed session compatibility");
})();
