// Main Admin Panel Script - Simplified version

// Helper to ensure script is loaded only once
const loadedScripts = new Set();
function loadJavaScriptModule(src) {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(src)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => {
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.body.appendChild(script);
    });
}

// Centralized module loader
async function loadAndInitModule({ htmlFile, jsFile, contentContainer, initFunction, cleanupFunction }) {
    try {
        // 1. Show loading indicator
        const container = document.getElementById(contentContainer);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>Loading ${htmlFile}...</p>
                </div>`;
        } else {
            console.error(`Content container #${contentContainer} not found.`);
            return false;
        }

        // 2. Call cleanup for previous module if it exists
        if (window.activeModule && window.activeModule.cleanup) {
            window.activeModule.cleanup();
        }

        // 3. Dynamically load the JavaScript module
        if (jsFile) {
            await loadJavaScriptModule(jsFile);
        }

        // 4. Load the HTML content
        const response = await fetch(htmlFile);
        if (!response.ok) {
            throw new Error(`Failed to load ${htmlFile}: ${response.statusText}`);
        }
        container.innerHTML = await response.text();

        // 5. Initialize the new module
        if (typeof window[initFunction] === 'function') {
            await window[initFunction]();
        } else {
            console.warn(`Initialization function ${initFunction} not found.`);
        }

        // 6. Set the active module for cleanup later
        window.activeModule = {
            name: initFunction,
            cleanup: typeof window[cleanupFunction] === 'function' ? window[cleanupFunction] : null
        };
        
        return true;
    } catch (error) {
        console.error(`Error loading module ${htmlFile}:`, error);
        const container = document.getElementById(contentContainer);
        if(container) {
            container.innerHTML = `<div class="alert alert-danger">Failed to load content. Please try again.</div>`;
        }
        return false;
    }
}

// Define the application namespace and module loader immediately
window.adminApp = {
    loadAndInitModule
};

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

/*
DEPRECATED: adminApp is now defined at the top of the file.
window.adminApp = {
    loadAndInitModule,
    loadTeamBalancer,
    loadRandomPicker,
    loadPlayerList,
    loadRegistration
};
*/
