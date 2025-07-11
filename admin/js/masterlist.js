(function() {
// masterlist.js - Manages the verified player masterlist

// Global state for masterlist (safe for reloading)
window.masterlistPlayers = window.masterlistPlayers || [];
window.currentEditingPlayer = window.currentEditingPlayer || null;
window.masterlistStats = window.masterlistStats || {};
window.isMasterlistLoading = window.isMasterlistLoading || false;
window.lastLoadedPlayerCount = window.lastLoadedPlayerCount || null;

// Initialize masterlist module
async function initMasterlist() {
    try {
        // Set up event listeners
        setupMasterlistEventListeners();
        
        // Load initial data
        await loadMasterlistData();
        
        return true;
    } catch (error) {
        console.error('Error initializing masterlist:', error);
        window.showNotification('Error initializing masterlist', 'danger');
        return false;
    }
}

// Set up event listeners
function setupMasterlistEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('masterlist-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleMasterlistSearch, 300));
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            handleMasterlistSearch();
        });
    }
    
    // Add player button
    const addPlayerBtn = document.getElementById('add-masterlist-player-btn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', showAddPlayerModal);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-masterlist-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadMasterlistData);
    }
    
    // Player form submission
    const playerForm = document.getElementById('masterlist-player-form');
    if (playerForm) {
        playerForm.addEventListener('submit', handlePlayerFormSubmit);
    }
    
    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('confirm-delete-masterlist-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }
    
    // Form validation
    const playerNameInput = document.getElementById('masterlist-player-name');
    const dota2IdInput = document.getElementById('masterlist-player-dota2id');
    const mmrInput = document.getElementById('masterlist-player-mmr');
    
    if (playerNameInput) {
        playerNameInput.addEventListener('input', validateNameUnique);
        playerNameInput.addEventListener('blur', validateNameUnique);
    }
    
    if (dota2IdInput) {
        dota2IdInput.addEventListener('input', validateDota2IdUnique);
        dota2IdInput.addEventListener('blur', validateDota2IdUnique);
    }
    
    if (mmrInput) {
        mmrInput.addEventListener('input', () => {
            const value = parseInt(mmrInput.value);
            if (value < 0) mmrInput.value = 0;
            if (value > 20000) mmrInput.value = 20000;
        });
    }
}

// Load masterlist data from API
async function loadMasterlistData() {
    if (window.isMasterlistLoading) return;
    window.isMasterlistLoading = true;
    try {
        window.showNotification('Loading masterlist...', 'info');
        
        const response = await fetch('/api/masterlist', {
            headers: {
                'x-session-id': localStorage.getItem('adminSessionId')
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load masterlist: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            window.masterlistPlayers = data.players || [];
            window.masterlistStats = data.stats || {};
            
            // If no stats from backend, calculate them on frontend
            if (!window.masterlistStats || Object.keys(window.masterlistStats).length === 0) {
                window.masterlistStats = calculateStatsFromPlayers(window.masterlistPlayers);
            }
            
            // Update UI
            updateMasterlistStats();
            renderMasterlistTable(window.masterlistPlayers);
            
            if (window.masterlistPlayers.length !== window.lastLoadedPlayerCount) {
                window.showNotification(`Loaded ${window.masterlistPlayers.length} players from masterlist`, 'success');
                window.lastLoadedPlayerCount = window.masterlistPlayers.length;
            }
            
            // Masterlist is loaded - tab will be enabled when clicked
        } else {
            throw new Error(data.message || 'Failed to load masterlist');
        }
    } catch (error) {
        console.error('Error loading masterlist:', error);
        window.showNotification(`Error loading masterlist: ${error.message}`, 'danger');
        
        // Show empty state
        renderMasterlistTable([]);
    } finally {
        window.isMasterlistLoading = false;
    }
}

// Calculate stats from players array (frontend fallback)
function calculateStatsFromPlayers(players) {
    if (!players || players.length === 0) {
        return {
            total: 0,
            avgMmr: 0,
            maxMmr: 0,
            minMmr: 0,
            topPlayer: 'N/A'
        };
    }
    
    const mmrValues = players.map(p => p.mmr || 0);
    const maxMmr = Math.max(...mmrValues);
    const minMmr = Math.min(...mmrValues);
    const avgMmr = Math.round(mmrValues.reduce((sum, mmr) => sum + mmr, 0) / mmrValues.length);
    
    // Find top player
    const topPlayer = players.find(p => p.mmr === maxMmr);
    
    return {
        total: players.length,
        avgMmr: avgMmr,
        maxMmr: maxMmr,
        minMmr: minMmr,
        topPlayer: topPlayer ? topPlayer.name : 'N/A'
    };
}

// Update statistics display
function updateMasterlistStats() {
    const totalElement = document.getElementById('total-masterlist-players');
    const avgElement = document.getElementById('avg-masterlist-mmr');
    const maxElement = document.getElementById('max-masterlist-mmr');
    const minElement = document.getElementById('min-masterlist-mmr');
    const topPlayerElement = document.getElementById('top-player-name');
    
    if (totalElement) totalElement.textContent = window.masterlistStats.total || 0;
    if (avgElement) avgElement.textContent = window.masterlistStats.avgMmr || 0;
    if (maxElement) maxElement.textContent = window.masterlistStats.maxMmr || 0;
    if (minElement) minElement.textContent = window.masterlistStats.minMmr || 0;
    if (topPlayerElement && window.masterlistStats.topPlayer && window.masterlistStats.topPlayer !== 'N/A') {
        topPlayerElement.textContent = window.masterlistStats.topPlayer;
    }
}

// Render masterlist table
function renderMasterlistTable(players) {
    const tableBody = document.getElementById('masterlist-table-body');
    const playerCountElement = document.getElementById('masterlist-player-count');
    
    if (!tableBody) return;
    
    // Update player count
    if (playerCountElement) {
        playerCountElement.textContent = players.length;
    }
    
    if (players.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox me-2"></i>No players in masterlist
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = players.map((player, index) => {
        const lastUpdated = player.updated_at ? new Date(player.updated_at).toLocaleDateString() : 'N/A';
        const notes = player.notes ? (player.notes.length > 20 ? player.notes.substring(0, 20) + '...' : player.notes) : '';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${escapeHtml(player.name)}</strong>
                </td>
                <td>
                    <code>${escapeHtml(player.dota2id)}</code>
                </td>
                <td>
                    <span class="badge bg-primary">${player.mmr} MMR</span>
                </td>
                <td>
                    <small class="text-muted">${lastUpdated}</small>
                </td>
                <td>
                    <small class="text-muted" title="${escapeHtml(player.notes || '')}">${escapeHtml(notes)}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editMasterlistPlayer(${player.id})" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteMasterlistPlayer(${player.id}, '${escapeHtml(player.name)}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Handle search
function handleMasterlistSearch(event) {
    const searchTerm = event.target.value.trim();
    
    if (!searchTerm) {
        renderMasterlistTable(window.masterlistPlayers);
        return;
    }
    
    const filteredPlayers = window.masterlistPlayers.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.dota2id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.mmr.toString().includes(searchTerm)
    );
    
    renderMasterlistTable(filteredPlayers);
}

// Show add player modal
function showAddPlayerModal() {
    window.currentEditingPlayer = null;
    
    // Reset form
    const form = document.getElementById('masterlist-player-form');
    if (form) form.reset();
    
    // Clear validation states
    clearValidationState();
    
    // Update modal title
    const modalTitle = document.getElementById('masterlistPlayerModalLabel');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-person-plus me-2"></i>Add Player to Masterlist';
    }
    
    // Hide alert
    const alert = document.getElementById('masterlist-modal-alert');
    if (alert) alert.style.display = 'none';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('masterlist-player-modal'));
    modal.show();
}

// Edit masterlist player
function editMasterlistPlayer(playerId) {
    const player = window.masterlistPlayers.find(p => p.id === playerId);
    if (!player) {
        window.showNotification('Player not found', 'danger');
        return;
    }
    
    window.currentEditingPlayer = player;
    
    // Fill form with player data
    document.getElementById('masterlist-player-name').value = player.name;
    document.getElementById('masterlist-player-dota2id').value = player.dota2id;
    document.getElementById('masterlist-player-mmr').value = player.mmr;
    document.getElementById('masterlist-player-notes').value = player.notes || '';
    
    // Clear validation states
    clearValidationState();
    
    // Update modal title
    const modalTitle = document.getElementById('masterlistPlayerModalLabel');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Masterlist Player';
    }
    
    // Hide alert
    const alert = document.getElementById('masterlist-modal-alert');
    if (alert) alert.style.display = 'none';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('masterlist-player-modal'));
    modal.show();
}

// Delete masterlist player
function deleteMasterlistPlayer(playerId, playerName) {
    const deletePlayerNameElement = document.getElementById('delete-player-name');
    if (deletePlayerNameElement) {
        deletePlayerNameElement.textContent = playerName;
    }
    
    // Store player ID for deletion
    const confirmBtn = document.getElementById('confirm-delete-masterlist-btn');
    if (confirmBtn) {
        confirmBtn.setAttribute('data-player-id', playerId);
    }
    
    // Show confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('confirm-delete-masterlist-modal'));
    modal.show();
}

// Handle form submission
async function handlePlayerFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('masterlist-player-name').value.trim(),
        dota2id: document.getElementById('masterlist-player-dota2id').value.trim(),
        mmr: parseInt(document.getElementById('masterlist-player-mmr').value),
        notes: document.getElementById('masterlist-player-notes').value.trim()
    };
    
    // Validate form data
    if (!formData.name || !formData.dota2id || isNaN(formData.mmr)) {
        showModalAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    if (formData.mmr < 0 || formData.mmr > 20000) {
        showModalAlert('MMR must be between 0 and 20,000', 'danger');
        return;
    }
    
    // Check for duplicates in existing masterlist (frontend validation)
    if (window.masterlistPlayers && Array.isArray(window.masterlistPlayers)) {
        const duplicateDota2Id = window.masterlistPlayers.find(p => 
            p.dota2id === formData.dota2id && 
            (!window.currentEditingPlayer || p.id !== window.currentEditingPlayer.id)
        );
        
        if (duplicateDota2Id) {
            showModalAlert(`A player with Dota 2 ID "${formData.dota2id}" already exists in the masterlist (${duplicateDota2Id.name}).`, 'danger');
            return;
        }
        
        const duplicateName = window.masterlistPlayers.find(p => 
            p.name.toLowerCase() === formData.name.toLowerCase() && 
            (!window.currentEditingPlayer || p.id !== window.currentEditingPlayer.id)
        );
        
        if (duplicateName) {
            showModalAlert(`A player with name "${formData.name}" already exists in the masterlist.`, 'danger');
            return;
        }
    }
    
    const saveBtn = document.getElementById('save-masterlist-player-btn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Disable button and show loading state
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
        
        let response;
        
        if (window.currentEditingPlayer) {
            // Update existing player
            response = await fetch(`/api/masterlist/${window.currentEditingPlayer.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': localStorage.getItem('adminSessionId')
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Add new player
            response = await fetch('/api/masterlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': localStorage.getItem('adminSessionId')
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showModalAlert(result.message, 'success');
            
            // Close modal after delay
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('masterlist-player-modal'));
                if (modal) modal.hide();
                
                // Reload masterlist
                loadMasterlistData();
            }, 1000);
        } else {
            showModalAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error saving player:', error);
        showModalAlert('Error saving player: ' + error.message, 'danger');
    } finally {
        // Reset button
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Handle confirm delete
async function handleConfirmDelete() {
    const confirmBtn = document.getElementById('confirm-delete-masterlist-btn');
    const playerId = confirmBtn.getAttribute('data-player-id');
    
    if (!playerId) return;
    
    const originalText = confirmBtn.innerHTML;
    
    try {
        // Disable button and show loading state
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';
        
        const response = await fetch(`/api/masterlist/${playerId}`, {
            method: 'DELETE',
            headers: {
                'x-session-id': localStorage.getItem('adminSessionId')
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.showNotification(result.message, 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirm-delete-masterlist-modal'));
            if (modal) modal.hide();
            
            // Reload masterlist
            await loadMasterlistData();
        } else {
            window.showNotification(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting player:', error);
        window.showNotification('Error deleting player: ' + error.message, 'danger');
    } finally {
        // Reset button
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// Show modal alert
function showModalAlert(message, type) {
    const alertDiv = document.getElementById('masterlist-modal-alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i>${message}`;
        alertDiv.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 3000);
        }
    }
}

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

// Clear validation state from form inputs
function clearValidationState() {
    const inputs = ['masterlist-player-name', 'masterlist-player-dota2id', 'masterlist-player-mmr'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.classList.remove('is-valid', 'is-invalid');
            
            // Remove existing feedback
            const existingFeedback = input.parentNode.querySelector('.invalid-feedback, .valid-feedback');
            if (existingFeedback) {
                existingFeedback.remove();
            }
        }
    });
}

// Real-time validation functions
function validateDota2IdUnique() {
    const dota2idInput = document.getElementById('masterlist-player-dota2id');
    if (!dota2idInput || !dota2idInput.value.trim()) return;
    
    const dota2id = dota2idInput.value.trim();
    
    // Clear previous validation state
    dota2idInput.classList.remove('is-valid', 'is-invalid');
    
    // Remove existing feedback
    const existingFeedback = dota2idInput.parentNode.querySelector('.invalid-feedback, .valid-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    if (window.masterlistPlayers && Array.isArray(window.masterlistPlayers)) {
        const duplicate = window.masterlistPlayers.find(p => 
            p.dota2id === dota2id && 
            (!window.currentEditingPlayer || p.id !== window.currentEditingPlayer.id)
        );
        
        if (duplicate) {
            dota2idInput.classList.add('is-invalid');
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>This Dota 2 ID already exists (${duplicate.name})`;
            dota2idInput.parentNode.appendChild(feedback);
        } else {
            dota2idInput.classList.add('is-valid');
            const feedback = document.createElement('div');
            feedback.className = 'valid-feedback';
            feedback.innerHTML = '<i class="bi bi-check-circle me-1"></i>Dota 2 ID is available';
            dota2idInput.parentNode.appendChild(feedback);
        }
    }
}

function validateNameUnique() {
    const nameInput = document.getElementById('masterlist-player-name');
    if (!nameInput || !nameInput.value.trim()) return;
    
    const name = nameInput.value.trim();
    
    // Clear previous validation state
    nameInput.classList.remove('is-valid', 'is-invalid');
    
    // Remove existing feedback
    const existingFeedback = nameInput.parentNode.querySelector('.invalid-feedback, .valid-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    if (window.masterlistPlayers && Array.isArray(window.masterlistPlayers)) {
        const duplicate = window.masterlistPlayers.find(p => 
            p.name.toLowerCase() === name.toLowerCase() && 
            (!window.currentEditingPlayer || p.id !== window.currentEditingPlayer.id)
        );
        
        if (duplicate) {
            nameInput.classList.add('is-invalid');
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>This player name already exists in the masterlist';
            nameInput.parentNode.appendChild(feedback);
        } else {
            nameInput.classList.add('is-valid');
            const feedback = document.createElement('div');
            feedback.className = 'valid-feedback';
            feedback.innerHTML = '<i class="bi bi-check-circle me-1"></i>Player name is available';
            nameInput.parentNode.appendChild(feedback);
        }
    }
}

// Utility function: escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.initMasterlist = initMasterlist;
window.editMasterlistPlayer = editMasterlistPlayer;
window.deleteMasterlistPlayer = deleteMasterlistPlayer;
})(); 