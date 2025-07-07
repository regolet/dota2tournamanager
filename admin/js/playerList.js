// playerList.js - Handles player list management functionality
// Used by player-list.html

// Module state object to avoid variable redeclaration conflicts
if (!window.playerListState) {
    window.playerListState = {};
}

// Player List Management with Registration Session Support

// Guard against redeclaration for SPA navigation
if (typeof window.playerListCurrentUser === 'undefined') {
    window.playerListCurrentUser = null;
}
if (typeof window.playerListCurrentSessionId === 'undefined') {
    window.playerListCurrentSessionId = null;
}
if (typeof window.playerListRegistrationSessions === 'undefined') {
    window.playerListRegistrationSessions = [];
}
if (typeof window.playerListAllPlayers === 'undefined') {
    window.playerListAllPlayers = [];
}
if (typeof window.playerListLastLoadedPlayerCount === 'undefined') {
    window.playerListLastLoadedPlayerCount = null;
}

// Use the global variables to avoid redeclaration
if (typeof currentUser === 'undefined') {
    var currentUser = window.playerListCurrentUser;
}
if (typeof currentSessionId === 'undefined') {
    var currentSessionId = window.playerListCurrentSessionId;
}
if (typeof registrationSessions === 'undefined') {
    var registrationSessions = window.playerListRegistrationSessions;
}
if (typeof allPlayers === 'undefined') {
    var allPlayers = window.playerListAllPlayers;
}
if (typeof lastLoadedPlayerCount === 'undefined') {
    var lastLoadedPlayerCount = window.playerListLastLoadedPlayerCount;
}

// Add fetchWithAuth function if not already available
if (typeof fetchWithAuth === 'undefined') {
    async function fetchWithAuth(url, options = {}) {
        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            
            if (!sessionId) {
                throw new Error('No session ID found. Please login again.');
            }

            if (!options.headers) {
                options.headers = {};
            }
            options.headers['x-session-id'] = sessionId;

            const response = await fetch(url, options);
            
            // Handle different response types
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                }

                // Handle specific error cases
                if (response.status === 401) {
                    window.showNotification('Session expired. Please login again.', 'error');
                    // Redirect to login after a delay
                    setTimeout(() => {
                        window.location.href = '/admin/login.html';
                    }, 2000);
                    throw new Error('Session expired');
                } else if (response.status === 403) {
                    window.showNotification('Access denied. You do not have permission for this action.', 'warning');
                    throw new Error('Access denied');
                } else if (response.status === 404) {
                    window.showNotification('Resource not found. Please check the URL.', 'error');
                    throw new Error('Resource not found');
                } else if (response.status >= 500) {
                    window.showNotification('Server error. Please try again later.', 'error');
                    throw new Error('Server error');
                }

                throw new Error(errorMessage);
            }

            // Try to parse JSON response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return response;
            }
        } catch (error) {
            console.error('fetchWithAuth error:', error);
            
            // Show user-friendly error message
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                window.showNotification('Network error. Please check your connection.', 'error');
            } else if (!error.message.includes('Session expired') && !error.message.includes('Access denied')) {
                window.showNotification(`Request failed: ${error.message}`, 'error');
            }
            
            throw error;
        }
    }
}

// Add to module state:
if (!window.playerListSortState) {
    window.playerListSortState = { field: 'name', direction: 'asc' };
}

function getSortValue(player, field) {
    switch (field) {
        case 'name': return (player.name || '').toLowerCase();
        case 'peakmmr': return Number(player.peakmmr) || 0;
        case 'dota2id': return player.dota2id || '';
        case 'tournament': return (player.sessionTitle || '').toLowerCase();
        case 'id': return player.id || '';
        case 'registered': return player.registrationDate || '';
        case 'status': return player.present ? 1 : 0;
        default: return '';
    }
}

function sortPlayers(players, field, direction) {
    return players.slice().sort((a, b) => {
        const vA = getSortValue(a, field);
        const vB = getSortValue(b, field);
        if (vA < vB) return direction === 'asc' ? -1 : 1;
        if (vA > vB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Initialize the Player List module
 */
async function initPlayerList() {
    try {
        // Always re-initialize when called (for tab switching)
        // Reset state to ensure fresh start
        window.playerListCurrentSessionId = null;
        window.playerListRegistrationSessions = [];
        window.playerListAllPlayers = [];
        window.playerListLastLoadedPlayerCount = null;
        
        // Sync local variables with global ones
        syncLocalVariables();
        
        // Get current user info from session manager
        currentUser = window.sessionManager?.getUserInfo();
        window.playerListCurrentUser = currentUser;
        
        // Create session selector UI
        await createSessionSelector();
        
        // Load registration sessions
        await loadRegistrationSessions();
        
        // Setup event listeners
        setupEventListeners();
        
        // Listen for registration updates to refresh player data
        setupRegistrationUpdateListener();
    } catch (error) {
        console.error('❌ Player List: Error initializing:', error);
        window.showNotification('Failed to initialize player list module', 'error');
    }
}

/**
 * Sync local variables with global ones
 */
function syncLocalVariables() {
    currentSessionId = window.playerListCurrentSessionId;
    registrationSessions = window.playerListRegistrationSessions;
    allPlayers = window.playerListAllPlayers;
    lastLoadedPlayerCount = window.playerListLastLoadedPlayerCount;
}

/**
 * Update both local and global variables
 */
function updateVariable(name, value) {
    switch(name) {
        case 'currentSessionId':
            currentSessionId = value;
            window.playerListCurrentSessionId = value;
            break;
        case 'registrationSessions':
            registrationSessions = value;
            window.playerListRegistrationSessions = value;
            break;
        case 'allPlayers':
            allPlayers = value;
            window.playerListAllPlayers = value;
            break;
        case 'lastLoadedPlayerCount':
            lastLoadedPlayerCount = value;
            window.playerListLastLoadedPlayerCount = value;
            break;
        case 'currentUser':
            currentUser = value;
            window.playerListCurrentUser = value;
            break;
    }
}

/**
 * Create session selector UI
 */
async function createSessionSelector() {
    // Check if session selector already exists
    const existingSelector = document.getElementById('session-selector');
    if (existingSelector) {
        return;
    }
    
    const playerListContainer = document.getElementById('player-list') || 
                                document.getElementById('main-content');
    
    if (!playerListContainer) {
        return;
    }
    
    // If the player list section doesn't exist, we might be using the template
    const playerListSection = document.getElementById('player-list');
    if (!playerListSection) {
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
                                            <th>Status</th>
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
 * Load registration sessions for player list
 */
async function loadRegistrationSessions() {
    try {
        const data = await fetchWithAuth('/.netlify/functions/registration-sessions');

        if (data && data.success && data.sessions) {
            updateVariable('registrationSessions', data.sessions);
            updateSessionSelector();
        } else {
            window.showNotification(data.message || 'Failed to load registration sessions', 'error');
        }
    } catch (error) {
        console.error('Error loading registration sessions:', error);
        window.showNotification('Error loading registration sessions', 'error');
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
        updateVariable('currentSessionId', latestSession.sessionId);
        // Trigger change event so handler runs
        selector.dispatchEvent(new Event('change', { bubbles: true }));
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
            updateVariable('currentSessionId', e.target.value || null);
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

    // Save player changes button
    const savePlayerChangesBtn = document.getElementById('save-player-changes');
    if (savePlayerChangesBtn) {
        savePlayerChangesBtn.addEventListener('click', savePlayerChanges);
    }

    // Save new player button
    const saveNewPlayerBtn = document.getElementById('save-new-player-button');
    if (saveNewPlayerBtn) {
        saveNewPlayerBtn.addEventListener('click', saveNewPlayer);
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

        // Build API URL with session filter
        let apiUrl = '/.netlify/functions/api-players?includeSessionInfo=true&limit=500';
        if (currentSessionId) {
            apiUrl += `&sessionId=${currentSessionId}`;
        }

        const data = await fetchWithAuth(apiUrl);

        if (data.success && Array.isArray(data.players)) {
            updateVariable('allPlayers', data.players);
            displayPlayers(allPlayers);
            
            // Update player count badge
            if (sessionPlayerCount) {
                sessionPlayerCount.textContent = `${allPlayers.length} players`;
            }
            if (allPlayers.length !== lastLoadedPlayerCount) {
                window.showNotification(`Loaded ${allPlayers.length} players`, 'success');
                updateVariable('lastLoadedPlayerCount', allPlayers.length);
            }
        } else {
            updateVariable('allPlayers', []);
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
        window.showNotification('Failed to load players', 'error');
    }
}

/**
 * Display players in the table
 */
function displayPlayers(players) {
    const sortState = window.playerListSortState;
    players = sortPlayers(players, sortState.field, sortState.direction);
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
            formatDateWithTimezone(player.registrationDate) : 'N/A';
        const playerId = player.id || `player_${index}`;
        const tournamentName = player.sessionTitle || 'Legacy';
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="px-3">
                <div class="d-flex align-items-center">
                    <div class="badge bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                         style="width: 32px; height: 32px; font-size: 0.85rem; font-weight: bold;">
                        ${index + 1}
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
            <td class="px-3">
                <span class="badge ${player.present ? 'bg-success' : 'bg-secondary'}">${player.present ? 'Present' : 'Absent'}</span>
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
    
    // Call setupPlayerTableSort and updateSortIcons after table render
    setupPlayerTableSort();
    updateSortIcons();
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
        window.showNotification('Please select a tournament first', 'warning');
            return;
        }
        
    // Clear the form fields
    document.getElementById('add-player-name').value = '';
    document.getElementById('add-player-dota2id').value = '';
    document.getElementById('add-player-peakmmr').value = '';
    
    // Show the modal
    const addModal = document.getElementById('add-player-modal');
    if (addModal) {
        const modal = new bootstrap.Modal(addModal);
        modal.show();
    } else {
        window.showNotification('Add player modal not found', 'error');
    }
}

/**
 * Save new player
 */
async function saveNewPlayer() {
    const playerName = document.getElementById('add-player-name').value?.trim();
    const playerDota2id = document.getElementById('add-player-dota2id').value?.trim();
    const playerPeakmmr = document.getElementById('add-player-peakmmr').value;

    // Validate required fields
    if (!playerName) {
        window.showNotification('Player name is required', 'warning');
        return;
    }

    if (!playerDota2id) {
        window.showNotification('Dota 2 ID is required', 'warning');
        return;
    }

    if (!currentSessionId) {
        window.showNotification('Please select a tournament first', 'warning');
        return;
    }

    const saveButton = document.getElementById('save-new-player-button');
    const originalText = saveButton ? saveButton.innerHTML : '';

    try {
        // Show loading state
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Adding...';
        }

        const newPlayerData = {
            name: playerName,
            dota2id: playerDota2id,
            peakmmr: parseInt(playerPeakmmr) || 0,
            registrationSessionId: currentSessionId
        };

        const data = await fetchWithAuth('/.netlify/functions/add-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newPlayerData)
        });

        if (data.success) {
            window.showNotification('Player added successfully', 'success');
            
            // Close the modal
            const addModal = document.getElementById('add-player-modal');
            if (addModal) {
                const modal = bootstrap.Modal.getInstance(addModal);
                if (modal) {
                    modal.hide();
                }
            }
            
            // Clear the form
            document.getElementById('add-player-name').value = '';
            document.getElementById('add-player-dota2id').value = '';
            document.getElementById('add-player-peakmmr').value = '';
            
            // Reload the player list
            await loadPlayers(true);
        } else {
            window.showNotification(data.message || 'Failed to add player', 'error');
        }
        
    } catch (error) {
        console.error('Error adding player:', error);
        window.showNotification('Error adding player: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }
}

/**
 * Edit player
 */
function editPlayer(playerId, playerIndex) {
    if (!allPlayers || !Array.isArray(allPlayers)) {
        window.showNotification('No player data available', 'error');
        return;
    }
    
    // Find the player by ID
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) {
        window.showNotification('Player not found', 'error');
            return;
        }
        
    // Populate the edit modal with player data
    document.getElementById('edit-player-id').value = player.id;
    document.getElementById('edit-player-index').value = playerIndex;
    document.getElementById('edit-player-name').value = player.name || '';
    document.getElementById('edit-player-dota2id').value = player.dota2id || '';
    document.getElementById('edit-player-peakmmr').value = player.peakmmr || '';
    document.getElementById('edit-player-registration-date').value = 
        player.registrationDate ? new Date(player.registrationDate).toLocaleString() : 'N/A';
    
    // Show the edit modal
    const editModal = document.getElementById('edit-player-modal');
    if (editModal) {
        const modal = new bootstrap.Modal(editModal);
        modal.show();
    } else {
        window.showNotification('Edit modal not found', 'error');
    }
}

/**
 * Save player changes
 */
async function savePlayerChanges() {
    const playerId = document.getElementById('edit-player-id').value;
    const playerName = document.getElementById('edit-player-name').value?.trim();
    const playerDota2id = document.getElementById('edit-player-dota2id').value?.trim();
    const playerPeakmmr = document.getElementById('edit-player-peakmmr').value;

    // Validate required fields
    if (!playerName) {
        window.showNotification('Player name is required', 'warning');
        return;
    }

    if (!playerDota2id) {
        window.showNotification('Dota 2 ID is required', 'warning');
            return;
    }

    const saveButton = document.getElementById('save-player-changes');
    const originalText = saveButton ? saveButton.innerHTML : '';

    try {
        // Show loading state
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Saving...';
        }

        const updateData = {
            playerId: playerId,
            name: playerName,
            dota2id: playerDota2id,
            peakmmr: parseInt(playerPeakmmr) || 0
        };

        const data = await fetchWithAuth('/.netlify/functions/api-players', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (data.success) {
            window.showNotification('Player updated successfully', 'success');
            
            // Close the modal
            const editModal = document.getElementById('edit-player-modal');
            if (editModal) {
                const modal = bootstrap.Modal.getInstance(editModal);
                if (modal) {
                    modal.hide();
                }
            }
            
            // Reload the player list
            await loadPlayers(true);
        } else {
            window.showNotification(data.message || 'Failed to update player', 'error');
        }

    } catch (error) {
        console.error('Error updating player:', error);
        window.showNotification('Error updating player: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }
}

/**
 * Delete player
 */
async function deletePlayer(playerId) {
    if (!confirm('Are you sure you want to delete this player?')) {
        return;
    }
    
    try {
        const data = await fetchWithAuth('/.netlify/functions/api-players', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerId })
        });
        
        if (data.success) {
            window.showNotification('Player deleted successfully', 'success');
            await loadPlayers();
        } else {
            window.showNotification(data.message || 'Failed to delete player', 'error');
        }
    } catch (error) {
        console.error('Error deleting player:', error);
        window.showNotification('Error deleting player', 'error');
    }
}

/**
 * Confirm remove all players
 */
async function confirmRemoveAllPlayers() {
    if (!currentSessionId) {
        window.showNotification('Please select a tournament first', 'warning');
        return;
    }
    
    if (!allPlayers || allPlayers.length === 0) {
        window.showNotification('No players to remove in this tournament', 'info');
        return;
    }
    
    const playerCount = allPlayers.length;
    const confirmed = confirm(`Are you sure you want to remove ALL ${playerCount} players from this tournament? This action cannot be undone.`);
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Show loading notification
        window.showNotification('Removing all players...', 'info');

        const data = await fetchWithAuth('/.netlify/functions/api-players', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'removeAll',
                sessionId: currentSessionId 
            })
        });

        if (data.success) {
            window.showNotification(`Successfully removed ${playerCount} players`, 'success');
            await loadPlayers(true);
        } else {
            window.showNotification(data.message || 'Failed to remove players', 'error');
        }

    } catch (error) {
        console.error('Error removing all players:', error);
        window.showNotification('Error removing players: ' + error.message, 'error');
    }
}

/**
 * Format date with timezone information
 */
function formatDateWithTimezone(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string in formatDateWithTimezone:', dateString);
            return 'Invalid date';
        }
        
        // Use consistent timezone formatting
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            timeZoneName: 'short'
        };
        
        return date.toLocaleString(undefined, options);
    } catch (error) {
        console.error('Error formatting date with timezone:', error, dateString);
        return 'Invalid date';
    }
}

/**
 * Export players to CSV
 */
function exportPlayersCSV() {
    if (!allPlayers || allPlayers.length === 0) {
        window.showNotification('No players to export', 'warning');
            return;
        }
        
    const tournamentName = currentSessionId ? 
        (registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament') :
        'All Tournaments';
    
    // Create CSV headers
    const headers = ['Name', 'Dota 2 ID', 'Peak MMR', 'Tournament', 'Player ID', 'Registration Date'];
    
    // Create CSV rows
    const rows = allPlayers.map(player => [
        player.name || '',
        player.dota2id || '',
        player.peakmmr || 0,
        player.sessionTitle || 'Legacy',
        player.id || '',
        player.registrationDate ? formatDateWithTimezone(player.registrationDate) : ''
    ]);
    
    // Combine headers and rows
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `players-${tournamentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showNotification('CSV export completed', 'success');
}

/**
 * Export players to JSON
 */
function exportPlayersJSON() {
    if (!allPlayers || allPlayers.length === 0) {
        window.showNotification('No players to export', 'warning');
        return;
    }
    
    const tournamentName = currentSessionId ? 
        (registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament') :
        'All Tournaments';
    
    // Create export data structure
    const exportData = {
        tournament: tournamentName,
        exportDate: new Date().toISOString(),
        playerCount: allPlayers.length,
        players: allPlayers.map(player => ({
            name: player.name,
            dota2id: player.dota2id,
            peakmmr: player.peakmmr,
            tournament: player.sessionTitle || 'Legacy',
            playerId: player.id,
            registrationDate: player.registrationDate ? formatDateWithTimezone(player.registrationDate) : 'N/A',
            present: player.present || false
        }))
    };
    
    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `players-${tournamentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showNotification('JSON export completed', 'success');
}

/**
 * Add CSS for refresh animations
 */
function addRefreshAnimationCSS() {
    if (!document.getElementById('refresh-animation-css')) {
        const style = document.createElement('style');
        style.id = 'refresh-animation-css';
        style.textContent = `
            .spin {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .sync-indicator {
                color: #198754 !important;
                background-color: rgba(25, 135, 84, 0.1) !important;
                border-color: #198754 !important;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Setup listener for registration updates
 * This allows the player list to refresh when registration settings change
 */
function setupRegistrationUpdateListener() {
    if (window.playerListRegistrationListenerAdded) return;
    window.playerListRegistrationListenerAdded = true;
    addRefreshAnimationCSS();
    window.addEventListener('registrationUpdated', function(event) {
        const refreshBtn = document.getElementById('refresh-player-list');
        if (refreshBtn) {
            const originalText = refreshBtn.innerHTML;
            const originalClasses = refreshBtn.className;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1 spin"></i> Syncing...';
            refreshBtn.disabled = true;
            refreshBtn.className = refreshBtn.className.replace('btn-outline-primary', 'btn-outline-success sync-indicator');
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
                refreshBtn.className = originalClasses;
            }, 2000);
        }
        loadRegistrationSessions().then(() => {
            window.showNotification(`Player list updated - registration ${event.detail.action}`, 'success');
        });
    });
    window.refreshPlayerListData = function() {
        loadRegistrationSessions().then(() => {
            const selector = document.getElementById('session-selector');
            if (selector && selector.value) {
                selector.dispatchEvent(new Event('change', { bubbles: true }));
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

// Initialize when DOM is loaded OR when explicitly called by navigation system
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the player list page and DOM is ready
    if (document.getElementById('player-list') || document.getElementById('session-selector')) {
        initPlayerList();
    }
});

// Also allow explicit initialization for template-based loading
window.initPlayerListWhenReady = function() {
    // Wait for DOM elements to be ready, then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPlayerList);
    } else {
        // DOM is already ready
        setTimeout(initPlayerList, 10); // Small delay to ensure template is rendered
    }
};

// Expose functions globally for compatibility
window.playerListModule = {
    initPlayerList,
    loadPlayers,
    displayPlayers,
    handlePlayerSearch
};

// Expose init function globally for navigation system
window.initPlayerList = initPlayerList;

// Expose cleanup function globally for navigation system
window.cleanupPlayerList = cleanupPlayerList;

/**
 * Cleanup function for player list when switching tabs
 */
function cleanupPlayerList() {
    // Reset state variables using the update function
    updateVariable('currentSessionId', null);
    updateVariable('registrationSessions', []);
    updateVariable('allPlayers', []);
    updateVariable('lastLoadedPlayerCount', null);
    
    // Clear DOM content
    const playersTableBody = document.getElementById('players-table-body');
    if (playersTableBody) playersTableBody.innerHTML = '';
    
    const sessionSelector = document.getElementById('session-selector');
    if (sessionSelector) sessionSelector.innerHTML = '<option value="">Loading sessions...</option>';
    
    const playerCountBadge = document.getElementById('session-player-count');
    if (playerCountBadge) playerCountBadge.textContent = '0 players';
    
    const playerSearch = document.getElementById('player-search');
    if (playerSearch) playerSearch.value = '';
    
    // Remove event listeners by cloning elements
    const elementsToClean = [
        'session-selector',
        'refresh-sessions',
        'player-search',
        'search-button',
        'refresh-player-list',
        'add-player-button',
        'export-csv-btn',
        'export-json-btn',
        'remove-all-players-btn'
    ];
    
    elementsToClean.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        }
    });
    
    // Clear any custom event listeners
    window.removeEventListener('registrationUpdated', window.playerListRegistrationListener);
}

// Add event listeners to table headers after DOMContentLoaded or table render
function setupPlayerTableSort() {
    document.querySelectorAll('th[data-sort] .sortable').forEach(el => {
        el.style.cursor = 'pointer';
        el.onclick = function() {
            const th = this.closest('th');
            const field = th.getAttribute('data-sort');
            const sortState = window.playerListSortState;
            if (sortState.field === field) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.field = field;
                sortState.direction = 'asc';
            }
            // Update sort icons
            updateSortIcons();
            // Re-render
            displayPlayers(allPlayers);
        };
    });
}

function updateSortIcons() {
    const sortState = window.playerListSortState;
    document.querySelectorAll('th[data-sort] .sortable i').forEach(icon => {
        const th = icon.closest('th');
        const field = th.getAttribute('data-sort');
        if (field === sortState.field) {
            icon.className = sortState.direction === 'asc' ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
        } else {
            icon.className = 'bi bi-chevron-expand';
        }
    });
}

