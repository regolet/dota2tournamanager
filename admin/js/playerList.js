// playerList.js - Handles player list management functionality
// Used by player-list.html

// Module state object to avoid variable redeclaration conflicts
if (!window.playerListState) {
    window.playerListState = {};
}

// Player List Management with Registration Session Support

let currentUser = null;
let currentSessionId = null;
let registrationSessions = [];
let allPlayers = [];

// Utility function: showNotification
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

/**
 * Initialize the Player List module
 */
async function initPlayerList() {
    try {
        // Get current user info from session manager
        currentUser = window.sessionManager?.getUserInfo();
        
        // Create session selector UI
        await createSessionSelector();
        
        // Load registration sessions
        await loadRegistrationSessions();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('Player list module initialized successfully');
    } catch (error) {
        console.error('Error initializing player list:', error);
        showNotification('Failed to initialize player list module', 'error');
    }
}

/**
 * Create session selector UI
 */
async function createSessionSelector() {
    const playerListContainer = document.getElementById('player-list') || 
                                document.getElementById('main-content');
    
    if (!playerListContainer) {
        // Create the player list section if it doesn't exist
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <section id="player-list" class="mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2 class="h3 mb-0">
                            <i class="bi bi-people-fill me-2"></i>Player List Management
                        </h2>
                        <div class="btn-group">
                            <button type="button" class="btn btn-primary me-2" id="add-player-button">
                                <i class="bi bi-person-plus-fill me-1"></i> Add Player
                            </button>
                            <button type="button" class="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#playerListHelpModal">
                                <i class="bi bi-question-circle me-1"></i> Help
                            </button>
                        </div>
                    </div>

                    <!-- Session Selector -->
                    <div class="card shadow-sm mb-4">
                        <div class="card-body p-3">
                            <div class="row align-items-center">
                                <div class="col-md-6">
                                    <div class="d-flex align-items-center">
                                        <i class="bi bi-filter-circle me-2 text-primary"></i>
                                        <label for="session-selector" class="form-label mb-0 me-3">Tournament:</label>
                                        <select id="session-selector" class="form-select" style="max-width: 300px;">
                                            <option value="">Loading sessions...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6 text-end">
                                    <button id="refresh-sessions" class="btn btn-outline-primary btn-sm me-2">
                                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                                    </button>
                                    <span id="session-player-count" class="badge bg-secondary">0 players</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Player List Controls -->
                    <div class="card shadow-sm mb-4">
                        <div class="card-body p-3">
                            <div class="row align-items-center">
                                <div class="col-md-6">
                                    <div class="input-group">
                                        <span class="input-group-text">
                                            <i class="bi bi-search"></i>
                                        </span>
                                        <input type="text" class="form-control" id="player-search" 
                                               placeholder="Search players by name or Dota 2 ID...">
                                        <button id="search-button" class="btn btn-outline-secondary" type="button">
                                            <i class="bi bi-funnel"></i> Filter
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6 d-flex justify-content-md-end">
                                    <div class="btn-group">
                                        <button id="refresh-player-list" class="btn btn-outline-primary">
                                            <i class="bi bi-arrow-clockwise me-1"></i> Refresh List
                                        </button>
                                        <button type="button" class="btn btn-outline-danger me-2" id="remove-all-players-button">
                                            <i class="bi bi-trash me-1"></i> Remove All Players
                                        </button>
                                        <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                            <i class="bi bi-download me-1"></i> Export
                                        </button>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li><a class="dropdown-item" href="#" id="export-csv">CSV</a></li>
                                            <li><a class="dropdown-item" href="#" id="export-json">JSON</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item" href="#" id="export-print">Print List</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Player List Table -->
                    <div class="card shadow-sm border-0">
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover align-middle mb-0">
                                    <thead class="table-dark">
                                        <tr>
                                            <th class="ps-3">Player</th>
                                            <th class="text-center">MMR</th>
                                            <th>Dota 2 ID</th>
                                            <th>Tournament</th>
                                            <th>ID</th>
                                            <th>Registered</th>
                                            <th class="text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="player-table-body" class="border-top-0">
                                        <tr>
                                            <td colspan="7" class="text-center py-5">
                                                <div class="text-muted">
                                                    <i class="bi bi-people display-6 d-block mb-3 opacity-25"></i>
                                                    <h5>Select a tournament to view players</h5>
                                                    <p class="mb-0">Choose a tournament from the dropdown above</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }
    }
}

/**
 * Load registration sessions for the session selector
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
    const selector = document.getElementById('session-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">All Tournaments</option>';

    // Sort sessions by creation date (newest first)
    const sortedSessions = [...registrationSessions].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.sessionId;
        option.textContent = `${session.title} (${session.playerCount}/${session.maxPlayers})`;
        if (!session.isActive) {
            option.textContent += ' [Inactive]';
            option.disabled = true;
        }
        selector.appendChild(option);
    });

    // Auto-select the latest (most recent) tournament if available
    if (sortedSessions.length > 0) {
        const latestSession = sortedSessions[0];
        selector.value = latestSession.sessionId;
        currentSessionId = latestSession.sessionId;
        
        // Load players for the selected session
        loadPlayers();
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Session selector change
    const sessionSelector = document.getElementById('session-selector');
    if (sessionSelector) {
        sessionSelector.addEventListener('change', async (e) => {
            currentSessionId = e.target.value || null;
            await loadPlayers();
        });
    }

    // Refresh sessions button
    const refreshSessionsBtn = document.getElementById('refresh-sessions');
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', loadRegistrationSessions);
    }

    // Refresh players button
    const refreshPlayersBtn = document.getElementById('refresh-player-list');
    if (refreshPlayersBtn) {
        refreshPlayersBtn.addEventListener('click', () => loadPlayers(true));
    }

    // Search functionality
    const searchInput = document.getElementById('player-search');
    if (searchInput) {
        searchInput.addEventListener('input', handlePlayerSearch);
    }

    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', handlePlayerSearch);
    }

    // Add player button
    const addPlayerBtn = document.getElementById('add-player-button');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', showAddPlayerModal);
    }

    // Remove all players button
    const removeAllBtn = document.getElementById('remove-all-players-button');
    if (removeAllBtn) {
        removeAllBtn.addEventListener('click', confirmRemoveAllPlayers);
    }

    // Export buttons
    const exportCsvBtn = document.getElementById('export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportPlayersCSV);
    }

    const exportJsonBtn = document.getElementById('export-json');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportPlayersJSON);
    }
}

/**
 * Load players from the API
 */
async function loadPlayers(forceRefresh = false) {
    try {
        const playerTableBody = document.getElementById('player-table-body');
        const sessionPlayerCount = document.getElementById('session-player-count');
        
        if (playerTableBody) {
            // Show loading state
            playerTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        Loading players...
                    </td>
                </tr>
            `;
        }

        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Build API URL with session filter
        let apiUrl = '/.netlify/functions/api-players?includeSessionInfo=true';
        if (currentSessionId) {
            apiUrl += `&sessionId=${currentSessionId}`;
        }

        const response = await fetch(apiUrl, {
            headers: {
                'x-session-id': sessionId
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.players)) {
            allPlayers = data.players;
            displayPlayers(allPlayers);
            
            // Update player count badge
            if (sessionPlayerCount) {
                sessionPlayerCount.textContent = `${allPlayers.length} players`;
            }
        } else {
            allPlayers = [];
            displayPlayers([]);
            
            if (sessionPlayerCount) {
                sessionPlayerCount.textContent = '0 players';
            }
        }

    } catch (error) {
        console.error('Error loading players:', error);
        const playerTableBody = document.getElementById('player-table-body');
        
        if (playerTableBody) {
            playerTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Error loading players: ${error.message}
                    </td>
                </tr>
            `;
        }
        showNotification('Failed to load players', 'error');
    }
}

/**
 * Display players in the table
 */
function displayPlayers(players) {
    const playerTableBody = document.getElementById('player-table-body');
    
    if (!playerTableBody) return;
    
    // Clear the table body
    playerTableBody.innerHTML = '';
    
    // If no players, show appropriate message
    if (!players || players.length === 0) {
        const message = currentSessionId ? 
            'No players registered for this tournament yet' : 
            'Select a tournament to view players';
        
        playerTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <div class="text-muted">
                        <i class="bi bi-people display-6 d-block mb-3 opacity-25"></i>
                        <h5>${message}</h5>
                        <p class="mb-0">${currentSessionId ? 'Players will appear here as they register' : 'Choose a tournament from the dropdown above'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add each player to the table
    players.forEach((player, index) => {
        const registrationDate = player.registrationDate ? 
            new Date(player.registrationDate).toLocaleString() : 'N/A';
        const playerId = player.id || `player_${index}`;
        const tournamentName = player.sessionTitle || 'Legacy';
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="px-3">
                <div class="d-flex align-items-center">
                    <div class="avatar avatar-sm bg-primary-subtle text-primary rounded-circle me-2">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="fw-bold">${escapeHtml(player.name || 'Unknown')}</div>
                </div>
            </td>
            <td class="text-center px-3">
                <span class="badge bg-primary">${player.peakmmr || 0}</span>
            </td>
            <td class="px-3">${escapeHtml(player.dota2id || 'N/A')}</td>
            <td class="px-3">
                <small class="text-muted">${escapeHtml(tournamentName)}</small>
            </td>
            <td class="px-3">
                <span class="badge bg-light text-dark">${escapeHtml(playerId)}</span>
            </td>
            <td class="px-3">
                <small class="text-muted">${registrationDate}</small>
            </td>
            <td class="text-center px-3">
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary edit-player" 
                            data-id="${player.id}" data-index="${index}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger delete-player" 
                            data-id="${player.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        playerTableBody.appendChild(row);
    });
    
    // Set up action buttons after all rows are added
    setupPlayerActionButtons();
}

/**
 * Handle player search
 */
function handlePlayerSearch() {
    const searchInput = document.getElementById('player-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!allPlayers || !Array.isArray(allPlayers)) {
        return;
    }
    
    // Filter players based on search term
    const filteredPlayers = allPlayers.filter(player => {
        return (
            (player.name && player.name.toLowerCase().includes(searchTerm)) ||
            (player.dota2id && player.dota2id.toString().toLowerCase().includes(searchTerm)) ||
            (player.id && player.id.toString().toLowerCase().includes(searchTerm))
        );
    });
    
    // Display filtered players
    displayPlayers(filteredPlayers);
    
    // Update player count
    const sessionPlayerCount = document.getElementById('session-player-count');
    if (sessionPlayerCount) {
        sessionPlayerCount.textContent = `${filteredPlayers.length} players`;
    }
}

/**
 * Setup player action buttons
 */
function setupPlayerActionButtons() {
    // Edit buttons
    document.querySelectorAll('.edit-player').forEach(button => {
        button.addEventListener('click', function() {
            const playerId = this.getAttribute('data-id');
            const playerIndex = this.getAttribute('data-index');
            editPlayer(playerId, playerIndex);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-player').forEach(button => {
        button.addEventListener('click', function() {
            const playerId = this.getAttribute('data-id');
            deletePlayer(playerId);
        });
    });
}

/**
 * Show add player modal
 */
function showAddPlayerModal() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        return;
    }
    
    // Implementation for add player modal
    // This would show a modal to add a new player to the current session
    console.log('Show add player modal for session:', currentSessionId);
}

/**
 * Edit player
 */
function editPlayer(playerId, playerIndex) {
    // Implementation for edit player
    console.log('Edit player:', playerId, playerIndex);
}

/**
 * Delete player
 */
async function deletePlayer(playerId) {
    if (!confirm('Are you sure you want to delete this player?')) {
        return;
    }
    
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        const response = await fetch('/.netlify/functions/api-players', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId
            },
            body: JSON.stringify({ playerId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Player deleted successfully', 'success');
            await loadPlayers();
        } else {
            showNotification(data.message || 'Failed to delete player', 'error');
        }
    } catch (error) {
        console.error('Error deleting player:', error);
        showNotification('Error deleting player', 'error');
    }
}

/**
 * Confirm remove all players
 */
function confirmRemoveAllPlayers() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to remove ALL players from this tournament? This action cannot be undone.')) {
        return;
    }
    
    // Implementation for removing all players from current session
    console.log('Remove all players from session:', currentSessionId);
}

/**
 * Export players to CSV
 */
function exportPlayersCSV() {
    if (!allPlayers || allPlayers.length === 0) {
        showNotification('No players to export', 'warning');
        return;
    }
    
    // Implementation for CSV export
    console.log('Export CSV');
}

/**
 * Export players to JSON
 */
function exportPlayersJSON() {
    if (!allPlayers || allPlayers.length === 0) {
        showNotification('No players to export', 'warning');
        return;
    }
    
    // Implementation for JSON export
    console.log('Export JSON');
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPlayerList);

// Expose functions globally for compatibility
window.playerListModule = {
    initPlayerList,
    loadPlayers,
    displayPlayers,
    handlePlayerSearch
};

// Expose init function globally for navigation system
window.initPlayerList = initPlayerList;

