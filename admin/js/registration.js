// Module state object to avoid variable redeclaration conflicts
if (!window.registrationState) {
    window.registrationState = {};
}

// Prevent duplicate declaration errors when script is reloaded
if (typeof API_CONFIG === 'undefined') {
    var API_CONFIG = {
        baseUrl: window.location.origin, // Use the current origin (e.g., http://localhost:3000)
        endpoints: {
            save: '/.netlify/functions/registration',
            load: '/.netlify/functions/registration',
            close: '/.netlify/functions/registration',
            playerCount: '/.netlify/functions/get-players'
        }
    };
}

// Or if it's an object, merge existing with new
window.API_CONFIG = window.API_CONFIG || {
    baseUrl: window.location.origin, // Use the current origin (e.g., http://localhost:3000)
    endpoints: {
        save: '/.netlify/functions/registration',
        load: '/.netlify/functions/registration',
        close: '/.netlify/functions/registration',
        playerCount: '/.netlify/functions/get-players'
    }
};

// Utility functions
function fetchWithAuth(url, options = {}) {
    const sessionId = localStorage.getItem('adminSessionId');
    if (sessionId) {
        if (!options.headers) options.headers = {};
        options.headers['X-Session-Id'] = sessionId;
    }
    return fetch(url, options);
}

function showNotification(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alert.style.zIndex = '1100';
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    document.body.appendChild(alert);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 3000);
}

// Initialize global registration state if not exists
if (!window.registrationGlobals) {
    window.registrationGlobals = {
        // DOM Elements
        expiryDateInput: null,
        expiryTimeInput: null,
        createRegistrationButton: null,
        closeRegistrationButton: null,
        currentRegStatusSpan: null,
        registrationInfoDiv: null,
        playerLimitInput: null,
        enablePlayerLimitCheckbox: null,
        playerLimitDisplay: null,
        playerCountDisplay: null,
        playerProgressBar: null,
        
        // State
        currentRegistrationSettings: {
            isOpen: false,
            expiry: null,
            createdAt: null,
            playerLimit: 40,
            enablePlayerLimit: true
        },
        currentPlayerCount: 0,
        registrationUpdateTimer: null
    };
}

// Create local references for easier access
var expiryDateInput, expiryTimeInput, createRegistrationButton, closeRegistrationButton;
var currentRegStatusSpan, registrationInfoDiv;
var playerLimitInput, enablePlayerLimitCheckbox, playerLimitDisplay, playerCountDisplay, playerProgressBar;
var currentRegistrationSettings, currentPlayerCount, registrationUpdateTimer;

// Initialize registration module
async function initRegistration() {
    try {
        // Get references from global state
        const globals = window.registrationGlobals;
        expiryDateInput = globals.expiryDateInput;
        expiryTimeInput = globals.expiryTimeInput;
        createRegistrationButton = globals.createRegistrationButton;
        closeRegistrationButton = globals.closeRegistrationButton;
        currentRegStatusSpan = globals.currentRegStatusSpan;
        registrationInfoDiv = globals.registrationInfoDiv;
        playerLimitInput = globals.playerLimitInput;
        enablePlayerLimitCheckbox = globals.enablePlayerLimitCheckbox;
        playerLimitDisplay = globals.playerLimitDisplay;
        playerCountDisplay = globals.playerCountDisplay;
        playerProgressBar = globals.playerProgressBar;
        currentRegistrationSettings = globals.currentRegistrationSettings;
        currentPlayerCount = globals.currentPlayerCount;
        registrationUpdateTimer = globals.registrationUpdateTimer;
        
        // Clear any existing timer to prevent multiple timers
        if (registrationUpdateTimer) {
            clearTimeout(registrationUpdateTimer);
            registrationUpdateTimer = null;
            globals.registrationUpdateTimer = null;
        }
        
        // Check if the registration-manager section exists
        const selectors = [
            '#registration-manager',
            'section#registration-manager',
            'section[id="registration-manager"]',
            '#registration',
            'section#registration',
            'section[id="registration"]',
            'div#registration-manager',
            'div#registration',
            'section.mb-4'
        ];
        
        let registrationSection = null;
        
        // Try each selector
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                registrationSection = element;
                break;
            }
        }
        
        if (!registrationSection) {
            // Add the section to the DOM if it's missing
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                // Fetch the HTML content directly
                try {
                    const response = await fetch('./registration.html');
                    if (response.ok) {
                        const html = await response.text();
                        mainContent.innerHTML = html;
                        
                        // Try to find the section again
                        registrationSection = document.querySelector('#registration-manager') || document.querySelector('#registration');
                    }
                } catch (error) {
                    // Error handling without console.log
                }
            }
        }
        
        // Wait for DOM to stabilize
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Initialize all global DOM element variables
        // Form control elements
        expiryDateInput = globals.expiryDateInput = document.getElementById('expiry-date');
        expiryTimeInput = globals.expiryTimeInput = document.getElementById('expiry-time');
        createRegistrationButton = globals.createRegistrationButton = document.getElementById('create-registration');
        closeRegistrationButton = globals.closeRegistrationButton = document.getElementById('close-registration');
        playerLimitInput = globals.playerLimitInput = document.getElementById('player-limit');
        enablePlayerLimitCheckbox = globals.enablePlayerLimitCheckbox = document.getElementById('enable-player-limit');
        
        // Status display elements
        currentRegStatusSpan = globals.currentRegStatusSpan = document.getElementById('current-reg-status');
        registrationInfoDiv = globals.registrationInfoDiv = document.getElementById('registration-info');
        playerLimitDisplay = globals.playerLimitDisplay = document.getElementById('player-limit-display');
        playerCountDisplay = globals.playerCountDisplay = document.getElementById('player-count-registration');
        playerProgressBar = globals.playerProgressBar = document.getElementById('player-progress');
        
        // Check if critical elements are missing
        const criticalElements = {
            createRegBtn: !!createRegistrationButton,
            closeRegBtn: !!closeRegistrationButton,
            expiryDate: !!expiryDateInput,
            expiryTime: !!expiryTimeInput
        };
        
        // If critical elements are missing, try to recreate them
        const missingCriticalElements = Object.values(criticalElements).some(exists => !exists);
        if (missingCriticalElements && registrationSection) {
            // Try to find or create the elements
            if (!createRegistrationButton) {
                createRegistrationButton = document.createElement('button');
                createRegistrationButton.id = 'create-registration';
                createRegistrationButton.className = 'btn btn-primary btn-lg flex-grow-1';
                createRegistrationButton.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Create Tournament Registration';
                
                // Find a place to insert it
                const buttonContainer = registrationSection.querySelector('.d-grid.gap-2.d-md-flex');
                if (buttonContainer) {
                    buttonContainer.appendChild(createRegistrationButton);
                }
            }
        }
        
        // Set up event listeners
        if (createRegistrationButton) {
            createRegistrationButton.addEventListener('click', createRegistration);
        }
        
        if (closeRegistrationButton) {
            closeRegistrationButton.addEventListener('click', closeRegistration);
        }
        
        if (expiryDateInput && expiryTimeInput) {
            // Set default expiry to 24 hours from now
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            expiryDateInput.value = tomorrow.toISOString().split('T')[0];
            expiryTimeInput.value = tomorrow.toTimeString().slice(0, 5);
            
            // Add event listeners for expiry changes
            expiryDateInput.addEventListener('change', updateExpiryDisplay);
            expiryTimeInput.addEventListener('change', updateExpiryDisplay);
        }
        
        if (playerLimitInput && enablePlayerLimitCheckbox) {
            playerLimitInput.addEventListener('input', updatePlayerLimitDisplay);
            enablePlayerLimitCheckbox.addEventListener('change', updatePlayerLimitDisplay);
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-registration-status');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadRegistrationSettings);
        }
        
        // Load registration settings
        await loadRegistrationSettings();
        
        return true;
        
    } catch (error) {
        return false;
    }
}

// Load current registration status
async function loadRegistrationStatus() {
    try {
        // Add cache-busting timestamp to prevent browser caching
        const cacheBuster = `?t=${Date.now()}`;
        
        // Load from API endpoint
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.load}${cacheBuster}`);
        
        // Default empty response structure
        let data = { success: true, registration: null };
        
        // Check if the API request was successful
        if (response.ok) {
            try {
                data = await response.json();
                
                // Handle different API response formats
                if (data && !data.registration && data.isOpen !== undefined) {
                    // Direct settings object
                    data = { registration: data };
                }
            } catch (parseError) {
                // Failed to parse JSON
                // Failed to parse registration status response
            }
        } else {
            // Endpoint not accessible
            data.registration = {
                isOpen: false,
                expiry: null,
                createdAt: null,
                playerLimit: 40,
                enablePlayerLimit: true
            };
        }
        
        // Update global state
        currentRegistrationSettings = data.registration;
        
        // Update UI based on registration status
        try {
            updateRegistrationUI();
            
            // Also update player count
            await loadPlayerCount();
        } catch (uiError) {
            // Handle UI update errors
        }
        
        return data.registration;
        
    } catch (error) {
        // Show error notification
        showNotification("Error loading registration status", "error");
        
        return null;
    }
}

// Load current player count
async function loadPlayerCount() {
    try {
        // Add cache-busting timestamp to prevent browser caching
        const cacheBuster = `?t=${Date.now()}`;
        
        // Load from players API endpoint
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.playerCount}${cacheBuster}`);
        
        // Check if the request was successful
        if (!response.ok) {
            // If endpoint fails, assume 0 players
            currentPlayerCount = 0;
            updatePlayerCountUI();
            return 0;
        }
        
        try {
            const data = await response.json();
            
            // Handle Node.js API response format
            if (data && data.success && data.players) {
                currentPlayerCount = data.players.length;
            } else if (data && data.count !== undefined) {
                currentPlayerCount = data.count;
            } else if (Array.isArray(data)) {
                // Legacy format - direct array
                currentPlayerCount = data.length;
            } else {
                currentPlayerCount = 0;
            }
        } catch (parseError) {
            // If parsing fails, assume 0 players
            currentPlayerCount = 0;
        }
        
        // Update UI
        try {
            updatePlayerCountUI();
            
            // Check if we need to auto-close registration due to player limit
            if (currentRegistrationSettings && currentRegistrationSettings.isOpen) {
                checkPlayerLimit();
            }
        } catch (uiError) {
            // Handle UI update errors
        }
        
        return currentPlayerCount;
        
    } catch (error) {
        // Handle error but don't show notification to avoid spamming
        return 0;
    }
}

// Update player count in the UI
function updatePlayerCountUI() {
    // Update player count display
    if (playerCountDisplay) {
        playerCountDisplay.textContent = currentPlayerCount;
    }
    
    // Update progress bar if we have player limit enabled
    if (playerProgressBar && currentRegistrationSettings) {
        const playerLimit = currentRegistrationSettings.playerLimit || 40;
        const percentage = Math.min(100, Math.round((currentPlayerCount / playerLimit) * 100));
        
        playerProgressBar.style.width = `${percentage}%`;
        
        // Change color based on how full it is
        if (percentage >= 90) {
            playerProgressBar.classList.remove('bg-success', 'bg-warning');
            playerProgressBar.classList.add('bg-danger');
        } else if (percentage >= 70) {
            playerProgressBar.classList.remove('bg-success', 'bg-danger');
            playerProgressBar.classList.add('bg-warning');
        } else {
            playerProgressBar.classList.remove('bg-warning', 'bg-danger');
            playerProgressBar.classList.add('bg-success');
        }
    }
}

// Check if player limit has been reached and auto-close registration if needed
function checkPlayerLimit() {
    try {
        if (!currentRegistrationSettings) return;
        
        const { isOpen, enablePlayerLimit, playerLimit } = currentRegistrationSettings;
        
        if (isOpen && enablePlayerLimit && playerLimit && currentPlayerCount >= playerLimit) {
            // Auto-close registration
            handleCloseRegistration(true);
            
            // Show notification
            showNotification(`Registration automatically closed: Player limit (${playerLimit}) reached`, 'info');
        }
    } catch (error) {
        // Handle error silently
    }
}

// Update player limit display
function updatePlayerLimitDisplay() {
    try {
        if (!playerLimitInput || !enablePlayerLimitCheckbox || !playerLimitDisplay) {
            return;
        }
        
        const limit = parseInt(playerLimitInput.value) || 40;
        const enabled = enablePlayerLimitCheckbox.checked;
        
        // Update display
        playerLimitDisplay.textContent = limit;
        
        // Update settings if they exist
        if (currentRegistrationSettings) {
            currentRegistrationSettings.playerLimit = limit;
            currentRegistrationSettings.enablePlayerLimit = enabled;
        }
    } catch (error) {
        // Handle error silently
    }
}

// Update the registration UI based on current status
function updateRegistrationUI() {
    // Check if we have the registration manager container
    const regManager = document.getElementById('registration-manager');
    if (!regManager) {
        return;
    }
    
    // Get all UI elements that need updating
    const elements = {
        statusBadge: currentRegStatusSpan,
        createBtn: createRegistrationButton,
        closeBtn: closeRegistrationButton,
        statusProgress: document.getElementById('status-progress'),
        timeRemaining: document.getElementById('time-remaining'),
        expiryTimeDisplay: document.getElementById('expiry-time-display'),
        timeUntil: document.getElementById('time-until')
    };
    
    // Check which elements are missing
    const missingElements = Object.entries(elements)
        .filter(([name, element]) => !element)
        .map(([name]) => name);
    
    if (missingElements.length > 0) {
        // If all elements are missing, the registration section may not be loaded correctly
        if (missingElements.length === Object.keys(elements).length) {
            return;
        }
    }
    
    // If we don't have registration settings, show default state
    if (!currentRegistrationSettings) {
        if (elements.statusBadge) {
            elements.statusBadge.textContent = 'Unknown';
            elements.statusBadge.className = 'badge bg-secondary';
        }
        
        if (elements.createBtn) elements.createBtn.disabled = false;
        if (elements.closeBtn) elements.closeBtn.disabled = true;
        
        return;
    }
    
    // Update UI based on registration status
    const { isOpen, expiry, createdAt } = currentRegistrationSettings;
    
    // Update status badge
    if (elements.statusBadge) {
        if (isOpen) {
            elements.statusBadge.textContent = 'Open';
            elements.statusBadge.className = 'badge bg-success';
        } else {
            elements.statusBadge.textContent = 'Closed';
            elements.statusBadge.className = 'badge bg-danger';
        }
    }
    
    // Update buttons
    if (elements.createBtn) elements.createBtn.disabled = isOpen;
    if (elements.closeBtn) elements.closeBtn.disabled = !isOpen;
    
    // Update expiry display
    if (elements.expiryTimeDisplay) {
        if (expiry) {
            const expiryDate = new Date(expiry);
            elements.expiryTimeDisplay.textContent = expiryDate.toLocaleString();
        } else {
            elements.expiryTimeDisplay.textContent = 'Not set';
        }
    }
    
    // Calculate and display time remaining if registration is open
    if (isOpen && expiry) {
        const now = new Date();
        const expiryDate = new Date(expiry);
        const timeRemaining = expiryDate - now;
        
        // Update progress bar
        if (elements.statusProgress && createdAt) {
            const startDate = new Date(createdAt);
            const totalDuration = expiryDate - startDate;
            const elapsed = now - startDate;
            const percentage = Math.min(100, Math.round((elapsed / totalDuration) * 100));
            
            elements.statusProgress.style.width = `${percentage}%`;
        }
        
        // Update time remaining display
        if (elements.timeRemaining) {
            if (timeRemaining <= 0) {
                elements.timeRemaining.textContent = 'Expired';
                
                // Auto-close registration if it's expired
                handleCloseRegistration(true);
            } else {
                // Format time remaining
                const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
                const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
                
                elements.timeRemaining.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
        
        // Update time until text
        if (elements.timeUntil) {
            if (timeRemaining <= 0) {
                elements.timeUntil.textContent = 'Registration has expired';
            } else {
                elements.timeUntil.textContent = `Registration closes ${formatTimeUntil(expiryDate)}`;
            }
        }
        
        // Set up a timer to update the UI every second
        if (!registrationUpdateTimer) {
            registrationUpdateTimer = setTimeout(() => {
                registrationUpdateTimer = null;
                updateRegistrationUI();
            }, 1000);
        }
    } else {
        // Registration is closed or no expiry set
        if (elements.statusProgress) elements.statusProgress.style.width = '0%';
        if (elements.timeRemaining) elements.timeRemaining.textContent = '--:--:--';
        if (elements.timeUntil) elements.timeUntil.textContent = 'No active registration';
        
        // Clear any existing timer
        if (registrationUpdateTimer) {
            clearTimeout(registrationUpdateTimer);
            registrationUpdateTimer = null;
        }
    }
}

// Handle creating a new registration
async function handleCreateRegistration() {
    try {
        // Get expiry date and time
        const expiryDate = expiryDateInput?.value;
        const expiryTime = expiryTimeInput?.value;
        
        if (!expiryDate || !expiryTime) {
            showNotification('Please set an expiry date and time', 'error');
            return false;
        }
        
        // Create expiry date object
        const expiry = new Date(`${expiryDate}T${expiryTime}`);
        
        // Validate expiry date is in the future
        const now = new Date();
        if (expiry <= now) {
            showNotification('Expiry date must be in the future', 'error');
            return false;
        }
        
        // Get player limit settings
        const playerLimit = parseInt(playerLimitInput?.value) || 40;
        const enablePlayerLimit = enablePlayerLimitCheckbox?.checked ?? true;
        
        // Create registration settings object
        const registrationSettings = {
            isOpen: true,
            expiry: expiry.toISOString(),
            createdAt: new Date().toISOString(),
            playerLimit,
            enablePlayerLimit
        };
        
        // Try to save using PHP endpoint first
        try {
            // Send request to PHP endpoint
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.save}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create',
                    settings: registrationSettings
                })
            });
            
            // Parse response
            const data = await response.json();
            
            // Check if successful
            if (data.success) {
                // Update current settings
                currentRegistrationSettings = registrationSettings;
                
                // Update UI
                updateRegistrationUI();
                
                // Show success notification
                showNotification('Registration created successfully', 'success');
                
                return true;
            }
        } catch (phpError) {
            // PHP endpoint failed, try Node.js endpoint
        }
        
        // Fallback to Node.js endpoint
        try {
            // Send request to Node.js endpoint
            const response = await fetch('/api/registration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create',
                    settings: registrationSettings
                })
            });
            
            // Parse response
            const data = await response.json();
            
            // Check if successful
            if (data.success) {
                // Update current settings
                currentRegistrationSettings = registrationSettings;
                
                // Update UI
                updateRegistrationUI();
                
                // Show success notification
                showNotification('Registration created successfully', 'success');
                
                return true;
            } else {
                throw new Error(data.message || 'Failed to create registration');
            }
        } catch (nodeError) {
            // Node.js endpoint failed, try direct file write
            throw new Error('Failed to save registration settings');
        }
    } catch (error) {
        // Show error notification
        showNotification('Error creating registration: ' + error.message, 'error');
        return false;
    }
}

// Handle closing the current registration
async function handleCloseRegistration(autoClose = false) {
    try {
        // Create registration settings object
        const registrationSettings = {
            ...currentRegistrationSettings,
            isOpen: false,
            closedAt: new Date().toISOString(),
            autoClose
        };
        
        // Send request to the close API endpoint
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.close}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                settings: registrationSettings
            })
        });
        
        // Parse response
        const data = await response.json();
        
        // Check if successful
        if (data.success) {
            // Update current settings
            currentRegistrationSettings = data.registration || registrationSettings;
            
            // Update UI
            updateRegistrationUI();
            
            // Show success notification
            showNotification('Registration closed successfully', 'success');
            
            return true;
        } else {
            throw new Error(data.message || 'Failed to close registration');
        }
    } catch (error) {
        // Show error notification
        showNotification('Error closing registration: ' + error.message, 'error');
        return false;
    }
}

// Refresh registration status manually
async function refreshRegistrationStatus() {
    try {
        // Load registration settings
        await loadRegistrationSettings();
        
        // Show success notification
        showNotification('Registration status refreshed', 'success');
        
        return true;
    } catch (error) {
        // Show error notification
        showNotification('Error refreshing registration status: ' + error.message, 'error');
        return false;
    }
}

/**
 * Clean up registration module resources
 * Call this when navigating away from the registration page
 */
function cleanupRegistration() {
    // Clear any existing timer
    if (registrationUpdateTimer) {
        clearTimeout(registrationUpdateTimer);
        registrationUpdateTimer = null;
    }
}

// Create registration button click handler
async function createRegistration() {
    // Get expiry date and time inputs
    if (!expiryDateInput || !expiryTimeInput) {
        showNotification('Missing expiry date/time inputs', 'error');
        return;
    }
    
    // Get current values
    const expiryDate = expiryDateInput.value;
    const expiryTime = expiryTimeInput.value;
    
    // Validate inputs
    if (!expiryDate || !expiryTime) {
        showNotification('Please set an expiry date and time', 'error');
        return;
    }
    
    // Create expiry date object
    const expiry = new Date(`${expiryDate}T${expiryTime}`);
    
    // Validate expiry date is in the future
    const now = new Date();
    if (expiry <= now) {
        showNotification('Expiry date must be in the future', 'error');
        return;
    }
    
    // Get player limit settings
    const playerLimit = parseInt(playerLimitInput?.value) || 40;
    const enablePlayerLimit = enablePlayerLimitCheckbox?.checked ?? true;
    
    // Create registration settings object
    const registrationSettings = {
        isOpen: true,
        expiry: expiry.toISOString(),
        createdAt: new Date().toISOString(),
        playerLimit,
        enablePlayerLimit
    };
    
    // Disable the button to prevent multiple clicks
    if (createRegistrationButton) {
        createRegistrationButton.disabled = true;
        createRegistrationButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
    }
    
    try {
        // Send request to the API endpoint
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.save}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'create',
                settings: registrationSettings
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        // Parse response
        const data = await response.json();
        
        // Check if successful
        if (data.success) {
            // Update current settings
            currentRegistrationSettings = data.registration || registrationSettings;
            
            // Update UI
            updateRegistrationUI();
            
            // Show success notification
            showNotification('Registration created successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to create registration');
        }
    } catch (error) {
        // Show error notification
        showNotification('Error creating registration: ' + error.message, 'error');
    } finally {
        // Re-enable the button
        if (createRegistrationButton) {
            createRegistrationButton.disabled = false;
            createRegistrationButton.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Create Tournament Registration';
        }
    }
}

// Close registration button click handler
async function closeRegistration() {
    // Confirm with user
    if (!confirm('Are you sure you want to close registration? This action cannot be undone.')) {
        return;
    }
    
    // Disable the button to prevent multiple clicks
    if (closeRegistrationButton) {
        closeRegistrationButton.disabled = true;
        closeRegistrationButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Closing...';
    }
    
    try {
        // Create registration settings object
        const registrationSettings = {
            ...currentRegistrationSettings,
            isOpen: false,
            closedAt: new Date().toISOString()
        };
        
        // Send request to the close API endpoint
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.close}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                settings: registrationSettings
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        // Parse response
        const data = await response.json();
        
        // Check if successful
        if (data.success) {
            // Update current settings
            currentRegistrationSettings = data.registration || registrationSettings;
            
            // Update UI
            updateRegistrationUI();
            
            // Show success notification
            showNotification('Registration closed successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to close registration');
        }
    } catch (error) {
        // Show error notification
        showNotification('Error closing registration: ' + error.message, 'error');
    } finally {
        // Re-enable the button
        if (closeRegistrationButton) {
            closeRegistrationButton.disabled = false;
            closeRegistrationButton.innerHTML = '<i class="bi bi-x-circle me-2"></i>Close Registration';
        }
    }
}

// Load registration settings and update UI
async function loadRegistrationSettings() {
    try {
        // Load registration status
        const registrationSettings = await loadRegistrationStatus();
        
        // Load player count
        await loadPlayerCount();
        
        // Update UI
        updateRegistrationUI();
        
        return registrationSettings;
    } catch (error) {
        // Show error notification
        showNotification('Error loading registration settings: ' + error.message, 'error');
        return null;
    }
}

// Update expiry display when date/time inputs change
function updateExpiryDisplay() {
    try {
        // Get expiry date and time inputs
        if (!expiryDateInput || !expiryTimeInput) {
            return;
        }
        
        // Get expiry display elements
        const expiryTimeDisplay = document.getElementById('expiry-time-display');
        const timeUntil = document.getElementById('time-until');
        
        if (!expiryTimeDisplay || !timeUntil) {
            return;
        }
        
        // Get current values
        const expiryDate = expiryDateInput.value;
        const expiryTime = expiryTimeInput.value;
        
        // If either is missing, show default text
        if (!expiryDate || !expiryTime) {
            expiryTimeDisplay.textContent = 'Not set';
            timeUntil.textContent = 'No active registration';
            return;
        }
        
        // Create expiry date object
        const expiry = new Date(`${expiryDate}T${expiryTime}`);
        
        // Update display
        expiryTimeDisplay.textContent = expiry.toLocaleString();
        timeUntil.textContent = `Registration will close ${formatTimeUntil(expiry)}`;
    } catch (error) {
        // Silently handle errors
    }
}

// Format time until a date in a human-readable format
function formatTimeUntil(date) {
    const now = new Date();
    const diff = date - now;
    
    if (diff <= 0) {
        return 'now';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `in ${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `in ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
}

// Make functions globally available
window.registrationAPI = {
    getRegistrationStatus: () => currentRegistrationSettings,
    refreshStatus: refreshRegistrationStatus,
    getCurrentPlayerCount: () => currentPlayerCount,
    cleanup: cleanupRegistration
};

window.initRegistration = initRegistration;
window.cleanupRegistration = cleanupRegistration;
