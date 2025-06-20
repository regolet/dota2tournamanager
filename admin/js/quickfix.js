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

    // Provide fallback session methods for compatibility
    if (!window.sessionManager && window.simpleSessionManager) {
        window.sessionManager = {
            getSessionId: () => window.simpleSessionManager.getSessionId(),
            getUser: () => window.simpleSessionManager.getUser(),
            isLoggedIn: () => !!window.simpleSessionManager.getSessionId()
        };
    }

    console.log("Quick fix applied - reduced logging and fixed session compatibility");
})();
