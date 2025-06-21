(function() {
    'use strict';

    // Team Balancer Module State
    const state = {
        currentSessionId: null,
        registrationSessions: [],
        availablePlayers: [],
        balancedTeams: [],
        reservedPlayers: []
    };

// Helper functions for MMR calculations
function ensureNumericMmr(mmr) {
    const numericMmr = parseInt(mmr);
    return isNaN(numericMmr) ? 0 : numericMmr;
}

function calculateTotalMmr(players) {
    return players.reduce((sum, player) => sum + ensureNumericMmr(player.peakmmr), 0);
}

function calculateAverageMmr(players) {
    if (!players || players.length === 0) return 0;
    return Math.round(calculateTotalMmr(players) / players.length);
}

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
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.zIndex = '1050';
        notification.style.maxWidth = '300px';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        document.body.appendChild(notification);
    }
    
    // Set notification type
    notification.className = type;
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    // Set message and show
    notification.textContent = message;
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
    }, 5000);
}

/**
 * Initialize the team balancer
 */
async function initTeamBalancer() {
    try {
        // Create session selector for team balancer
        await createTeamBalancerSessionSelector();
        
        // Load registration sessions
        await loadRegistrationSessions();
        
        // Setup event listeners for static elements
        setupTeamBalancerEventListeners();
        
        // Setup initial state for dynamic buttons (will be re-run)
        setupBalancerButtons();
        
        // Reserved players will be initialized when needed during team generation
        
        // Listen for registration updates to refresh player data
        setupTeamBalancerRegistrationListener();
        
        // Enable the tab after all initialization is complete
        if (typeof window.enableOnlyNavigationTab === 'function') {
            window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
        }

    } catch (error) {
        console.error('Error initializing team balancer:', error);
        showNotification('Failed to initialize team balancer', 'error');
        
        // Still enable the tab even if there was an error
        if (typeof window.enableOnlyNavigationTab === 'function') {
            window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
        }
    }
}

/**
 * Create session selector for team balancer
 */
async function createTeamBalancerSessionSelector() {
    const sessionSelectorContainer = document.querySelector('.session-selector-container');
    
    if (!sessionSelectorContainer) {
        // Create session selector if it doesn't exist
        const teamBalancerContent = document.querySelector('#team-balancer') || 
                                    document.querySelector('.team-balancer-section');
        
        if (teamBalancerContent) {
            const selectorHtml = `
                <div class="session-selector-container mb-4">
                    <div class="card shadow-sm">
                        <div class="card-body p-3">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <div class="d-flex align-items-center">
                                        <i class="bi bi-funnel me-2 text-primary"></i>
                                        <label for="team-balancer-session-selector" class="form-label mb-0 me-3">
                                            Select Tournament:
                                        </label>
                                        <select id="team-balancer-session-selector" class="form-select" style="max-width: 400px;">
                                            <option value="">Choose a tournament...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <button id="refresh-balancer-sessions" class="btn btn-outline-primary btn-sm me-2">
                                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                                    </button>
                                    <span id="balancer-player-count" class="badge bg-secondary">0 players</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert at the beginning of the team balancer content
            teamBalancerContent.insertAdjacentHTML('afterbegin', selectorHtml);
        }
    }
}

/**
 * Load registration sessions for team balancer
 */
async function loadRegistrationSessions() {
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        const response = await fetch('/.netlify/functions/registration-sessions', {
            headers: {
                'x-session-id': sessionId
            }
        });

        const data = await response.json();

        if (data.success && data.sessions) {
            state.registrationSessions = data.sessions;
            updateSessionSelector();
        } else {
            showNotification(data.message || 'Failed to load registration sessions', 'error');
                    }
                } catch (error) {
        console.error('Error loading registration sessions:', error);
        showNotification('Error loading registration sessions', 'error');
    }
}

/**
 * Update the session selector dropdown
 */
function updateSessionSelector() {
    const selector = document.getElementById('team-balancer-session-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">Choose a tournament...</option>';

    // Sort sessions by creation date (newest first)
    const sortedSessions = [...state.registrationSessions].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.sessionId;
        option.textContent = `${session.title} (${session.playerCount} players)`;
        if (!session.isActive) {
            option.textContent += ' [Inactive]';
        }
        selector.appendChild(option);
    });

    // Auto-select the latest (most recent) tournament if available
    if (sortedSessions.length > 0) {
        const latestSession = sortedSessions[0];
        selector.value = latestSession.sessionId;
        state.currentSessionId = latestSession.sessionId;
        
        // Load players for the selected session
        loadPlayersForBalancer();
    } else {
        // No sessions available, still enable the tab
        if (typeof window.enableOnlyNavigationTab === 'function') {
            window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
        }
    }
}

/**
 * Setup team balancer event listeners
 */
function setupTeamBalancerEventListeners() {
    // Session selector change
    const sessionSelector = document.getElementById('team-balancer-session-selector');
    if (sessionSelector) {
        sessionSelector.addEventListener('change', async (e) => {
            state.currentSessionId = e.target.value || null;
            await loadPlayersForBalancer();
            clearTeams(); // Clear existing teams when session changes
        });
    }

    // Refresh sessions button
    const refreshSessionsBtn = document.getElementById('refresh-balancer-sessions');
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', loadRegistrationSessions);
    }

    // Setup existing team balancer buttons with session validation
    setupBalancerButtons();
}

/**
 * Setup balancer buttons with session validation
 */
function setupBalancerButtons() {
    // Load Players button
    const loadPlayersBtn = document.getElementById('load-players-btn') || 
                          document.querySelector('[onclick="loadPlayers()"]');
    if (loadPlayersBtn) {
        // Remove existing onclick handler
        loadPlayersBtn.removeAttribute('onclick');
        loadPlayersBtn.addEventListener('click', loadPlayersForBalancer);
    }

    // Add Player button
    const addPlayerBtn = document.getElementById('add-player');
    const playerNameInput = document.getElementById('player-name');
    const playerMmrInput = document.getElementById('player-mmr');
    
    if (addPlayerBtn && playerNameInput && playerMmrInput) {
        addPlayerBtn.addEventListener('click', function() {
            const playerName = playerNameInput.value.trim();
            const playerMmr = parseInt(playerMmrInput.value) || 0;
            
            if (playerName) {
                addPlayerManuallyToBalancer(playerName, playerMmr);
                playerNameInput.value = '';
                playerMmrInput.value = '';
                playerNameInput.focus();
            } else {
                showNotification('Please enter a player name', 'warning');
            }
        });

        // Add on Enter key for both inputs
        playerNameInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                const playerName = this.value.trim();
                const playerMmr = parseInt(playerMmrInput.value) || 0;
                if (playerName) {
                    addPlayerManuallyToBalancer(playerName, playerMmr);
                    this.value = '';
                    playerMmrInput.value = '';
                    this.focus();
                } else {
                    showNotification('Please enter a player name', 'warning');
                }
            }
        });

        playerMmrInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                const playerName = playerNameInput.value.trim();
                const playerMmr = parseInt(this.value) || 0;
                if (playerName) {
                    addPlayerManuallyToBalancer(playerName, playerMmr);
                    playerNameInput.value = '';
                    this.value = '';
                    playerNameInput.focus();
                } else {
                    showNotification('Please enter a player name', 'warning');
                }
            }
        });
    }

    // Clear Players button
    const clearPlayersBtn = document.getElementById('clear-players');
    if (clearPlayersBtn) {
        clearPlayersBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all players?')) {
                state.availablePlayers = [];
                state.reservedPlayers = [];
                displayPlayersForBalancer([]);
                displayReservedPlayers();
                clearTeams();
                showNotification('All players cleared', 'success');
            }
        });
    }

    // Auto Balance button (multiple possible IDs)
    const autoBalanceBtn = document.getElementById('generate-teams') || 
                          document.getElementById('auto-balance-btn') || 
                          document.querySelector('[onclick="autoBalance()"]');
    if (autoBalanceBtn) {

        autoBalanceBtn.removeAttribute('onclick');
        autoBalanceBtn.addEventListener('click', function(e) {

            autoBalance();
        });
    } else {
        console.warn('Team balancer: Generate teams button not found');
    }

    // Clear Teams button
    const clearTeamsBtn = document.getElementById('clear-teams') || 
                         document.getElementById('clear-teams-btn') || 
                         document.querySelector('[onclick="clearTeams()"]');
    if (clearTeamsBtn) {
        clearTeamsBtn.removeAttribute('onclick');
        clearTeamsBtn.addEventListener('click', clearTeams);
    }

    // Export Teams button
    const exportTeamsBtn = document.getElementById('export-teams') || 
                          document.getElementById('export-teams-btn') || 
                          document.querySelector('[onclick="exportTeams()"]');
    if (exportTeamsBtn) {
        exportTeamsBtn.removeAttribute('onclick');
        exportTeamsBtn.addEventListener('click', exportTeams);
    }

    // Save Teams button
    const saveTeamsBtn = document.getElementById('save-teams') || 
                        document.getElementById('save-teams-btn') || 
                        document.querySelector('[onclick="saveTeams()"]');
    if (saveTeamsBtn) {
        saveTeamsBtn.removeAttribute('onclick');
        saveTeamsBtn.addEventListener('click', saveTeams);
    }
}

/**
 * Add a player manually to the team balancer
 */
function addPlayerManuallyToBalancer(playerName, playerMmr) {
    if (!playerName || !playerName.trim()) {
        showNotification('Please enter a valid player name', 'warning');
        return;
    }

    // Check if player already exists
    const existingPlayer = state.availablePlayers.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
    );
    
    if (existingPlayer) {
        showNotification('Player already exists in the list', 'warning');
        return;
    }

    // Create a new player object
    const newPlayer = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: playerName.trim(),
        dota2id: 'Manual',
        peakmmr: Math.max(0, playerMmr || 0),
        isManual: true
    };

    // Add to available players
    state.availablePlayers.push(newPlayer);
    
    // Update display
    displayPlayersForBalancer(state.availablePlayers);
    
    // Update player count badge
    const countBadge = document.getElementById('balancer-player-count');
    if (countBadge) {
        countBadge.textContent = `${state.availablePlayers.length} players`;
    }
    
    showNotification(`Added "${playerName}" (${playerMmr} MMR) to team balancer`, 'success');
}

/**
 * Load players for the selected tournament session
 */
async function loadPlayersForBalancer() {
    try {
        if (!state.currentSessionId) {
            showNotification('Please select a tournament first', 'warning');
            return;
        }

        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Clear existing players
        state.availablePlayers = [];
        
        // Clear existing teams when loading new players
        clearTeams();

        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }

        try {
            // Build API URL exactly like Player List does
            let apiUrl = '/.netlify/functions/api-players?includeSessionInfo=true';
            if (state.currentSessionId) {
                apiUrl += `&sessionId=${state.currentSessionId}`;
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'x-session-id': sessionId
                }
            });
        
        const data = await response.json();
        
            if (data.success && Array.isArray(data.players)) {
                state.availablePlayers = data.players.filter(player => 
                    player.name && 
                    player.name.trim() !== ''
                );
                
                displayPlayersForBalancer(state.availablePlayers);
                
                // Initialize reserved players display
                displayReservedPlayers();
                
                // Update player count in badge
                const countBadge = document.getElementById('balancer-player-count');
                if (countBadge) {
                    countBadge.textContent = `${state.availablePlayers.length} players`;
                }
                
                if (state.availablePlayers.length === 0) {
                    showNotification('No players found in selected tournament', 'info');
                } else {
                    showNotification(`Loaded ${state.availablePlayers.length} players from tournament`, 'success');
                }
                
                // Enable the tab after data loading is complete
                if (typeof window.enableOnlyNavigationTab === 'function') {
                    window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
                }
            } else {
                console.error('Failed to load players:', data.message || 'Unknown error');
                showNotification(data.message || 'Failed to load players', 'error');
                state.availablePlayers = [];
                displayPlayersForBalancer([]);
                
                // Enable the tab even if data loading failed
                if (typeof window.enableOnlyNavigationTab === 'function') {
                    window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
                }
            }
        } catch (fetchError) {
            console.error('Network error loading players:', fetchError);
            showNotification('Network error loading players', 'error');
            
            // Enable the tab even if network error occurred
            if (typeof window.enableOnlyNavigationTab === 'function') {
                window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
            }
        } finally {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error in loadPlayersForBalancer:', error);
        showNotification('Error loading players', 'error');
        
        // Enable the tab even if there was a general error
        if (typeof window.enableOnlyNavigationTab === 'function') {
            window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
        }
    }
}

/**
 * Display players for the team balancer
 */
function displayPlayersForBalancer(players) {
    const playersList = document.getElementById('player-list');
    const playerCountElement = document.getElementById('player-count');
    
    if (!playersList) {
        console.warn('Players list container not found - DOM may not be fully loaded yet');
        // Try again after a short delay if DOM isn't ready
        setTimeout(() => {
            const retryPlayersList = document.getElementById('player-list');
            if (retryPlayersList) {
                displayPlayersForBalancer(players);
            } else {
                console.error('Players list container still not found after retry');
            }
        }, 100);
        return;
    }

    // Update player count badge with total count
    if (playerCountElement) {
        const count = players ? players.length : 0;
        playerCountElement.textContent = count;
        
        // Also update the header to show total players
        const playerListHeader = document.querySelector('#team-balancer .h5');
        if (playerListHeader) {
            playerListHeader.innerHTML = `
                <i class="bi bi-people me-2"></i>Player List
                <span id="player-count" class="badge bg-primary ms-1">${count}</span>
                <span class="badge bg-secondary ms-1">Total: ${count}</span>
            `;
        }
    }

    if (!players || players.length === 0) {
        playersList.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-info-circle fs-4 d-block mb-2"></i>
                    <span>${state.currentSessionId ? 'No players found in this tournament.' : 'Please select a tournament to load players.'}</span>
                </td>
            </tr>
        `;
        return;
    }

    // Sort players by MMR (highest first) for better display
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));

    const playersHtml = sortedPlayers.map((player, index) => `
        <tr>
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <div class="badge bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style="width: 32px; height: 32px; font-size: 0.85rem; font-weight: bold;">
                        ${index + 1}
                    </div>
                    <div>
                        <div class="fw-bold">${escapeHtml(player.name)}</div>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-primary">${player.peakmmr || 0}</span>
            </td>
            <td class="text-end pe-3">
                <button type="button" class="btn btn-outline-danger btn-sm remove-player" 
                        data-id="${player.id}" data-index="${index}" title="Remove Player">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    playersList.innerHTML = playersHtml;
    
    // Setup action buttons after adding players
    setupPlayerActionButtons();
}

/**
 * Auto balance teams based on MMR
 */
function autoBalance() {
    try {
        // Get and disable the generate button to prevent multiple clicks
        const generateBtn = document.getElementById('generate-teams');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generating...';
        }
        
        if (!state.currentSessionId) {
            showNotification('Please select a tournament first', 'warning');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
            }
            return;
        }

        if (!state.availablePlayers || state.availablePlayers.length === 0) {
            showNotification('No players available for balancing', 'warning');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
            }
            return;
        }

        // Get balance settings
        const teamSizeSelect = document.getElementById('team-size');
        const balanceMethodSelect = document.getElementById('balance-type');
        
        const teamSize = parseInt(teamSizeSelect?.value) || 5;
        const balanceMethod = balanceMethodSelect?.value || 'highRanked';

        // High Ranked Balance, Perfect MMR Balance, and High/Low Shuffle calculate teams based on ALL available players
        // Other methods exclude already reserved players
        let playersForTeams, numTeams;
        
        // For methods that handle their own reserve logic, restore all reserved players first
        // This ensures fresh randomization every time
        if (balanceMethod === 'highRanked' || balanceMethod === 'perfectMmr' || balanceMethod === 'highLowShuffle') {
            // Restore all reserved players back to available players for fresh randomization
            if (state.reservedPlayers && state.reservedPlayers.length > 0) {
                state.availablePlayers.push(...state.reservedPlayers);
                state.reservedPlayers = []; // Clear reserved list
                
                // Update displays immediately to show all players available
                displayPlayersForBalancer(state.availablePlayers);
                displayReservedPlayers();
            }
        }
        
        if (balanceMethod === 'highRanked') {
            // High Ranked Balance handles its own reserve logic
            playersForTeams = [...state.availablePlayers]; // Use ALL available players (now restored)
            numTeams = Math.floor(state.availablePlayers.length / teamSize);

        } else if (balanceMethod === 'perfectMmr') {
            // Perfect MMR Balance handles its own reserve logic
            playersForTeams = [...state.availablePlayers]; // Use ALL available players (now restored)
            numTeams = Math.floor(state.availablePlayers.length / teamSize);

        } else if (balanceMethod === 'highLowShuffle') {
            // High/Low Shuffle handles its own reserve logic
            playersForTeams = [...state.availablePlayers]; // Use ALL available players (now restored)
            numTeams = Math.floor(state.availablePlayers.length / teamSize);

        } else {
            // Other methods exclude already reserved players
            const reservedPlayerIds = state.reservedPlayers ? state.reservedPlayers.map(p => p.id) : [];
            playersForTeams = state.availablePlayers.filter(p => !reservedPlayerIds.includes(p.id));
            numTeams = Math.floor(playersForTeams.length / teamSize);

        }
        
        if (playersForTeams.length === 0) {
            showNotification('No players available for team generation. All players are reserved.', 'warning');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
            }
            return;
        }
        
        if (numTeams < 2) {
            showNotification(`Not enough non-reserved players for ${teamSize}v${teamSize} teams. Need at least ${teamSize * 2} players. (${playersForTeams.length} available, ${reservedPlayerIds.length} reserved)`, 'warning');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
            }
            return;
        }

        // Clear existing teams completely
        state.balancedTeams = [];

    
        // Initialize teams
        for (let i = 0; i < numTeams; i++) {
            state.balancedTeams.push({
                players: [],
                totalMmr: 0
            });
        }


        // Distribute players based on selected balance method
        distributePlayersByMethod(playersForTeams, balanceMethod, numTeams, teamSize);
        
        // For methods that don't handle their own reserves, handle leftover players
        if (balanceMethod !== 'highRanked' && balanceMethod !== 'perfectMmr' && balanceMethod !== 'highLowShuffle') {
            const playersUsedInTeams = state.balancedTeams.reduce((total, team) => total + team.players.length, 0);
            const leftoverPlayers = playersForTeams.slice(playersUsedInTeams);
            
            if (leftoverPlayers.length > 0) {

                
                // Initialize reserved players if needed
                if (!state.reservedPlayers) {
                    state.reservedPlayers = [];
                }
                
                // Move leftover players to reserved list
                leftoverPlayers.forEach(player => {
                    // Remove from available players
                    const playerIndex = state.availablePlayers.findIndex(p => p.id === player.id);
                    if (playerIndex > -1) {
                        state.availablePlayers.splice(playerIndex, 1);
                    }
                    
                    // Add to reserved players if not already there
                    const alreadyReserved = state.reservedPlayers.find(p => p.id === player.id);
                    if (!alreadyReserved) {
                        state.reservedPlayers.push(player);
                    }
                });
                
                // Update displays
                displayPlayersForBalancer(state.availablePlayers);
                displayReservedPlayers();
                
                showNotification(`${leftoverPlayers.length} leftover player(s) moved to reserved list`, 'info');
            }
        }
        // Note: highRanked, perfectMmr, and highLowShuffle methods handle their own reserve logic within their distribution functions

        // Display balanced teams with new layout

        displayBalancedTeams();

        const methodNames = {
            'highRanked': 'High Ranked Balance',
            'perfectMmr': 'Perfect MMR Balance', 
            'highLowShuffle': 'High/Low Shuffle',
            'random': 'Random Teams'
        };

        const methodName = methodNames[balanceMethod] || balanceMethod;
        showNotification(`Created ${numTeams} balanced teams using ${methodName}!`, 'success');
        
        // Update the teams display header to show the method used
        const teamsContainer = document.getElementById('teams-display');
        if (teamsContainer && teamsContainer.firstElementChild) {
            const headerElement = teamsContainer.querySelector('.col-12 h5, .col-12 .h5');
            if (headerElement) {
                headerElement.innerHTML = `
                    <i class="bi bi-people-fill me-2"></i>
                    Balanced Teams (${numTeams}) - ${methodName}
                `;
            }
        }
        
        // Re-enable the generate button
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
        }

    } catch (error) {
        console.error('Error in auto balance:', error);
        showNotification('Error creating balanced teams', 'error');
        
        // Re-enable the generate button on error
        const generateBtn = document.getElementById('generate-teams');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
        }
    }
}

/**
 * Distribute players based on the selected balance method
 */
function distributePlayersByMethod(players, method, numTeams, teamSize) {
    switch (method) {
        case 'highRanked':
            distributeHighRankedBalance(players, numTeams, teamSize);
            break;
        case 'perfectMmr':
            distributePerfectMmrBalance(players, numTeams, teamSize);
            break;
        case 'highLowShuffle':
            distributeHighLowShuffle(players, numTeams, teamSize);
            break;
        case 'random':
            distributeRandomTeams(players, numTeams, teamSize);
            break;
        default:
            distributeHighRankedBalance(players, numTeams, teamSize);
    }
}

/**
 * High Ranked Balance - Prioritize high MMR players for teams, low MMR to reserves (with randomness)
 */
function distributeHighRankedBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first) - high MMR players get priority
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const maxPlayersForTeams = numTeams * teamSize;
    
    // Step 1: Separate players for teams vs reserves (with randomness)
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    
    const reserveCandidates = sortedPlayers.slice(maxPlayersForTeams);
    const playersForReserves = [...reserveCandidates].sort(() => Math.random() - 0.5); // Shuffle reserves for variety
    
    if (playersForReserves.length > 0) {
        // Move lowest MMR players to reserves
        playersForReserves.forEach(player => {
            // Remove from available players
            const playerIndex = state.availablePlayers.findIndex(p => p.id === player.id);
            if (playerIndex > -1) {
                state.availablePlayers.splice(playerIndex, 1);
            }
            
            // Add to reserved players if not already there
            if (!state.reservedPlayers) {
                state.reservedPlayers = [];
            }
            const alreadyReserved = state.reservedPlayers.find(p => p.id === player.id);
            if (!alreadyReserved) {
                state.reservedPlayers.push(player);
            }
        });
        
        // Update displays immediately
        displayPlayersForBalancer(state.availablePlayers);
        displayReservedPlayers();
    }
    
    // Step 2: Create MMR tiers for randomness within similar skill levels
    const tierSize = Math.ceil(playersForTeams.length / (numTeams * 2)); // Create roughly 2 tiers per team
    const shuffledPlayersForTeams = [];
    
    for (let i = 0; i < playersForTeams.length; i += tierSize) {
        const tier = playersForTeams.slice(i, i + tierSize);
        // Shuffle within each tier to add randomness while maintaining MMR proximity
        const shuffledTier = tier.sort(() => Math.random() - 0.5);
        shuffledPlayersForTeams.push(...shuffledTier);
    }
    
    // Step 3: Snake draft with the tier-shuffled players
    let currentTeam = 0;
    let direction = 1; // 1 for forward, -1 for backward (snake pattern)
    let playersUsed = 0;
    
    for (const player of shuffledPlayersForTeams) {
        if (playersUsed >= maxPlayersForTeams) {
            break;
        }
        
        state.balancedTeams[currentTeam].players.push(player);
        state.balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;
        playersUsed++;

        // Move to next team using snake pattern
        if (direction === 1) {
            currentTeam++;
            if (currentTeam >= numTeams) {
                currentTeam = numTeams - 1;
                direction = -1;
            }
        } else {
            currentTeam--;
            if (currentTeam < 0) {
                currentTeam = 0;
                direction = 1;
            }
        }
    }
}

/**
 * Perfect MMR Balance - Try to make team MMR totals as close as possible, low MMR to reserves
 */
function distributePerfectMmrBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first) - high MMR players get priority
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const maxPlayersForTeams = numTeams * teamSize;
    
    // Step 1: Separate players for teams vs reserves (with randomness)
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    
    const reserveCandidates = sortedPlayers.slice(maxPlayersForTeams);
    const playersForReserves = [...reserveCandidates].sort(() => Math.random() - 0.5); // Shuffle reserves for variety
    
    if (playersForReserves.length > 0) {
        // Move lowest MMR players to reserves
        playersForReserves.forEach(player => {
            // Remove from available players
            const playerIndex = state.availablePlayers.findIndex(p => p.id === player.id);
            if (playerIndex > -1) {
                state.availablePlayers.splice(playerIndex, 1);
            }
            
            // Add to reserved players if not already there
            if (!state.reservedPlayers) {
                state.reservedPlayers = [];
            }
            const alreadyReserved = state.reservedPlayers.find(p => p.id === player.id);
            if (!alreadyReserved) {
                state.reservedPlayers.push(player);
            }
        });
        
        // Update displays immediately
        displayPlayersForBalancer(state.availablePlayers);
        displayReservedPlayers();
    }
    
    // Step 2: Distribute players for optimal MMR balance (deterministic, no randomness)
    // Distribute each player to the team with the lowest current total MMR
    for (const player of playersForTeams) {
        // Find the team with the lowest total MMR that still has space
        const availableTeams = state.balancedTeams.filter(team => team.players.length < teamSize);
        if (availableTeams.length === 0) {
            break;
        }
        
        const targetTeam = availableTeams.reduce((lowest, current) => 
            current.totalMmr < lowest.totalMmr ? current : lowest
        );

        // Add player to the target team
        targetTeam.players.push(player);
        targetTeam.totalMmr += player.peakmmr || 0;
    }
}

/**
 * High/Low Shuffle - Positional priority with randomness (Slot 1: High, Slots 2-4: Mid, Slot 5: Low)
 */
function distributeHighLowShuffle(players, numTeams, teamSize) {
    // Sort players by MMR (highest first) - high MMR players get priority
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const maxPlayersForTeams = numTeams * teamSize;
    
    // Step 1: Select players for teams and reserves (prioritize LOW MMR for teams)
    // Strategy: Take top players for teams, but prioritize keeping LOW MMR in teams
    
    // First, let's identify which players should go to reserves (middle MMR range)
    // We want to keep the HIGHEST and LOWEST MMR players, and reserve the MIDDLE ones
    
    const playersNeededForTeams = maxPlayersForTeams; // exactly 40 for 8 teams
    const playersToReserve = sortedPlayers.length - playersNeededForTeams; // exactly 1 for 41 total
    
    // Strategy: Randomized selection from middle tier for reserves (NON-DETERMINISTIC)
    const guaranteedTopCount = Math.floor(playersNeededForTeams * 0.4); // Keep top 40% guaranteed
    const guaranteedBottomCount = Math.floor(playersNeededForTeams * 0.4); // Keep bottom 40% guaranteed  
    const flexibleCount = playersNeededForTeams - guaranteedTopCount - guaranteedBottomCount; // Remaining 20% - flexible
    
    // Guaranteed players for teams
    const guaranteedTopPlayers = sortedPlayers.slice(0, guaranteedTopCount); // TOP 40% (guaranteed)
    const guaranteedBottomPlayers = sortedPlayers.slice(-guaranteedBottomCount); // BOTTOM 40% (guaranteed - LOW MMR priority)
    
    // Flexible candidates (middle 20% MMR range - these are the reserve candidates)
    const flexibleCandidates = sortedPlayers.slice(guaranteedTopCount, sortedPlayers.length - guaranteedBottomCount);
    
    // Apply MULTIPLE rounds of shuffling for maximum randomness
    let shuffledFlexibleCandidates = [...flexibleCandidates];
    for (let i = 0; i < 3; i++) {
        shuffledFlexibleCandidates = shuffledFlexibleCandidates.sort(() => Math.random() - 0.5);
    }
    
    // Additional randomization using timestamp-based seed for different results each time
    const randomSeed = Date.now() % 1000;
    shuffledFlexibleCandidates = shuffledFlexibleCandidates.sort(() => (Math.random() + randomSeed / 1000) - 0.5);
    
    const flexiblePlayersForTeams = shuffledFlexibleCandidates.slice(0, flexibleCount);
    const playersForReserves = shuffledFlexibleCandidates.slice(flexibleCount);
    
    // Combine all players for teams
    const playersForTeams = [
        ...guaranteedTopPlayers,
        ...flexiblePlayersForTeams,
        ...guaranteedBottomPlayers
    ];
    
    if (playersForReserves.length > 0) {
        // Move players to reserves
        playersForReserves.forEach(player => {
            // Remove from available players
            const playerIndex = state.availablePlayers.findIndex(p => p.id === player.id);
            if (playerIndex > -1) {
                state.availablePlayers.splice(playerIndex, 1);
            }
            
            // Add to reserved players if not already there
            if (!state.reservedPlayers) {
                state.reservedPlayers = [];
            }
            const alreadyReserved = state.reservedPlayers.find(p => p.id === player.id);
            if (!alreadyReserved) {
                state.reservedPlayers.push(player);
            }
        });
        
        // Update displays immediately
        displayPlayersForBalancer(state.availablePlayers);
        displayReservedPlayers();
    }
    
    // Step 2: Create tiers from selected team players for positional assignment
    // Sort the selected players again (they are mixed after combining top + bottom)
    const teamPlayersResorted = playersForTeams.sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const highTierSize = numTeams; // 1 high MMR player per team
    const lowTierSize = numTeams;  // 1 low MMR player per team  
    const midTierSize = teamPlayersResorted.length - highTierSize - lowTierSize; // Remaining players
    
    const highTierPlayers = teamPlayersResorted.slice(0, highTierSize);
    const midTierPlayers = teamPlayersResorted.slice(highTierSize, highTierSize + midTierSize);
    const lowTierPlayers = teamPlayersResorted.slice(-lowTierSize);
    
    // Step 3: Shuffle each tier for randomness
    const shuffledHighTier = [...highTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledMidTier = [...midTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledLowTier = [...lowTierPlayers].sort(() => Math.random() - 0.5);
    
    // Step 4: Distribute players by positional priority
    for (let teamIndex = 0; teamIndex < numTeams; teamIndex++) {
        const team = state.balancedTeams[teamIndex];
        
        // Slot 1: High MMR player (priority)
        if (shuffledHighTier.length > 0) {
            const highPlayer = shuffledHighTier.shift();
            team.players.push(highPlayer);
            team.totalMmr += highPlayer.peakmmr || 0;
        }
        
        // Slot 5: Low MMR player (priority) - assign early to ensure each team gets one
        if (shuffledLowTier.length > 0) {
            const lowPlayer = shuffledLowTier.shift();
            team.players.push(lowPlayer);
            team.totalMmr += lowPlayer.peakmmr || 0;
        }
    }
    
    // Step 5: Fill remaining slots (2-4) with shuffled mid-tier players
    let midTierIndex = 0;
    // Fill remaining slots until teams are full
    while (midTierIndex < shuffledMidTier.length) {
        let slotFilled = false;
        for (let teamIndex = 0; teamIndex < numTeams && midTierIndex < shuffledMidTier.length; teamIndex++) {
            const team = state.balancedTeams[teamIndex];
            if (team.players.length < teamSize) {
                const midPlayer = shuffledMidTier[midTierIndex++];
                team.players.push(midPlayer);
                team.totalMmr += midPlayer.peakmmr || 0;
                slotFilled = true;
            }
        }
        // If no slots were filled, break to avoid infinite loop
        if (!slotFilled) break;
    }
}

/**
 * Random Teams - Completely random distribution
 */
function distributeRandomTeams(players, numTeams, teamSize) {
    // Shuffle players randomly
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    let currentTeam = 0;

    for (let i = 0; i < shuffledPlayers.length && i < numTeams * teamSize; i++) {
        const player = shuffledPlayers[i];
        state.balancedTeams[currentTeam].players.push(player);
        state.balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;

        // Move to next team (round-robin)
        currentTeam = (currentTeam + 1) % numTeams;
    }
}

/**
 * Display balanced teams in compact horizontal layout
 */
function displayBalancedTeams() {
    const teamsContainer = document.getElementById('teams-display') || // Fixed ID to match HTML
                          document.getElementById('teams-container') || 
                          document.querySelector('.teams-container');
    
    if (!teamsContainer) {
        return;
    }
    
    if (!state.balancedTeams || state.balancedTeams.length === 0) {
        teamsContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No teams created yet. Use the Auto Balance button to create balanced teams.
            </div>
        `;
        return;
    }
    
    const teamsHtml = `
        <div class="col-12">
            <div class="mb-3 d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-people-fill me-2"></i>
                    Balanced Teams (${state.balancedTeams.length})
                </h5>
                <div class="btn-group" role="group">
                    <button id="save-teams-btn" class="btn btn-sm btn-outline-success">
                        <i class="bi bi-floppy me-1"></i>Save
                    </button>
                    <button id="export-teams-btn" class="btn btn-sm btn-outline-secondary">
                        <i class="bi bi-download me-1"></i>Export
                    </button>
                    <button id="clear-teams-btn" class="btn btn-sm btn-outline-danger">
                        <i class="bi bi-trash me-1"></i>Clear
                    </button>
                </div>
            </div>
            
            <!-- Compact Teams Table -->
            <div class="row g-3">
                ${state.balancedTeams.map((team, teamIndex) => `
                    <div class="col-lg-4 col-md-6 col-12">
                        <div class="card border-primary shadow-sm">
                            <div class="card-header bg-primary text-white py-2">
                                <div class="row align-items-center">
                                    <div class="col-auto">
                                        <h6 class="mb-0 fw-bold">Team ${teamIndex + 1}</h6>
                                    </div>
                                    <div class="col text-end">
                                        <span class="badge bg-light text-dark me-1">
                                            Avg MMR: ${Math.round(team.totalMmr / team.players.length)}
                                        </span>
                                        <span class="badge bg-light text-dark">
                                            Total: ${team.totalMmr}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover align-middle mb-0" style="table-layout: fixed; width: 100%;">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="fw-semibold" style="width: 45%;">Player</th>
                                                <th class="fw-semibold text-center" style="width: 35%;">Dota 2 ID</th>
                                                <th class="fw-semibold text-end" style="width: 20%;">MMR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${team.players.map((player, playerIndex) => `
                                                <tr class="${playerIndex % 2 === 0 ? 'table-light' : ''}">
                                                    <td class="fw-bold text-primary">${escapeHtml(player.name)}</td>
                                                    <td class="text-center font-monospace small">${player.dota2id || 'N/A'}</td>
                                                    <td class="text-end">
                                                        <span class="badge bg-primary">${player.peakmmr || 0}</span>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Clear container first to avoid caching issues
    teamsContainer.innerHTML = '';
    
    // Force a brief delay to ensure DOM update
    setTimeout(() => {
        teamsContainer.innerHTML = teamsHtml;
        
        // Re-attach event listeners to the new buttons
        setupBalancerButtons();
    }, 10);
}

/**
 * Setup player action buttons
 */
function setupPlayerActionButtons() {
    // Remove player buttons
    const removePlayerButtons = document.querySelectorAll('.remove-player');
    
    removePlayerButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const playerId = e.currentTarget.getAttribute('data-id');
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            removePlayerFromList(playerId, playerIndex);
        });
    });
}

/**
 * Remove player from list
 */
function removePlayerFromList(playerId, playerIndex) {
    // Find player by ID instead of using index (fixes sorting bug)
    const playerRealIndex = state.availablePlayers.findIndex(p => p.id === playerId);
    
    if (playerRealIndex >= 0 && playerRealIndex < state.availablePlayers.length) {
        const player = state.availablePlayers[playerRealIndex];

        
        if (confirm(`Are you sure you want to remove ${player.name} from the team balancer?`)) {
            // Remove from available players using the correct index
            state.availablePlayers.splice(playerRealIndex, 1);
            
            // Refresh display
            displayPlayersForBalancer(state.availablePlayers);
            
            showNotification(`${player.name} removed from team balancer`, 'info');
        }
    } else {
        console.error(`Player not found with ID: ${playerId}. Available players: ${state.availablePlayers.length}`);
        showNotification('Error: Player not found', 'error');
    }
}

/**
 * Display reserved players
 */
function displayReservedPlayers() {
    const reservedList = document.getElementById('reserved-players-list');
    const reservedCountElement = document.getElementById('reserved-count');
    
    if (!reservedList) {
        return;
    }
    
    // Update reserved count badge
    if (reservedCountElement) {
        const count = state.reservedPlayers ? state.reservedPlayers.length : 0;
        reservedCountElement.textContent = count;
    }
    
    if (!state.reservedPlayers || state.reservedPlayers.length === 0) {
        reservedList.innerHTML = `
            <tr>
                <td colspan="2" class="text-center text-muted py-4">
                    <i class="bi bi-person-x fs-4 d-block mb-2"></i>
                    <span>No reserved players</span>
                </td>
            </tr>
        `;
        return;
    }
    
    const reservedHtml = state.reservedPlayers.map((player, index) => `
        <tr>
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <div class="avatar avatar-sm bg-warning-subtle text-warning rounded-circle me-2">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold">${escapeHtml(player.name)}</div>
                        <small class="text-muted">${player.dota2id || 'N/A'}</small>
                    </div>
                </div>
            </td>
            <td class="text-end pe-3">
                <span class="badge bg-warning text-dark">${player.peakmmr || 0}</span>
                <button type="button" class="btn btn-sm btn-outline-primary ms-1 restore-player" 
                        data-index="${index}" title="Restore to Available">
                    <i class="bi bi-arrow-left"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    reservedList.innerHTML = reservedHtml;
    
    // Setup restore buttons
    document.querySelectorAll('.restore-player').forEach(button => {
        button.addEventListener('click', (e) => {
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            restorePlayerFromReserved(playerIndex);
        });
    });
}

/**
 * Restore player from reserved list
 */
function restorePlayerFromReserved(playerIndex) {
    if (state.reservedPlayers && playerIndex >= 0 && playerIndex < state.reservedPlayers.length) {
        const player = state.reservedPlayers[playerIndex];
        
        // Remove from reserved
        state.reservedPlayers.splice(playerIndex, 1);
        
        // Add back to available
        state.availablePlayers.push(player);
        
        // Refresh displays
        displayPlayersForBalancer(state.availablePlayers);
        displayReservedPlayers();
        
        showNotification(`${player.name} restored to available players`, 'success');
    }
}

/**
 * Clear all teams
 */
function clearTeams() {
    state.balancedTeams = [];
    
    const teamsContainer = document.getElementById('teams-display') || // Fixed ID to match HTML
                          document.getElementById('teams-container') || 
                          document.querySelector('.teams-container');
    
    if (teamsContainer) {
        teamsContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No teams created yet. Use the Auto Balance button to create balanced teams.
            </div>
        `;
    }

    showNotification('Teams cleared', 'info');
}

/**
 * Export teams to various formats
 */
function exportTeams() {
    if (!state.balancedTeams || state.balancedTeams.length === 0) {
        showNotification('No teams to export', 'warning');
        return;
    }
    
    // Create export data
    const exportData = {
        tournament: state.registrationSessions.find(s => s.sessionId === state.currentSessionId)?.title || 'Unknown Tournament',
        sessionId: state.currentSessionId,
        exportDate: new Date().toISOString(),
        totalTeams: state.balancedTeams.length,
        teams: state.balancedTeams.map((team, index) => ({
            teamNumber: index + 1,
            totalMmr: team.totalMmr,
            averageMmr: Math.round(team.totalMmr / team.players.length),
            players: team.players.map(player => ({
                name: player.name,
                dota2id: player.dota2id,
                mmr: player.peakmmr || 0
            }))
        }))
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-balance-${state.currentSessionId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);

    showNotification('Teams exported successfully', 'success');
}

/**
 * Save teams to database for tournament bracket use
 */
async function saveTeams() {
    if (!state.balancedTeams || state.balancedTeams.length === 0) {
        showNotification('No teams to save', 'warning');
        return;
    }

    // Show save dialog
    const title = prompt('Enter a name for this team configuration:', 
        `${state.registrationSessions.find(s => s.sessionId === state.currentSessionId)?.title || 'Tournament'} Teams`);
    
    if (!title) {
        return; // User cancelled
    }

    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Calculate team statistics
        const totalPlayers = state.balancedTeams.reduce((sum, team) => sum + team.players.length, 0);
        const allMmrs = state.balancedTeams.flatMap(team => team.players.map(p => p.peakmmr || 0));
        const averageMmr = allMmrs.length > 0 ? Math.round(allMmrs.reduce((sum, mmr) => sum + mmr, 0) / allMmrs.length) : 0;

        // Get balance method from current settings
        const balanceMethodSelect = document.getElementById('balance-type');
        const balanceMethod = balanceMethodSelect ? balanceMethodSelect.value : 'highRanked';

        const teamData = {
            title: title.trim(),
            description: `Teams generated on ${new Date().toLocaleDateString()} using ${balanceMethod} method`,
            balanceMethod: balanceMethod,
            totalTeams: state.balancedTeams.length,
            totalPlayers: totalPlayers,
            averageMmr: averageMmr,
            registrationSessionId: state.currentSessionId,
            teams: state.balancedTeams.map((team, index) => ({
                teamNumber: index + 1,
                name: `Team ${index + 1}`,
                totalMmr: team.totalMmr,
                averageMmr: Math.round(team.totalMmr / team.players.length),
                players: team.players.map(player => ({
                    id: player.id,
                    name: player.name,
                    dota2id: player.dota2id,
                    peakmmr: player.peakmmr || 0,
                    isManual: player.isManual || false
                }))
            }))
        };

        const response = await fetch('/.netlify/functions/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId
            },
            body: JSON.stringify(teamData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`Teams saved successfully as "${title}"`, 'success');
        } else {
            showNotification(result.error || 'Failed to save teams', 'error');
        }

    } catch (error) {
        console.error('Error saving teams:', error);
        showNotification('Error saving teams to database', 'error');
    }
}

/**
 * Setup listener for registration updates
 * This allows the team balancer to refresh when registration settings change
 */
function setupTeamBalancerRegistrationListener() {
    // Listen for custom registration update events
    window.addEventListener('registrationUpdated', function(event) {
        // Reload registration sessions to get updated limits and status
        loadRegistrationSessions().then(() => {
            // Reload players to reflect any new availability
            if (state.currentSessionId) {
                loadPlayersForBalancer();
                showNotification('Team balancer refreshed due to registration changes', 'info');
            }
        });
    });
    
    // Also expose refresh function globally for direct calls
    window.refreshTeamBalancerData = function() {
        loadRegistrationSessions().then(() => {
            if (state.currentSessionId) {
                loadPlayersForBalancer();
            }
        });
    };
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Legacy function for backward compatibility
function loadPlayers() {
    return loadPlayersForBalancer();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for full page rendering before initializing
    setTimeout(initTeamBalancer, 100);
});

// Expose functions globally for compatibility
window.teamBalancerModule = {
    initTeamBalancer,
    loadPlayersForBalancer,
    autoBalance,
    clearTeams,
    exportTeams,
    saveTeams
};

    // Expose init function globally for navigation system
window.initTeamBalancer = initTeamBalancer;

    // Legacy global functions for existing onclick handlers
    window.loadPlayers = loadPlayersForBalancer;
    window.autoBalance = autoBalance;
    window.clearTeams = clearTeams;
    window.exportTeams = exportTeams;
    window.saveTeams = saveTeams;

})();
