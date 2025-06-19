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
 * Set up role-based access control for navigation tabs
 */
async function setupRoleBasedAccess() {
    try {
        // Get user info from session manager
        const userInfo = await window.sessionManager?.getUserInfo();
        
        if (!userInfo || !userInfo.role) {
            console.warn('No user role information available');
            return;
        }
        
        // Update profile dropdown with user info
        const profileDropdown = document.querySelector('#profileDropdown');
        if (profileDropdown) {
            profileDropdown.innerHTML = `
                <i class="bi bi-person-circle me-1"></i> ${userInfo.fullName || userInfo.username}
                <small class="text-muted ms-1">(${userInfo.role})</small>
            `;
        }
        
        // Update footer with user info
        const footer = document.querySelector('footer small');
        if (footer) {
            footer.textContent = `Logged in as ${userInfo.fullName || userInfo.username} (${userInfo.role})`;
        }
        
        // Role-based tab visibility
        if (userInfo.role === 'admin') {
            // Regular admin - hide masterlist tab
            const masterlistTab = document.getElementById('masterlist-tab');
            if (masterlistTab) {
                masterlistTab.closest('li').style.display = 'none';
            }
            
            // If currently on masterlist tab, redirect to team balancer
            const currentTab = document.querySelector('.nav-link.active');
            if (currentTab && currentTab.id === 'masterlist-tab') {
                const teamBalancerTab = document.getElementById('team-balancer-tab');
                if (teamBalancerTab) {
                    teamBalancerTab.click();
                }
            }
        } else if (userInfo.role === 'superadmin') {
            // Super admin - show all tabs (default behavior)
            const masterlistTab = document.getElementById('masterlist-tab');
            if (masterlistTab) {
                masterlistTab.closest('li').style.display = 'block';
            }
            
            // Add user management option to profile dropdown for super admins
            const profileDropdownMenu = document.querySelector('#profileDropdown').nextElementSibling;
            if (profileDropdownMenu && !document.getElementById('user-management-btn')) {
                const userManagementItem = document.createElement('li');
                userManagementItem.innerHTML = `
                    <a class="dropdown-item" href="#" id="user-management-btn">
                        <i class="bi bi-people me-2"></i>User Management
                    </a>
                `;
                
                // Insert before the divider
                const divider = profileDropdownMenu.querySelector('.dropdown-divider');
                if (divider) {
                    profileDropdownMenu.insertBefore(userManagementItem, divider);
                } else {
                    profileDropdownMenu.appendChild(userManagementItem);
                }
                
                // Set up user management functionality
                const userManagementBtn = document.getElementById('user-management-btn');
                if (userManagementBtn) {
                    userManagementBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        showUserManagementModal();
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error setting up role-based access:', error);
    }
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
    
    // Set up role-based access control
    setupRoleBasedAccess();
    
    // Set up navigation tabs
    const teamBalancerTab = document.getElementById('team-balancer-tab');
    const randomPickerTab = document.getElementById('random-picker-tab');
    const playerListTab = document.getElementById('player-list-tab');
    const registrationTab = document.getElementById('registration-tab');
    const masterlistTab = document.getElementById('masterlist-tab');
    
    
    
    if (teamBalancerTab) {
        teamBalancerTab.addEventListener('click', function(e) {

            e.preventDefault();
            loadTeamBalancer();
        });
            }
    
    if (randomPickerTab) {
        randomPickerTab.addEventListener('click', function(e) {

            e.preventDefault();
            loadRandomPicker();
        });
            }
    
    if (playerListTab) {
        playerListTab.addEventListener('click', function(e) {

            e.preventDefault();
            loadPlayerList();
        });
            }
    
    if (registrationTab) {
        registrationTab.addEventListener('click', function(e) {

            e.preventDefault();
            loadRegistration();
        });
            }
    
    if (masterlistTab) {
        masterlistTab.addEventListener('click', async function(e) {
            e.preventDefault();
            try {
                await loadMasterlist();
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
    try {
        const response = await fetch(templatePath);
        
        if (!response.ok) {
            throw new Error(`Failed to load ${templatePath}: ${response.status} ${response.statusText}`);
        }
        
        const content = await response.text();
        const container = document.getElementById(containerId);
        
        if (container) {
            container.innerHTML = content;
            
            // Load corresponding JavaScript module if specified
            if (jsModulePath) {
                await loadJavaScriptModule(jsModulePath);
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
    try {
        // Remove any existing script tags for this module (force reload)
        const existingScripts = document.querySelectorAll(`script[src*="${jsPath.split('/').pop()}"]`);
        existingScripts.forEach(script => {
            script.remove();
        });
        
        // Create and load new script with cache busting
        const script = document.createElement('script');
        script.src = `${jsPath}?v=${Date.now()}`;
        script.type = 'text/javascript';
        script.setAttribute('data-module', jsPath);
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
            script.onload = () => {
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

/**
 * Show user management modal (Super Admin only)
 */
function showUserManagementModal() {
    // Create user management modal if it doesn't exist
    if (!document.getElementById('user-management-modal')) {
        const modalHTML = `
            <!-- User Management Modal -->
            <div class="modal fade" id="user-management-modal" tabindex="-1" aria-labelledby="userManagementModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="userManagementModalLabel">
                                <i class="bi bi-people me-2"></i>User Management
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="mb-0">Admin Users</h6>
                                <button class="btn btn-primary btn-sm" id="add-user-btn">
                                    <i class="bi bi-person-plus me-1"></i>Add User
                                </button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Username</th>
                                            <th>Full Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-table-body">
                                        <tr>
                                            <td colspan="6" class="text-center py-3">
                                                <div class="spinner-border spinner-border-sm me-2"></div>
                                                Loading users...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event handlers
        document.getElementById('add-user-btn').addEventListener('click', () => {
            alert('User management functionality will be implemented in the next update!');
        });
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('user-management-modal'));
    modal.show();
    
    // Load users (placeholder for now)
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = `
        <tr>
            <td>superadmin</td>
            <td>Super Administrator</td>
            <td>superadmin@tournament.local</td>
            <td><span class="badge bg-danger">Super Admin</span></td>
            <td><span class="badge bg-success">Active</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" disabled>
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" disabled>
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        <tr>
            <td>admin</td>
            <td>Administrator</td>
            <td>admin@tournament.local</td>
            <td><span class="badge bg-primary">Admin</span></td>
            <td><span class="badge bg-success">Active</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" disabled>
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" disabled>
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
}
