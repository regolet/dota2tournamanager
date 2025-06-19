// Wrap in IIFE to avoid global variable conflicts
(function() {
    'use strict';

    // Module state object to avoid variable redeclaration conflicts
    if (!window.randomPickerState) {
        window.randomPickerState = {
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

// Initialize random picker module
async function initRandomPicker() {
    try {
        // Initializing Random Picker module
        
        // Wait a moment for DOM to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get DOM elements - updated to match HTML template and update state
        pickerPlayerList = state.pickerPlayerList = document.getElementById('player-list-picker');
        
        // Find the result area more specifically - it's in the right column
        pickerResult = state.pickerResult = document.querySelector('.col-lg-7 .card-body') || 
                                          document.querySelector('#random-picker .col-lg-7 .card-body') ||
                                          document.querySelector('.card-body.d-flex.flex-column');
        
        pickButton = state.pickButton = document.getElementById('pick-random');
        clearButton = state.clearButton = document.getElementById('clear-players-picker');
        pickerAnimationArea = state.pickerAnimationArea = pickerResult; // Same as result area
        playerNameInputPicker = state.playerNameInputPicker = document.getElementById('player-name-picker');
        
        // DOM Elements initialized
        
        // Check if result element exists
        if (!pickerResult) {
            // Try more specific selectors
            const alternatives = [
                '.col-lg-7 .card-body',
                'section#random-picker .col-lg-7 .card-body',
                '[class*="col-lg-7"] .card-body',
                '.card:last-child .card-body'
            ];
            
            for (const selector of alternatives) {
                const element = document.querySelector(selector);
                if (element) {
                    pickerResult = state.pickerResult = element;
                    // Found result area
                    break;
                }
            }
        }
        
        // Set up event listeners for the add player button
        const addPlayerBtn = document.getElementById('add-player-picker');
        if (addPlayerBtn && playerNameInputPicker) {
            addPlayerBtn.addEventListener('click', () => {
                addPlayerToPicker(playerNameInputPicker.value);
            });
            
            playerNameInputPicker.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    addPlayerToPicker(playerNameInputPicker.value);
                }
            });
        }
        
        // Set up clear button
        if (clearButton) {
            clearButton.addEventListener('click', clearPicker);
        }
        
        // Set up pick random player button
        if (pickButton) {
            pickButton.addEventListener('click', () => {
                pickRandomPlayer();
            });
        }
        
        // Set up import button
        const importBtn = document.getElementById('import-players-to-picker');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/players');
                    if (response.ok) {
                        const players = await response.json();
                        if (players && players.length > 0) {
                            let importCount = 0;
                            for (const player of players) {
                                if (player.name) {
                                    addPlayerToPicker(player.name);
                                    importCount++;
                                }
                            }
                            showNotification(`Imported ${importCount} players`, 'success');
                        } else {
                            showNotification('No players available to import', 'warning');
                        }
                    } else {
                        throw new Error(`Failed to load players: ${response.status}`);
                    }
                } catch (error) {
                    // Error importing players
                    showNotification(`Error importing players: ${error.message}`, 'danger');
                }
            });
        }
        
        // Set up refresh button
        const refreshBtn = document.getElementById('refresh-players-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadPickerPlayers);
        }
        
        // Load initial players
        await loadPickerPlayers();
        
        // Random Picker initialization complete
        return true;
        
    } catch (error) {
        // Error initializing Random Picker
        return false;
    }
}

// Load players for the picker
async function loadPickerPlayers() {
    try {
        // Load from correct API endpoint
        const response = await fetch('/.netlify/functions/api-players');
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.players) && data.players.length > 0) {
                pickerPlayers = state.pickerPlayers = data.players.map(player => ({
                    name: player.name,
                    dota2id: player.dota2id || 'N/A',
                    peakmmr: player.peakmmr || 'N/A'
                }));
                console.log(`Loaded ${pickerPlayers.length} players from API`);
            } else {
                console.log('No players returned from API or invalid format');
                pickerPlayers = state.pickerPlayers = [];
            }
        } else {
            throw new Error(`Failed to load players: ${response.status}`);
        }
    } catch (error) {
        console.error('Error loading players:', error);
        pickerPlayers = state.pickerPlayers = [];
    }
    
    // Always render the player list, even if empty
    renderPickerPlayerList();
    
    // Return the players for chaining
    return pickerPlayers;
}

// Render the player list for the picker in a single row format
function renderPickerPlayerList(filter = '') {
    // Rendering player list
    
    if (!pickerPlayerList) {
        pickerPlayerList = state.pickerPlayerList = document.getElementById('player-list-picker');
        if (!pickerPlayerList) {
            // Player list element not found
            return;
        }
    }
    
    pickerPlayerList.innerHTML = '';
    
    const filteredPlayers = filter 
        ? pickerPlayers.filter(p => 
            p.name.toLowerCase().includes(filter.toLowerCase()) ||
            (p.dota2id && p.dota2id.toString().includes(filter)))
        : [...pickerPlayers]; // Show all players in pool
    
    if (filteredPlayers.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'list-group-item text-muted text-center py-3';
        emptyItem.textContent = 'No players available';
        pickerPlayerList.appendChild(emptyItem);
        
        // Update player count
        const playerCountElement = document.getElementById('player-count-picker');
        if (playerCountElement) {
            playerCountElement.textContent = '0';
        }
        return;
    }
    
    // Create individual list items for each player
    filteredPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        // Player info
        const playerInfo = document.createElement('div');
        playerInfo.innerHTML = `
            <span class="fw-bold">${player.name}</span>
            ${player.dota2id && player.dota2id !== 'N/A' ? `<small class="text-muted ms-2">ID: ${player.dota2id}</small>` : ''}
            ${player.peakmmr && player.peakmmr !== 'N/A' ? `<span class="badge bg-primary ms-2">${player.peakmmr} MMR</span>` : ''}
        `;
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
        removeBtn.title = 'Remove player';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            removePlayerFromPicker(index);
        };
        
        li.appendChild(playerInfo);
        li.appendChild(removeBtn);
        pickerPlayerList.appendChild(li);
    });
    
    // Update player count
    const playerCountElement = document.getElementById('player-count-picker');
    if (playerCountElement) {
        playerCountElement.textContent = filteredPlayers.length;
    }
    
    // Player list rendered
}

// Save picker state
function savePickerState() {
    // Save to localStorage for persistence
    try {
        localStorage.setItem('pickerPlayers', JSON.stringify(pickerPlayers));
    } catch (e) {
        // Failed to save picker state
    }
}

// Toggle the picking animation
function togglePicking() {
    if (isPicking) {
        stopPicking();
    } else {
        startPicking();
    }
}

// Start the picking animation with name cycling
function startPicking() {
    if (pickerPlayers.length === 0) {
        showNotification('No players in the pool!', 'warning');
        return;
    }
    
    // Get timer value (shortened to 0.2 seconds instead of default 3 seconds)
    const timerInput = document.getElementById('timer-input');
    // Override with quick 200ms timer unless custom value is explicitly specified
    const timerSeconds = timerInput && timerInput.value ? Math.max(0.2, parseFloat(timerInput.value) || 0.2) : 0.2;
    
    // Update UI for picking state
    isPicking = state.isPicking = true;
    pickButton.textContent = 'Stop Picking';
    pickButton.classList.remove('btn-primary');
    pickButton.classList.add('btn-danger');
    
    // Show animation area and hide result area
    pickerAnimationArea.classList.remove('d-none');
    pickerResult.classList.add('d-none');
    
    // Set up animation area
    pickerAnimationArea.innerHTML = `
        <div class="text-center">
            <div class="display-1 fw-bold text-primary my-4" id="picking-name" style="min-height: 6rem; display: flex; align-items: center; justify-content: center;">
                Picking...
            </div>
            <div class="progress mt-3" style="height: 8px;">
                <div id="picking-progress" class="progress-bar bg-primary" 
                     role="progressbar" style="width: 100%; transition: width 0.1s linear"></div>
            </div>
            <div class="mt-2 text-muted" id="countdown-display">
                Time remaining: ${timerSeconds}.0s
            </div>
        </div>
    `;
    
    const startTime = Date.now();
    const endTime = startTime + (timerSeconds * 1000);
    const nameDisplay = document.getElementById('picking-name');
    const countdownDisplay = document.getElementById('countdown-display');
    const progressBar = document.getElementById('picking-progress');
    
    // Shuffle players for cycling
    const shuffledPlayers = [...pickerPlayers].sort(() => Math.random() - 0.5);
    let currentPlayerIndex = 0;
    
    // Start the animation loop
    pickerTimer = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now;
        
        if (timeLeft <= 0) {
            stopPicking();
            return;
        }
        
        // Update progress
        const progress = (timeLeft / (timerSeconds * 1000)) * 100;
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, progress)}%`;
        }
        
        // Update countdown
        if (countdownDisplay) {
            countdownDisplay.textContent = `Time remaining: ${(timeLeft / 1000).toFixed(1)}s`;
        }
        
        // Cycle through player names with very fast timing (50ms per name)
        if (nameDisplay) {
            const cycleSpeed = 50; // Ultra-fast 50ms per name
            if (now - startTime >= currentPlayerIndex * cycleSpeed) {
                currentPlayerIndex = (currentPlayerIndex + 1) % shuffledPlayers.length;
                const player = shuffledPlayers[currentPlayerIndex];
                nameDisplay.style.opacity = '0.8';
                setTimeout(() => {
                    nameDisplay.textContent = player.name;
                    nameDisplay.style.opacity = '1';
                    nameDisplay.style.fontSize = '3.5rem';
                    nameDisplay.style.transition = 'all 0.05s ease-out';
                }, 10); // Much faster transition
            }
        }
    }, 16); // ~60fps
}

// Stop the picking animation and select a winner
function stopPicking() {
    if (!isPicking) return;
    
    clearInterval(pickerTimer);
    isPicking = state.isPicking = false;
    pickButton.textContent = 'Pick Random Player';
    pickButton.classList.remove('btn-danger');
    pickButton.classList.add('btn-primary');
    
    // Pick a random player from the current pool
    if (pickerPlayers.length > 0) {
        const randomIndex = Math.floor(Math.random() * pickerPlayers.length);
        const winner = pickerPlayers[randomIndex];
        
        // Show the winner
        pickerAnimationArea.classList.add('d-none');
        pickerResult.classList.remove('d-none');
        
        // Update the result display with party emoji
        const pickedPlayerElement = document.getElementById('picked-player');
        const playerCountDisplay = document.getElementById('player-count-display');
        
        if (pickedPlayerElement) {
            pickedPlayerElement.innerHTML = `${winner.name} <span class="emoji">🎉</span>`;
            // Add animation class for celebration effect
            pickedPlayerElement.classList.add('winner-animation');
        }
        
        if (playerCountDisplay) {
            playerCountDisplay.textContent = pickerPlayers.length;
        }
        
        // Remove the winner if the option is checked
        const removeAfterPick = document.getElementById('remove-after-pick');
        if (removeAfterPick && removeAfterPick.checked) {
            const winnerIndex = pickerPlayers.findIndex(p => p.name === winner.name);
            if (winnerIndex !== -1) {
                const removedPlayer = pickerPlayers.splice(winnerIndex, 1)[0];
                state.pickerPlayers = pickerPlayers;
                renderPickerPlayerList();
                showNotification(`${removedPlayer.name} removed from pool`, 'info');
            }
        }
    } else {
        // No players left
        pickerAnimationArea.classList.add('d-none');
        pickerResult.classList.add('d-none');
        showNotification('No more players in the pool!', 'warning');
    }
}

// Clear the picker
function clearPicker() {
    // Clearing all players from picker
    
    // Clear all players
    pickerPlayers = [];
    state.pickerPlayers = [];
    
    // Render the empty list
    renderPickerPlayerList();
    
    // Reset display to initial state
    if (pickerResult) {
        pickerResult.innerHTML = `
            <div class="display-1 text-muted opacity-25">
                <i class="bi bi-people"></i>
            </div>
            <div class="text-muted">Player management area</div>
        `;
    }
    
    // Clear search input if it exists
    if (playerSearchInput) {
        playerSearchInput.value = '';
    }
    
    showNotification('All players cleared', 'info');
}

// Handle player search
function handlePlayerSearch(e) {
    const searchTerm = e.target.value.trim();
    renderPickerPlayerList(searchTerm);
}

// Pick a specific player - removed as requested

// Function to add a player to the picker list
function addPlayerToPicker(name) {
    name = name.trim();
    if (!name) {
        showNotification('Please enter a player name', 'warning');
        return;
    }

    // Check if player already exists
    if (pickerPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Player already in the pool!', 'warning');
        return;
    }

    // Add new player with default values
    const newPlayer = {
        name: name,
        dota2id: 'N/A',
        peakmmr: 'N/A',
        selected: false
    };

    pickerPlayers.push(newPlayer);
    state.pickerPlayers = pickerPlayers;
    
    // Re-render the player list
    renderPickerPlayerList();

    // Clear the input field
    if (playerNameInputPicker) {
        playerNameInputPicker.value = '';
        playerNameInputPicker.focus();
    }

    showNotification(`Added ${name} to the pool`, 'success');
    
    // Log current state for debugging
    // Current players in pool
}

// Function to render the picker player list
function renderPlayerPickerList() {
    if (!playerListPicker) return;

    playerListPicker.innerHTML = '';

    pickerPlayers.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = `player-picker-item ${player.selected ? 'selected' : ''}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = player.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pickerPlayers = pickerPlayers.filter(p => p.id !== player.id);
            renderPlayerPickerList();
        });

        li.appendChild(nameSpan);
        li.appendChild(deleteBtn);

        li.addEventListener('click', () => {
            player.selected = !player.selected;
            renderPlayerPickerList();
        });

        playerListPicker.appendChild(li);
    });
}

// Function to remove a player from the picker list
function removePlayerFromPicker(index) {
    if (index >= 0 && index < pickerPlayers.length) {
        const playerName = pickerPlayers[index].name;
        pickerPlayers.splice(index, 1);
        state.pickerPlayers = pickerPlayers;
        renderPickerPlayerList();
        showNotification(`Removed ${playerName} from the pool`, 'info');
    }
}

// Show notification helper
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

// Main function to pick a random player
async function pickRandomPlayer() {
    // Starting pick random player process
    
    try {
        // Use players from the current pool (not from API/SQLite)
        const players = pickerPlayers;
        // Using players from pool
        
        if (!players || players.length === 0) {
            // No players available
            const resultArea = pickerResult || 
                             document.querySelector('.col-lg-7 .card-body') || 
                             document.querySelector('.result-area') || 
                             document.querySelector('#result-area') ||
                             document.querySelector('.card-body');
            
            if (resultArea) {
                resultArea.innerHTML = `
                    <div class="text-center p-4">
                        <div class="display-1 text-muted opacity-50">
                            <i class="bi bi-people-fill"></i>
                        </div>
                        <h3 class="text-muted mt-3">No Players Available</h3>
                        <p class="text-muted">Add some players to the pool to start picking!</p>
                        <button class="btn btn-primary" onclick="document.getElementById('player-name-picker').focus()">
                            <i class="bi bi-plus-lg me-2"></i>Add Players
                        </button>
                    </div>
                `;
            }
            
            showNotification('No players available for random selection', 'warning');
            return;
        }

        // Find result area with multiple selectors
        const resultArea = pickerResult || 
                         document.querySelector('.col-lg-7 .card-body') || 
                         document.querySelector('.result-area') || 
                         document.querySelector('#result-area') ||
                         document.querySelector('.card-body');
        
        // Found result area
        
        if (!resultArea) {
            // Could not find result area
            showNotification('Could not find result display area', 'error');
            return;
        }

        // Enhanced CSS for faster animations
        const style = document.createElement('style');
        style.textContent = `
            .picker-animation {
                text-align: center !important;
                padding: 30px !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                border-radius: 15px !important;
                color: white !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
                animation: glow 0.4s ease-in-out infinite alternate !important;
            }
            
            .picker-name {
                font-size: 2.5rem !important;
                font-weight: bold !important;
                margin: 20px 0 !important;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3) !important;
                animation: bounce 0.2s ease-in-out infinite alternate !important;
            }
            
            .picker-countdown {
                font-size: 1.2rem !important;
                opacity: 0.9 !important;
                margin-top: 10px !important;
            }
            
            .winner-result {
                text-align: center !important;
                padding: 40px !important;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
                border-radius: 15px !important;
                color: white !important;
                box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important;
                animation: winner-pulse 0.3s ease-in-out infinite alternate !important;
            }
            
            .winner-name {
                font-size: 3rem !important;
                font-weight: bold !important;
                margin: 20px 0 !important;
                text-shadow: 3px 3px 6px rgba(0,0,0,0.4) !important;
                animation: glow-text 0.4s ease-in-out infinite alternate !important;
            }
            
            .winner-emoji {
                font-size: 4rem !important;
                animation: bounce-emoji 0.2s ease-in-out infinite alternate !important;
                display: block !important;
                margin: 20px 0 !important;
            }
            
            @keyframes glow {
                0% { box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                100% { box-shadow: 0 15px 40px rgba(102, 126, 234, 0.4), 0 0 30px rgba(102, 126, 234, 0.3); }
            }
            
            @keyframes bounce {
                0% { transform: scale(1); }
                100% { transform: scale(1.05); }
            }
            
            @keyframes winner-pulse {
                0% { transform: scale(1); box-shadow: 0 15px 40px rgba(0,0,0,0.3); }
                100% { transform: scale(1.02); box-shadow: 0 20px 50px rgba(245, 87, 108, 0.4), 0 0 40px rgba(245, 87, 108, 0.3); }
            }
            
            @keyframes glow-text {
                0% { text-shadow: 3px 3px 6px rgba(0,0,0,0.4); }
                100% { text-shadow: 3px 3px 6px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.5); }
            }
            
            @keyframes bounce-emoji {
                0% { transform: translateY(0) scale(1); }
                100% { transform: translateY(-10px) scale(1.1); }
            }
            
            .pick-another-btn {
                background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%) !important;
                border: none !important;
                color: white !important;
                padding: 12px 30px !important;
                border-radius: 25px !important;
                font-weight: bold !important;
                margin-top: 20px !important;
                transition: all 0.1s ease !important;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2) !important;
            }
            
            .pick-another-btn:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3) !important;
            }
        `;
        document.head.appendChild(style);

        // Get timer value from input field
        const timerInput = document.getElementById('timer-input');
        const timerSeconds = timerInput && timerInput.value ? Math.max(1, parseFloat(timerInput.value)) : 10.0;
        
        // Update initial display to show correct time
        resultArea.innerHTML = `
            <div class="picker-animation">
                <div>🎲 Picking Random Player...</div>
                <div class="picker-name" id="cycling-name">Getting ready...</div>
                <div class="picker-countdown" id="countdown">${timerSeconds.toFixed(1)}</div>
            </div>
        `;

        // Starting countdown animation
        
        const cyclingNameEl = document.getElementById('cycling-name');
        const countdownEl = document.getElementById('countdown');
        
        // Fast name cycling with user-defined countdown
        let currentNameIndex = 0;
        let timeLeft = timerSeconds;
        
        const nameInterval = setInterval(() => {
            if (cyclingNameEl && players.length > 0) {
                const playerName = players[currentNameIndex % players.length].name || players[currentNameIndex % players.length].player_name;
                cyclingNameEl.textContent = playerName;
                currentNameIndex++;
            }
        }, 30); // Reduced from 50ms to 30ms for very fast cycling
        
        const countdownInterval = setInterval(() => {
            timeLeft -= 0.1;
            if (countdownEl) {
                countdownEl.textContent = Math.max(0, timeLeft).toFixed(1);
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                clearInterval(nameInterval);
                
                // Pick winner
                const randomIndex = Math.floor(Math.random() * players.length);
                const winner = players[randomIndex];
                // Winner selected
                
                // Remove the winner if the option is checked
                const removeAfterPick = document.getElementById('remove-after-pick');
                if (removeAfterPick && removeAfterPick.checked) {
                    // Remove from the picker players array
                    const winnerIndex = pickerPlayers.findIndex(p => 
                        (p.name === winner.name) || (p.player_name === winner.name) ||
                        (p.name === winner.player_name) || (p.player_name === winner.player_name)
                    );
                    if (winnerIndex !== -1) {
                        const removedPlayer = pickerPlayers.splice(winnerIndex, 1)[0];
                        state.pickerPlayers = pickerPlayers;
                        renderPickerPlayerList();
                        showNotification(`${removedPlayer.name || removedPlayer.player_name} removed from pool`, 'info');
                    }
                }
                
                // Create confetti effect immediately
                createConfettiEffect();
                
                // Show winner with faster animations
                const winnerName = winner.name || winner.player_name;
                resultArea.innerHTML = `
                    <div class="winner-result">
                        <div class="winner-emoji">🏆</div>
                        <div class="winner-name">${winnerName}</div>
                        <div style="font-size: 1.5rem; margin: 15px 0;">🎉 Winner Selected! 🎉</div>
                        <div class="text-muted" style="font-size: 1rem; margin: 10px 0;">
                            ${pickerPlayers.length} players remaining
                        </div>
                        <button class="btn pick-another-btn" onclick="pickRandomPlayer()">
                            🎲 Pick Another
                        </button>
                    </div>
                `;
                
                showNotification(`Winner: ${winnerName}`, 'success');
            }
        }, 100);

    } catch (error) {
        // Error in pickRandomPlayer
        showNotification('Error selecting random player: ' + error.message, 'error');
    }
}

// Create a simple confetti effect
function createConfettiEffect() {
    const confettiCount = 150;
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = `${Math.random() * 10 + 5}px`;
        confetti.style.height = `${Math.random() * 10 + 5}px`;
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        confetti.style.borderRadius = '50%';
        confetti.style.opacity = Math.random();
        confetti.style.top = '0';
        confetti.style.left = `${Math.random() * 100}%`;
        
        const animation = confetti.animate(
            [
                { transform: 'translateY(0) rotate(0)', opacity: 1 },
                { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
            ],
            {
                duration: Math.random() * 3000 + 2000,
                easing: 'cubic-bezier(.37,1.04,.68,.98)'
            }
        );
        
        container.appendChild(confetti);
        
        animation.onfinish = () => {
            confetti.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        };
    }
}

// Simple test function to pick a player immediately without animation
function testPickPlayer() {
    // TEST PICK PLAYER
    // Current players
    
    if (!pickerPlayers || pickerPlayers.length === 0) {
        // No players for test
        return;
    }
    
    // Find result area
    const resultArea = document.querySelector('.col-lg-7 .card-body') || 
                      document.querySelector('.card-body.d-flex.flex-column');
    
    if (!resultArea) {
        // No result area found for test
        return;
    }
    
    // Pick random player
    const randomIndex = Math.floor(Math.random() * pickerPlayers.length);
    const selectedPlayer = pickerPlayers[randomIndex];
    
    // Test selected
    
    // Display immediately
    resultArea.innerHTML = `
        <div class="text-center">
            <h1 style="color: red; font-size: 3rem;">TEST RESULT</h1>
            <h2 style="color: blue; font-size: 2rem;">${selectedPlayer.name}</h2>
            <p>Player ${randomIndex + 1} of ${pickerPlayers.length}</p>
            <button onclick="testPickPlayer()" class="btn btn-primary">Test Again</button>
        </div>
    `;
    
    // Test display complete
}

// Make test function globally available
window.testPickPlayer = testPickPlayer;

// Make pickRandomPlayer globally available for onclick handlers
window.pickRandomPlayer = pickRandomPlayer;

// Make functions globally available
window.randomPickerAPI = {
    refreshPlayers: loadPickerPlayers,
    addPlayer: addPlayerToPicker,
    clearPlayers: clearPicker,
    pickRandomPlayer: pickRandomPlayer
};

window.initRandomPicker = initRandomPicker;

})(); // Close IIFE
