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
        
        // Setup event listeners
        setupTeamBalancerEventListeners();
        
        // Initialize reserved players display
        displayReservedPlayers();
        
        // Listen for registration updates to refresh player data
        setupTeamBalancerRegistrationListener();
        
        console.log('Team balancer initialized successfully');
    } catch (error) {
        console.error('Error initializing team balancer:', error);
        showNotification('Failed to initialize team balancer', 'error');
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

    // Auto Balance button (multiple possible IDs)
    const autoBalanceBtn = document.getElementById('generate-teams') || 
                          document.getElementById('auto-balance-btn') || 
                          document.querySelector('[onclick="autoBalance()"]');
    if (autoBalanceBtn) {
        console.log('Team balancer: Found generate-teams button, adding click listener');
        autoBalanceBtn.removeAttribute('onclick');
        autoBalanceBtn.addEventListener('click', function(e) {
            console.log('Generate teams button clicked');
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
            } else {
                console.error('Failed to load players:', data.message || 'Unknown error');
                showNotification(data.message || 'Failed to load players', 'error');
                state.availablePlayers = [];
                displayPlayersForBalancer([]);
            }
        } catch (fetchError) {
            console.error('Network error loading players:', fetchError);
            showNotification('Network error loading players', 'error');
        } finally {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error in loadPlayersForBalancer:', error);
        showNotification('Error loading players', 'error');
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

    // Update player count badge
    if (playerCountElement) {
        playerCountElement.textContent = players ? players.length : 0;
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
                    <div class="avatar avatar-sm bg-primary-subtle text-primary rounded-circle me-2">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold">${escapeHtml(player.name)}</div>
                        <small class="text-muted">${player.dota2id || 'N/A'}</small>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-primary">${player.peakmmr || 0}</span>
            </td>
            <td class="text-end pe-3">
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-secondary move-to-reserved" 
                            data-id="${player.id}" data-index="${index}" title="Move to Reserved">
                        <i class="bi bi-arrow-right"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger remove-player" 
                            data-id="${player.id}" data-index="${index}" title="Remove Player">
                    <i class="bi bi-trash"></i>
                </button>
                </div>
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
        console.log('AutoBalance function called');
        console.log('Current session ID:', state.currentSessionId);
        console.log('Available players:', state.availablePlayers?.length || 0);
        
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
        const balanceMethodSelect = document.getElementById('balance-type'); // Fixed ID to match HTML
        
        const teamSize = parseInt(teamSizeSelect?.value) || 5;
        const balanceMethod = balanceMethodSelect?.value || 'highRanked';

        console.log('Selected balance method:', balanceMethod);
        console.log('Balance method element:', balanceMethodSelect);
        console.log('All balance options:', balanceMethodSelect ? Array.from(balanceMethodSelect.options).map(o => o.value) : 'No select found');

        // Calculate number of teams
        const numTeams = Math.floor(state.availablePlayers.length / teamSize);
        
        if (numTeams < 2) {
            showNotification(`Not enough players for ${teamSize}v${teamSize} teams. Need at least ${teamSize * 2} players.`, 'warning');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="bi bi-shuffle me-1"></i> Generate Teams (5v5)';
            }
            return;
        }

        // Clear existing teams completely
        state.balancedTeams = [];
        console.log('Cleared existing teams');
    
        // Initialize teams
        for (let i = 0; i < numTeams; i++) {
            state.balancedTeams.push({
                players: [],
                totalMmr: 0
            });
        }
        console.log(`Initialized ${numTeams} empty teams`);

        // Distribute players based on selected balance method
        distributePlayersByMethod(state.availablePlayers, balanceMethod, numTeams, teamSize);

        // Display balanced teams
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
    console.log(`🎯 Distributing ${players.length} players using method: ${method}`);
    
    switch (method) {
        case 'highRanked':
            console.log('📈 Using High Ranked Balance (Snake Draft)');
            distributeHighRankedBalance(players, numTeams, teamSize);
            break;
        case 'perfectMmr':
            console.log('⚖️ Using Perfect MMR Balance');
            distributePerfectMmrBalance(players, numTeams, teamSize);
            break;
        case 'highLowShuffle':
            console.log('🔄 Using High/Low Shuffle');
            distributeHighLowShuffle(players, numTeams, teamSize);
            break;
        case 'random':
            console.log('🎲 Using Random Teams');
            distributeRandomTeams(players, numTeams, teamSize);
            break;
        default:
            console.warn(`❓ Unknown balance method '${method}', using high ranked balance`);
            distributeHighRankedBalance(players, numTeams, teamSize);
    }
    
    // Log results after distribution
    console.log('Teams after distribution:', state.balancedTeams.map((team, i) => ({
        team: i + 1,
        players: team.players.length,
        totalMMR: team.totalMmr,
        avgMMR: Math.round(team.totalMmr / team.players.length) || 0
    })));
}

/**
 * High Ranked Balance - Snake draft starting with highest MMR (with shuffling)
 */
function distributeHighRankedBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first), then add randomization
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    // Group players by MMR tiers to maintain balance while adding variety
    const mmrTiers = [];
    const tierSize = Math.max(1, Math.floor(sortedPlayers.length / (numTeams * 2))); // Create reasonable tiers
    
    for (let i = 0; i < sortedPlayers.length; i += tierSize) {
        const tier = sortedPlayers.slice(i, i + tierSize);
        // Shuffle players within the same MMR tier for variety
        const shuffledTier = tier.sort(() => Math.random() - 0.5);
        mmrTiers.push(...shuffledTier);
    }
    
    console.log(`📊 Created MMR tiers with ${tierSize} players per tier for shuffling`);

    let currentTeam = 0;
    let direction = 1; // 1 for forward, -1 for backward
    
    // Randomly decide starting direction for more variety
    if (Math.random() < 0.5) {
        direction = -1;
        currentTeam = numTeams - 1;
    }

    for (let i = 0; i < mmrTiers.length && i < numTeams * teamSize; i++) {
        const player = mmrTiers[i];
        state.balancedTeams[currentTeam].players.push(player);
        state.balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;

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
    
    console.log(`🐍 Snake draft completed with direction: ${direction === 1 ? 'forward' : 'reverse'} start`);
}

/**
 * Perfect MMR Balance - Try to make team MMR totals as close as possible (with shuffling)
 */
function distributePerfectMmrBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first), then add some shuffling within tiers
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    // Add slight randomization while maintaining general MMR order
    const tierSize = Math.max(2, Math.floor(sortedPlayers.length / numTeams)); // Smaller tiers for more precision
    const shuffledPlayers = [];
    
    for (let i = 0; i < sortedPlayers.length; i += tierSize) {
        const tier = sortedPlayers.slice(i, i + tierSize);
        // Light shuffle within tier to add variety while keeping balance
        const shuffledTier = tier.sort(() => (Math.random() - 0.5) * 0.3); // Gentle shuffle
        shuffledPlayers.push(...shuffledTier);
    }
    
    console.log(`⚖️ Using shuffled tiers of ${tierSize} players for Perfect MMR balance`);

    for (const player of shuffledPlayers) {
        if (state.balancedTeams.every(team => team.players.length >= teamSize)) {
            break; // All teams are full
        }

        // Find the team with the lowest total MMR that still has space
        const availableTeams = state.balancedTeams.filter(team => team.players.length < teamSize);
        const targetTeam = availableTeams.reduce((lowest, current) => 
            current.totalMmr < lowest.totalMmr ? current : lowest
        );

        targetTeam.players.push(player);
        targetTeam.totalMmr += player.peakmmr || 0;
        
        console.log(`Added ${player.name} (${player.peakmmr}) to team with ${targetTeam.totalMmr - player.peakmmr} MMR`);
    }
}

/**
 * High/Low Shuffle - Alternate between high and low MMR players
 */
function distributeHighLowShuffle(players, numTeams, teamSize) {
    // Sort players by MMR (highest first)
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    // Split into high and low MMR groups
    const midPoint = Math.floor(sortedPlayers.length / 2);
    const highMmrPlayers = sortedPlayers.slice(0, midPoint);
    const lowMmrPlayers = sortedPlayers.slice(midPoint).reverse(); // Start with lowest MMR

    let currentTeam = 0;
    let useHighMmr = true;

    // Alternate between high and low MMR players
    const maxIterations = numTeams * teamSize;
    for (let i = 0; i < maxIterations; i++) {
        const sourceArray = useHighMmr ? highMmrPlayers : lowMmrPlayers;
        
        if (sourceArray.length === 0) {
            // Switch to the other array if current one is empty
            useHighMmr = !useHighMmr;
            continue;
        }

        if (state.balancedTeams[currentTeam].players.length >= teamSize) {
            currentTeam = (currentTeam + 1) % numTeams;
            continue;
        }

        const player = sourceArray.shift();
        if (player) {
            state.balancedTeams[currentTeam].players.push(player);
            state.balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;
        }

        // Alternate between high and low, and move to next team
        useHighMmr = !useHighMmr;
        currentTeam = (currentTeam + 1) % numTeams;
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
 * Display balanced teams
 */
function displayBalancedTeams() {
    const teamsContainer = document.getElementById('teams-display') || // Fixed ID to match HTML
                          document.getElementById('teams-container') || 
                          document.querySelector('.teams-container');
    
    if (!teamsContainer) {
        console.error('Teams container not found - looking for teams-display');
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
        <div class="row">
            <div class="col-12 mb-3">
                <h5>
                    <i class="bi bi-people-fill me-2"></i>
                    Balanced Teams (${state.balancedTeams.length})
                </h5>
            </div>
            ${state.balancedTeams.map((team, teamIndex) => `
                <div class="col-lg-6 mb-4">
                    <div class="card border-primary">
                        <div class="card-header bg-primary text-white">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0">Team ${teamIndex + 1}</h6>
                                <div>
                                    <span class="badge bg-light text-dark">
                                        Avg MMR: ${Math.round(team.totalMmr / team.players.length)}
                                    </span>
                                    <span class="badge bg-light text-dark ms-1">
                                        Total: ${team.totalMmr}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="card-body p-0">
                            ${team.players.map((player, playerIndex) => `
                                <div class="d-flex justify-content-between align-items-center p-2 ${playerIndex % 2 === 0 ? 'bg-light' : ''}">
                                    <div>
                                        <div class="fw-bold">${escapeHtml(player.name)}</div>
                                        <small class="text-muted">${player.dota2id || 'N/A'}</small>
                                    </div>
                                    <span class="badge bg-primary">${player.peakmmr || 0}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    teamsContainer.innerHTML = teamsHtml;
}

/**
 * Setup player action buttons
 */
function setupPlayerActionButtons() {
    console.log('🔧 Setting up player action buttons...');
    
    // Move to reserved buttons
    const moveToReservedButtons = document.querySelectorAll('.move-to-reserved');
    console.log(`Found ${moveToReservedButtons.length} move-to-reserved buttons`);
    
    moveToReservedButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            console.log('📦 Move to reserved button clicked');
            const playerId = e.currentTarget.getAttribute('data-id');
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            console.log(`Moving player ID: ${playerId}, Index: ${playerIndex}`);
            movePlayerToReserved(playerId, playerIndex);
        });
    });

    // Remove player buttons
    const removePlayerButtons = document.querySelectorAll('.remove-player');
    console.log(`Found ${removePlayerButtons.length} remove-player buttons`);
    
    removePlayerButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            console.log('🗑️ Remove player button clicked');
            const playerId = e.currentTarget.getAttribute('data-id');
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            console.log(`Removing player ID: ${playerId}, Index: ${playerIndex}`);
            removePlayerFromList(playerId, playerIndex);
        });
    });
}

/**
 * Move player to reserved list
 */
function movePlayerToReserved(playerId, playerIndex) {
    console.log(`🔄 movePlayerToReserved called with ID: ${playerId}, Index: ${playerIndex}`);
    console.log(`Available players count: ${state.availablePlayers?.length || 0}`);
    console.log(`Reserved players count: ${state.reservedPlayers?.length || 0}`);
    
    if (playerIndex >= 0 && playerIndex < state.availablePlayers.length) {
        const player = state.availablePlayers[playerIndex];
        console.log(`Player to move: ${player.name}`);
        
        // Add to reserved players if not already there
        if (!state.reservedPlayers) {
            state.reservedPlayers = [];
            console.log('Initialized reservedPlayers array');
        }
        
        const alreadyReserved = state.reservedPlayers.find(p => p.id === player.id);
        if (!alreadyReserved) {
            state.reservedPlayers.push(player);
            console.log(`Added ${player.name} to reserved players`);
            
            // Remove from available players
            state.availablePlayers.splice(playerIndex, 1);
            console.log(`Removed ${player.name} from available players`);
            
            // Refresh displays
            displayPlayersForBalancer(state.availablePlayers);
            displayReservedPlayers();
            
            showNotification(`${player.name} moved to reserved players`, 'success');
        } else {
            console.log(`${player.name} is already in reserved players`);
            showNotification(`${player.name} is already in reserved players`, 'warning');
        }
    } else {
        console.error(`Invalid player index: ${playerIndex}. Available players: ${state.availablePlayers.length}`);
        showNotification('Error: Invalid player selected', 'error');
    }
}

/**
 * Remove player from list
 */
function removePlayerFromList(playerId, playerIndex) {
    if (playerIndex >= 0 && playerIndex < state.availablePlayers.length) {
        const player = state.availablePlayers[playerIndex];
        
        if (confirm(`Are you sure you want to remove ${player.name} from the team balancer?`)) {
            // Remove from available players
            state.availablePlayers.splice(playerIndex, 1);
            
            // Refresh display
            displayPlayersForBalancer(state.availablePlayers);
            
            showNotification(`${player.name} removed from team balancer`, 'info');
        }
    }
}

/**
 * Display reserved players
 */
function displayReservedPlayers() {
    console.log('📋 Displaying reserved players...');
    
    const reservedList = document.getElementById('reserved-players-list');
    const reservedCountElement = document.getElementById('reserved-count');
    
    console.log('Reserved list element:', reservedList);
    console.log('Reserved count element:', reservedCountElement);
    console.log('Reserved players:', state.reservedPlayers);
    
    if (!reservedList) {
        console.error('❌ Reserved players list element not found!');
        return;
    }
    
    // Update reserved count badge
    if (reservedCountElement) {
        const count = state.reservedPlayers ? state.reservedPlayers.length : 0;
        reservedCountElement.textContent = count;
        console.log(`Updated reserved count badge to: ${count}`);
    }
    
    if (!state.reservedPlayers || state.reservedPlayers.length === 0) {
        console.log('No reserved players to display');
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
 * Setup listener for registration updates
 * This allows the team balancer to refresh when registration settings change
 */
function setupTeamBalancerRegistrationListener() {
    // Listen for custom registration update events
    window.addEventListener('registrationUpdated', function(event) {
        console.log('⚖️ Team Balancer received registration update event:', event.detail);
        
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
        console.log('⚖️ Direct refresh requested for Team Balancer');
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
    exportTeams
};

    // Expose init function globally for navigation system
window.initTeamBalancer = initTeamBalancer;

    // Legacy global functions for existing onclick handlers
    window.loadPlayers = loadPlayersForBalancer;
    window.autoBalance = autoBalance;
    window.clearTeams = clearTeams;
    window.exportTeams = exportTeams;

})();
