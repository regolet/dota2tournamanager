// Random Picker with Registration Session Support
(function() {
    'use strict';

    // Module state object to avoid variable redeclaration conflicts
    if (!window.randomPickerState) {
        window.randomPickerState = {
            // Session state
            currentSessionId: null,
            registrationSessions: [],
            availablePlayers: [],
            pickerHistory: [],
            
            // DOM Elements
            pickerPlayerList: null,
            pickerResult: null,
            pickButton: null,
            clearButton: null,
            playerSearchInput: null,
            pickerAnimationArea: null,
            playerListPicker: null,
            pickRandomBtn: null,
            playerNameInputPicker: null,
            
            // State
            pickerPlayers: [],
            isPicking: false,
            pickerTimer: null
        };
    }

    // Create local references for easier access
    const state = window.randomPickerState;
    let pickerPlayerList = state.pickerPlayerList;
    let pickerResult = state.pickerResult;
    let pickButton = state.pickButton;
    let clearButton = state.clearButton;
    let playerSearchInput = state.playerSearchInput;
    let pickerAnimationArea = state.pickerAnimationArea;
    let playerListPicker = state.playerListPicker;
    let pickRandomBtn = state.pickRandomBtn;
    let playerNameInputPicker = state.playerNameInputPicker;
    let pickerPlayers = state.pickerPlayers;
    let isPicking = state.isPicking;
    let pickerTimer = state.pickerTimer;

    // Add CSS styles for animations
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .winner-animation {
            animation: winner-pulse 1.5s ease-in-out infinite alternate;
            text-shadow: 0 0 10px rgba(0, 123, 255, 0.5) !important;
            color: #0d6efd !important;
            font-weight: bold !important;
            display: inline-block;
            transform-origin: center;
        }
        
        @keyframes winner-pulse {
            0% {
                transform: scale(1);
                text-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
            }
            100% {
                transform: scale(1.05);
                text-shadow: 0 0 20px rgba(0, 123, 255, 0.8), 0 0 30px rgba(0, 123, 255, 0.6);
            }
        }
        
        .emoji {
            display: inline-block;
            animation: emoji-bounce 1s ease infinite;
            font-size: 2rem;
        }
        
        @keyframes emoji-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .emoji-container {
            min-height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .emoji-animation {
            animation: emoji-spin 2s ease-in-out infinite;
        }

        @keyframes emoji-spin {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.5); }
            100% { transform: rotate(360deg) scale(1); }
        }

        #picked-player {
            background: linear-gradient(45deg, #0d6efd, #0dcaf0) !important;
            background-clip: text !important;
            -webkit-background-clip: text !important;
            color: transparent !important;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2) !important;
            padding: 10px;
            border-radius: 10px;
            margin-bottom: 20px;
            position: relative;
        }

        #picked-player.winner-animation {
            color: #0d6efd !important;
            background: none !important;
            -webkit-background-clip: initial !important;
            background-clip: initial !important;
        }

        .result-container {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        @keyframes glow {
            0% { box-shadow: 0 0 5px rgba(13, 110, 253, 0.5); }
            100% { box-shadow: 0 0 20px rgba(13, 110, 253, 0.8), 0 0 30px rgba(13, 110, 253, 0.6); }
        }

        .confetti-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        }
    `;
    document.head.appendChild(styleElement);

// Utility function: debounce
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

// Utility function: fetchWithAuth
function fetchWithAuth(url, options = {}) {
    const sessionId = localStorage.getItem('adminSessionId');
    if (sessionId) {
        if (!options.headers) options.headers = {};
        options.headers['x-session-id'] = sessionId;
    }
    return fetch(url, options);
}

// Random Picker with Registration Session Support

let currentSessionId = null;
let registrationSessions = [];
let availablePlayers = [];
let excludedPlayers = [];
let pickerHistory = [];

/**
 * Initialize the random picker
 */
async function initRandomPicker() {
    try {
        // Always re-initialize when called (for tab switching)
        // Reset state to ensure fresh start
        state.currentSessionId = null;
        state.registrationSessions = [];
        state.availablePlayers = [];
        state.pickerHistory = [];
        state.isPicking = false;
        if (state.pickerTimer) {
            clearTimeout(state.pickerTimer);
            state.pickerTimer = null;
        }
        
        await createRandomPickerSessionSelector();
        await loadRegistrationSessions();
        setupRandomPickerEventListeners();
        setupRandomPickerRegistrationListener();
    } catch (error) {
        console.error('❌ Random Picker: Error initializing:', error);
        window.showNotification('Failed to initialize random picker', 'error');
    }
}

/**
 * Create session selector for random picker
 */
async function createRandomPickerSessionSelector() {
    // The session selector already exists in the HTML, so we don't need to create it
    // Just verify it exists and update the loading text
    const sessionSelector = document.getElementById('picker-session-selector');
    if (sessionSelector) {
        sessionSelector.innerHTML = '<option value="">Choose a tournament...</option>';
    } else {
        console.error('Random Picker session selector not found in HTML');
    }
}

/**
 * Load registration sessions for random picker
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
            registrationSessions = data.sessions;
            updateSessionSelector();
        } else {
            console.error('Random Picker: Failed to process sessions. Data received:', data);
            window.showNotification(data.message || 'Failed to load registration sessions', 'error');
        }
    } catch (error) {
        console.error('Error loading registration sessions in Random Picker:', error);
        window.showNotification('An error occurred while loading tournaments.', 'error');
    }
}

/**
 * Update the session selector dropdown
 */
function updateSessionSelector() {
    const selector = document.getElementById('picker-session-selector');
    if (!selector) {
        console.error('Random Picker session selector not found');
        return;
    }

    selector.innerHTML = '<option value="">Choose a tournament...</option>';

    // Sort sessions by creation date (newest first)
    const sortedSessions = [...registrationSessions].sort((a, b) => {
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
        currentSessionId = latestSession.sessionId;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        console.log('No tournaments available for Random Picker');
    }
}

/**
 * Setup random picker event listeners
 */
function setupRandomPickerEventListeners() {
    // Session selector change
    const sessionSelector = document.getElementById('picker-session-selector');
    if (sessionSelector) {
        sessionSelector.addEventListener('change', async (e) => {
            currentSessionId = e.target.value || null;
            await loadPlayersForPicker();
            clearPickerResults(); // Clear existing results when session changes
        });
    }

    // Refresh sessions button
    const refreshSessionsBtn = document.getElementById('refresh-picker-sessions');
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', loadRegistrationSessions);
    }

    // Refresh players button
    const refreshPlayersBtn = document.getElementById('refresh-players-btn');
    if (refreshPlayersBtn) {
        refreshPlayersBtn.addEventListener('click', loadPlayersForPicker);
    }

    // Import from team balancer button
    const importBtn = document.getElementById('import-players-to-picker');
    if (importBtn) {
        importBtn.addEventListener('click', importPlayersFromTeamBalancer);
    }

    // Show excluded players button
    const showExcludedBtn = document.getElementById('show-excluded-picker');
    if (showExcludedBtn) {
        showExcludedBtn.addEventListener('click', showExcludedPlayersModal);
    }

    // Clear all players button
    const clearAllBtn = document.getElementById('clear-players-picker');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all players from the picker?')) {
                availablePlayers = [];
                excludedPlayers = [];
                displayPlayersForPicker([]);
                window.showNotification('All players cleared from picker', 'info');
            }
        });
    }

    // Setup existing picker buttons with session validation
    setupPickerButtons();
}

/**
 * Setup picker buttons with session validation
 */
function setupPickerButtons() {
    // Load Players button
    const loadPlayersBtn = document.getElementById('load-picker-players-btn') || 
                          document.querySelector('[onclick="loadPlayersList()"]');
    if (loadPlayersBtn) {
        // Remove existing onclick handler
        loadPlayersBtn.removeAttribute('onclick');
        loadPlayersBtn.addEventListener('click', loadPlayersForPicker);
    }

    // Pick Random Player button
    const pickRandomBtn = document.getElementById('pick-random') || 
                         document.getElementById('pick-random-btn') || 
                         document.querySelector('[onclick="pickRandomPlayer()"]');
    if (pickRandomBtn) {
        pickRandomBtn.removeAttribute('onclick');
        pickRandomBtn.addEventListener('click', pickRandomPlayerInternal);
    }

    // Pick Multiple Players button
    const pickMultipleBtn = document.getElementById('pick-multiple-btn') || 
                           document.querySelector('[onclick="pickMultiplePlayers()"]');
    if (pickMultipleBtn) {
        pickMultipleBtn.removeAttribute('onclick');
        pickMultipleBtn.addEventListener('click', pickMultiplePlayersInternal);
    }

    // Clear History button
    const clearHistoryBtn = document.getElementById('clear-history-btn') || 
                           document.querySelector('[onclick="clearHistory()"]');
    if (clearHistoryBtn) {
        clearHistoryBtn.removeAttribute('onclick');
        clearHistoryBtn.addEventListener('click', clearPickerHistory);
    }

    // Export History button
    const exportHistoryBtn = document.getElementById('export-history-btn') || 
                            document.querySelector('[onclick="exportHistory()"]');
    if (exportHistoryBtn) {
        exportHistoryBtn.removeAttribute('onclick');
        exportHistoryBtn.addEventListener('click', exportPickerHistory);
    }

    // Add Player button
    const addPlayerBtn = document.getElementById('add-player-picker');
    const playerNameInput = document.getElementById('player-name-picker');
    if (addPlayerBtn && playerNameInput) {
        addPlayerBtn.addEventListener('click', function() {
            const playerName = playerNameInput.value.trim();
            if (playerName) {
                addPlayerManually(playerName);
                playerNameInput.value = '';
                playerNameInput.focus();
            } else {
                window.showNotification('Please enter a player name', 'warning');
            }
        });

        // Add on Enter key
        playerNameInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                const playerName = this.value.trim();
                if (playerName) {
                    addPlayerManually(playerName);
                    this.value = '';
                } else {
                    window.showNotification('Please enter a player name', 'warning');
                }
            }
        });
    }
}

/**
 * Add a player manually to the picker
 */
function addPlayerManually(playerName) {
    if (!playerName || !playerName.trim()) {
        window.showNotification('Please enter a valid player name', 'warning');
        return;
    }

    // Check if player already exists
    const existingPlayer = availablePlayers.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
    );
    
    if (existingPlayer) {
        window.showNotification('Player already exists in the pool', 'warning');
        return;
    }

    // Create a new player object
    const newPlayer = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: playerName.trim(),
        dota2id: 'Manual',
        peakmmr: 0,
        isManual: true
    };

    // Add to available players
    availablePlayers.push(newPlayer);
    
    // Update display
    displayPlayersForPicker(availablePlayers);
    
    window.showNotification(`Added "${playerName}" to picker`, 'success');
}

/**
 * Load players for the selected tournament session
 */
async function loadPlayersForPicker() {
    if (!currentSessionId) {
        window.showNotification('Please select a tournament first', 'warning');
        
        // Clear player display
        const playersContainer = document.getElementById('picker-players-container') || 
                                document.querySelector('.picker-players-container');
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
        const playersContainer = document.getElementById('picker-players-container') || 
                                document.querySelector('.picker-players-container') ||
                                document.getElementById('player-list-display');
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
            window.showNotification('Session expired. Please login again.', 'error');
            return;
        }

        // Build API URL exactly like Team Balancer does
        let apiUrl = '/.netlify/functions/api-players?includeSessionInfo=true';
        if (currentSessionId) {
            apiUrl += `&sessionId=${currentSessionId}`;
        }

        const response = await fetchWithAuth(apiUrl);

        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.players)) {
            availablePlayers = data.players.filter(player => 
                player.name && 
                player.name.trim() !== ''
            );

            displayPlayersForPicker(availablePlayers);
    
    // Update player count
            const playerCountBadge = document.getElementById('picker-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = availablePlayers.length;
            }

            if (availablePlayers.length === 0) {
                window.showNotification('No players found in selected tournament', 'info');
            } else {
                window.showNotification(`Loaded ${availablePlayers.length} players from tournament`, 'success');
            }
        } else {
            console.error('Failed to load players for Random Picker:', data.message || 'Unknown error');
            window.showNotification(data.message || 'Failed to load players', 'error');
            availablePlayers = [];
            displayPlayersForPicker([]);
            
            const playerCountBadge = document.getElementById('picker-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = '0';
            }
        }

    } catch (error) {
        console.error('Error loading players for picker:', error);
        
        const playersContainer = document.getElementById('picker-players-container') || 
                                document.querySelector('.picker-players-container') ||
                                document.getElementById('player-list-display');
        if (playersContainer) {
            playersContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error loading players: ${error.message}
                </div>
            `;
        }
        
        window.showNotification('Failed to load players for random picker', 'error');
    }
}

/**
 * Display players for the random picker
 */
function displayPlayersForPicker(players) {
    const playersList = document.getElementById('picker-players-list');
    const playerCountElement = document.getElementById('picker-player-count');
    
    if (!playersList) {
        console.error('Players list container not found');
        return;
    }
    
    // Update player count badges with total count
    const count = players ? players.length : 0;
    if (playerCountElement) {
        playerCountElement.textContent = count;
    }
    
    const totalCountElement = document.getElementById('picker-total-count');
    if (totalCountElement) {
        totalCountElement.textContent = `${count} players`;
    }

    if (!players || players.length === 0) {
        playersList.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    <i class="bi bi-info-circle fs-4 d-block mb-2"></i>
                    <span>${currentSessionId ? 'No players found in this tournament.' : 'Please select a tournament to load players.'}</span>
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
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-success pick-single-player" 
                            data-id="${player.id}" data-index="${index}" title="Pick This Player">
                        <i class="bi bi-hand-index"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger exclude-player" 
                            data-id="${player.id}" data-index="${index}" title="Exclude from Pool">
                        <i class="bi bi-eye-slash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    playersList.innerHTML = playersHtml;
    
    // Setup action buttons after adding players
    setupPickerActionButtons();
}

/**
 * Setup picker action buttons
 */
function setupPickerActionButtons() {
    // Pick single player buttons
    document.querySelectorAll('.pick-single-player').forEach(button => {
        button.addEventListener('click', (e) => {
            const playerId = e.currentTarget.getAttribute('data-id');
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            pickSpecificPlayer(playerId, playerIndex);
        });
    });

    // Exclude player buttons
    document.querySelectorAll('.exclude-player').forEach(button => {
        button.addEventListener('click', (e) => {
            const playerId = e.currentTarget.getAttribute('data-id');
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            excludePlayerFromPool(playerId, playerIndex);
        });
    });
}

/**
 * Pick a specific player by ID
 */
function pickSpecificPlayer(playerId, playerIndex) {
    // Find player by ID instead of using index (fixes sorting bug)
    const playerRealIndex = availablePlayers.findIndex(p => p.id === playerId);
    
    if (playerRealIndex >= 0 && playerRealIndex < availablePlayers.length) {
        const selectedPlayer = availablePlayers[playerRealIndex];
        console.log(`Player to pick: ${selectedPlayer.name} (ID: ${playerId}, Real Index: ${playerRealIndex})`);
        
        // Add to history
        const historyEntry = {
            type: 'manual',
            timestamp: new Date().toISOString(),
            players: [selectedPlayer],
            tournament: registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament'
        };
        
        pickerHistory.unshift(historyEntry);

        // Display result
        displayPickerResult([selectedPlayer], 'Manually Selected Player');

        // Update history display
        updateHistoryDisplay();

        window.showNotification(`Selected: ${selectedPlayer.name}`, 'success');
    } else {
        console.error(`Player not found with ID: ${playerId}. Available players: ${availablePlayers.length}`);
        window.showNotification('Error: Player not found', 'error');
    }
}

/**
 * Exclude player from the pool temporarily
 */
function excludePlayerFromPool(playerId, playerIndex) {
    // Find player by ID instead of using index (fixes sorting bug)
    const playerRealIndex = availablePlayers.findIndex(p => p.id === playerId);
    
    if (playerRealIndex >= 0 && playerRealIndex < availablePlayers.length) {
        const player = availablePlayers[playerRealIndex];
        console.log(`Player to exclude: ${player.name} (ID: ${playerId}, Real Index: ${playerRealIndex})`);
        
        if (confirm(`Temporarily exclude ${player.name} from random picker?`)) {
            // Add to excluded players if not already there
            if (!excludedPlayers) {
                excludedPlayers = [];
            }
            
            const alreadyExcluded = excludedPlayers.find(p => p.id === player.id);
            if (!alreadyExcluded) {
                excludedPlayers.push(player);
                
                // Remove from available players using the correct index
                availablePlayers.splice(playerRealIndex, 1);
                
                // Refresh display
                displayPlayersForPicker(availablePlayers);
                
                window.showNotification(`${player.name} excluded from picker pool`, 'info');
            } else {
                window.showNotification(`${player.name} is already excluded`, 'warning');
            }
        }
    } else {
        console.error(`Player not found with ID: ${playerId}. Available players: ${availablePlayers.length}`);
        window.showNotification('Error: Player not found', 'error');
    }
}

/**
 * Pick a random player from the available players
 */
function pickRandomPlayerInternal() {
    if (!currentSessionId) {
        window.showNotification('Please select a tournament first', 'warning');
        return;
    }

    if (!availablePlayers || availablePlayers.length === 0) {
        window.showNotification('Please load players first', 'warning');
        return;
    }

    // Get timer duration from input
    const timerInput = document.getElementById('timer-input');
    const timerSeconds = timerInput ? parseInt(timerInput.value) || 5 : 5;
    
    // Disable the pick button during animation
    const pickButton = document.getElementById('pick-random');
    if (pickButton) {
        pickButton.disabled = true;
        pickButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Picking...';
    }

    // Start the animated picking process
    startAnimatedPicking(timerSeconds, (selectedPlayer) => {
        // Check if "remove name after picking" is enabled
        const removeAfterPickCheckbox = document.getElementById('remove-after-pick');
        const shouldRemove = removeAfterPickCheckbox ? removeAfterPickCheckbox.checked : false;
        
        if (shouldRemove) {
            // Remove the selected player from available players
            const playerIndex = availablePlayers.findIndex(p => p.name === selectedPlayer.name);
            if (playerIndex > -1) {
                availablePlayers.splice(playerIndex, 1);
                displayPlayersForPicker(availablePlayers);
            }
        }

        // Add to history
        const historyEntry = {
            type: 'single',
            timestamp: new Date().toISOString(),
            players: [selectedPlayer],
            tournament: registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament'
        };
        
        pickerHistory.unshift(historyEntry);

        // Display result with animation
        displayPickerResultWithAnimation([selectedPlayer], 'Random Player Selected');

        // Update history display
        updateHistoryDisplay();

        // Re-enable the pick button
        if (pickButton) {
            pickButton.disabled = false;
            pickButton.innerHTML = '<i class="bi bi-shuffle me-2"></i>Pick Random Player';
        }

        window.showNotification(`Selected: ${selectedPlayer.name}`, 'success');
    });
}

/**
 * Start animated picking process
 */
function startAnimatedPicking(durationSeconds, callback) {
    const resultContainer = document.getElementById('picker-result-container');
    if (!resultContainer) {
        console.error('Result container not found');
        return;
    }

    // Show animation container
    resultContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="mb-4">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Picking...</span>
                </div>
                <h4 id="animated-player-name" class="display-6 text-primary fw-bold mb-3">
                    🎲 Picking...
                </h4>
                <div class="progress mb-3" style="height: 10px;">
                    <div id="pick-progress" class="progress-bar bg-primary progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%"></div>
                </div>
                <div id="countdown-timer" class="h5 text-muted">
                    <i class="bi bi-stopwatch me-2"></i><span id="countdown-seconds">${durationSeconds}</span>s
                </div>
            </div>
        </div>
    `;

    const animatedNameElement = document.getElementById('animated-player-name');
    const progressBar = document.getElementById('pick-progress');
    const countdownElement = document.getElementById('countdown-seconds');
    
    let timeLeft = durationSeconds;
    let animationInterval;
    let countdownInterval;
    
    // Start name cycling animation
    animationInterval = setInterval(() => {
        if (availablePlayers.length > 0) {
            const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
            animatedNameElement.textContent = randomPlayer.name;
            animatedNameElement.className = 'display-6 text-primary fw-bold mb-3 winner-animation';
        }
    }, 100); // Change name every 100ms
    
    // Start countdown and progress
    countdownInterval = setInterval(() => {
        timeLeft--;
        const progress = ((durationSeconds - timeLeft) / durationSeconds) * 100;
        
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (countdownElement) countdownElement.textContent = Math.max(0, timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(animationInterval);
            clearInterval(countdownInterval);
            
            // Pick the final player
            const finalIndex = Math.floor(Math.random() * availablePlayers.length);
            const selectedPlayer = availablePlayers[finalIndex];
            
            // Final animation
            animatedNameElement.textContent = selectedPlayer.name;
            animatedNameElement.className = 'display-6 text-success fw-bold mb-3 winner-animation';
            
            // Show confetti effect
            if (progressBar) progressBar.className = 'progress-bar bg-success';
            
    setTimeout(() => {
                callback(selectedPlayer);
            }, 1000); // Wait 1 second before showing final result
        }
    }, 1000);
}

/**
 * Display picker result with animation
 */
function displayPickerResultWithAnimation(players, title) {
    const resultContainer = document.getElementById('picker-result-container');
    
    if (!resultContainer) {
        console.error('Result container not found');
        return;
    }

    const player = players[0]; // For single player selection
    
    const resultHtml = `
        <div class="card border-success animate__animated animate__bounceIn">
            <div class="card-header bg-success text-white">
                <h6 class="mb-0">
                    <i class="bi bi-star-fill me-2"></i>
                    🎉 ${title}
                </h6>
                        </div>
            <div class="card-body text-center">
                <div class="mb-4">
                    <div class="display-4 mb-3">🏆</div>
                    <h3 class="text-success fw-bold winner-animation">${escapeHtml(player.name)}</h3>
                    <p class="text-muted mb-3">Dota 2 ID: ${player.dota2id || 'N/A'}</p>
                    <span class="badge bg-primary fs-6 px-3 py-2">${player.peakmmr || 0} MMR</span>
                </div>
                <div class="text-muted small">
                    <i class="bi bi-clock me-1"></i>
                    Selected at ${formatDateWithTimezone(new Date())}
                </div>
            </div>
                    </div>
                `;

    resultContainer.innerHTML = resultHtml;
    
    // Add celebration sound effect (optional)
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // Audio API not supported, continue without sound
    }
}

/**
 * Pick multiple random players
 */
function pickMultiplePlayersInternal() {
    if (!currentSessionId) {
        window.showNotification('Please select a tournament first', 'warning');
            return;
        }

    if (!availablePlayers || availablePlayers.length === 0) {
        window.showNotification('Please load players first', 'warning');
        return;
    }

    // Get number of players to pick from input
    const numberInput = document.getElementById('pick-count-input') || 
                       document.querySelector('input[name="pick-count"]');
    const numberToPick = numberInput ? parseInt(numberInput.value) || 1 : 1;

    if (numberToPick <= 0) {
        window.showNotification('Please enter a valid number of players to pick', 'warning');
            return;
        }

    if (numberToPick > availablePlayers.length) {
        window.showNotification(`Cannot pick ${numberToPick} players. Only ${availablePlayers.length} available.`, 'warning');
        return;
    }

    // Shuffle and pick the specified number of players
    const shuffledPlayers = [...availablePlayers].sort(() => Math.random() - 0.5);
    const selectedPlayers = shuffledPlayers.slice(0, numberToPick);

    // Add to history
    const historyEntry = {
        type: 'multiple',
        timestamp: new Date().toISOString(),
        players: selectedPlayers,
        tournament: registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament'
    };
    
    pickerHistory.unshift(historyEntry);

    // Display result
    displayPickerResult(selectedPlayers, `${numberToPick} Random Players Selected`);

    // Update history display
    updateHistoryDisplay();

    window.showNotification(`Selected ${numberToPick} players`, 'success');
}

/**
 * Display picker result
 */
function displayPickerResult(players, title) {
    const resultContainer = document.getElementById('picker-result-container') || 
                           document.querySelector('.picker-result-container') ||
                           document.getElementById('pick-result');
    
    if (!resultContainer) {
        console.error('Result container not found');
        return;
    }

    const resultHtml = `
        <div class="card border-success">
            <div class="card-header bg-success text-white">
                <h6 class="mb-0">
                    <i class="bi bi-star-fill me-2"></i>
                    ${title}
                </h6>
            </div>
            <div class="card-body">
                ${players.map((player, index) => `
                    <div class="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded">
                        <div>
                            <div class="fw-bold">${escapeHtml(player.name)}</div>
                            <small class="text-muted">Dota 2 ID: ${player.dota2id || 'N/A'}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-primary">${player.peakmmr || 0} MMR</span>
                        </div>
                    </div>
                `).join('')}
                <div class="text-muted small mt-3">
                    <i class="bi bi-clock me-1"></i>
                    Selected at ${formatDateWithTimezone(new Date())}
                </div>
            </div>
        </div>
    `;

    resultContainer.innerHTML = resultHtml;
}

/**
 * Clear picker results
 */
function clearPickerResults() {
    const resultContainer = document.getElementById('picker-result-container');
    
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No picks made yet. Use the buttons to pick random players.
            </div>
        `;
    }
}

/**
 * Update history display
 */
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('picker-history-container');
    
    if (!historyContainer) return;

    if (!pickerHistory || pickerHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="alert alert-info mb-0">
                <i class="bi bi-clock-history me-2"></i>
                No pick history yet.
            </div>
        `;
        return;
    }

    const historyHtml = `
        <div class="small">
            <div class="fw-bold mb-2 text-muted">
                Recent Picks (${pickerHistory.length})
            </div>
            ${pickerHistory.slice(0, 8).map((entry, index) => `
                <div class="d-flex justify-content-between align-items-center py-2 ${index < pickerHistory.length - 1 && index < 7 ? 'border-bottom' : ''}">
                    <div class="flex-grow-1">
                        <div class="fw-bold" style="font-size: 0.85rem;">
                            ${entry.type === 'single' ? '🎯' : '🎲'} ${entry.players.map(p => p.name).join(', ')}
                        </div>
                        <div class="text-muted" style="font-size: 0.75rem;">
                            ${entry.tournament} • ${formatDateWithTimezone(entry.timestamp)}
                        </div>
                    </div>
                </div>
            `).join('')}
            ${pickerHistory.length > 8 ? `
                <div class="text-center text-muted mt-2" style="font-size: 0.75rem;">
                    ... and ${pickerHistory.length - 8} more picks
                </div>
            ` : ''}
        </div>
    `;

    historyContainer.innerHTML = historyHtml;
}

/**
 * Clear picker history
 */
function clearPickerHistory() {
    if (!confirm('Are you sure you want to clear the pick history?')) {
        return;
    }

    pickerHistory = [];
    updateHistoryDisplay();
    window.showNotification('Pick history cleared', 'info');
}

/**
 * Export picker history
 */
function exportPickerHistory() {
    if (!pickerHistory || pickerHistory.length === 0) {
        window.showNotification('No history to export', 'warning');
        return;
    }

    // Create export data
    const exportData = {
        tournament: currentSessionId ? 
            (registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament') :
            'Multiple Tournaments',
        exportDate: new Date().toISOString(),
        totalPicks: pickerHistory.length,
        history: pickerHistory.map(entry => ({
            type: entry.type,
            timestamp: entry.timestamp,
            tournament: entry.tournament,
            players: entry.players.map(player => ({
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
    link.download = `random-picks-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);

    window.showNotification('Pick history exported successfully', 'success');
}

/**
 * Setup listener for registration updates
 * This allows the random picker to refresh when registration settings change
 */
function setupRandomPickerRegistrationListener() {
    window.randomPickerRegistrationListener = function(event) {
        loadRegistrationSessions().then(() => {
            // Only reload players if the dropdown triggers it
            // No direct call to loadPlayersForPicker here
            window.showNotification('Random picker refreshed due to registration changes', 'info');
        });
    };
    window.addEventListener('registrationUpdated', window.randomPickerRegistrationListener);
    window.refreshRandomPickerData = function() {
        // Only trigger the session selector change event if a session is selected
        const selector = document.getElementById('picker-session-selector');
        if (selector && selector.value) {
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification - using global notification system
 */

/**
 * Show excluded players modal
 */
function showExcludedPlayersModal() {
    if (!excludedPlayers || excludedPlayers.length === 0) {
        window.showNotification('No excluded players', 'info');
        return;
    }

    const modalHtml = `
        <div class="modal fade" id="excludedPlayersModal" tabindex="-1" aria-labelledby="excludedPlayersModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="excludedPlayersModalLabel">
                            <i class="bi bi-eye-slash me-2"></i>Excluded Players (${excludedPlayers.length})
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead class="table-light">
                                    <tr>
                                        <th>Name</th>
                                        <th class="text-center">MMR</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${excludedPlayers.map((player, index) => `
                                        <tr>
                                            <td>
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
                                            <td class="text-center">
                                                <span class="badge bg-primary">${player.peakmmr || 0}</span>
                                            </td>
                                            <td class="text-end">
                                                <button type="button" class="btn btn-sm btn-outline-success restore-player" 
                                                        data-index="${index}" title="Restore to Pool">
                                                    <i class="bi bi-arrow-clockwise"></i> Restore
                        </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-success" id="restore-all-players">
                            <i class="bi bi-arrow-clockwise me-2"></i>Restore All
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
                    </div>
                `;
                
    // Remove existing modal if it exists
    const existingModal = document.getElementById('excludedPlayersModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup restore buttons
    document.querySelectorAll('.restore-player').forEach(button => {
        button.addEventListener('click', (e) => {
            const playerIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            restorePlayerFromExcluded(playerIndex);
        });
    });

    // Setup restore all button
    document.getElementById('restore-all-players').addEventListener('click', () => {
        restoreAllExcludedPlayers();
    });

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('excludedPlayersModal'));
    modal.show();

    // Clean up modal when hidden
    document.getElementById('excludedPlayersModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

/**
 * Restore a specific player from excluded list
 */
function restorePlayerFromExcluded(playerIndex) {
    if (playerIndex >= 0 && playerIndex < excludedPlayers.length) {
        const player = excludedPlayers[playerIndex];
        
        // Add back to available players
        availablePlayers.push(player);
        
        // Remove from excluded players
        excludedPlayers.splice(playerIndex, 1);
        
        // Refresh displays
        displayPlayersForPicker(availablePlayers);
        
        // Close modal if no more excluded players
        if (excludedPlayers.length === 0) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('excludedPlayersModal'));
            if (modal) {
                modal.hide();
            }
        } else {
            // Refresh modal content
            showExcludedPlayersModal();
        }
        
        window.showNotification(`${player.name} restored to picker pool`, 'success');
    }
}

/**
 * Restore all excluded players
 */
function restoreAllExcludedPlayers() {
    if (excludedPlayers.length === 0) {
        return;
    }
    
    const restoredCount = excludedPlayers.length;
    
    // Add all excluded players back to available players
    availablePlayers.push(...excludedPlayers);
    
    // Clear excluded players
    excludedPlayers = [];
    
    // Refresh display
    displayPlayersForPicker(availablePlayers);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('excludedPlayersModal'));
    if (modal) {
        modal.hide();
    }
    
    window.showNotification(`Restored ${restoredCount} players to picker pool`, 'success');
}

// Legacy functions for backward compatibility
function loadPlayersList() {
    return loadPlayersForPicker();
}

function pickRandomPlayer() {
    return pickRandomPlayerInternal();
}

function pickMultiplePlayers() {
    return pickMultiplePlayersInternal();
}

function clearHistory() {
    return clearPickerHistory();
}

function exportHistory() {
    return exportPickerHistory();
}

// Expose functions globally for compatibility
window.randomPickerModule = {
    initRandomPicker,
    cleanupRandomPicker,
    loadPlayersForPicker,
    pickRandomPlayerInternal,
    pickMultiplePlayersInternal,
    clearPickerHistory,
    exportPickerHistory
};

// Expose init function globally for navigation system
window.initRandomPicker = initRandomPicker;

// Expose cleanup function globally for navigation system
window.cleanupRandomPicker = cleanupRandomPicker;

// Legacy global functions for existing onclick handlers
window.loadPlayersList = loadPlayersForPicker;
window.pickRandomPlayer = pickRandomPlayer;
window.pickMultiplePlayers = pickMultiplePlayers;
window.clearHistory = clearPickerHistory;
window.exportHistory = exportPickerHistory;
window.showExcludedPlayersModal = showExcludedPlayersModal;

/**
 * Cleanup function for random picker when switching tabs
 */
function cleanupRandomPicker() {
    // Clear any ongoing operations
    if (state.pickerTimer) {
        clearTimeout(state.pickerTimer);
        state.pickerTimer = null;
    }
    state.isPicking = false;
    
    // Clear state data
    state.currentSessionId = null;
    state.registrationSessions = [];
    state.availablePlayers = [];
    state.pickerHistory = [];
    
    // Clear DOM content
    const pickerPlayerList = document.getElementById('random-picker-players');
    if (pickerPlayerList) pickerPlayerList.innerHTML = '';
    
    const pickerResult = document.getElementById('picker-result');
    if (pickerResult) pickerResult.innerHTML = '';
    
    const pickerHistory = document.getElementById('picker-history');
    if (pickerHistory) pickerHistory.innerHTML = '';
    
    // Clear session selector
    const sessionSelector = document.getElementById('random-picker-session-selector');
    if (sessionSelector) sessionSelector.innerHTML = '<option value="">Loading sessions...</option>';
    
    // Remove event listeners by cloning elements (this removes all attached listeners)
    const elementsToClean = [
        'random-picker-session-selector',
        'refresh-picker-sessions',
        'add-player-picker',
        'clear-picker-results',
        'pick-random-btn',
        'pick-multiple-btn',
        'clear-history-btn',
        'export-history-btn',
        'show-excluded-btn',
        'player-name-picker'
    ];
    
    elementsToClean.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        }
    });
    
    // Clear any custom event listeners
    window.removeEventListener('registrationUpdated', window.randomPickerRegistrationListener);
    
    // Remove any existing modals
    const existingModal = document.getElementById('excludedPlayersModal');
    if (existingModal) {
        existingModal.remove();
    }
}

/**
 * Import players from team balancer
 */
async function importPlayersFromTeamBalancer() {
    try {
        const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
        
        if (!sessionId) {
            window.showNotification('Session expired. Please login again.', 'error');
            return;
        }

        const response = await fetchWithAuth('/.netlify/functions/api-players?includeSessionInfo=true');
        
        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success || !data.players || data.players.length === 0) {
            window.showNotification('No players available to import', 'warning');
            return;
        }
        
        // Add each player to the picker
        let importCount = 0;
        for (const player of data.players) {
            if (player.name && player.name.trim() !== '') {
                // Check if player already exists
                const existingPlayer = availablePlayers.find(p => p.name === player.name);
                if (!existingPlayer) {
                    availablePlayers.push(player);
                    importCount++;
                }
            }
        }
        
        // Refresh display
        displayPlayersForPicker(availablePlayers);
        
        window.showNotification(`Imported ${importCount} players successfully`, 'success');
    } catch (error) {
        console.error('Error importing players:', error);
        window.showNotification(`Failed to import players: ${error.message}`, 'error');
    }
}

})(); // Close IIFE
