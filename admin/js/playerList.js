// playerList.js - Handles player list management functionality
// Used by player-list.html

// Module state object to avoid variable redeclaration conflicts
if (!window.playerListState) {
    window.playerListState = {};
}

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
        // Check if the player-list section exists with multiple selectors
        const possibleSelectors = [
            '#player-list',
            'section#player-list',
            'section[id="player-list"]',
            '#player-list-section',
            'section#player-list-section',
            'section[id="player-list-section"]',
            'div#player-list',
            'div#player-list-section',
        ];
        
        let playerListSection = null;
        for (const selector of possibleSelectors) {
            playerListSection = document.querySelector(selector);
            if (playerListSection) {
                break;
            }
        }
        
        if (!playerListSection) {
            // If player list section not found in DOM, create it
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                // Create a basic player list structure
                mainContent.innerHTML = `
                <section id="player-list" class="mb-4">
                    <div class="container-fluid">
                        <div class="row">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header">
                                        <h5 class="card-title mb-0">Player List</h5>
                                    </div>
                                    <div class="card-body">
                                        <div class="table-responsive">
                                            <table class="table table-striped">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>MMR</th>
                                                        <th>Dota2 ID</th>
                                                        <th>IP Address</th>
                                                        <th>Player ID</th>
                                                        <th>Registration Date</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="player-table-body">
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                `;
                
                playerListSection = document.querySelector('#player-list');
            }
        }
        
        if (!playerListSection) {
            showNotification('Player list section not found and could not be created', 'error');
            return;
        }
        
        // Set up event listeners for search, buttons, etc.
        setupEventListeners();
        
        // Set up modal event listeners for add/edit/delete operations
        setupModalEventListeners();
        
        // Load and display players
        await loadPlayers();
        
        // Initialize other components
        initPagination();
        
        showNotification('Player list initialized successfully', 'success');
        
    } catch (error) {
        showNotification('Error initializing player list: ' + error.message, 'error');
    }
}

/**
 * Set up all event listeners for the player list page
 */
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('player-search');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput) {
        // Debounce search to avoid too many refreshes
        searchInput.addEventListener('input', debounce((e) => {
            handlePlayerSearch();
        }, 300));
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            handlePlayerSearch();
        });
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                handlePlayerSearch();
            }
        });
    }
    
    // Refresh button
    const refreshButton = document.getElementById('refresh-player-list');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => loadPlayers(true));
    }
    
    // Remove All Players button
    const removeAllPlayersButton = document.getElementById('remove-all-players-button');
    if (removeAllPlayersButton) {
        removeAllPlayersButton.addEventListener('click', showRemoveAllPlayersModal);
    }
    
    // Set up the confirm checkbox for the Remove All Players modal
    const confirmRemoveAllCheckbox = document.getElementById('confirm-remove-all-players');
    const confirmRemoveAllButton = document.getElementById('confirm-remove-all-button');
    
    if (confirmRemoveAllCheckbox && confirmRemoveAllButton) {
        confirmRemoveAllCheckbox.addEventListener('change', () => {
            confirmRemoveAllButton.disabled = !confirmRemoveAllCheckbox.checked;
        });
    }
    
    // Confirm Remove All Players button
    if (confirmRemoveAllButton) {
        confirmRemoveAllButton.addEventListener('click', removeAllPlayers);
    }
    
    // Export buttons
    const exportCSV = document.getElementById('export-csv');
    const exportJSON = document.getElementById('export-json');
    const exportPrint = document.getElementById('export-print');
    
    if (exportCSV) exportCSV.addEventListener('click', () => exportData('csv'));
    if (exportJSON) exportJSON.addEventListener('click', () => exportData('json'));
    if (exportPrint) exportPrint.addEventListener('click', () => exportData('print'));
    
    // Add Player button
    const addPlayerButton = document.getElementById('add-player-button');
    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', showAddPlayerModal);
    }
    
    // Save New Player button in modal
    const saveNewPlayerButton = document.getElementById('save-new-player-button');
    if (saveNewPlayerButton) {
        saveNewPlayerButton.addEventListener('click', saveNewPlayer);
    }
}

/**
 * Handle player search
 */
function handlePlayerSearch() {
    const searchInput = document.getElementById('player-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    // If no player data, return
    if (!window.playerData || !Array.isArray(window.playerData)) {
        return;
    }
    
    // Filter players based on search term
    const filteredPlayers = window.playerData.filter(player => {
        return (
            (player.name && player.name.toLowerCase().includes(searchTerm)) ||
            (player.dota2id && player.dota2id.toString().toLowerCase().includes(searchTerm)) ||
            (player.dotaId && player.dotaId.toString().toLowerCase().includes(searchTerm)) ||
            (player.id && player.id.toString().toLowerCase().includes(searchTerm))
        );
    });
    
    // Display filtered players
    displayPlayers(filteredPlayers);
    
    // Update player count
    updatePlayerCount(filteredPlayers.length);
}

/**
 * Filter players based on search term
 * @param {string} searchTerm - Search term to filter by
 */
function filterPlayers(searchTerm) {
    // If no search term, show all players
    if (!searchTerm) {
        displayPlayers(window.playerData || []);
        updatePlayerCount((window.playerData || []).length);
        return;
    }
    
    // If no player data, return
    if (!window.playerData || !Array.isArray(window.playerData)) {
        return;
    }
    
    // Filter players based on search term
    const filteredPlayers = window.playerData.filter(player => {
        return (
            (player.name && player.name.toLowerCase().includes(searchTerm)) ||
            (player.dota2id && String(player.dota2id).toLowerCase().includes(searchTerm)) ||
            (player.dotaId && String(player.dotaId).toLowerCase().includes(searchTerm)) ||
            (player.id && String(player.id).toLowerCase().includes(searchTerm))
        );
    });
    
    // Display filtered players
    displayPlayers(filteredPlayers);
    
    // Update player count
    updatePlayerCount(filteredPlayers.length);
}

/**
 * Handle removing all players
 */
function handleRemoveAllPlayers() {
    // Check if there are any players to remove
    if (!window.playerData || window.playerData.length === 0) {
        showNotification('There are no players to remove.', 'info');
        return;
    }
    
    // Show the confirmation modal instead of directly removing
    showRemoveAllPlayersModal();
}

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Load players from the API
 * @param {boolean} forceRefresh - Whether to force a refresh from the server
 */
async function loadPlayers(forceRefresh = false) {
    try {
        const playerTableBody = document.getElementById('player-table-body');
        const noPlayersMessage = document.getElementById('no-players-message');
        
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
            
            // Load players from API endpoint that uses SQLite
            const response = await fetch('../api/get-players');
            
            if (!response.ok) {
                // If error, assume no players yet or issue with the database
                if (response.status === 404 || response.status === 204) {
                    window.playerData = [];
                    displayPlayers([]);
                    updatePlayerCount(0);
                    return;
                }
                throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
            }
            
            // Parse the JSON response
            const data = await response.json();
            
            // Process the loaded data
            let players = [];
            if (data && data.success && Array.isArray(data.players)) {
                // The API returns players in the 'players' property
                players = data.players;
            } else if (Array.isArray(data)) {
                // Handle case where the API might return an array directly
                players = data;
            } else {
                // Default to empty array if no valid data format
                // Unexpected data format from API
                players = [];
            }
            
            // Store players data globally for filtering and other operations
            window.playerData = players;
            
            // Display the players
            displayPlayers(players);
            
            // Update the player count
            updatePlayerCount(players.length);
        }
    } catch (error) {
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
    }
}

/**
 * Display players in the table
 * @param {Array} players - Array of player objects
 */
function displayPlayers(players) {
    const playerTableBody = document.getElementById('player-table-body');
    const noPlayersMessage = document.getElementById('no-players-message');
    
    if (!playerTableBody) return;
    
    // Clear the table body
    playerTableBody.innerHTML = '';
    
    // If no players, show the no players message
    if (!players || players.length === 0) {
        playerTableBody.innerHTML = `
            <tr id="no-players-message">
                <td colspan="7" class="text-center py-5">
                    <div class="text-muted">
                        <i class="bi bi-people display-6 d-block mb-3 opacity-25"></i>
                        <h5>No players found</h5>
                        <p class="mb-0">Add players or check back later</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add each player to the table
    players.forEach((player, index) => {
        const registrationDate = player.registrationDate ? new Date(player.registrationDate).toLocaleString() : 'N/A';
        // Display player ID or generate a placeholder
        const playerId = player.id || `player_${index}`;
        
        const row = document.createElement('tr');
        
        // Create row with buttons that match the HTML file's expected class names
        row.innerHTML = `
            <td class="px-3">
                <div class="d-flex align-items-center">
                    <div class="fw-bold">${player.name || 'Unknown'}</div>
                </div>
            </td>
            <td class="text-center px-3">${getMmrDisplay(player)}</td>
            <td class="px-3">${player.dota2id || player.dotaId || 'N/A'}</td>
            <td class="px-3">${player.ipAddress || 'N/A'}</td>
            <td class="px-3">
                <span class="badge bg-light text-dark">${playerId}</span>
            </td>
            <td class="px-3">${registrationDate}</td>
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
 * Helper function to get the MMR display value
 * @param {Object} player - The player object
 * @returns {string} - The MMR value to display
 */
function getMmrDisplay(player) {
    // Check for different property names, prioritizing peakmmr (as in players.json)
    const mmrValue = player.peakmmr !== undefined ? player.peakmmr : 
                    player.peakMmr !== undefined ? player.peakMmr :
                    player.peakMMR !== undefined ? player.peakMMR :
                    player.peak_mmr !== undefined ? player.peak_mmr :
                    player.mmr !== undefined ? player.mmr : 
                    player.MMR !== undefined ? player.MMR : 
                    player.rank !== undefined ? player.rank : null;
    
    // Handle edge cases
    if (mmrValue === null || mmrValue === undefined) {
        return 'N/A';
    }
    
    // Convert to number to ensure proper display
    const numericMmr = Number(mmrValue);
    
    // Check if it's a valid number
    if (isNaN(numericMmr)) {
        return mmrValue.toString(); // If it's not a number, return as string
    }
    
    return numericMmr.toString();
}

/**
 * Update the player count display
 * @param {number} count - Number of players
 */
function updatePlayerCount(count) {
    const playerCount = document.getElementById('player-count');
    if (playerCount) {
        playerCount.textContent = count;
    }
}

/**
 * Initialize pagination controls
 */
function initPagination() {
    // For now, we're loading all players at once
    // In a real application with many players, we would implement server-side pagination
    // This is a placeholder for future implementation
    
    const pageSizeSelect = document.querySelector('.pagination-container select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            // Update page size and reload players with pagination
            const pageSize = parseInt(e.target.value);
            // Implement pagination logic here
        });
    }
}

/**
 * Edit a player
 * @param {Object} player - Player object to edit
 * @param {number} index - Index of player in the array
 */
function editPlayer(player, index) {
    try {
        // Find the edit player modal
        const editPlayerModal = document.getElementById('edit-player-modal');
        
        if (!editPlayerModal) {
            showNotification('Edit player modal not found', 'error');
            return;
        }
        
        // Get form elements
        const playerNameInput = document.getElementById('edit-player-name');
        const playerMmrInput = document.getElementById('edit-player-peakmmr');
        const playerDotaIdInput = document.getElementById('edit-player-dota2id');
        const playerIdInput = document.getElementById('edit-player-id');
        const playerIndexInput = document.getElementById('edit-player-index');
        const playerRegistrationDateInput = document.getElementById('edit-player-registration-date');
        
        // Check if all required elements exist
        if (!playerNameInput || !playerMmrInput || !playerDotaIdInput) {
            showNotification('Edit form elements not found', 'error');
            return;
        }
        
        // Set the player index for reference when saving
        if (playerIndexInput) {
            playerIndexInput.value = index;
        }
        
        // Set form values
        playerNameInput.value = player.name || '';
        
        // Handle MMR value - try different properties
        const mmrValue = player.peakmmr !== undefined ? player.peakmmr : 
                      player.mmr !== undefined ? player.mmr : 
                      player.rank !== undefined ? player.rank : null;
      
        // Handle edge cases
        if (mmrValue === null || mmrValue === undefined) {
            playerMmrInput.value = '';
        } else {
            playerMmrInput.value = mmrValue;
        }
        
        playerDotaIdInput.value = player.dota2id || player.dotaId || '';
        
        if (playerIdInput) {
            playerIdInput.value = player.id || '';
        }
        
        // Set registration date if available
        if (playerRegistrationDateInput && player.registrationDate) {
            try {
                const date = new Date(player.registrationDate);
                playerRegistrationDateInput.value = date.toLocaleString();
            } catch (e) {
                playerRegistrationDateInput.value = player.registrationDate || 'Not available';
            }
        }
        
        // Show the modal
        const bsModal = new bootstrap.Modal(editPlayerModal);
        bsModal.show();
        
        // Show success notification
        showNotification(`Editing player: ${player.name}`, 'info');
        
    } catch (error) {
        showNotification('Error opening edit modal: ' + error.message, 'error');
    }
}

/**
 * Save changes to a player
 * @returns {Promise} A promise that resolves when the update is complete
 */
async function savePlayerChanges() {
    // Track update state to prevent duplicates
    if (window._updateInProgress) {
        return Promise.resolve(); // Return early if already in progress
    }
    
    try {
        window._updateInProgress = true;
        
        // Show saving message
        showNotification('Saving player changes...', 'info');
        
        // Get form elements
        const playerNameInput = document.getElementById('edit-player-name');
        const playerMmrInput = document.getElementById('edit-player-peakmmr');
        const playerDotaIdInput = document.getElementById('edit-player-dota2id');
        const playerIdInput = document.getElementById('edit-player-id');
        const playerIndexInput = document.getElementById('edit-player-index');
        
        // Check if required elements exist
        if (!playerNameInput || !playerMmrInput || !playerDotaIdInput) {
            showNotification('Required form elements not found', 'error');
            return Promise.resolve();
        }
        
        // Get values
        const playerName = playerNameInput.value.trim();
        const playerMmr = parseInt(playerMmrInput.value) || 0;
        const playerDotaId = playerDotaIdInput.value.trim();
        const playerId = playerIdInput ? playerIdInput.value.trim() : '';
        const playerIndex = parseInt(playerIndexInput ? playerIndexInput.value : -1);
        
        // Validate
        if (!playerName) {
            showNotification('Player name is required', 'error');
            return Promise.resolve();
        }
        
        if (!playerDotaId) {
            showNotification('Dota 2 ID is required', 'error');
            return Promise.resolve();
        }
        
        // Check if player index is valid
        if (isNaN(playerIndex) || playerIndex < 0 || !window.playerData || playerIndex >= window.playerData.length) {
            showNotification('Invalid player index', 'error');
            return Promise.resolve();
        }
        
        // Create updated player object
        const updatedPlayer = {
            ...window.playerData[playerIndex],
            name: playerName,
            peakmmr: playerMmr,
            dota2id: playerDotaId,
            id: playerId || window.playerData[playerIndex].id
        };
        
        // Update player in the array
        window.playerData[playerIndex] = updatedPlayer;
        
        // Save to server using SQLite-backed API endpoint
        const response = await fetch('/admin/save-players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': localStorage.getItem('adminSessionId')
            },
            body: JSON.stringify({
                action: 'edit',
                player: updatedPlayer
            })
        });
        
        // Check if response is ok
        if (!response.ok) {
            const errorText = await response.text();
            showNotification(`Failed to update player: ${response.status} - ${errorText}`, 'error');
            return Promise.resolve();
        }
        
        // Parse response
        const result = await response.json();
        
        if (!result.success) {
            showNotification(`Update failed: ${result.message || 'Unknown error'}`, 'error');
            return Promise.resolve();
        }
        
        // Close modal
        const editPlayerModal = document.getElementById('edit-player-modal');
        if (editPlayerModal) {
            const bsModal = bootstrap.Modal.getInstance(editPlayerModal);
            if (bsModal) {
                bsModal.hide();
            }
        }
        
        // Update display
        displayPlayers(window.playerData);
        
        // Show success message
        showNotification(`Player "${playerName}" updated successfully!`, 'success');
        
        return Promise.resolve();
        
    } catch (error) {
        showNotification('Error updating player: ' + error.message, 'error');
        return Promise.reject(error);
    } finally {
        // Always reset the update flag when done
        window._updateInProgress = false;
    }
}

/**
 * Delete a player
 * @param {Object} player - Player object to delete
 * @param {number} index - Index of player in the array
 */
async function deletePlayer(player, index) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete player "${player.name}"?`)) {
        return;
    }
    
    try {
        // Prepare request data - for SQLite we just need the ID
        const requestData = {
            action: 'delete',
            playerId: player.id
        };
        
        // Send request to server using API endpoint
        const response = await fetch('../admin/save-players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': localStorage.getItem('adminSessionId')
            },
            body: JSON.stringify(requestData)
        });
        
        // Check response
        if (!response.ok) {
            const responseText = await response.text();
            showNotification(`Failed to delete player: ${response.status}`, 'error');
            return;
        }
        
        // Remove from local array
        if (window.playerData && Array.isArray(window.playerData)) {
            window.playerData.splice(index, 1);
            
            // Update display
            displayPlayers(window.playerData);
            updatePlayerCount(window.playerData.length);
            
            // Show success message
            showNotification('Player deleted successfully', 'success');
        }
    } catch (error) {
        showNotification('Error deleting player: ' + error.message, 'error');
    }
}

/**
 * Show the add player modal
 */
function showAddPlayerModal() {
    // Find the add player modal
    let addPlayerModal = document.getElementById('add-player-modal');
    
    if (!addPlayerModal) {
        // Try to find the modal with different selectors
        const modalSelectors = [
            '#add-player-modal',
            '.modal#add-player-modal',
            '.modal[id="add-player-modal"]',
            '.modal'
        ];
        
        for (const selector of modalSelectors) {
            try {
                const modal = document.querySelector(selector);
                if (modal) {
                    addPlayerModal = modal;
                    break;
                }
            } catch (e) {
                // Ignore errors
            }
        }
        
        if (!addPlayerModal) {
            showNotification('Add Player modal not found', 'error');
            return;
        }
    }
    
    // Reset form
    const playerNameInput = document.getElementById('add-player-name');
    const playerMmrInput = document.getElementById('add-player-peakmmr');
    const playerDotaIdInput = document.getElementById('add-player-dota2id');
    
    if (playerNameInput) playerNameInput.value = '';
    if (playerMmrInput) playerMmrInput.value = '';
    if (playerDotaIdInput) playerDotaIdInput.value = '';
    
    // Show the modal
    try {
        const bsModal = new bootstrap.Modal(addPlayerModal);
        bsModal.show();
    } catch (error) {
        showNotification('Error showing Add Player modal: ' + error.message, 'error');
    }
}

/**
 * Save a new player
 */
async function saveNewPlayer() {
    // Get form elements
    const playerNameInput = document.getElementById('add-player-name');
    const playerMmrInput = document.getElementById('add-player-peakmmr');
    const playerDotaIdInput = document.getElementById('add-player-dota2id');
    
    // Get values
    const playerName = playerNameInput?.value.trim() || '';
    const playerMmr = parseInt(playerMmrInput?.value) || 0;
    const playerDotaId = playerDotaIdInput?.value.trim() || '';
    
    // Validate
    if (!playerName) {
        showNotification('Player name is required', 'error');
        return;
    }
    
    // Check for duplicate names
    if (window.playerData && window.playerData.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        showNotification('A player with this name already exists', 'error');
        return;
    }
    
    // Generate a unique ID
    const uniqueId = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Create new player object
    const newPlayer = {
        name: playerName,
        peakmmr: playerMmr,
        dota2id: playerDotaId,
        id: uniqueId,
        registrationDate: new Date().toISOString()
    };
    
    try {
        // Add player using API endpoint
        const response = await fetch('../admin/save-players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': localStorage.getItem('adminSessionId')
            },
            body: JSON.stringify({
                action: 'add',
                player: newPlayer
            })
        });
        
        // Check response
        if (!response.ok) {
            const errorText = await response.text();
            showNotification(`Failed to add player: ${response.status} ${errorText}`, 'error');
            return;
        }
        
        // Parse response
        const result = await response.json();
        
        // Add to local array
        if (!window.playerData) {
            window.playerData = [];
        }
        
        window.playerData.push(newPlayer);
        
        // Close modal
        const addPlayerModal = document.getElementById('add-player-modal');
        if (addPlayerModal) {
            const bsModal = bootstrap.Modal.getInstance(addPlayerModal);
            if (bsModal) {
                bsModal.hide();
            }
        }
        
        // Update display
        displayPlayers(window.playerData);
        updatePlayerCount(window.playerData.length);
        
        // Show success message
        showNotification('Player added successfully', 'success');
        
    } catch (error) {
        showNotification('Error adding player: ' + error.message, 'error');
    }
}

/**
 * Export player data in various formats
 * @param {string} format - Format to export (csv, json, print)
 * @param {Array} data - Player data to export
 */
function exportData(format, data = window.playerData) {
    // Ensure we have data
    if (!data || !Array.isArray(data) || data.length === 0) {
        showNotification('No player data to export', 'warning');
        return;
    }
    
    // Export based on format
    switch (format) {
        case 'csv':
            exportCSV(data);
            break;
        case 'json':
            exportJSON(data);
            break;
        case 'print':
            printData(data);
            break;
        default:
            showNotification('Unknown export format', 'error');
    }
}

/**
 * Export player data as CSV
 * @param {Array} data - Player data to export
 */
function exportCSV(data) {
    // Define CSV headers
    const headers = [
        'Name',
        'MMR',
        'Dota 2 ID',
        'IP Address',
        'ID',
        'Registration Date'
    ];
    
    // Convert player data to CSV rows
    const rows = data.map(player => [
        `"${player.name || ''}"`,
        player.peakmmr || '',
        `"${player.dota2id || player.dotaId || ''}"`,
        `"${player.ipAddress || ''}"`,
        `"${player.id || ''}"`,
        `"${player.registrationDate ? new Date(player.registrationDate).toLocaleString() : ''}"`,
    ]);
    
    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create a download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dota-tournament-players-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Player data exported as CSV', 'success');
}

/**
 * Export player data as JSON
 * @param {Array} data - Player data to export
 */
function exportJSON(data) {
    // Using the new export endpoint that serves data from SQLite
    const exportUrl = `../export-players?t=${Date.now()}`;
    
    // Open the export URL in a new tab or trigger download
    const link = document.createElement('a');
    link.setAttribute('href', exportUrl);
    link.setAttribute('download', `dota-tournament-players-${new Date().toISOString().slice(0, 10)}.json`);
    link.setAttribute('target', '_blank'); // Open in new tab if download doesn't start
    link.style.display = 'none';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Player data exported as JSON', 'success');
}

/**
 * Print player data
 * @param {Array} data - Player data to print
 */
function printData(data) {
    // Create a printable table
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        showNotification('Pop-up blocked. Please allow pop-ups for this site.', 'error');
        return;
    }
    
    // Get the current date/time
    const now = new Date().toLocaleString();
    
    // Create the print content
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dota Tournament Players - ${now}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .timestamp {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
                @media print {
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <h1>Dota Tournament Players</h1>
            <div class="timestamp">Generated: ${now}</div>
            <div class="no-print">
                <button onclick="window.print()">Print</button>
                <button onclick="window.close()">Close</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>MMR</th>
                        <th>Dota 2 ID</th>
                        <th>ID</th>
                        <th>Registration Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((player, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${player.name || ''}</td>
                            <td>${player.peakmmr || ''}</td>
                            <td>${player.dota2id || player.dotaId || ''}</td>
                            <td>${player.id || ''}</td>
                            <td>${player.registrationDate ? new Date(player.registrationDate).toLocaleString() : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                Total Players: ${data.length}
            </div>
            <script>
                // Auto print
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

/**
 * Show the Remove All Players modal
 */
function showRemoveAllPlayersModal() {
    // Check if there are any players to remove
    if (!window.playerData || window.playerData.length === 0) {
        showNotification('There are no players to remove', 'info');
        return;
    }
    
    // Find the modal
    const removeAllModal = document.getElementById('remove-all-players-modal');
    if (!removeAllModal) {
        showNotification('Remove All Players modal not found', 'error');
        return;
    }
    
    // Reset the confirmation checkbox
    const confirmCheckbox = document.getElementById('confirm-remove-all-players');
    if (confirmCheckbox) {
        confirmCheckbox.checked = false;
    }
    
    // Disable the confirm button
    const confirmButton = document.getElementById('confirm-remove-all-button');
    if (confirmButton) {
        confirmButton.disabled = true;
    }
    
    // Show the modal
    const bsModal = new bootstrap.Modal(removeAllModal);
    bsModal.show();
}

/**
 * Remove all players
 */
async function removeAllPlayers() {
    // Check if there are any players to remove
    if (!window.playerData || window.playerData.length === 0) {
        showNotification('There are no players to remove', 'info');
        return;
    }
    
    try {
        // Send request to server using API endpoint
        const response = await fetch('../admin/save-players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'removeAll'
            })
        });
        
        // Check response
        if (!response.ok) {
            const errorText = await response.text();
            showNotification(`Failed to remove all players: ${response.status} ${errorText}`, 'error');
            return;
        }
        
        // Parse response
        const result = await response.json();
        
        // Clear local data
        window.playerData = [];
        
        // Update display
        displayPlayers([]);
        updatePlayerCount(0);
        
        // Close modal
        const removeAllModal = document.getElementById('remove-all-players-modal');
        if (removeAllModal) {
            const bsModal = bootstrap.Modal.getInstance(removeAllModal);
            if (bsModal) {
                bsModal.hide();
            }
        }
        
        // Show success message
        showNotification('All players removed successfully', 'success');
        
    } catch (error) {
        showNotification('Error removing all players: ' + error.message, 'error');
    }
}

// Edit form setup is now handled in setupModalEventListeners

/**
 * Set up all modal event listeners - prevents duplicate event handlers
 */
function setupModalEventListeners() {
    try {
        // Track if listeners have been set up
        if (window._eventListenersSet) {
            // Avoid setting duplicate listeners
            return;
        }
        
        // Add Player Modal
        const addPlayerForm = document.getElementById('add-player-form');
        const saveNewPlayerButton = document.getElementById('save-new-player-button');
        
        if (saveNewPlayerButton) {
            // Remove any existing listeners (just in case)
            saveNewPlayerButton.removeEventListener('click', saveNewPlayer);
            // Add single listener
            saveNewPlayerButton.addEventListener('click', saveNewPlayer);
        }
        
        if (addPlayerForm) {
            // Use a named function for the event handler so we can remove it if needed
            const handleAddPlayerSubmit = function(e) {
                e.preventDefault();
                saveNewPlayer();
            };
            
            // Remove any existing listeners
            addPlayerForm.removeEventListener('submit', handleAddPlayerSubmit);
            // Add single listener
            addPlayerForm.addEventListener('submit', handleAddPlayerSubmit);
        }
        
        // Edit Player Modal - find the save button
        const savePlayerChangesButton = document.getElementById('save-player-changes');
        const editPlayerForm = document.getElementById('edit-player-form');
        
        // Create a single handler for saving changes
        const handleSaveChanges = function(e) {
            e.preventDefault();
            // Prevent multiple rapid clicks
            if (window._saveInProgress) return;
            
            window._saveInProgress = true;
            savePlayerChanges().finally(() => {
                window._saveInProgress = false;
            });
        };
        
        // Set up the save button click handler
        if (savePlayerChangesButton) {
            // Remove any existing listeners
            savePlayerChangesButton.removeEventListener('click', handleSaveChanges);
            // Add single listener
            savePlayerChangesButton.addEventListener('click', handleSaveChanges);
        }
        
        // Set up form submit handler
        if (editPlayerForm) {
            // Remove any existing listeners
            editPlayerForm.removeEventListener('submit', handleSaveChanges);
            // Add single listener
            editPlayerForm.addEventListener('submit', handleSaveChanges);
        }
        
        // Mark that listeners have been set up
        window._eventListenersSet = true;
        
        // Remove All Players Modal
        const confirmRemoveAllCheckbox = document.getElementById('confirm-remove-all-players');
        const confirmRemoveAllButton = document.getElementById('confirm-remove-all-button');
        
        if (confirmRemoveAllCheckbox && confirmRemoveAllButton) {
            confirmRemoveAllCheckbox.addEventListener('change', function() {
                confirmRemoveAllButton.disabled = !this.checked;
            });
        }
        
        if (confirmRemoveAllButton) {
            confirmRemoveAllButton.addEventListener('click', function() {
                removeAllPlayers();
            });
        }
        
    } catch (error) {
        showNotification('Error setting up modal event listeners: ' + error.message, 'error');
    }
}

/**
 * Set up action buttons for each player row
 */
function setupPlayerActionButtons() {
    // Find all edit buttons (using the class name from HTML file)
    const editButtons = document.querySelectorAll('.edit-player');
    const deleteButtons = document.querySelectorAll('.delete-player');
    
    // Add click event to edit buttons
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const playerId = this.getAttribute('data-id');
            const playerIndex = parseInt(this.getAttribute('data-index'));
            
            if (!isNaN(playerIndex) && playerIndex >= 0 && playerIndex < window.playerData.length) {
                // Use the player object and index for the edit function
                editPlayer(window.playerData[playerIndex], playerIndex);
            } else {
                showNotification('Invalid player data', 'error');
            }
        });
    });
    
    // Add click event to delete buttons
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const playerId = this.getAttribute('data-id');
            const playerIndex = Array.from(deleteButtons).indexOf(button);
            
            if (playerIndex >= 0 && playerIndex < window.playerData.length) {
                deletePlayer(window.playerData[playerIndex], playerIndex);
            } else {
                showNotification('Invalid player data', 'error');
            }
        });
    });
}

// Make functions available to the global scope
window.initPlayerList = initPlayerList;

