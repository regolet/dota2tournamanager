// navigation.js - Handles tab navigation and HTML file loading
// Navigation script loaded

// Simple template cache
const templateCache = new Map();

// Make sure we have global functions for each component
if (typeof initTeamBalancer !== 'function') {
    window.initTeamBalancer = async function() {
        // Team balancer placeholder function called
        return true;
    };
}

if (typeof initRandomPicker !== 'function') {
    window.initRandomPicker = async function() {
        // Random picker placeholder function called
        return true;
    };
}

if (typeof initPlayerList !== 'function') {
    window.initPlayerList = async function() {
        // Player list placeholder function called
        return true;
    };
}

if (typeof initRegistration !== 'function') {
    window.initRegistration = async function() {
        // Registration placeholder function called
        return true;
    };
}

if (typeof cleanupRegistration !== 'function') {
    window.cleanupRegistration = function() {
        // Registration cleanup placeholder function called
    };
}

/**
 * Helper function to wait for an element to be present in the DOM
 */
async function waitForElement(selector, maxAttempts = 10, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                // Found element
                resolve(element);
            } else if (attempts < maxAttempts) {
                attempts++;
                // Waiting for element
                setTimeout(checkElement, interval);
            } else {
                reject(new Error(`Element not found: ${selector} after ${maxAttempts} attempts`));
            }
        };
        checkElement();
    });
}

/**
 * Loads content from a separate HTML file
 * @param {string} filename - The file to load
 * @param {string} sectionId - The section ID for navigation
 * @param {string} title - Display title for loading state
 * @param {Function|null} initFunc - Optional initialization function to run after loading
 */
async function loadContentFromFile(filename, sectionId, title, initFunc = null) {
    // Loading content from file
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        // Main content container not found
        return false;
    }

    try {
        // Show loading state
        mainContent.classList.add('loading');
        mainContent.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="ms-3">Loading ${title}...</div>
            </div>`;

        // Load the file
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
        }

        // Get the HTML content
        const htmlContent = await response.text();
        // Received HTML content
        
        // Insert the HTML content
        mainContent.innerHTML = htmlContent;
        
        // Update active tab
        updateActiveTab(sectionId);
        
        // Wait for the DOM to be updated with a slightly longer delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // After DOM update, check if the section is actually in the document
        // Special handling for registration which might use either ID
        let sectionElement = null;
        if (sectionId === 'registration' || sectionId === 'registration-manager') {
            sectionElement = document.getElementById(sectionId) || 
                           document.getElementById('registration-manager') ||
                           document.getElementById('registration') ||
                           document.querySelector(`section[id="${sectionId}"]`) ||
                           document.querySelector(`section[id="registration-manager"]`) ||
                           document.querySelector(`section[id="registration"]`) ||
                           document.querySelector(`.${sectionId}`);
        } else {
            sectionElement = document.getElementById(sectionId) || 
                           document.querySelector(`section[id="${sectionId}"]`) ||
                           document.querySelector(`.${sectionId}`);
        }
                             
        // Section found in DOM after update
        
        if (!sectionElement) {
            // Section not found in DOM after content was loaded
            // Load fallback HTML
            try {
                const fallbackResponse = await fetch('./fallback.html');
                if (fallbackResponse.ok) {
                    const fallbackContent = await fallbackResponse.text();
                    mainContent.innerHTML = fallbackContent;
                    // Loaded fallback HTML content
                }
            } catch (fallbackError) {
                // Error loading fallback HTML
            }
            throw new Error(`Could not find section #${sectionId} in loaded content`);
        }
        
        // Run initialization function if provided
        if (initFunc) {
            // Allow a longer delay for layout to stabilize before initializing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                // Initializing
                const success = await initFunc();
                
                // Only consider explicit false as failure
                if (success === false) {
                    throw new Error(`${title} initialization returned false`);
                }
                
                // Initialized successfully
                return true;
            } catch (error) {
                // Error initializing
                
                // Load fallback HTML on initialization failure
                try {
                    const fallbackResponse = await fetch('./fallback.html');
                    if (fallbackResponse.ok) {
                        const fallbackContent = await fallbackResponse.text();
                        mainContent.innerHTML = fallbackContent;
                        // Loaded fallback HTML content after initialization failure
                    }
                } catch (fallbackError) {
                    // Error loading fallback HTML
                }
                
                throw error;
            }
        }
        
        return true;
    } catch (error) {
        // Error loading
        
        // Try to load fallback HTML
        try {
            const fallbackResponse = await fetch('./fallback.html');
            if (fallbackResponse.ok) {
                const fallbackContent = await fallbackResponse.text();
                mainContent.innerHTML = fallbackContent;
                // Loaded fallback HTML content after error
            } else {
                showError(mainContent, `Error Loading ${title}`, 
                    `Failed to load ${title}. ${error.message}`);
            }
        } catch (fallbackError) {
            console.error('Error loading fallback HTML:', fallbackError);
            showError(mainContent, `Error Loading ${title}`, 
                `Failed to load ${title}. ${error.message}`);
        }
        
        return false;
    } finally {
        mainContent.classList.remove('loading');
    }
}

/**
 * Loads and displays the team balancer section
 */
async function loadTeamBalancer() {
    // Loading Team Balancer
    
    // Clean up registration resources if switching from registration tab
    if (typeof cleanupRegistration === 'function') {
        cleanupRegistration();
    }

    // Update active tab immediately
    updateActiveTab('team-balancer');

    // Load team balancer template and JavaScript
    return loadTabContent('./team-balancer.html', 'main-content', '/admin/js/teamBalancer.js');
}

/**
 * Loads and displays the random picker section
 */
async function loadRandomPicker() {
    // Loading Random Picker
    
    // Clean up registration resources if switching from registration tab
    if (typeof cleanupRegistration === 'function') {
        cleanupRegistration();
    }

    // Update active tab immediately
    updateActiveTab('random-picker');

    // Load random picker template and JavaScript
    return loadTabContent('./random-picker.html', 'main-content', '/admin/js/randompicker.js');
}

/**
 * Loads and displays the masterlist section
 */
async function loadMasterlist() {
    console.log('=== loadMasterlist() called at:', Date.now());
    
    // Loading Masterlist
    
    // Clean up registration resources if switching from registration tab
    if (typeof cleanupRegistration === 'function') {
        cleanupRegistration();
    }

    // Update active tab immediately
    updateActiveTab('masterlist');

    // Load masterlist template and JavaScript
    return loadTabContent('./masterlist.html', 'main-content', '/admin/js/masterlist.js');
}

/**
 * Loads and displays the player list section
 */
async function loadPlayerList() {
    // Loading Player List
    
    // Clean up registration resources if switching from registration tab
    if (typeof cleanupRegistration === 'function') {
        cleanupRegistration();
    }

    // Update active tab immediately
    updateActiveTab('player-list');

    // Load player list template and JavaScript
    return loadTabContent('./player-list.html', 'main-content', '/admin/js/playerList.js');
}

/**
 * Loads and displays the registration manager section
 */
async function loadRegistration() {
    // Loading Registration Manager

    // Update active tab immediately
    updateActiveTab('registration-manager');

    // Load registration template and JavaScript
    return loadTabContent('./registration.html', 'main-content', '/admin/js/registration.js');
}

/**
 * Updates the active tab styling
 * @param {string} activeId - ID of the active section (without #)
 */
function updateActiveTab(activeId) {
    // More specific selector for nav links
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    navLinks.forEach(link => {
        // Handle both href="#section-id" and href="javascript:loadSection()"
        const href = link.getAttribute('href');
        const dataSection = link.getAttribute('data-section');
        const linkId = link.getAttribute('id');
        
        // Check multiple conditions for matching
        const isActive = (href === `#${activeId}`) || 
                        (dataSection === activeId) ||
                        (linkId === `${activeId}-tab`);
        
        if (isActive) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Shows an error message in the main content area
 * @param {HTMLElement} container - Container to show error in
 * @param {string} title - Error title
 * @param {string} message - Error message
 */
function showError(container, title, message) {
    container.innerHTML = `
        <div class="error-state">
            <h3>${title}</h3>
            <p>${message}</p>
            <button class="retry-btn" onclick="location.reload()">Try Again</button>
        </div>
    `;
}

/**
 * Initialize the navigation
 */
function initNavigation() {
    // Initializing navigation
    
    // Get session ID from session manager for link updates
    const sessionId = window.sessionManager?.getSessionId();
    
    if (sessionId) {
        // Add session ID to all admin links
        document.querySelectorAll('a[href^="/admin"]').forEach(link => {
            const url = new URL(link.href);
            url.searchParams.set('sessionId', sessionId);
            link.href = url.toString();
        });
    }

    // Add profile dropdown to navbar
    const navbar = document.querySelector('.navbar-nav');
    if (navbar) {
        // Create profile dropdown
        const profileDropdown = document.createElement('li');
        profileDropdown.className = 'nav-item dropdown ms-auto';
        profileDropdown.innerHTML = `
            <a class="nav-link dropdown-toggle" href="#" id="profileDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-person-circle me-1"></i> Admin
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="profileDropdown">
                <li><a class="dropdown-item" href="#" id="change-password-btn">
                    <i class="bi bi-key me-2"></i>Change Password
                </a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logout-btn">
                    <i class="bi bi-box-arrow-right me-2"></i>Logout
                </a></li>
            </ul>
        `;
        navbar.appendChild(profileDropdown);
        
        // Set up logout functionality using session manager
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                
                if (window.sessionManager) {
                    await window.sessionManager.logout();
                } else {
                    // Fallback logout
                    window.location.href = '/admin/login.html';
                }
            });
        }
        
        // Set up change password functionality
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', function(e) {
                e.preventDefault();
                showChangePasswordModal();
            });
        }
    }
    
    // Create change password modal if it doesn't exist
    if (!document.getElementById('change-password-modal')) {
        const modalHTML = `
            <!-- Change Password Modal -->
            <div class="modal fade" id="change-password-modal" tabindex="-1" aria-labelledby="changePasswordModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="changePasswordModalLabel">
                                <i class="bi bi-key me-2"></i>Change Password
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="change-password-form">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label for="current-password" class="form-label">Current Password</label>
                                    <div class="input-group">
                                        <input type="password" class="form-control" id="current-password" required>
                                        <button class="btn btn-outline-secondary" type="button" id="toggle-current-password">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="new-password" class="form-label">New Password</label>
                                    <div class="input-group">
                                        <input type="password" class="form-control" id="new-password" required minlength="6">
                                        <button class="btn btn-outline-secondary" type="button" id="toggle-new-password">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </div>
                                    <div class="form-text">Password must be at least 6 characters long</div>
                                </div>
                                <div class="mb-3">
                                    <label for="confirm-password" class="form-label">Confirm New Password</label>
                                    <div class="input-group">
                                        <input type="password" class="form-control" id="confirm-password" required minlength="6">
                                        <button class="btn btn-outline-secondary" type="button" id="toggle-confirm-password">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                <div id="password-change-alert" class="alert" style="display: none;"></div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="save-password-btn">Change Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up password visibility toggles
        setupPasswordToggles();
        
        // Set up form submission
        const changePasswordForm = document.getElementById('change-password-form');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', handlePasswordChange);
        }
    }
    
    // Set up navigation tabs
    const teamBalancerTab = document.getElementById('team-balancer-tab');
    const randomPickerTab = document.getElementById('random-picker-tab');
    const playerListTab = document.getElementById('player-list-tab');
    const registrationTab = document.getElementById('registration-tab');
    const masterlistTab = document.getElementById('masterlist-tab');
    
    console.log('Setting up navigation tabs:', {
        teamBalancerTab: !!teamBalancerTab,
        randomPickerTab: !!randomPickerTab,
        playerListTab: !!playerListTab,
        registrationTab: !!registrationTab,
        masterlistTab: !!masterlistTab
    });
    
    if (teamBalancerTab) {
        teamBalancerTab.addEventListener('click', function(e) {
            console.log('Team Balancer tab clicked');
            e.preventDefault();
            loadTeamBalancer();
        });
    } else {
        console.warn('Team Balancer tab not found');
    }
    
    if (randomPickerTab) {
        randomPickerTab.addEventListener('click', function(e) {
            console.log('Random Picker tab clicked');
            e.preventDefault();
            loadRandomPicker();
        });
    } else {
        console.warn('Random Picker tab not found');
    }
    
    if (playerListTab) {
        playerListTab.addEventListener('click', function(e) {
            console.log('Player List tab clicked');
            e.preventDefault();
            loadPlayerList();
        });
    } else {
        console.warn('Player List tab not found');
    }
    
    if (registrationTab) {
        registrationTab.addEventListener('click', function(e) {
            console.log('Registration tab clicked');
            e.preventDefault();
            loadRegistration();
        });
    } else {
        console.warn('Registration tab not found');
    }
    
    if (masterlistTab) {
        masterlistTab.addEventListener('click', async function(e) {
            console.log('Masterlist tab clicked! Time:', Date.now());
            e.preventDefault();
            try {
                console.log('About to call loadMasterlist...');
                await loadMasterlist();
                console.log('loadMasterlist completed successfully');
            } catch (error) {
                console.error('Error calling loadMasterlist:', error);
            }
        });
    } else {
        console.error('Masterlist tab element not found!');
    }
    
    // Load default tab content
    const defaultTab = document.querySelector('.nav-link.active');
    if (defaultTab) {
        const tabId = defaultTab.id;
        
        if (tabId === 'team-balancer-tab') {
            loadTeamBalancer();
        } else if (tabId === 'random-picker-tab') {
            loadRandomPicker();
        } else if (tabId === 'player-list-tab') {
            loadPlayerList();
        } else if (tabId === 'registration-tab') {
            loadRegistration();
        } else if (tabId === 'masterlist-tab') {
            loadMasterlist();
        }
    } else {
        // If no active tab, default to team balancer
        loadTeamBalancer();
    }
}

/**
 * Enhanced content loader for admin tabs with JavaScript module loading
 */
async function loadTabContent(templatePath, containerId, jsModulePath = null) {
    console.log('Loading content:', { templatePath, containerId, jsModulePath });
    
    try {
        console.log('Fetching template:', templatePath);
        const response = await fetch(templatePath);
        console.log('Fetch response:', { status: response.status, ok: response.ok });
        
        if (!response.ok) {
            throw new Error(`Failed to load ${templatePath}: ${response.status} ${response.statusText}`);
        }
        
        const content = await response.text();
        console.log('Content loaded, length:', content.length);
        
        const container = document.getElementById(containerId);
        console.log('Container found:', !!container);
        
        if (container) {
            container.innerHTML = content;
            console.log('Content inserted into container');
            
            // Load corresponding JavaScript module if specified
            if (jsModulePath) {
                console.log('Loading JavaScript module:', jsModulePath);
                await loadJavaScriptModule(jsModulePath);
                console.log('JavaScript module loaded successfully');
            }
            
            return true;
        } else {
            console.error('Container not found:', containerId);
            return false;
        }
    } catch (error) {
        console.error('Error loading content:', error);
        console.error('Error details:', {
            templatePath,
            containerId,
            jsModulePath,
            message: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Dynamic JavaScript module loader with cleanup and duplicate prevention
 */
async function loadJavaScriptModule(jsPath) {
    console.log('Starting JavaScript module load:', jsPath);
    
    try {
        // Remove any existing script tags for this module (force reload)
        const existingScripts = document.querySelectorAll(`script[src*="${jsPath.split('/').pop()}"]`);
        console.log('Found existing scripts:', existingScripts.length);
        existingScripts.forEach(script => {
            script.remove();
            console.log('Removed existing script:', script.src);
        });
        
        // Create and load new script with cache busting
        const script = document.createElement('script');
        script.src = `${jsPath}?v=${Date.now()}`;
        script.type = 'text/javascript';
        script.setAttribute('data-module', jsPath);
        
        console.log('Loading script:', script.src);
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
            script.onload = () => {
                console.log('Script loaded successfully:', script.src);
                resolve();
            };
            script.onerror = (error) => {
                console.error('Script failed to load:', script.src, error);
                reject(new Error(`Failed to load ${jsPath}`));
            };
            
            document.head.appendChild(script);
        });
        
        // Give a moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Call the appropriate initialization function based on the module
        const moduleFileName = jsPath.split('/').pop().replace('.js', '');
        console.log('Initializing module:', moduleFileName);
        await initializeModule(moduleFileName);
        
    } catch (error) {
        console.error('Error loading JavaScript module:', error);
        console.error('Module details:', {
            jsPath,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Initialize the appropriate module after loading
 */
async function initializeModule(moduleFileName) {
    try {
        // Initializing module
        
        switch (moduleFileName) {
            case 'teamBalancer':
                if (typeof window.initTeamBalancer === 'function') {
                    await window.initTeamBalancer();
                    // Team Balancer initialized
                } else {
                    // initTeamBalancer function not found
                }
                break;
                
            case 'randompicker':
                if (typeof window.initRandomPicker === 'function') {
                    await window.initRandomPicker();
                    // Random Picker initialized
                } else {
                    // initRandomPicker function not found
                }
                break;
                
            case 'playerList':
                if (typeof window.initPlayerList === 'function') {
                    await window.initPlayerList();
                    // Player List initialized
                } else {
                    // initPlayerList function not found
                }
                break;
                
            case 'registration':
                if (typeof window.initRegistration === 'function') {
                    await window.initRegistration();
                    // Registration initialized
                } else {
                    // initRegistration function not found
                }
                break;
                
            case 'masterlist':
                if (typeof window.initMasterlist === 'function') {
                    await window.initMasterlist();
                    // Masterlist initialized
                } else {
                    // initMasterlist function not found
                }
                break;
                
            default:
                // No specific initialization for module
        }
    } catch (error) {
        // Error initializing module
    }
}

// Make functions globally available
window.loadTeamBalancer = loadTeamBalancer;
window.loadRandomPicker = loadRandomPicker;
window.loadPlayerList = loadPlayerList;
window.loadRegistration = loadRegistration;
window.loadMasterlist = loadMasterlist;
window.updateActiveTab = updateActiveTab;
window.initNavigation = initNavigation;
window.initializeModule = initializeModule;
window.showChangePasswordModal = showChangePasswordModal;

/**
 * Show the change password modal
 */
function showChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        // Clear form
        const form = document.getElementById('change-password-form');
        if (form) {
            form.reset();
        }
        
        // Hide any existing alerts
        const alert = document.getElementById('password-change-alert');
        if (alert) {
            alert.style.display = 'none';
        }
        
        // Show modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

/**
 * Set up password visibility toggles
 */
function setupPasswordToggles() {
    const toggles = [
        { buttonId: 'toggle-current-password', inputId: 'current-password' },
        { buttonId: 'toggle-new-password', inputId: 'new-password' },
        { buttonId: 'toggle-confirm-password', inputId: 'confirm-password' }
    ];
    
    toggles.forEach(({ buttonId, inputId }) => {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        
        if (button && input) {
            button.addEventListener('click', function() {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                const icon = button.querySelector('i');
                if (icon) {
                    icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
                }
            });
        }
    });
}

/**
 * Handle password change form submission
 */
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const saveButton = document.getElementById('save-password-btn');
    const alertDiv = document.getElementById('password-change-alert');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showPasswordAlert('New passwords do not match', 'danger');
        return;
    }
    
    // Validate password length
    if (newPassword.length < 6) {
        showPasswordAlert('New password must be at least 6 characters long', 'danger');
        return;
    }
    
    // Validate current password is different from new password
    if (currentPassword === newPassword) {
        showPasswordAlert('New password must be different from current password', 'danger');
        return;
    }
    
    // Disable button and show loading state
    const originalText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Changing...';
    
    try {
        // Get session ID from session manager
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showPasswordAlert('Session expired. Please login again.', 'danger');
            return;
        }
        
        const response = await fetch('/admin/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                oldPassword: currentPassword,
                newPassword: newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPasswordAlert('Password changed successfully!', 'success');
            
            // Clear form
            document.getElementById('change-password-form').reset();
            
            // Close modal after a delay
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('change-password-modal'));
                if (modal) {
                    modal.hide();
                }
            }, 1500);
        } else {
            showPasswordAlert(data.message || 'Failed to change password', 'danger');
        }
    } catch (error) {
        showPasswordAlert('An error occurred while changing password', 'danger');
    } finally {
        // Reset button
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    }
}

/**
 * Show alert in password change modal
 */
function showPasswordAlert(message, type) {
    const alertDiv = document.getElementById('password-change-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 3000);
        }
    }
}
