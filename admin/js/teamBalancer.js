(function() {
    'use strict';

    // Simple global state like Masterlist (safe for reloading)
    window.teamBalancerData = window.teamBalancerData || {
        currentSessionId: null,
        registrationSessions: [],
        availablePlayers: [],
        balancedTeams: [],
        reservedPlayers: []
    };
    
    window.isTeamBalancerLoading = window.isTeamBalancerLoading || false;
    window.lastLoadedTeamBalancerCount = window.lastLoadedTeamBalancerCount || null;

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
        options.headers['x-session-id'] = sessionId;
    }
    return fetch(url, options);
}

/**
 * Initialize the team balancer - Simplified like Masterlist
 */
async function initTeamBalancer() {
    try {
        console.log('🚀 Team Balancer: Starting initialization...');
        
        // Set up event listeners
        setupTeamBalancerEventListeners();
        
        // Load initial data
        await loadTeamBalancerData();
        
        console.log('✅ Team Balancer: Initialization complete');
        return true;
    } catch (error) {
        console.error('❌ Team Balancer: Error in initTeamBalancer:', error);
        window.showNotification('Error initializing team balancer', 'error');
        return false;
    }
}

/**
 * Load team balancer data - Simplified like Masterlist
 */
async function loadTeamBalancerData() {
    if (window.isTeamBalancerLoading) return;
    window.isTeamBalancerLoading = true;
    
    try {
        console.log('🔄 Team Balancer: Loading data...');
        
        // Load registration sessions
        await loadRegistrationSessions();
        
        // Load players if session is selected
        if (window.teamBalancerData.currentSessionId) {
            await loadPlayersForBalancer();
        }
        
        console.log('✅ Team Balancer: Data loaded successfully');
    } catch (error) {
        console.error('❌ Team Balancer: Error loading data:', error);
        window.showNotification('Error loading team balancer data', 'error');
    } finally {
        window.isTeamBalancerLoading = false;
    }
}

/**
 * Cleanup function for team balancer when switching tabs - Simplified
 */
function cleanupTeamBalancer() {
    console.log('Team Balancer: Starting cleanup...');
    
    // Simple cleanup - just reset loading flag
    window.isTeamBalancerLoading = false;
    
    console.log('Team Balancer: Cleanup completed');
}

/**
 * Set up event listeners - Simplified like Masterlist
 */
function setupTeamBalancerEventListeners() {
    // Session selector change
    const sessionSelector = document.getElementById('team-balancer-session-selector');
    if (sessionSelector) {
        sessionSelector.addEventListener('change', async (e) => {
            window.teamBalancerData.currentSessionId = e.target.value || null;
            await loadPlayersForBalancer();
        });
    }
    
    // Refresh sessions button
    const refreshBtn = document.getElementById('refresh-balancer-sessions');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRegistrationSessions);
    }
    
    // Load players button
    const loadPlayersBtn = document.getElementById('load-players-btn');
    if (loadPlayersBtn) {
        loadPlayersBtn.addEventListener('click', loadPlayersForBalancer);
    }
    
    // Generate teams button
    const generateTeamsBtn = document.getElementById('generate-teams');
    if (generateTeamsBtn) {
        generateTeamsBtn.addEventListener('click', autoBalance);
    }
    
    // Clear teams button
    const clearTeamsBtn = document.getElementById('clear-teams');
    if (clearTeamsBtn) {
        clearTeamsBtn.addEventListener('click', () => clearTeams());
    }
    
    // Export teams button
    const exportTeamsBtn = document.getElementById('export-teams');
    if (exportTeamsBtn) {
        exportTeamsBtn.addEventListener('click', exportTeams);
    }
    
    // Save teams button
    const saveTeamsBtn = document.getElementById('save-teams-btn');
    if (saveTeamsBtn) {
        saveTeamsBtn.addEventListener('click', saveTeams);
    }
    
    // Load players from teams
    const loadPlayersFromTeamsBtn = document.getElementById('load-players-from-teams');
    if (loadPlayersFromTeamsBtn) {
        loadPlayersFromTeamsBtn.addEventListener('click', loadPlayersFromTeams);
    }
    
    // Add player form
    const addPlayerForm = document.getElementById('add-player-form');
    if (addPlayerForm) {
        addPlayerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const playerName = document.getElementById('player-name').value.trim();
            const playerMmr = document.getElementById('player-mmr').value.trim();
            
            if (playerName && playerMmr) {
                const newPlayer = {
                    id: 'temp_' + Date.now(),
                    name: playerName,
                    peakmmr: parseInt(playerMmr) || 0
                };
                
                window.teamBalancerData.availablePlayers.push(newPlayer);
                displayPlayersForBalancer(window.teamBalancerData.availablePlayers);
                
                // Clear form
                document.getElementById('player-name').value = '';
                document.getElementById('player-mmr').value = '';
                
                window.showNotification(`${playerName} added to team balancer`, 'success');
            }
        });
    }
    
    // Clear players button
    const clearPlayersBtn = document.getElementById('clear-players');
    if (clearPlayersBtn) {
        clearPlayersBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all players?')) {
                window.teamBalancerData.availablePlayers = [];
                window.teamBalancerData.reservedPlayers = [];
                displayPlayersForBalancer([]);
                displayReservedPlayers();
                window.showNotification('All players cleared', 'info');
            }
        });
    }
}

/**
 * Load registration sessions for team balancer
 */
async function loadRegistrationSessions() {
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            window.showNotification('Session expired. Please login again.', 'error');
            return;
        }

        const apiResponse = await fetchWithAuth('/.netlify/functions/registration-sessions');
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }
        
        const data = await apiResponse.json();

        if (data && data.success && Array.isArray(data.sessions)) {
            window.teamBalancerData.registrationSessions = data.sessions;
            updateSessionSelector();
        } else {
            console.error('Team Balancer: Failed to process sessions. Data received:', data);
            window.showNotification(data.message || 'Failed to load registration sessions', 'error');
        }
    } catch (error) {
        console.error('Error loading registration sessions in Team Balancer:', error);
        window.showNotification('An error occurred while loading tournaments.', 'error');
    }
}

/**
 * Update the session selector dropdown
 */
function updateSessionSelector() {
    const selector = document.getElementById('team-balancer-session-selector');
    if (!selector) return;

    // Preserve the currently selected value if it exists
    const previouslySelected = selector.value;

    selector.innerHTML = '<option value="">Choose a tournament...</option>';

    // Check user role
    const user = window.sessionManager?.getUser();
    const userRole = user ? user.role : 'admin';

    // Sort sessions by creation date (newest first)
    const sortedSessions = [...window.teamBalancerData.registrationSessions].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.sessionId;
        option.textContent = `${session.title} (${session.playerCount} players)`;
        if (!session.isActive) {
            option.textContent += ' [Inactive]';
        }
        // Add dataset for the delete button
        option.dataset.sessionId = session.sessionId;
        selector.appendChild(option);
    });

    // Remove the old list container if it exists
    const existingListContainer = document.getElementById('session-list-container');
    if (existingListContainer) {
        existingListContainer.remove();
    }

    // Add a single delete button next to the dropdown for superadmin
    if (userRole === 'superadmin') {
        addDeleteButtonToBalancerSelector();
    }

    // Auto-select the latest (most recent) or previously selected tournament
    if (previouslySelected && sortedSessions.some(s => s.sessionId === previouslySelected)) {
        selector.value = previouslySelected;
        window.teamBalancerData.currentSessionId = previouslySelected;
    } else if (window.teamBalancerData.currentSessionId && sortedSessions.some(s => s.sessionId === window.teamBalancerData.currentSessionId)) {
        // Always restore to state.currentSessionId if possible
        selector.value = window.teamBalancerData.currentSessionId;
    } else if (sortedSessions.length > 0) {
        const latestSession = sortedSessions[0];
        selector.value = latestSession.sessionId;
        window.teamBalancerData.currentSessionId = latestSession.sessionId;
    } else {
        if (typeof window.enableOnlyNavigationTab === 'function') {
            window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
        }
    }

    syncSessionSelectorToState();
}

/**
 * Add delete button for team balancer tournament selector
 */
function addDeleteButtonToBalancerSelector() {
    const selector = document.getElementById('team-balancer-session-selector');
    if (!selector) return;

    // Prevent adding multiple buttons
    if (selector.parentElement.querySelector('.delete-tournament-session-btn')) {
        return;
    }

    let container = selector.closest('.d-flex');
    if (container) {
        // Use input-group for proper alignment
        if (!container.classList.contains('input-group')) {
            container.classList.add('input-group');
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outline-danger delete-tournament-session-btn';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = 'Delete selected tournament';
        container.appendChild(deleteBtn);

        deleteBtn.addEventListener('click', async () => {
            const selectedOption = selector.options[selector.selectedIndex];
            const sessionId = selectedOption?.dataset.sessionId;

            if (!sessionId || selector.value === '') {
                window.showNotification('Please select a tournament to delete.', 'warning');
                return;
            }

            if (confirm(`Are you sure you want to permanently delete the tournament "${selectedOption.textContent}"? This will also delete all associated players.`)) {
                await deleteTournamentSession(sessionId, deleteBtn);
            }
        });
    }
}

/**
 * Load players for the selected tournament session
 */
async function loadPlayersForBalancer() {
    try {
        if (!window.teamBalancerData.currentSessionId) {
            window.showNotification('Please select a tournament first', 'warning');
            return;
        }

        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            window.showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Clear existing players
        window.teamBalancerData.availablePlayers = [];
        
        // Clear existing teams when loading new players
        clearTeams(true);

        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }

        try {
            // Build API URL exactly like Player List does
            let apiUrl = '/.netlify/functions/api-players?includeSessionInfo=true';
            if (window.teamBalancerData.currentSessionId) {
                apiUrl += `&sessionId=${window.teamBalancerData.currentSessionId}`;
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'x-session-id': sessionId
                }
            });
        
        const data = await response.json();
        
            if (data.success && Array.isArray(data.players)) {
                window.teamBalancerData.availablePlayers = data.players.filter(player => 
                    player.name && 
                    player.name.trim() !== ''
                );
                
                displayPlayersForBalancer(window.teamBalancerData.availablePlayers);
                
                // Initialize reserved players display
                displayReservedPlayers();
                
                // Update player count in badge
                const countBadge = document.getElementById('balancer-player-count');
                if (countBadge) {
                    countBadge.textContent = `${window.teamBalancerData.availablePlayers.length} players`;
                }
                
                if (window.teamBalancerData.availablePlayers.length === 0) {
                    window.showNotification('No players found in selected tournament', 'info');
                    window.lastLoadedTeamBalancerCount = 0;
                } else if (window.teamBalancerData.availablePlayers.length !== window.lastLoadedTeamBalancerCount) {
                    window.showNotification(`Loaded ${window.teamBalancerData.availablePlayers.length} players from tournament`, 'success');
                    window.lastLoadedTeamBalancerCount = window.teamBalancerData.availablePlayers.length;
                }
                
                // Enable the tab after data loading is complete
                if (typeof window.enableOnlyNavigationTab === 'function') {
                    window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
                }
            } else {
                console.error('Failed to load players:', data.message || 'Unknown error');
                window.showNotification(data.message || 'Failed to load players', 'error');
                window.teamBalancerData.availablePlayers = [];
                displayPlayersForBalancer([]);
                
                // Enable the tab even if data loading failed
                if (typeof window.enableOnlyNavigationTab === 'function') {
                    window.enableOnlyNavigationTab('team-balancer-tab', 'bi bi-people-fill me-2');
                }
            }
        } catch (fetchError) {
            console.error('Network error loading players:', fetchError);
            window.showNotification('Network error loading players', 'error');
            
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
        window.showNotification('Error loading players', 'error');
        
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
    }

    if (!players || players.length === 0) {
        playersList.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-info-circle fs-4 d-block mb-2"></i>
                    <span>${window.teamBalancerData.currentSessionId ? 'No players found in this tournament.' : 'Please select a tournament to load players.'}</span>
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
    
    // Note: Event listeners are now handled by event delegation in setupTeamBalancerEventListeners
}

/**
 * Auto balance teams based on MMR
 */
function autoBalance() {
    // Prevent multiple simultaneous executions
    if (window.isTeamBalancerLoading) {
        window.showNotification('Team balancing already in progress. Please wait...', 'warning');
        return;
    }
    
    // Set execution guard
    window.isTeamBalancerLoading = true;
    
    try {
        // Get and disable the generate button to prevent multiple clicks
        const generateBtn = document.getElementById('generate-teams');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generating...';
        }
        
        if (!window.teamBalancerData.currentSessionId) {
            window.showNotification('Please select a tournament first', 'warning');
            return;
        }

        if (!window.teamBalancerData.availablePlayers || window.teamBalancerData.availablePlayers.length === 0) {
            window.showNotification('No players available for balancing', 'warning');
            return;
        }

        // Get balance settings
        const teamSizeSelect = document.getElementById('team-size');
        const balanceMethodSelect = document.getElementById('balance-type');
        
        const teamSize = parseInt(teamSizeSelect?.value) || 5;
        const balanceMethod = balanceMethodSelect?.value || 'highRanked';

        // Create a clean copy of all players for this execution (available + reserved)
        const allPlayers = [...window.teamBalancerData.availablePlayers, ...(window.teamBalancerData.reservedPlayers || [])];
        // Always reset reservedPlayers before generating teams
        window.teamBalancerData.reservedPlayers = [];

        // For all methods, use allPlayers as the pool
        let playersForTeams = [...allPlayers];
        let numTeams = Math.floor(playersForTeams.length / teamSize);

        if (playersForTeams.length === 0) {
            window.showNotification('No players available for team generation.', 'warning');
            return;
        }
        if (numTeams < 2) {
            window.showNotification(`Not enough players for ${teamSize}v${teamSize} teams. Need at least ${teamSize * 2} players.`, 'warning');
            return;
        }

        // Clear existing teams completely
        window.teamBalancerData.balancedTeams = [];
        for (let i = 0; i < numTeams; i++) {
            window.teamBalancerData.balancedTeams.push({
                name: `Team ${i + 1}`,
                players: [],
                totalMmr: 0
            });
        }

        // Distribute players based on selected balance method
        const reservePlayers = distributePlayersByMethod(playersForTeams, balanceMethod, numTeams, teamSize);

        // Handle reserve logic for all methods
        if (reservePlayers && reservePlayers.length > 0) {
            // Update available and reserved players based on what's in teams vs reserves
            const playersUsedInTeams = window.teamBalancerData.balancedTeams.flatMap(team => team.players);
            const playerIdsInTeams = new Set(playersUsedInTeams.map(p => p.id));
            window.teamBalancerData.availablePlayers = allPlayers.filter(p => playerIdsInTeams.has(p.id));
            window.teamBalancerData.reservedPlayers = reservePlayers;
            window.showNotification(`${reservePlayers.length} low MMR player(s) moved to reserved list`, 'info');
        } else {
            // No reserve players, all players are in teams
            const playersUsedInTeams = window.teamBalancerData.balancedTeams.flatMap(team => team.players);
            const playerIdsInTeams = new Set(playersUsedInTeams.map(p => p.id));
            window.teamBalancerData.availablePlayers = allPlayers.filter(p => playerIdsInTeams.has(p.id));
            window.teamBalancerData.reservedPlayers = [];
        }

        // Update all displays at once (much more efficient)
        displayPlayersForBalancer(window.teamBalancerData.availablePlayers);
        displayReservedPlayers();
        displayBalancedTeams();

        const methodNames = {
            'highRanked': 'High Ranked Balance',
            'perfectMmr': 'Perfect MMR Balance', 
            'highLowShuffle': 'High/Low Shuffle',
            'random': 'Random Teams'
        };

        const methodName = methodNames[balanceMethod] || balanceMethod;
        window.showNotification(`Created ${numTeams} balanced teams using ${methodName}!`, 'success');
        
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

    } catch (error) {
        console.error('Error in auto balance:', error);
        window.showNotification('Error creating balanced teams', 'error');
    } finally {
        // Reset execution guard and ensure button is re-enabled
        window.isTeamBalancerLoading = false;
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
            return distributeHighRankedBalance(players, numTeams, teamSize);
        case 'perfectMmr':
            return distributePerfectMmrBalance(players, numTeams, teamSize);
        case 'highLowShuffle':
            return distributeHighLowShuffle(players, numTeams, teamSize);
        case 'random':
            return distributeRandomTeams(players, numTeams, teamSize);
        default:
            return distributeHighRankedBalance(players, numTeams, teamSize);
    }
}

/**
 * High Ranked Balance - Prioritize high MMR players for teams, lowest MMR to reserves (tiered randomization)
 * This version is based on High/Low Shuffle, but reserves the lowest MMR players.
 */
function distributeHighRankedBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first)
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    const maxPlayersForTeams = numTeams * teamSize;
    // Players for teams: top N*teamSize
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    // Players for reserves: the rest (lowest MMR)
    const playersForReserves = sortedPlayers.slice(maxPlayersForTeams);

    // Tiered assignment: distribute top players to teams in tiers
    const teams = Array.from({ length: numTeams }, () => []);
    const tiers = [];
    for (let i = 0; i < teamSize; i++) {
        tiers.push(playersForTeams.slice(i * numTeams, (i + 1) * numTeams));
    }
    // Shuffle each tier and assign
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        for (let j = tier.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [tier[j], tier[k]] = [tier[k], tier[j]];
        }
        for (let t = 0; t < numTeams; t++) {
            if (tier[t]) teams[t].push(tier[t]);
        }
    }
    // Assign to state.balancedTeams
    for (let t = 0; t < numTeams; t++) {
        window.teamBalancerData.balancedTeams[t].players = teams[t];
        window.teamBalancerData.balancedTeams[t].totalMmr = teams[t].reduce((sum, p) => sum + (p.peakmmr || 0), 0);
    }
    return playersForReserves;
}

/**
 * Perfect MMR Balance - Try to make team MMR totals as close as possible, low MMR to reserves
 */
function distributePerfectMmrBalance(players, numTeams, teamSize) {
    // Sort players by MMR (highest first) - high MMR players get priority
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const maxPlayersForTeams = numTeams * teamSize;
    
    // Step 1: Separate players for teams vs reserves
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    const playersForReserves = sortedPlayers.slice(maxPlayersForTeams);
    
    // Step 2: Distribute players for optimal MMR balance (optimized)
    // Create a simple array to track team MMR totals for faster lookups
    const teamMmrTotals = new Array(numTeams).fill(0);
    
    for (const player of playersForTeams) {
        // Find the team with the lowest total MMR that still has space
        let targetTeamIndex = 0;
        let lowestMmr = teamMmrTotals[0];
        
        for (let i = 1; i < numTeams; i++) {
            if (window.teamBalancerData.balancedTeams[i].players.length < teamSize && teamMmrTotals[i] < lowestMmr) {
                targetTeamIndex = i;
                lowestMmr = teamMmrTotals[i];
            }
        }
        
        // Add player to the target team
        const targetTeam = window.teamBalancerData.balancedTeams[targetTeamIndex];
        targetTeam.players.push(player);
        targetTeam.totalMmr += player.peakmmr || 0;
        teamMmrTotals[targetTeamIndex] += player.peakmmr || 0;
    }
    
    // Step 3: Return reserve players for proper state management
    return playersForReserves;
}

/**
 * High/Low Shuffle - Positional priority with randomness (Slot 1: High, Slots 2-4: Mid, Slot 5: Low)
 */
function distributeHighLowShuffle(players, numTeams, teamSize) {
    // Sort players by MMR (highest first) - high MMR players get priority
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const maxPlayersForTeams = numTeams * teamSize;
    
    // Step 1: Select players for teams and reserves
    const playersNeededForTeams = maxPlayersForTeams;
    const playersToReserve = sortedPlayers.length - playersNeededForTeams;
    
    // Strategy: Keep top 40% and bottom 40%, reserve middle 20%
    const guaranteedTopCount = Math.floor(playersNeededForTeams * 0.4);
    const guaranteedBottomCount = Math.floor(playersNeededForTeams * 0.4);
    const flexibleCount = playersNeededForTeams - guaranteedTopCount - guaranteedBottomCount;
    
    // Guaranteed players for teams
    const guaranteedTopPlayers = sortedPlayers.slice(0, guaranteedTopCount);
    const guaranteedBottomPlayers = sortedPlayers.slice(-guaranteedBottomCount);
    
    // Flexible candidates (middle MMR range)
    const flexibleCandidates = sortedPlayers.slice(guaranteedTopCount, sortedPlayers.length - guaranteedBottomCount);
    
    // Single shuffle for flexible candidates (much faster)
    const shuffledFlexibleCandidates = [...flexibleCandidates].sort(() => Math.random() - 0.5);
    
    const flexiblePlayersForTeams = shuffledFlexibleCandidates.slice(0, flexibleCount);
    const playersForReserves = shuffledFlexibleCandidates.slice(flexibleCount);
    
    // Combine all players for teams
    const playersForTeams = [
        ...guaranteedTopPlayers,
        ...flexiblePlayersForTeams,
        ...guaranteedBottomPlayers
    ];
    
    // Step 2: Create tiers from selected team players
    const teamPlayersResorted = playersForTeams.sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    
    const highTierSize = numTeams;
    const lowTierSize = numTeams;
    const midTierSize = teamPlayersResorted.length - highTierSize - lowTierSize;
    
    const highTierPlayers = teamPlayersResorted.slice(0, highTierSize);
    const midTierPlayers = teamPlayersResorted.slice(highTierSize, highTierSize + midTierSize);
    const lowTierPlayers = teamPlayersResorted.slice(-lowTierSize);
    
    // Step 3: Single shuffle for each tier (much faster)
    const shuffledHighTier = [...highTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledMidTier = [...midTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledLowTier = [...lowTierPlayers].sort(() => Math.random() - 0.5);
    
    // Step 4: Distribute players efficiently
    for (let teamIndex = 0; teamIndex < numTeams; teamIndex++) {
        const team = window.teamBalancerData.balancedTeams[teamIndex];
        
        // Slot 1: High MMR player
        if (shuffledHighTier.length > 0) {
            const highPlayer = shuffledHighTier.shift();
            team.players.push(highPlayer);
            team.totalMmr += highPlayer.peakmmr || 0;
        }
        
        // Slot 5: Low MMR player
        if (shuffledLowTier.length > 0) {
            const lowPlayer = shuffledLowTier.shift();
            team.players.push(lowPlayer);
            team.totalMmr += lowPlayer.peakmmr || 0;
        }
    }
    
    // Step 5: Fill remaining slots efficiently
    let midTierIndex = 0;
    for (let teamIndex = 0; teamIndex < numTeams && midTierIndex < shuffledMidTier.length; teamIndex++) {
        const team = window.teamBalancerData.balancedTeams[teamIndex];
        while (team.players.length < teamSize && midTierIndex < shuffledMidTier.length) {
            const midPlayer = shuffledMidTier[midTierIndex++];
            team.players.push(midPlayer);
            team.totalMmr += midPlayer.peakmmr || 0;
        }
    }
    
    // Step 6: Return reserve players for proper state management
    return playersForReserves;
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
        window.teamBalancerData.balancedTeams[currentTeam].players.push(player);
        window.teamBalancerData.balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;

        // Move to next team (round-robin)
        currentTeam = (currentTeam + 1) % numTeams;
    }
    
    // Return any leftover players as reserves
    const maxPlayersForTeams = numTeams * teamSize;
    const leftoverPlayers = shuffledPlayers.slice(maxPlayersForTeams);
    return leftoverPlayers;
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
    
    if (!window.teamBalancerData.balancedTeams || window.teamBalancerData.balancedTeams.length === 0) {
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
                    Balanced Teams (${window.teamBalancerData.balancedTeams.length})
                </h5>
                <div class="btn-group" role="group">
                    <button id="load-teams-btn" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-folder2-open me-1"></i>Load
                    </button>
                    <button id="load-players-from-teams-btn" class="btn btn-sm btn-outline-info">
                        <i class="bi bi-arrow-left-circle me-1"></i>Load Players
                    </button>
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
                ${window.teamBalancerData.balancedTeams.map((team, teamIndex) => `
                    <div class="col-lg-3 col-md-6 col-12">
                        <div class="card border-primary shadow-sm">
                            <div class="card-header bg-primary text-white py-2">
                                <div class="row align-items-center">
                                    <div class="col-auto">
                                        <h6 class="mb-0 fw-bold">${escapeHtml(team.name)}</h6>
                                    </div>
                                    <div class="col text-end">
                                        <span class="badge bg-light text-dark">
                                            Avg MMR: ${Math.round(team.totalMmr / team.players.length)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover align-middle mb-0" style="table-layout: fixed; width: 100%;">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="fw-semibold" style="width: 70%;">Player</th>
                                                <th class="fw-semibold text-end" style="width: 30%;">MMR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${team.players.map((player, playerIndex) => `
                                                <tr class="${playerIndex % 2 === 0 ? 'table-light' : ''}">
                                                    <td class="fw-bold text-primary">${escapeHtml(player.name)}</td>
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

    // Update DOM immediately without delay
    teamsContainer.innerHTML = teamsHtml;
    
    // Note: Event listeners are handled by event delegation in setupTeamBalancerEventListeners
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
        const count = window.teamBalancerData.reservedPlayers ? window.teamBalancerData.reservedPlayers.length : 0;
        reservedCountElement.textContent = count;
    }
    
    if (!window.teamBalancerData.reservedPlayers || window.teamBalancerData.reservedPlayers.length === 0) {
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
    
    const reservedHtml = window.teamBalancerData.reservedPlayers.map((player, index) => `
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
    
    // Note: Event listeners are now handled by event delegation in setupTeamBalancerEventListeners
}

/**
 * Restore player from reserved list
 */
function restorePlayerFromReserved(playerIndex) {
    if (window.teamBalancerData.reservedPlayers && playerIndex >= 0 && playerIndex < window.teamBalancerData.reservedPlayers.length) {
        const player = window.teamBalancerData.reservedPlayers[playerIndex];
        
        // Remove from reserved
        window.teamBalancerData.reservedPlayers.splice(playerIndex, 1);
        
        // Add back to available
        window.teamBalancerData.availablePlayers.push(player);
        
        // Refresh displays
        displayPlayersForBalancer(window.teamBalancerData.availablePlayers);
        displayReservedPlayers();
        
        window.showNotification(`${player.name} restored to available players`, 'success');
    }
}

/**
 * Clear all teams
 */
function clearTeams(suppressNotification = false) {
    window.teamBalancerData.balancedTeams = [];
    
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
    if (!suppressNotification) {
        window.showNotification('Teams cleared', 'info');
    }
}

/**
 * Export teams to various formats
 */
function exportTeams() {
    if (!window.teamBalancerData.balancedTeams || window.teamBalancerData.balancedTeams.length === 0) {
        window.showNotification('No teams to export', 'warning');
        return;
    }
    
    // Create export data
    const exportData = {
        tournament: window.teamBalancerData.registrationSessions.find(s => s.sessionId === window.teamBalancerData.currentSessionId)?.title || 'Unknown Tournament',
        sessionId: window.teamBalancerData.currentSessionId,
        exportDate: new Date().toISOString(),
        totalTeams: window.teamBalancerData.balancedTeams.length,
        teams: window.teamBalancerData.balancedTeams.map((team, index) => ({
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
    link.download = `team-balance-${window.teamBalancerData.currentSessionId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);

    window.showNotification('Teams exported successfully', 'success');
}

/**
 * Save teams to database for tournament bracket use
 */
async function saveTeams() {
    if (window.isTeamBalancerLoading) {
        window.showNotification('Already saving teams...', 'warning');
        return;
    }
    if (window.teamBalancerData.balancedTeams.length === 0) {
        window.showNotification('No teams to save.', 'warning');
        return;
    }

    window.isTeamBalancerLoading = true;
    const saveButton = document.getElementById('save-teams-btn');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    }

    const currentSession = window.teamBalancerData.registrationSessions.find(s => s.sessionId === window.teamBalancerData.currentSessionId);
    const sessionTitle = currentSession ? currentSession.title : 'Balanced Teams';
    const teamSetTitle = `${sessionTitle} - ${new Date().toLocaleString()}`;


    const teamsPayload = {
        title: teamSetTitle,
        teams: window.teamBalancerData.balancedTeams,
        sourceSessionId: window.teamBalancerData.currentSessionId
    };

    try {
        const response = await fetchWithAuth('/.netlify/functions/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamsPayload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            window.showNotification('Teams saved successfully!', 'success');
            
            // Switch to the tournament bracket tab
            const tournamentTab = document.querySelector('a[href="#tournament-bracket"]');
            if (tournamentTab) {
                // Use Bootstrap's tab API to show the tab
                const tab = new bootstrap.Tab(tournamentTab);
                tab.show();
            }

        } else {
            throw new Error(result.message || 'Failed to save teams');
        }
    } catch (error) {
        console.error('Error saving teams:', error);
        window.showNotification(`Error: ${error.message}`, 'error');
    } finally {
        window.isTeamBalancerLoading = false;
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="bi bi-floppy me-1"></i>Save';
        }
    }
}

/**
 * Setup listener for registration updates
 * This allows the team balancer to refresh when registration settings change
 */
function setupTeamBalancerRegistrationListener() {
    window.teamBalancerRegistrationListener = function(event) {
        loadRegistrationSessions().then(() => {
            // Only reload players if the dropdown triggers it
            // No direct call to loadPlayersForBalancer here
            window.showNotification('Team balancer refreshed due to registration changes', 'info');
        });
    };
    window.addEventListener('registrationUpdated', window.teamBalancerRegistrationListener);
    window.refreshTeamBalancerData = function() {
        // Only trigger the session selector change event if a session is selected
        const selector = document.getElementById('team-balancer-session-selector');
        if (selector && selector.value) {
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }
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

// Expose functions globally for compatibility
window.teamBalancerModule = {
    initTeamBalancer,
    cleanupTeamBalancer,
    loadPlayersForBalancer,
    autoBalance,
    clearTeams,
    exportTeams,
    saveTeams,
    deleteSavedTeams,
    deleteTournamentSession,
    loadPlayersFromTeams
};

    // Expose init function globally for navigation system
window.initTeamBalancer = initTeamBalancer;

    // Expose cleanup function globally for navigation system
window.cleanupTeamBalancer = cleanupTeamBalancer;

/**
 * Load players from teams back into available players list
 */
function loadPlayersFromTeams() {
    if (!window.teamBalancerData.balancedTeams || window.teamBalancerData.balancedTeams.length === 0) {
        window.showNotification('No teams to load players from', 'warning');
        return;
    }

    // Extract all players from teams
    const playersFromTeams = window.teamBalancerData.balancedTeams.flatMap(team => team.players);
    
    if (playersFromTeams.length === 0) {
        window.showNotification('No players found in teams', 'warning');
        return;
    }

    // Add players to available players list (avoid duplicates)
    let addedCount = 0;
    playersFromTeams.forEach(player => {
        const existingPlayer = window.teamBalancerData.availablePlayers.find(p => p.id === player.id);
        if (!existingPlayer) {
            window.teamBalancerData.availablePlayers.push(player);
            addedCount++;
        }
    });

    // Clear teams since we're moving players back to available list
    window.teamBalancerData.balancedTeams = [];
    
    // Clear reserved players (they're now back in available)
    window.teamBalancerData.reservedPlayers = [];
    
    // Update all displays
    displayPlayersForBalancer(window.teamBalancerData.availablePlayers);
    displayReservedPlayers();
    displayBalancedTeams();
    
    window.showNotification(`Loaded ${addedCount} players from teams back to available list`, 'success');
}

/**
 * Deletes a registration session (tournament).
 * @param {string} sessionId The ID of the session to delete.
 * @param {HTMLElement} buttonElement The clicked button.
 */
async function deleteTournamentSession(sessionId, buttonElement) {
    if (!confirm('Are you sure you want to permanently delete this tournament? This will also delete all associated players and cannot be undone.')) {
        return;
    }

    try {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        const response = await fetchWithAuth(`/.netlify/functions/registration-sessions?sessionId=${sessionId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            window.showNotification('Tournament deleted successfully.', 'success');
            // Reload sessions to update the UI
            loadRegistrationSessions();
        } else {
            throw new Error(result.error || 'Failed to delete tournament.');
        }

    } catch (error) {
        console.error('Error deleting tournament session:', error);
        window.showNotification(error.message, 'error');
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<i class="bi bi-trash"></i>';
    }
}

// Utility function to sync dropdown to state
function syncSessionSelectorToState() {
    const selector = document.getElementById('team-balancer-session-selector');
    if (selector) {
        // Always sync state to the dropdown value, even if it's empty
        window.teamBalancerData.currentSessionId = selector.value;
    }
}

})();
