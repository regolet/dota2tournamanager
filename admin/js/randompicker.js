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
        options.headers['X-Session-Id'] = sessionId;
    }
    return fetch(url, options);
}

// Random Picker with Registration Session Support

let currentSessionId = null;
let registrationSessions = [];
let availablePlayers = [];
let pickerHistory = [];

/**
 * Initialize the random picker
 */
async function initRandomPicker() {
    try {
        // Create session selector for random picker
        await createRandomPickerSessionSelector();
        
        // Load registration sessions
        await loadRegistrationSessions();
        
        // Setup event listeners
        setupRandomPickerEventListeners();
        
        console.log('Random picker initialized successfully');
    } catch (error) {
        console.error('Error initializing random picker:', error);
        showNotification('Failed to initialize random picker', 'error');
    }
}

/**
 * Create session selector for random picker
 */
async function createRandomPickerSessionSelector() {
    const sessionSelectorContainer = document.querySelector('.picker-session-selector-container');
    
    if (!sessionSelectorContainer) {
        // Create session selector if it doesn't exist
        const randomPickerContent = document.querySelector('#random-picker') || 
                                    document.querySelector('.random-picker-section');
        
        if (randomPickerContent) {
            const selectorHtml = `
                <div class="picker-session-selector-container mb-4">
                    <div class="card shadow-sm">
                        <div class="card-body p-3">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <div class="d-flex align-items-center">
                                        <i class="bi bi-funnel me-2 text-primary"></i>
                                        <label for="picker-session-selector" class="form-label mb-0 me-3">
                                            Select Tournament:
                                        </label>
                                        <select id="picker-session-selector" class="form-select" style="max-width: 400px;">
                                            <option value="">Choose a tournament...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <button id="refresh-picker-sessions" class="btn btn-outline-primary btn-sm me-2">
                                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                                    </button>
                                    <span id="picker-player-count" class="badge bg-secondary">0 players</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert at the beginning of the random picker content
            randomPickerContent.insertAdjacentHTML('afterbegin', selectorHtml);
        }
    }
}

/**
 * Load registration sessions for random picker
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
    const selector = document.getElementById('picker-session-selector');
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
    const pickRandomBtn = document.getElementById('pick-random-btn') || 
                         document.querySelector('[onclick="pickRandomPlayer()"]');
    if (pickRandomBtn) {
        pickRandomBtn.removeAttribute('onclick');
        pickRandomBtn.addEventListener('click', pickRandomPlayer);
    }

    // Pick Multiple Players button
    const pickMultipleBtn = document.getElementById('pick-multiple-btn') || 
                           document.querySelector('[onclick="pickMultiplePlayers()"]');
    if (pickMultipleBtn) {
        pickMultipleBtn.removeAttribute('onclick');
        pickMultipleBtn.addEventListener('click', pickMultiplePlayers);
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
}

/**
 * Load players for the selected tournament session
 */
async function loadPlayersForPicker() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        
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
            availablePlayers = data.players;

            displayPlayersForPicker(availablePlayers);
            
            // Update player count
            const playerCountBadge = document.getElementById('picker-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = `${availablePlayers.length} players`;
            }

            showNotification(`Loaded ${availablePlayers.length} players from tournament`, 'success');
        } else {
            availablePlayers = [];
            displayPlayersForPicker([]);
            
            const playerCountBadge = document.getElementById('picker-player-count');
            if (playerCountBadge) {
                playerCountBadge.textContent = '0 players';
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
        
        showNotification('Failed to load players for random picker', 'error');
    }
}

/**
 * Display players for the random picker
 */
function displayPlayersForPicker(players) {
    const playersContainer = document.getElementById('picker-players-container') || 
                            document.querySelector('.picker-players-container') ||
                            document.getElementById('player-list-display');
    
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

    // Sort players by name
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

    const playersHtml = `
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0">
                    <i class="bi bi-people me-2"></i>
                    Available Players (${players.length})
                </h6>
            </div>
            <div class="card-body">
                <div class="row">
                    ${sortedPlayers.map((player, index) => `
                        <div class="col-md-6 col-lg-4 mb-2">
                            <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                                <div>
                                    <div class="fw-bold small">${escapeHtml(player.name)}</div>
                                    <small class="text-muted">${player.dota2id || 'N/A'}</small>
                                </div>
                                <span class="badge bg-primary">${player.peakmmr || 0}</span>
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
 * Pick a random player from the available players
 */
function pickRandomPlayer() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        return;
    }

    if (!availablePlayers || availablePlayers.length === 0) {
        showNotification('Please load players first', 'warning');
        return;
    }

    // Pick a random player
    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];

    // Add to history
    const historyEntry = {
        type: 'single',
        timestamp: new Date().toISOString(),
        players: [selectedPlayer],
        tournament: registrationSessions.find(s => s.sessionId === currentSessionId)?.title || 'Unknown Tournament'
    };
    
    pickerHistory.unshift(historyEntry);

    // Display result
    displayPickerResult([selectedPlayer], 'Random Player Selected');

    // Update history display
    updateHistoryDisplay();

    showNotification(`Selected: ${selectedPlayer.name}`, 'success');
}

/**
 * Pick multiple random players
 */
function pickMultiplePlayers() {
    if (!currentSessionId) {
        showNotification('Please select a tournament first', 'warning');
        return;
    }

    if (!availablePlayers || availablePlayers.length === 0) {
        showNotification('Please load players first', 'warning');
        return;
    }

    // Get number of players to pick from input
    const numberInput = document.getElementById('pick-count-input') || 
                       document.querySelector('input[name="pick-count"]');
    const numberToPick = numberInput ? parseInt(numberInput.value) || 1 : 1;

    if (numberToPick <= 0) {
        showNotification('Please enter a valid number of players to pick', 'warning');
        return;
    }

    if (numberToPick > availablePlayers.length) {
        showNotification(`Cannot pick ${numberToPick} players. Only ${availablePlayers.length} available.`, 'warning');
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

    showNotification(`Selected ${numberToPick} players`, 'success');
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
                    Selected at ${new Date().toLocaleString()}
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
    const resultContainer = document.getElementById('picker-result-container') || 
                           document.querySelector('.picker-result-container') ||
                           document.getElementById('pick-result');
    
    if (resultContainer) {
        resultContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No picks made yet. Use the buttons above to pick random players.
            </div>
        `;
    }
}

/**
 * Update history display
 */
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('picker-history-container') || 
                            document.querySelector('.picker-history-container') ||
                            document.getElementById('pick-history');
    
    if (!historyContainer) return;

    if (!pickerHistory || pickerHistory.length === 0) {
        historyContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-clock-history me-2"></i>
                No pick history yet.
            </div>
        `;
        return;
    }

    const historyHtml = `
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0">
                    <i class="bi bi-clock-history me-2"></i>
                    Pick History (${pickerHistory.length})
                </h6>
            </div>
            <div class="card-body">
                ${pickerHistory.slice(0, 10).map((entry, index) => `
                    <div class="border-bottom pb-2 mb-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <div class="fw-bold small">
                                    ${entry.type === 'single' ? 'Single Pick' : `Multiple Pick (${entry.players.length})`}
                                </div>
                                <div class="text-muted small">${entry.tournament}</div>
                                <div class="small">
                                    ${entry.players.map(p => p.name).join(', ')}
                                </div>
                            </div>
                            <small class="text-muted">
                                ${new Date(entry.timestamp).toLocaleTimeString()}
                            </small>
                        </div>
                    </div>
                `).join('')}
                ${pickerHistory.length > 10 ? `
                    <div class="text-center text-muted small">
                        ... and ${pickerHistory.length - 10} more entries
                    </div>
                ` : ''}
            </div>
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
    showNotification('Pick history cleared', 'info');
}

/**
 * Export picker history
 */
function exportPickerHistory() {
    if (!pickerHistory || pickerHistory.length === 0) {
        showNotification('No history to export', 'warning');
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

    showNotification('Pick history exported successfully', 'success');
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

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    notification.style.zIndex = '9999';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close ms-2" aria-label="Close"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    // Allow manual close
    notification.querySelector('.btn-close').addEventListener('click', () => {
        notification.remove();
    });
}

// Legacy functions for backward compatibility
function loadPlayersList() {
    return loadPlayersForPicker();
}

function pickRandomPlayer() {
    return pickRandomPlayer();
}

function pickMultiplePlayers() {
    return pickMultiplePlayers();
}

function clearHistory() {
    return clearPickerHistory();
}

function exportHistory() {
    return exportPickerHistory();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initRandomPicker);

// Expose functions globally for compatibility
window.randomPickerModule = {
    initRandomPicker,
    loadPlayersForPicker,
    pickRandomPlayer,
    pickMultiplePlayers,
    clearPickerHistory,
    exportPickerHistory
};

// Legacy global functions for existing onclick handlers
window.loadPlayersList = loadPlayersForPicker;
window.pickRandomPlayer = pickRandomPlayer;
window.pickMultiplePlayers = pickMultiplePlayers;
window.clearHistory = clearPickerHistory;
window.exportHistory = exportPickerHistory;

})(); // Close IIFE
