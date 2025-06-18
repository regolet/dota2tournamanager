// Admin Module - Core functionality for the admin panel
import { fetchWithAuth, showNotification } from './utils.js';

// No authentication required - show admin content directly
export function handleAdminLogin() {
    // Admin panel loaded without authentication
    
    // Remove the login modal if it exists
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.remove();
    }
    
    // Remove any modal backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    
    // Remove modal-open class from body
    document.body.classList.remove('modal-open');
    
    // Remove any inline styles added by modals
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

// Initialize the admin panel
export function initAdmin(playerListAPI, teamBalancerAPI, randomPickerAPI, registrationAPI) {
    // Admin module initialized
    
    // Initialize DOM elements
    const addPlayerBtn = document.getElementById('add-player');
    const loadJsonDataBtn = document.getElementById('load-json-data');
    const clearPlayersBtn = document.getElementById('clear-players');
    
    const playerNameInput = document.getElementById('player-name');
    const playerDotaIdInput = document.getElementById('player-dota-id');
    const playerMmrInput = document.getElementById('player-mmr');
    
    // Event Listeners for Player Management
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', () => {
            const name = playerNameInput.value.trim();
            const dotaId = playerDotaIdInput.value.trim();
            const mmr = parseInt(playerMmrInput.value);
            
            if (name && dotaId && !isNaN(mmr)) {
                // Use playerListAPI
                if (typeof playerListAPI !== 'undefined' && typeof playerListAPI.addPlayer === 'function') {
                    playerListAPI.addPlayer({
                        name: name,
                        dotaId: dotaId,
                        mmr: mmr
                    });
                    playerNameInput.value = '';
                    playerDotaIdInput.value = '';
                    playerMmrInput.value = '';
                    playerNameInput.focus();
                } else {
                    console.error('playerListAPI.addPlayer is not available');
                    showNotification('Player list functionality is not available.', 'error');
                }
            } else {
                showNotification('Please fill in all fields correctly.', 'error');
            }
        });
    }
    
    // Event listener for loading player data from JSON
    if (loadJsonDataBtn) {
        loadJsonDataBtn.addEventListener('click', () => {
            // Use playerListAPI
            if (typeof playerListAPI !== 'undefined' && typeof playerListAPI.refreshPlayerList === 'function') {
                playerListAPI.refreshPlayerList();
            } else {
                console.error('playerListAPI.refreshPlayerList is not available');
                showNotification('Player list functionality is not available.', 'error');
            }
        });
    }
    
    // Clear players button
    if (clearPlayersBtn) {
        clearPlayersBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all players?')) {
                // Use the playerList API
                if (typeof playerListAPI !== 'undefined' && typeof playerListAPI.refreshPlayerList === 'function') {
                    playerListAPI.refreshPlayerList();
                } else {
                    console.error('playerListAPI.refreshPlayerList is not available');
                }
                
                // Use the teamBalancer API
                if (typeof teamBalancerAPI !== 'undefined' && typeof teamBalancerAPI.clearTeams === 'function') {
                    teamBalancerAPI.clearTeams();
                } else {
                    console.error('teamBalancerAPI.clearTeams is not available');
                }
                
                // Clear input fields
                if (playerNameInput) playerNameInput.value = '';
                if (playerDotaIdInput) playerDotaIdInput.value = '';
                if (playerMmrInput) playerMmrInput.value = '';
                
                showNotification('All players cleared successfully!', 'success');
            }
        });
    }
    
    // Google Sheet functionality has been removed
    
    // Initialize player list after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof initPlayerList === 'function') {
            // Initializing player list from admin module
            initPlayerList();
            
            // If we're already on the player list tab, trigger a refresh
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab && activeTab.id === 'player-list-tab' && typeof refreshPlayerList === 'function') {
                // Player list tab is active, refreshing player list
                refreshPlayerList();
            }
        } else {
            console.warn('initPlayerList function not found');
        }
    }, 100);
}

// Default export for easier importing
export default {
    verifyAdminPassword,
    handleAdminLogin,
    initAdmin
};
