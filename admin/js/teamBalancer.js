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

// Wrap in IIFE to avoid global variable conflicts
(function() {
    'use strict';
    
    // Module state object to avoid variable redeclaration conflicts
    if (!window.teamBalancerState) {
        window.teamBalancerState = {
            teams: [],
            reservedPlayers: [],
            players: [], // Store players for team formation
            
            // DOM Elements
            teamsDisplay: null,
            balanceTypeSelect: null,
            balanceButton: null,
            clearTeamsButton: null,
            exportTeamsButton: null,
            reservedPlayersList: null,
            
            // Constants
            PLAYERS_PER_TEAM: 5
        };
    }

    // Local variables for easier access
    let teams = window.teamBalancerState.teams;
    let reservedPlayers = window.teamBalancerState.reservedPlayers;
    let players = window.teamBalancerState.players;
    let teamsDisplay = window.teamBalancerState.teamsDisplay;
    let balanceTypeSelect = window.teamBalancerState.balanceTypeSelect;
    let balanceButton = window.teamBalancerState.balanceButton;
    let clearTeamsButton = window.teamBalancerState.clearTeamsButton;
    let exportTeamsButton = window.teamBalancerState.exportTeamsButton;
    let reservedPlayersList = window.teamBalancerState.reservedPlayersList;
    const PLAYERS_PER_TEAM = window.teamBalancerState.PLAYERS_PER_TEAM;

// Initialize team balancer module
// Template initialization - called first
function initTeamBalancerTemplate() {
    // Try multiple selectors to find the team balancer section
    const selectors = [
        '#team-balancer',
        'section#team-balancer',
        'section[id="team-balancer"]',
        'div#team-balancer',
        'section.mb-5'
    ];
    
    // Try each selector
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            return true;
        }
    }
    
    return false;
}

// Data initialization - called after template is loaded
async function initTeamBalancer() {
    try {
        // Check first if the team balancer section exists with multiple selectors
        const selectors = [
            '#team-balancer',
            'section#team-balancer',
            'section[id="team-balancer"]',
            'div#team-balancer',
            'section.mb-5'
        ];
        
        let teamBalancerSection = null;
        
        // Try each selector
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                teamBalancerSection = element;
                break;
            }
        }
        
        if (!teamBalancerSection) {
            // Add the section to the DOM if it's missing
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                // Fetch the HTML content directly
                try {
                    const response = await fetch('./team-balancer.html');
                    if (response.ok) {
                        const html = await response.text();
                        mainContent.innerHTML = html;
                        
                        // Try to find the section again
                        teamBalancerSection = document.querySelector('#team-balancer');
                    }
                } catch (error) {
                    // Error handling without console.log
                }
            }
            
            // If still not found, return false
            if (!teamBalancerSection) {
                return false;
            }
        }
        
        // Since we're using direct HTML loading, elements should be available immediately
        // No need for waiting or retrying - just a single small delay for any async operations
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get all required elements directly
        const elements = {
            teamsDisplay: document.querySelector('#teams-display'),
            balanceTypeSelect: document.querySelector('#balance-type'),
            balanceButton: document.querySelector('#generate-teams'),
            clearTeamsButton: document.querySelector('#clear-teams'),
            reservedPlayersList: document.querySelector('#reserved-players-list')
        };
        
        // Assign to both local variables and state object
        teamsDisplay = window.teamBalancerState.teamsDisplay = elements.teamsDisplay;
        balanceTypeSelect = window.teamBalancerState.balanceTypeSelect = elements.balanceTypeSelect;
        balanceButton = window.teamBalancerState.balanceButton = elements.balanceButton;
        clearTeamsButton = window.teamBalancerState.clearTeamsButton = elements.clearTeamsButton;
        reservedPlayersList = window.teamBalancerState.reservedPlayersList = elements.reservedPlayersList;
        
        // Helper function to check if an element is in the DOM
        const isInDOM = (el) => {
            return el && document.body.contains(el);
        };
        
        // Check for missing required elements
        const requiredElements = [
            { name: 'teamsDisplay', element: teamsDisplay, required: true },
            { name: 'balanceTypeSelect', element: balanceTypeSelect, required: true },
            { name: 'balanceButton', element: balanceButton, required: true }
        ];
        
        const missingRequired = requiredElements
            .filter(item => item.required && (!item.element || !isInDOM(item.element)))
            .map(item => item.name);
            
        if (missingRequired.length > 0) {
            return false;
        }
        
        // Set up event listeners
        if (balanceButton) {
            balanceButton.addEventListener('click', generateBalancedTeams);
        }
        
        if (clearTeamsButton) {
            clearTeamsButton.addEventListener('click', handleClearTeams);
        }
        
        // Set up event listeners
        const clearPlayersBtn = document.getElementById('clear-players');
        if (clearPlayersBtn) {
            clearPlayersBtn.addEventListener('click', handleClearPlayers);
        }
        
        // Set up add player button
        const addPlayerBtn = document.getElementById('add-player');
        if (addPlayerBtn) {
            addPlayerBtn.addEventListener('click', handleAddPlayer);
            
            // Also allow pressing Enter in the MMR field to add a player
            const mmrInput = document.getElementById('player-mmr');
            if (mmrInput) {
                mmrInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        handleAddPlayer();
                    }
                });
            }
        }
        
        // Load players
        await loadPlayers();
        
        return true;
        
    } catch (error) {
        return false;
    }
}

// Load players from external source
async function loadPlayers() {
    try {
        // Use API endpoint to load players from database
        const response = await fetch('/api/players');
        
        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle case where response is an array directly or has a players property
        players = window.teamBalancerState.players = Array.isArray(data) ? data : data.players || [];
        
        if (!Array.isArray(players)) {
            throw new Error('Invalid players data format');
        }
        
        // Update player count in the UI
        const playerCountElement = document.getElementById('player-count');
        if (playerCountElement) {
            playerCountElement.textContent = players.length;
        }
        
        // Render the player list
        renderPlayerList();
        
        // Only generate teams if we have players
        if (players.length > 0) {
            // Ensure DOM elements are available before generating teams
            const checkElements = () => {
                const ready = teamsDisplay && balanceTypeSelect;
                if (ready) {
                    generateBalancedTeams();
                    renderTeams();
                }
                return ready;
            };
            
            // Try immediately
            if (!checkElements()) {
                // Try again after a short delay
                const maxAttempts = 5;
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    if (checkElements() || attempts >= maxAttempts) {
                        clearInterval(interval);
                    }
                }, 300);
            }
        }
    } catch (error) {
        showNotification('Error loading players: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Render the player list in the UI
function renderPlayerList() {
    const playerListElement = document.getElementById('player-list');
    if (!playerListElement) {
        return;
    }

    // Clear existing content
    playerListElement.innerHTML = '';

    if (players.length === 0) {
        playerListElement.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-3">
                    No players added yet
                </td>
            </tr>`;
        return;
    }

    // Add each player to the list
    players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        row.innerHTML = `
            <td class="ps-3">${player.name || 'Unknown'}</td>
            <td class="text-end pe-3">${ensureNumericMmr(player.peakmmr)}</td>
            <td class="text-end pe-3">
                <button class="btn btn-sm btn-outline-danger remove-player" data-index="${index}" title="Remove player">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        playerListElement.appendChild(row);
    });

    // Add event listeners for remove buttons
    playerListElement.querySelectorAll('.remove-player').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(button.dataset.index);
            if (!isNaN(index) && index >= 0 && index < players.length) {
                players.splice(index, 1);
                renderPlayerList();
                
                // Update player count
                const playerCountElement = document.getElementById('player-count');
                if (playerCountElement) {
                    playerCountElement.textContent = players.length;
                }
                
                // Regenerate teams if we have teams
                if (teams.length > 0) {
                    generateBalancedTeams();
                }
            }
        });
    });
}

// Team balancing algorithms
function shuffleArray(array) {
    // Create a copy of the array to avoid modifying the original
    const newArray = [...array];
    
    // Fisher-Yates shuffle algorithm
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * Distributes players into teams ensuring only the highest MMR players are in teams.
 * Uses a snake draft pattern to distribute top players, rest go to reserved.
 * @param {Array} playerPool - Array of player objects with peakmmr property
 * @param {number} teamCount - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {Object} Object containing teams and reserved players
 */
function highRankedBalance(playerPool, teamCount = 2, playersPerTeam = 5) {
    // Create a deep copy of players and sort by MMR (descending)
    const sortedPlayers = JSON.parse(JSON.stringify(playerPool)).sort((a, b) => {
        const mmrDiff = ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr);
        return mmrDiff !== 0 ? mmrDiff : a.name.localeCompare(b.name);
    });
    
    // Calculate total players needed for full teams
    const totalPlayersNeeded = teamCount * playersPerTeam;
    
    // Take only the top N players for teams, rest go to reserved
    const playersForTeams = sortedPlayers.slice(0, totalPlayersNeeded);
    const reservedPlayers = sortedPlayers.slice(totalPlayersNeeded);
    
    // Shuffle the top players to add randomness while maintaining high MMR priority
    const shuffledPlayersForTeams = shuffleArray(playersForTeams);
    
    // Initialize teams
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        name: `Team ${i + 1}`,
        players: [],
        totalMmr: 0,
        avgMmr: 0
    }));
    
    // Distribute players in snake draft order
    for (let i = 0; i < shuffledPlayersForTeams.length; i++) {
        // Determine which team gets this player
        const round = Math.floor(i / teamCount);
        const pickInRound = i % teamCount;
        
        // Determine direction (forward on even rounds, backward on odd)
        const teamIndex = round % 2 === 0 
            ? pickInRound                   // 0, 1, 2, ...
            : teamCount - 1 - pickInRound;  // ..., 2, 1, 0
        
        // Add player to the team
        const player = shuffledPlayersForTeams[i];
        teams[teamIndex].players.push(player);
        teams[teamIndex].totalMmr += ensureNumericMmr(player.peakmmr);
    }
    
    // Calculate average MMR for each team
    teams.forEach(team => {
        team.avgMmr = team.players.length > 0 
            ? Math.round(team.totalMmr / team.players.length) 
            : 0;
    });
    
    return {
        teams,
        reserved: reservedPlayers
    };
}

function randomTeams(players, teamCount = 2, playersPerTeam = 5) {
    // Create a deep copy and completely randomize players
    const shuffledPlayers = shuffleArray(JSON.parse(JSON.stringify(players)));
    
    // Initialize teams
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
        teams.push({
            name: `Team ${i + 1}`,
            players: [],
            totalMmr: 0,
            avgMmr: 0
        });
    }
    
    // Distribute players to teams in order
    for (let i = 0; i < teamCount * playersPerTeam; i++) {
        if (i < shuffledPlayers.length) {
            const teamIndex = Math.floor(i / playersPerTeam);
            // If we've filled all teams, break to avoid index out of bounds
            if (teamIndex >= teamCount) break;
            
            const player = shuffledPlayers[i];
            teams[teamIndex].players.push(player);
            teams[teamIndex].totalMmr += ensureNumericMmr(player.peakmmr);
        }
    }
    
    // Calculate average MMRs
    teams.forEach(team => {
        team.avgMmr = team.players.length > 0 ? Math.round(team.totalMmr / team.players.length) : 0;
    });
    
    // Remaining players go to reserved
    const reserved = shuffledPlayers.slice(teamCount * playersPerTeam);
    
    return {
        teams: teams,
        reserved: reserved
    };
}

function perfectMmrBalance(playerPool, teamCount = 2, playersPerTeam = 5) {
    // Create a deep copy of players and shuffle them first for randomness
    const availablePlayers = JSON.parse(JSON.stringify(playerPool));
    const shuffledAvailablePlayers = shuffleArray(availablePlayers);
    
    // Sort by MMR (descending) after shuffling
    const sortedPlayers = shuffledAvailablePlayers.sort((a, b) => {
        const mmrDiff = ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr);
        return mmrDiff !== 0 ? mmrDiff : a.name.localeCompare(b.name);
    });
    
    // Calculate total players needed for full teams
    const totalPlayersNeeded = teamCount * playersPerTeam;
    
    // Take only the players needed for teams, rest go to reserved
    const playersForTeams = sortedPlayers.slice(0, totalPlayersNeeded);
    const reservedPlayers = sortedPlayers.slice(totalPlayersNeeded);
    
    // Initialize teams
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        name: `Team ${i + 1}`,
        players: [],
        totalMmr: 0,
        avgMmr: 0
    }));
    
    // Distribute players using a balanced approach
    let playerIndex = 0;
    
    // For each round of picks (5 rounds for 5 players per team)
    for (let round = 0; round < playersPerTeam; round++) {
        // Sort teams by current total MMR (ascending) to assign to weakest teams first
        const teamsByMmr = teams.slice().sort((a, b) => a.totalMmr - b.totalMmr);
        
        // Distribute one player to each team in this round
        for (let i = 0; i < teamCount && playerIndex < playersForTeams.length; i++) {
            const team = teamsByMmr[i];
            const player = playersForTeams[playerIndex];
            
            // Find the actual team in the original array and add player
            const originalTeamIndex = teams.findIndex(t => t.name === team.name);
            teams[originalTeamIndex].players.push(player);
            teams[originalTeamIndex].totalMmr += ensureNumericMmr(player.peakmmr);
            
            playerIndex++;
        }
    }
    
    // Calculate average MMR for each team
    teams.forEach(team => {
        team.avgMmr = team.players.length > 0 
            ? Math.round(team.totalMmr / team.players.length) 
            : 0;
    });
    
    return {
        teams,
        reserved: reservedPlayers
    };
}

function highLowShuffle(playerPool, teamCount = 2, playersPerTeam = 5) {
    // Create a deep copy of players and sort by MMR (descending)
    const sortedPlayers = JSON.parse(JSON.stringify(playerPool)).sort((a, b) => {
        const mmrDiff = ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr);
        return mmrDiff !== 0 ? mmrDiff : a.name.localeCompare(b.name);
    });
    
    // Calculate total players needed for full teams
    const totalPlayersNeeded = teamCount * playersPerTeam;
    
    // For High/Low Shuffle, we need to ensure both high and low players are on teams
    // Don't just take the top N players - instead select strategically
    let playersForTeams, reservedPlayers;
    
    if (sortedPlayers.length <= totalPlayersNeeded) {
        // If we have exactly the right number or fewer, use all players
        playersForTeams = sortedPlayers;
        reservedPlayers = [];
    } else {
        // We have more players than team spots, so we need to choose wisely
        // Take top players and bottom players, exclude middle players if needed
        const excessPlayers = sortedPlayers.length - totalPlayersNeeded;
        
        // Calculate how many top and bottom players per team
        const topPlayersPerTeam = Math.ceil(teamCount);  // At least 1 top player per team
        const bottomPlayersPerTeam = Math.ceil(teamCount); // At least 1 bottom player per team
        
        const topPlayers = sortedPlayers.slice(0, topPlayersPerTeam);
        const bottomPlayers = sortedPlayers.slice(-bottomPlayersPerTeam);
        
        // Calculate how many middle players we can take
        const middleStartIndex = topPlayersPerTeam;
        const middleEndIndex = sortedPlayers.length - bottomPlayersPerTeam;
        const availableMiddlePlayers = sortedPlayers.slice(middleStartIndex, middleEndIndex);
        
        const middlePlayersNeeded = totalPlayersNeeded - topPlayers.length - bottomPlayers.length;
        const middlePlayersToTake = availableMiddlePlayers.slice(0, middlePlayersNeeded);
        
        // Combine selected players
        playersForTeams = [...topPlayers, ...middlePlayersToTake, ...bottomPlayers];
        
        // Reserved players are the ones we didn't select
        const selectedPlayerNames = new Set(playersForTeams.map(p => p.name + p.peakmmr));
        reservedPlayers = sortedPlayers.filter(p => !selectedPlayerNames.has(p.name + p.peakmmr));
    }
    
    // Re-sort playersForTeams by MMR to identify top/bottom properly
    const sortedTeamPlayers = playersForTeams.sort((a, b) => {
        const mmrDiff = ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr);
        return mmrDiff !== 0 ? mmrDiff : a.name.localeCompare(b.name);
    });
    
    // Extract top N and bottom N players (1 per team)
    const topPlayers = sortedTeamPlayers.slice(0, teamCount);
    const bottomPlayers = sortedTeamPlayers.slice(-teamCount);
    const middlePlayers = sortedTeamPlayers.slice(teamCount, -teamCount);
    
    // Shuffle the high and low players for random team assignment
    const shuffledTopPlayers = shuffleArray(topPlayers);
    const shuffledBottomPlayers = shuffleArray(bottomPlayers);
    const shuffledMiddlePlayers = shuffleArray(middlePlayers);
    
    // Initialize teams
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        name: `Team ${i + 1}`,
        players: [],
        totalMmr: 0,
        avgMmr: 0
    }));
    
    // If we don't have enough players for meaningful high/low distribution, use simple shuffle
    if (playersForTeams.length < teamCount * 2) {
        const shuffledPlayersForTeams = shuffleArray(playersForTeams);
        
        // Distribute shuffled players
        for (let i = 0; i < shuffledPlayersForTeams.length; i++) {
            const teamIndex = i % teamCount;
            const player = shuffledPlayersForTeams[i];
            teams[teamIndex].players.push(player);
            teams[teamIndex].totalMmr += ensureNumericMmr(player.peakmmr);
        }
    } else {
        // Create randomized team assignment indices
        const topTeamIndices = Array.from({ length: teamCount }, (_, i) => i);
        const bottomTeamIndices = Array.from({ length: teamCount }, (_, i) => i);
        shuffleArray(topTeamIndices);
        shuffleArray(bottomTeamIndices);
        
        // Assign one top player and one bottom player to each team with random assignments
        for (let i = 0; i < teamCount; i++) {
            // Add top player to a random team
            const topTeamIndex = topTeamIndices[i];
            const topPlayer = shuffledTopPlayers[i];
            teams[topTeamIndex].players.push(topPlayer);
            teams[topTeamIndex].totalMmr += ensureNumericMmr(topPlayer.peakmmr);
            
            // Add bottom player to a random team
            const bottomTeamIndex = bottomTeamIndices[i];
            const bottomPlayer = shuffledBottomPlayers[i];
            teams[bottomTeamIndex].players.push(bottomPlayer);
            teams[bottomTeamIndex].totalMmr += ensureNumericMmr(bottomPlayer.peakmmr);
        }
        
        // Distribute remaining middle players across teams with random assignment
        const middleTeamIndices = [];
        for (let i = 0; i < middlePlayers.length; i++) {
            middleTeamIndices.push(i % teamCount);
        }
        shuffleArray(middleTeamIndices);
        
        for (let i = 0; i < middlePlayers.length; i++) {
            const teamIndex = middleTeamIndices[i];
            const player = shuffledMiddlePlayers[i];
            teams[teamIndex].players.push(player);
            teams[teamIndex].totalMmr += ensureNumericMmr(player.peakmmr);
        }
    }
    
    // Calculate average MMR for each team
    teams.forEach(team => {
        team.avgMmr = team.players.length > 0 
            ? Math.round(team.totalMmr / team.players.length) 
            : 0;
    });
    
    return {
        teams,
        reserved: reservedPlayers
    };
}

// Main team generation function that uses the selected balance type
function generateBalancedTeams() {
    // Check if there are enough players to form at least one team
    if (players.length < PLAYERS_PER_TEAM * 2) {
        const msg = `Need at least ${PLAYERS_PER_TEAM * 2} players to form teams (${PLAYERS_PER_TEAM}v${PLAYERS_PER_TEAM})`;
        showNotification(msg, 'warning');
        return;
    }
    
    // Reset teams and reserved players
    teams = [];
    reservedPlayers = [];
    
    // Calculate team count based on number of players (5 players per team)
    const teamCount = Math.floor(players.length / PLAYERS_PER_TEAM);
    
    // If we can't form at least 2 teams, show an error
    if (teamCount < 2) {
        const msg = `Need at least ${PLAYERS_PER_TEAM * 2} players to form teams (${PLAYERS_PER_TEAM}v${PLAYERS_PER_TEAM})`;
        showNotification(msg, 'warning');
        return;
    }
    
    // Get the selected balance type
    const balanceType = balanceTypeSelect.value;
    
    // Apply the selected algorithm
    let result;
    switch (balanceType) {
        case 'highRanked':
            result = highRankedBalance(players, teamCount, PLAYERS_PER_TEAM);
            break;
        case 'highLowShuffle':
            result = highLowShuffle(players, teamCount, PLAYERS_PER_TEAM);
            break;
        case 'perfectMmr':
            result = perfectMmrBalance(players, teamCount, PLAYERS_PER_TEAM);
            break;
        case 'random':
        default:
            result = randomTeams(players, teamCount, PLAYERS_PER_TEAM);
            break;
    }
    
    // Update the team data
    if (result) {
        teams = result.teams;
        reservedPlayers = result.reserved;
        
        // Render UI
        renderTeams();
        renderReservedPlayers();
        
        showNotification('Teams generated successfully', 'success');
    }
}

// Handle adding a new player from the UI
function handleAddPlayer() {
    const nameInput = document.getElementById('player-name');
    const mmrInput = document.getElementById('player-mmr');
    
    const playerName = nameInput.value.trim();
    const playerMmr = parseInt(mmrInput.value) || 0;
    
    if (!playerName) {
        showNotification('Player name is required', 'error');
        return;
    }
    
    // Create new player object
    const newPlayer = {
        name: playerName,
        peakmmr: playerMmr,
        // Add other default fields if needed
        dota2id: '',
        role: ''
    };
    
    // Add to players array
    players.push(newPlayer);
    
    // Update UI
    renderPlayerList();
    
    // Update player count badge
    const playerCountElement = document.getElementById('player-count');
    if (playerCountElement) {
        playerCountElement.textContent = players.length;
    }
    
    // Clear input fields
    nameInput.value = '';
    mmrInput.value = '';
    
    // Set focus back to name input for quick entry
    nameInput.focus();
    
    showNotification('Player added successfully', 'success');
}

// Handle clearing players list
function handleClearPlayers() {
    if (confirm('Are you sure you want to clear all players?')) {
        players = [];
        renderPlayerList();
        // Also clear any teams that might be displayed
        teams = [];
        reservedPlayers = [];
        renderTeams();
        renderReservedPlayers();
        showNotification('Player list cleared', 'success');
    }
}

// Handle clearing teams
function handleClearTeams() {
    if (!confirm('Are you sure you want to clear all teams?')) {
        return;
    }
    
    teams = [];
    reservedPlayers = [];
    renderTeams();
    renderReservedPlayers(); // Also clear the reserved players display
    showNotification('Teams cleared', 'success');
}

// Render teams in the UI
function renderTeams() {
    if (!teamsDisplay) {
        teamsDisplay = document.getElementById('teams-display');
        if (!teamsDisplay) {
            return;
        }
    }
    
    // Clear existing content
    teamsDisplay.innerHTML = '';
    
    // If no teams, add empty state display
    if (!teams || !teams.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-people text-muted display-1"></i>
                <h4 class="mt-3">No Teams Generated</h4>
                <p class="text-muted">Add players and click "Generate Teams" to create balanced teams</p>
            </div>
        `;
        teamsDisplay.appendChild(emptyState);
        return;
    }
    
    // If still no teams, show message
    if (!teams.length) {
        teamsDisplay.innerHTML = '<p class="empty-message">No players available. Please add some players first.</p>';
        return;
    }
    
    // Create a container for all teams
    const teamsContainer = document.createElement('div');
    teamsContainer.className = 'teams-container';
    
    // Render each team
    teams.forEach(team => {
        // Team header with improved styling
        const teamElement = document.createElement('div');
        teamElement.className = 'team';
        teamElement.style.border = '1px solid #444';
        teamElement.style.borderRadius = '8px';
        teamElement.style.padding = '15px';
        teamElement.style.margin = '10px';
        teamElement.style.backgroundColor = '#2a2a2a';
        teamElement.style.width = '300px';
        teamElement.style.display = 'inline-block';
        teamElement.style.verticalAlign = 'top';
        
        const teamHeader = document.createElement('div');
        teamHeader.className = 'team-header';
        teamHeader.style.display = 'flex';
        teamHeader.style.justifyContent = 'space-between';
        teamHeader.style.alignItems = 'center';
        teamHeader.style.marginBottom = '10px';
        teamHeader.style.paddingBottom = '8px';
        teamHeader.style.borderBottom = '1px solid #444';
        
        const teamName = document.createElement('h3');
        teamName.textContent = team.name;
        teamName.style.margin = '0';
        teamName.style.color = '#fff';
        
        const teamMmr = document.createElement('span');
        teamMmr.className = 'team-mmr';
        // Ensure we're using the calculated average MMR
        const avgMmr = team.players.length > 0 
            ? Math.round(calculateTotalMmr(team.players) / team.players.length)
            : 0;
        teamMmr.textContent = `Avg: ${avgMmr} MMR`;
        teamMmr.style.backgroundColor = '#444';
        teamMmr.style.padding = '4px 8px';
        teamMmr.style.borderRadius = '4px';
        teamMmr.style.fontSize = '0.9em';
        
        teamHeader.appendChild(teamName);
        teamHeader.appendChild(teamMmr);
        
        // Team players list
        const playersList = document.createElement('div');
        playersList.className = 'players-list';
        playersList.style.marginTop = '10px';
        
        // Sort players by MMR (highest first)
        const sortedPlayers = [...team.players].sort((a, b) => 
            ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr)
        );
        
        sortedPlayers.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.style.display = 'flex';
            playerItem.style.justifyContent = 'space-between';
            playerItem.style.padding = '6px 0';
            playerItem.style.borderBottom = '1px solid #333';
            
            // Add zebra striping
            if (index % 2 === 0) {
                playerItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }
            
            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.name || 'Unknown Player';
            playerName.style.color = '#fff';
            
            const playerMmr = document.createElement('span');
            playerMmr.className = 'player-mmr';
            // Use ensureNumericMmr to handle any potential undefined/null values
            const mmr = ensureNumericMmr(player.peakmmr);
            playerMmr.textContent = mmr.toString();
            playerMmr.style.color = '#4CAF50';
            playerMmr.style.fontWeight = 'bold';
            
            playerItem.appendChild(playerName);
            playerItem.appendChild(playerMmr);
            playersList.appendChild(playerItem);
        });
        
        // Team footer with total MMR
        const teamFooter = document.createElement('div');
        teamFooter.style.display = 'flex';
        teamFooter.style.justifyContent = 'space-between';
        teamFooter.style.marginTop = '10px';
        teamFooter.style.paddingTop = '8px';
        teamFooter.style.borderTop = '1px solid #444';
        teamFooter.style.fontWeight = 'bold';
        
        const totalLabel = document.createElement('span');
        totalLabel.textContent = 'Total:';
        totalLabel.style.color = '#fff';
        
        const totalMmr = document.createElement('span');
        totalMmr.textContent = team.totalMmr || '0';
        totalMmr.style.color = '#4CAF50';
        
        teamFooter.appendChild(totalLabel);
        teamFooter.appendChild(totalMmr);
        
        // Assemble team element
        teamElement.appendChild(teamHeader);
        teamElement.appendChild(playersList);
        teamsContainer.appendChild(teamElement);
    });
    
    teamsDisplay.appendChild(teamsContainer);
    
    // Also render reserved players
    renderReservedPlayers();
}

// Render reserved players in the UI
function renderReservedPlayers() {
    if (!reservedPlayersList) {
        return;
    }
    
    // Clear existing list
    reservedPlayersList.innerHTML = '';
    
    // Always show the section, even if empty
    reservedPlayersList.classList.remove('hidden');
    const parentSection = reservedPlayersList.closest('.reserved-section');
    if (parentSection) {
        parentSection.classList.remove('hidden');
    }
    
    // If no reserved players, display empty message
    if (!reservedPlayers || !reservedPlayers.length) {
        reservedPlayersList.innerHTML = `
            <tr>
                <td colspan="2" class="text-center text-muted py-4">
                    <i class="bi bi-person-x fs-4 d-block mb-2"></i>
                    <span>No reserved players</span>
                </td>
            </tr>`;
        return;
    }
    
    // Sort reserved players by MMR (descending)
    const sortedReserved = [...reservedPlayers].sort((a, b) => ensureNumericMmr(b.peakmmr) - ensureNumericMmr(a.peakmmr));
    
    // Create table rows for each reserved player
    sortedReserved.forEach((player, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        row.innerHTML = `
            <td class="ps-3">${player.name || 'Unknown'}</td>
            <td class="text-end pe-3">${ensureNumericMmr(player.peakmmr)}</td>
        `;
        
        
        reservedPlayersList.appendChild(row);
    });
}

// Helper function to display a single team
function displayTeam(team, listElement) {
    // Create team display elements
    team.players.forEach(player => {
        const playerItem = document.createElement('li');
        playerItem.innerHTML = `<span class="player-name">${player.name}</span><span class="player-mmr">${ensureNumericMmr(player.peakmmr)}</span>`;
        listElement.appendChild(playerItem);
    });
}

// Helper functions for the API
function getTeams() {
    return teams;
}

function getReservedPlayers() {
    return reservedPlayers;
}

// Export functions that need to be called from other modules
window.teamBalancerAPI = {
    getTeams,
    getReservedPlayers,
    generateTeams: generateBalancedTeams,
    clearTeams: handleClearTeams
};

// Make the initialization function globally available
window.initTeamBalancer = initTeamBalancer;

})(); // Close IIFE
