// Main Admin Panel Script - Simplified version

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Show admin content immediately
    const adminContent = document.getElementById('main-content');
    if (adminContent) {
        // Main content container found
    } else {
        console.error('Main content container not found');
    }
    
    // Initialize navigation
    setTimeout(() => {
        if (typeof initNavigation === 'function') {
            initNavigation();
            // Navigation initialized
        } else {
            console.error('Navigation function not found');
            
            // Try to load navigation.js manually
            const script = document.createElement('script');
            script.src = './js/navigation.js';
            script.onload = () => {
                // Navigation script loaded manually
                if (typeof initNavigation === 'function') {
                    initNavigation();
                }
            };
            document.head.appendChild(script);
        }
    }, 500);
});

// Global state for module APIs
let teamBalancerAPI, randomPickerAPI, registrationAPI;

// Set up API references when modules are initialized
window.setTeamBalancerAPI = (api) => {
    teamBalancerAPI = api;
};

window.setRandomPickerAPI = (api) => {
    randomPickerAPI = api;
};

window.setRegistrationAPI = (api) => {
    registrationAPI = api;
};

// Export for debugging
window.adminApp = {
    loadTeamBalancer,
    loadRandomPicker,
    loadPlayerList,
    loadRegistration
};
