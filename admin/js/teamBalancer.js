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

// Team Balancer with Registration Session Support

let currentSessionId = null;
let registrationSessions = [];
let availablePlayers = [];
let balancedTeams = [];

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
            registrationSessions = data.sessions;
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

    registrationSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.sessionId;
        option.textContent = `${session.title} (${session.playerCount} players)`;
        if (!session.isActive) {
            option.textContent += ' [Inactive]';
        }
        selector.appendChild(option);
    });
}

/**
 * Setup team balancer event listeners
 */
function setupTeamBalancerEventListeners() {
    // Session selector change
    const sessionSelector = document.getElementById('team-balancer-session-selector');
    if (sessionSelector) {
        sessionSelector.addEventListener('change', async (e) => {
            currentSessionId = e.target.value || null;
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

    // Auto Balance button
    const autoBalanceBtn = document.getElementById('auto-balance-btn') || 
                          document.querySelector('[onclick="autoBalance()"]');
    if (autoBalanceBtn) {
        autoBalanceBtn.removeAttribute('onclick');
        autoBalanceBtn.addEventListener('click', autoBalance);
    }

    // Clear Teams button
    const clearTeamsBtn = document.getElementById('clear-teams-btn') || 
                         document.querySelector('[onclick="clearTeams()"]');
    if (clearTeamsBtn) {
        clearTeamsBtn.removeAttribute('onclick');
        clearTeamsBtn.addEventListener('click', clearTeams);
    }

    // Export Teams button
    const exportTeamsBtn = document.getElementById('export-teams-btn') || 
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
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        
        // Clear player display
        const playersContainer = document.getElementById('players-container') || 
                                document.querySelector('.players-container');
        if (playersContainer) {
            playersContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Please select a tournament from the dropdown above to load players.
                </div>
            `;
        }
        return;
    }

    try {
        // Show loading state
        const playersContainer = document.getElementById('players-container') || 
                                document.querySelector('.players-container');
        if (playersContainer) {
            playersContainer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Loading players from tournament...
                </div>
            `;
        }

        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Load players for the specific session
        const response = await fetch(`/.netlify/functions/api-players?sessionId=${currentSessionId}`, {
            headers: {
                'x-session-id': sessionId
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.players)) {
            availablePlayers = data.players.map(player => ({
                id: player.id,
                name: player.name,
                peakmmr: player.peakmmr || 0,
                dota2id: player.dota2id
            }));

            displayPlayersForBalancer(availablePlayers);
            
            // Update player count
            const playerCountBadge = document.getElementById('balancer-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = `${availablePlayers.length} players`;
            }

            showNotification(`Loaded ${availablePlayers.length} players from tournament`, 'success');
        } else {
            availablePlayers = [];
            displayPlayersForBalancer([]);
            
            const playerCountBadge = document.getElementById('balancer-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = '0 players';
            }
        }

    } catch (error) {
        console.error('Error loading players for balancer:', error);
        
        const playersContainer = document.getElementById('players-container') || 
                                document.querySelector('.players-container');
        if (playersContainer) {
            playersContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error loading players: ${error.message}
                </div>
            `;
        }
        
        showNotification('Failed to load players for team balancer', 'error');
    }
}

/**
 * Display players for the team balancer
 */
function displayPlayersForBalancer(players) {
    const playersContainer = document.getElementById('players-container') || 
                            document.querySelector('.players-container');
    
    if (!playersContainer) {
        console.error('Players container not found');
        return;
    }

    if (!players || players.length === 0) {
        playersContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                ${currentSessionId ? 'No players found in this tournament.' : 'Please select a tournament to load players.'}
            </div>
        `;
        return;
    }

    // Sort players by MMR (highest first)
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));

    const playersHtml = `
        <div class="row">
            <div class="col-12">
                <h5 class="mb-3">
                    <i class="bi bi-people me-2"></i>
                    Available Players (${players.length})
                </h5>
                <div class="row">
                    ${sortedPlayers.map(player => `
                        <div class="col-md-6 col-lg-4 mb-2">
                            <div class="card h-100 player-card" data-player-id="${player.id}">
                                <div class="card-body p-2">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="fw-bold small">${escapeHtml(player.name)}</div>
                                            <small class="text-muted">${player.dota2id || 'N/A'}</small>
                                        </div>
                                        <span class="badge bg-primary">${player.peakmmr || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    playersContainer.innerHTML = playersHtml;
}

/**
 * Auto balance teams based on MMR
 */
function autoBalance() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        return;
    }

    if (!availablePlayers || availablePlayers.length === 0) {
        showNotification('Please load players first', 'warning');
        return;
    }

    if (availablePlayers.length < 10) {
        showNotification('Need at least 10 players to create balanced teams', 'warning');
        return;
    }

    try {
        // Get team size from input or default to 5
        const teamSizeInput = document.getElementById('team-size-input') || 
                             document.querySelector('input[name="team-size"]');
        const teamSize = teamSizeInput ? parseInt(teamSizeInput.value) || 5 : 5;

        // Shuffle players randomly first
        const shuffledPlayers = [...availablePlayers].sort(() => Math.random() - 0.5);
        
        // Sort by MMR (descending)
        const sortedPlayers = shuffledPlayers.sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));

        // Calculate number of complete teams
        const numTeams = Math.floor(sortedPlayers.length / teamSize);
        
        if (numTeams < 2) {
            showNotification(`Need at least ${teamSize * 2} players to create 2 teams of ${teamSize}`, 'warning');
            return;
        }

        // Initialize teams
        balancedTeams = Array.from({ length: numTeams }, () => ({
            players: [],
            totalMmr: 0
        }));

        // Distribute players using snake draft method
        let currentTeam = 0;
        let direction = 1; // 1 for forward, -1 for backward

        for (let i = 0; i < sortedPlayers.length && i < numTeams * teamSize; i++) {
            const player = sortedPlayers[i];
            balancedTeams[currentTeam].players.push(player);
            balancedTeams[currentTeam].totalMmr += player.peakmmr || 0;

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

        // Display balanced teams
        displayBalancedTeams();

        showNotification(`Created ${numTeams} balanced teams!`, 'success');

    } catch (error) {
        console.error('Error in auto balance:', error);
        showNotification('Error creating balanced teams', 'error');
    }
}

/**
 * Display balanced teams
 */
function displayBalancedTeams() {
    const teamsContainer = document.getElementById('teams-container') || 
                          document.querySelector('.teams-container');
    
    if (!teamsContainer) {
        console.error('Teams container not found');
        return;
    }

    if (!balancedTeams || balancedTeams.length === 0) {
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
                    Balanced Teams (${balancedTeams.length})
                </h5>
            </div>
            ${balancedTeams.map((team, teamIndex) => `
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
 * Clear all teams
 */
function clearTeams() {
    balancedTeams = [];
    
    const teamsContainer = document.getElementById('teams-container') || 
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
    if (!balancedTeams || balancedTeams.length === 0) {
        showNotification('No teams to export', 'warning');
        return;
    }

    // Create export data
    const exportData = {
        tournament: registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament',
        sessionId: currentSessionId,
        exportDate: new Date().toISOString(),
        totalTeams: balancedTeams.length,
        teams: balancedTeams.map((team, index) => ({
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
    link.download = `team-balance-${currentSessionId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);

    showNotification('Teams exported successfully', 'success');
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
document.addEventListener('DOMContentLoaded', initTeamBalancer);

// Expose functions globally for compatibility
window.teamBalancerModule = {
    initTeamBalancer,
    loadPlayersForBalancer,
    autoBalance,
    clearTeams,
    exportTeams
};

// Legacy global functions for existing onclick handlers
window.loadPlayers = loadPlayersForBalancer;
window.autoBalance = autoBalance;
window.clearTeams = clearTeams;
window.exportTeams = exportTeams;
