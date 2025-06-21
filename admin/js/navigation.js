// navigation.js - Handles tab navigation and HTML file loading
// Navigation script loaded

// Simple template cache
const templateCache = new Map();

// Navigation loading state management
const navigationState = {
    isInitializing: true,
    disabledTabs: new Set(),
    readyTabs: new Set()
};

/**
 * Initialize navigation loading state - disable all tabs until system is ready
 */
function initNavigationLoadingState() {
    console.log('🔄 Initializing navigation loading state...');
    
    // Get all navigation tabs
    const navTabs = document.querySelectorAll('.navbar-nav .nav-link');
    
    navTabs.forEach(tab => {
        // Store original onclick handlers
        if (tab.onclick) {
            tab.dataset.originalOnclick = tab.onclick.toString();
        }
        if (tab.href && tab.href.startsWith('javascript:')) {
            tab.dataset.originalHref = tab.href;
            tab.href = 'javascript:void(0)'; // Disable the javascript link
        }
        
        // Disable the tab
        tab.classList.add('disabled');
        tab.style.opacity = '0.5';
        tab.style.pointerEvents = 'none';
        tab.title = 'Loading... Please wait';
        
        // Add loading indicator
        const icon = tab.querySelector('i');
        if (icon) {
            icon.className = 'bi bi-hourglass-split me-2'; // Loading icon
            icon.classList.add('spinner');
        }
        
        navigationState.disabledTabs.add(tab.id);
    });
    
    // Add CSS for spinner animation
    const style = document.createElement('style');
    style.textContent = `
        .spinner {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .nav-link.disabled {
            cursor: not-allowed !important;
        }
        .nav-link.ready {
            transition: all 0.3s ease;
        }
    `;
    document.head.appendChild(style);
    
    console.log('🚫 Navigation tabs disabled during initialization');
}

/**
 * Enable a specific navigation tab when its module is ready
 */
function enableNavigationTab(tabId, originalIcon = null) {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    
    console.log(`✅ Enabling navigation tab: ${tabId}`);
    
    // Restore functionality
    tab.classList.remove('disabled');
    tab.classList.add('ready');
    tab.style.opacity = '1';
    tab.style.pointerEvents = 'auto';
    tab.title = '';
    
    // Restore original onclick handler
    if (tab.dataset.originalOnclick) {
        tab.onclick = new Function(tab.dataset.originalOnclick.replace('function()', '').replace(/^\s*{\s*/, '').replace(/\s*}\s*$/, ''));
    }
    
    // Restore original href
    if (tab.dataset.originalHref) {
        tab.href = tab.dataset.originalHref;
    }
    
    // Restore original icon
    const icon = tab.querySelector('i');
    if (icon && originalIcon) {
        icon.className = originalIcon;
        icon.classList.remove('spinner');
    }
    
    navigationState.disabledTabs.delete(tabId);
    navigationState.readyTabs.add(tabId);
    
    // Add ready indicator (brief green glow)
    tab.style.boxShadow = '0 0 8px rgba(25, 135, 84, 0.4)';
    setTimeout(() => {
        tab.style.boxShadow = '';
    }, 2000);
}

/**
 * Get the original icon class for a tab
 */
function getOriginalIconForTab(tabId) {
    const iconMap = {
        'team-balancer-tab': 'bi bi-people-fill me-2',
        'tournament-bracket-tab': 'bi bi-trophy me-2',
        'random-picker-tab': 'bi bi-shuffle me-2',
        'player-list-tab': 'bi bi-list-ul me-1',
        'registration-tab': 'bi bi-clipboard2-check me-1',
        'masterlist-tab': 'bi bi-shield-check me-1'
    };
    return iconMap[tabId] || 'bi bi-circle me-2';
}

/**
 * Complete navigation initialization - all tabs are ready
 */
function completeNavigationInitialization() {
    if (navigationState.disabledTabs.size === 0) {
        console.log('✅ All navigation tabs are ready!');
        navigationState.isInitializing = false;
        
        // Show success message briefly
        if (window.showNotification) {
            window.showNotification('System initialized successfully! All features are now available.', 'success');
        } else {
            // Fallback notification
            console.log('✅ System initialized successfully! All features are now available.');
            
            // Show a simple toast notification
            const toast = document.createElement('div');
            toast.className = 'alert alert-success position-fixed';
            toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; opacity: 0.9;';
            toast.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>System ready! All features are now available.';
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
        
        // Auto-load the first tab (Team Balancer) if no tab is active
        const activeTab = document.querySelector('.nav-link.active');
        if (!activeTab) {
            const teamBalancerTab = document.getElementById('team-balancer-tab');
            if (teamBalancerTab && teamBalancerTab.onclick) {
                setTimeout(() => {
                    console.log('🎯 Auto-loading Team Balancer tab...');
                    teamBalancerTab.click();
                }, 500);
            }
        }
    }
}

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
            const profileDropdown = document.querySelector('#profileDropdown');
            if (profileDropdown && !document.getElementById('user-management-btn')) {
                const profileDropdownMenu = profileDropdown.nextElementSibling;
                
                if (profileDropdownMenu && profileDropdownMenu.classList.contains('dropdown-menu')) {
                    const userManagementItem = document.createElement('li');
                    userManagementItem.innerHTML = `
                        <a class="dropdown-item" href="#" id="user-management-btn">
                            <i class="bi bi-people me-2"></i>User Management
                        </a>
                    `;
                    
                    // Find the divider (hr element with dropdown-divider class)
                    const dividerItems = profileDropdownMenu.querySelectorAll('li');
                    let dividerLi = null;
                    
                    for (const li of dividerItems) {
                        if (li.querySelector('.dropdown-divider')) {
                            dividerLi = li;
                            break;
                        }
                    }
                    
                    // Insert before the divider if found, otherwise append
                    if (dividerLi) {
                        profileDropdownMenu.insertBefore(userManagementItem, dividerLi);
                    } else {
                        // If no divider found, insert before the last item (logout)
                        const lastItem = profileDropdownMenu.lastElementChild;
                        if (lastItem) {
                            profileDropdownMenu.insertBefore(userManagementItem, lastItem);
                        } else {
                            profileDropdownMenu.appendChild(userManagementItem);
                        }
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
    return await loadTabContent('./team-balancer.html', 'main-content', '/admin/js/teamBalancer.js');
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
    const result = await loadTabContent('./player-list.html', 'main-content', '/admin/js/playerList.js');
    
    // After template and script are loaded, initialize the player list
    if (result && typeof window.initPlayerListWhenReady === 'function') {
        window.initPlayerListWhenReady();
    } else if (typeof window.initPlayerList === 'function') {
        // Fallback to direct initialization with delay
        setTimeout(window.initPlayerList, 50);
    }
    
    return result;
}

/**
 * Loads and displays the registration manager section
 */
async function loadRegistration() {
    try {
        console.log('Loading Registration Manager');

        // Update active tab immediately
        updateActiveTab('registration-manager');

        // Check if registration content is already loaded
        const mainContent = document.getElementById('main-content');
        const existingContent = mainContent?.querySelector('#registration-manager, .registration-content');
        
        if (existingContent && window.registrationModuleLoaded) {
            console.log('Registration already loaded, reinitializing...');
            // Just reinitialize if already loaded
            if (typeof window.initRegistration === 'function') {
                await window.initRegistration();
            }
            return true;
        }

        // Load registration template and JavaScript
        return await loadTabContent('./registration.html', 'main-content', '/admin/js/registration.js');
    } catch (error) {
        console.error('Error loading registration:', error);
        return false;
    }
}

/**
 * Loads and displays the tournament bracket section
 */
async function loadTournamentBracket() {
    // Loading Tournament Bracket
    
    // Clean up registration resources if switching from registration tab
    if (typeof cleanupRegistration === 'function') {
        cleanupRegistration();
    }

    // Update active tab immediately
    updateActiveTab('tournament-bracket');

    // Load tournament bracket template and JavaScript
    const result = await loadTabContent('./tournament-bracket.html', 'main-content', '/admin/js/tournamentBrackets.js');
    
    // After Tournament Bracket is loaded, initialize the tournament bracket system
    if (result) {
        // Wait a moment for DOM to be fully ready
        setTimeout(async () => {
            if (typeof window.initTournamentBracketPage === 'function') {
                console.log('🏆 Initializing tournament bracket page...');
                await window.initTournamentBracketPage();
                enableNavigationTab('tournament-bracket-tab', 'bi bi-trophy me-2');
                completeNavigationInitialization();
            } else {
                console.log('⚠️ Tournament bracket page function not available yet');
            }
        }, 100);
    }
    
    return result;
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
    // Initialize loading state first
    initNavigationLoadingState();
    
    // Set up a timeout to force enable tabs if initialization takes too long
    setTimeout(() => {
        if (navigationState.isInitializing && navigationState.disabledTabs.size > 0) {
            console.warn('⚠️ Some tabs are still disabled after 10 seconds, force enabling...');
            
            // Force enable remaining tabs
            navigationState.disabledTabs.forEach(tabId => {
                const tab = document.getElementById(tabId);
                if (tab) {
                    const originalIcon = getOriginalIconForTab(tabId);
                    enableNavigationTab(tabId, originalIcon);
                }
            });
            
            completeNavigationInitialization();
        }
    }, 10000); // 10 second timeout
    
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
                    enableNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
                    // Team Balancer initialized
                } else {
                    // initTeamBalancer function not found
                }
                break;
                
            case 'randompicker':
                if (typeof window.initRandomPicker === 'function') {
                    await window.initRandomPicker();
                    enableNavigationTab('random-picker-tab', 'bi bi-shuffle me-2');
                    // Random Picker initialized
                } else {
                    // initRandomPicker function not found
                }
                break;
                
            case 'playerList':
                if (typeof window.initPlayerList === 'function') {
                    await window.initPlayerList();
                    enableNavigationTab('player-list-tab', 'bi bi-list-ul me-1');
                    // Player List initialized
                } else {
                    // initPlayerList function not found
                }
                break;
                
            case 'registration':
                if (typeof window.initRegistration === 'function') {
                    await window.initRegistration();
                    enableNavigationTab('registration-tab', 'bi bi-clipboard2-check me-1');
                    // Registration initialized
                } else {
                    // initRegistration function not found
                }
                break;
                
            case 'masterlist':
                if (typeof window.initMasterlist === 'function') {
                    await window.initMasterlist();
                    enableNavigationTab('masterlist-tab', 'bi bi-shield-check me-1');
                    // Masterlist initialized
                } else {
                    // initMasterlist function not found
                }
                break;
                
            case 'tournamentBrackets':
                // Tournament bracket is handled separately in loadTournamentBracket
                enableNavigationTab('tournament-bracket-tab', 'bi bi-trophy me-2');
                break;
                
            default:
                // No specific initialization for module
        }
        
        // Check if all tabs are now ready
        completeNavigationInitialization();
    } catch (error) {
        // Error initializing module
    }
}

// Expose functions globally
window.loadTeamBalancer = loadTeamBalancer;
window.loadTournamentBracket = loadTournamentBracket;
window.loadRandomPicker = loadRandomPicker;
window.loadMasterlist = loadMasterlist;
window.loadPlayerList = loadPlayerList;
window.loadRegistration = loadRegistration;
window.initNavigation = initNavigation;

/**
 * Show the change password modal
 */
function showChangePasswordModal() {
    // Use the new password change modal from utils.js
    const modal = document.getElementById('passwordChangeModal');
    if (modal) {
        // Clear form
        const form = document.getElementById('password-change-form');
        if (form) {
            form.reset();
        }
        
        // Reset any validation states
        const strengthIndicator = document.getElementById('password-strength');
        const matchFeedback = document.getElementById('password-match-feedback');
        const confirmPasswordField = document.getElementById('confirm-password');
        
        if (strengthIndicator) strengthIndicator.style.display = 'none';
        if (matchFeedback) matchFeedback.textContent = '';
        if (confirmPasswordField) confirmPasswordField.classList.remove('is-valid', 'is-invalid');
        
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
        
        const response = await fetch('/.netlify/functions/change-password', {
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
                            <div id="user-management-alert" class="alert" style="display: none;"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit User Modal -->
            <div class="modal fade" id="add-edit-user-modal" tabindex="-1" aria-labelledby="addEditUserModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="addEditUserModalLabel">
                                <i class="bi bi-person-plus me-2"></i>Add User
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="add-edit-user-form">
                            <div class="modal-body">
                                <input type="hidden" id="edit-user-id">
                                
                                <div class="mb-3">
                                    <label for="user-username" class="form-label">Username</label>
                                    <input type="text" class="form-control" id="user-username" required minlength="3" maxlength="50">
                                    <div class="form-text">3-50 characters, letters, numbers, and underscores only</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="user-password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="user-password" required minlength="6">
                                    <div class="form-text">Minimum 6 characters</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="user-full-name" class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="user-full-name" maxlength="255">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="user-email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="user-email" maxlength="255">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="user-role" class="form-label">Role</label>
                                    <select class="form-select" id="user-role" required>
                                        <option value="">Select Role</option>
                                        <option value="admin">Admin</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="user-active" checked>
                                        <label class="form-check-label" for="user-active">
                                            Active User
                                        </label>
                                    </div>
                                </div>
                                
                                <div id="add-edit-user-alert" class="alert" style="display: none;"></div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="save-user-btn">Add User</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event handlers
        document.getElementById('add-user-btn').addEventListener('click', showAddUserModal);
        document.getElementById('add-edit-user-form').addEventListener('submit', handleUserSave);
    }
    
    // Show modal and load users
    const modal = new bootstrap.Modal(document.getElementById('user-management-modal'));
    modal.show();
    
    // Load users from backend
    loadAdminUsers();
}

/**
 * Load admin users from backend
 */
async function loadAdminUsers() {
    const tbody = document.getElementById('users-table-body');
    
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showUserManagementAlert('Session expired. Please login again.', 'danger');
            return;
        }
        
        const response = await fetch('/.netlify/functions/admin-users', {
            headers: {
                'x-session-id': sessionId
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.users) {
            tbody.innerHTML = '';
            
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.fullName || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td>
                        <span class="badge ${user.role === 'superadmin' ? 'bg-danger' : 'bg-primary'}">
                            ${user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${user.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser('${user.id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.id}', '${user.username}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            showUserManagementAlert(data.message || 'Failed to load users', 'danger');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showUserManagementAlert('Error loading users', 'danger');
    }
}

/**
 * Show add user modal
 */
function showAddUserModal() {
    // Reset form
    document.getElementById('add-edit-user-form').reset();
    document.getElementById('edit-user-id').value = '';
    document.getElementById('user-active').checked = true;
    
    // Update modal title and button
    document.getElementById('addEditUserModalLabel').innerHTML = '<i class="bi bi-person-plus me-2"></i>Add User';
    document.getElementById('save-user-btn').textContent = 'Add User';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('add-edit-user-modal'));
    modal.show();
}

/**
 * Edit user
 */
async function editUser(userId) {
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        const response = await fetch(`/.netlify/functions/admin-users?userId=${userId}`, {
            headers: {
                'x-session-id': sessionId
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            
            // Fill form
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-password').value = ''; // Don't show current password
            document.getElementById('user-full-name').value = user.fullName || '';
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-role').value = user.role;
            document.getElementById('user-active').checked = user.isActive;
            
            // Update modal title and button
            document.getElementById('addEditUserModalLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit User';
            document.getElementById('save-user-btn').textContent = 'Update User';
            
            // Make password optional for editing
            document.getElementById('user-password').removeAttribute('required');
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('add-edit-user-modal'));
            modal.show();
        } else {
            showUserManagementAlert(data.message || 'Failed to load user', 'danger');
        }
    } catch (error) {
        console.error('Error loading user:', error);
        showUserManagementAlert('Error loading user', 'danger');
    }
}

/**
 * Delete user
 */
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        const response = await fetch(`/.netlify/functions/admin-users`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId
            },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showUserManagementAlert(`User "${username}" deleted successfully`, 'success');
            loadAdminUsers(); // Reload the list
        } else {
            showUserManagementAlert(data.message || 'Failed to delete user', 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showUserManagementAlert('Error deleting user', 'danger');
    }
}

/**
 * Handle user save (add/edit)
 */
async function handleUserSave(e) {
    e.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const isEdit = !!userId;
    
    const userData = {
        username: document.getElementById('user-username').value,
        password: document.getElementById('user-password').value,
        fullName: document.getElementById('user-full-name').value,
        email: document.getElementById('user-email').value,
        role: document.getElementById('user-role').value,
        isActive: document.getElementById('user-active').checked
    };
    
    // For editing, password is optional
    if (isEdit && !userData.password) {
        delete userData.password;
    }
    
    const saveButton = document.getElementById('save-user-btn');
    const originalText = saveButton.textContent;
    
    try {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        const url = isEdit ? `/.netlify/functions/admin-users` : '/.netlify/functions/admin-users';
        const method = isEdit ? 'PUT' : 'POST';
        
        if (isEdit) {
            userData.userId = userId;
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showUserManagementAlert(`User ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('add-edit-user-modal'));
            if (modal) {
                modal.hide();
            }
            
            // Reload users list
            loadAdminUsers();
        } else {
            showAddEditUserAlert(data.message || `Failed to ${isEdit ? 'update' : 'create'} user`, 'danger');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showAddEditUserAlert('Error saving user', 'danger');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
        
        // Restore required attribute for password if adding new user
        if (!isEdit) {
            document.getElementById('user-password').setAttribute('required', '');
        }
    }
}

/**
 * Show alert in user management modal
 */
function showUserManagementAlert(message, type) {
    const alertDiv = document.getElementById('user-management-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 3000);
        }
    }
}

/**
 * Show alert in add/edit user modal
 */
function showAddEditUserAlert(message, type) {
    const alertDiv = document.getElementById('add-edit-user-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// Make functions globally available
window.editUser = editUser;
window.deleteUser = deleteUser;
