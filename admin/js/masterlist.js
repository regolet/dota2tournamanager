// masterlist.js - Manages the verified player masterlist

// Global state for masterlist (safe for reloading)
window.masterlistPlayers = window.masterlistPlayers || [];
window.currentEditingPlayer = window.currentEditingPlayer || null;
window.masterlistStats = window.masterlistStats || {};

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
        showMasterlistNotification('Error initializing masterlist', 'danger');
        return false;
    }
}

// Set up event listeners
function setupMasterlistEventListeners() {
    // Add player button
    const addPlayerBtn = document.getElementById('add-masterlist-player-btn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', () => showAddPlayerModal());
    }
    
    // Bulk import button
    const bulkImportBtn = document.getElementById('bulk-import-masterlist-btn');
    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', () => showBulkImportModal());
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-masterlist-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadMasterlistData());
    }
    
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
            renderMasterlistTable(window.masterlistPlayers);
        });
    }
    
    // Modal form submission
    const playerForm = document.getElementById('masterlist-player-form');
    if (playerForm) {
        playerForm.addEventListener('submit', handlePlayerFormSubmit);
    }
    
    // Bulk import form submission
    const bulkImportForm = document.getElementById('bulk-import-form');
    if (bulkImportForm) {
        bulkImportForm.addEventListener('submit', handleBulkImportSubmit);
    }
    
    // Bulk import preview button
    const previewBtn = document.getElementById('preview-bulk-import-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', handleBulkImportPreview);
    }
    
    // Real-time validation for duplicate checking
    const dota2idInput = document.getElementById('masterlist-player-dota2id');
    const nameInput = document.getElementById('masterlist-player-name');
    
    if (dota2idInput) {
        dota2idInput.addEventListener('input', debounce(validateDota2IdUnique, 500));
        dota2idInput.addEventListener('blur', validateDota2IdUnique);
    }
    
    if (nameInput) {
        nameInput.addEventListener('input', debounce(validateNameUnique, 500));
        nameInput.addEventListener('blur', validateNameUnique);
    }
    
    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('confirm-delete-masterlist-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }
}

// Load masterlist data from API
async function loadMasterlistData() {
    try {
        showMasterlistNotification('Loading masterlist...', 'info');
        
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
            
            showMasterlistNotification(`Loaded ${window.masterlistPlayers.length} players from masterlist`, 'success');
            
            // Masterlist is loaded - tab will be enabled when clicked
        } else {
            throw new Error(data.message || 'Failed to load masterlist');
        }
    } catch (error) {
        console.error('Error loading masterlist:', error);
        showMasterlistNotification(`Error loading masterlist: ${error.message}`, 'danger');
        
        // Show empty state
        renderMasterlistTable([]);
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
        showMasterlistNotification('Player not found', 'danger');
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
            showMasterlistNotification(result.message, 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirm-delete-masterlist-modal'));
            if (modal) modal.hide();
            
            // Reload masterlist
            await loadMasterlistData();
        } else {
            showMasterlistNotification(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting player:', error);
        showMasterlistNotification('Error deleting player: ' + error.message, 'danger');
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

// Show notification
function showMasterlistNotification(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alert.style.zIndex = '1100';
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    document.body.appendChild(alert);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 4000);
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

// Bulk Import Functions

// Show bulk import modal
function showBulkImportModal() {
    const modal = new bootstrap.Modal(document.getElementById('bulk-import-masterlist-modal'));
    modal.show();
    
    // Clear previous data
    document.getElementById('bulk-import-data').value = '';
    document.getElementById('bulk-import-preview').style.display = 'none';
    document.getElementById('bulk-import-alert').style.display = 'none';
    document.getElementById('execute-bulk-import-btn').disabled = true;
}

// Parse bulk import data
function parseBulkImportData(data) {
    const lines = data.trim().split('\n');
    const players = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return; // Skip empty lines
        
        const parts = trimmedLine.split('\t');
        
        if (parts.length !== 3) {
            errors.push(`Line ${lineNumber}: Invalid format. Expected 3 fields separated by tabs.`);
            return;
        }
        
        const [name, dota2id, mmr] = parts.map(part => part.trim());
        
        // Validate name
        if (!name || name.length < 2) {
            errors.push(`Line ${lineNumber}: Player name is too short or empty.`);
            return;
        }
        
        // Validate Dota2 ID
        if (!dota2id || !/^\d+$/.test(dota2id)) {
            errors.push(`Line ${lineNumber}: Invalid Dota2 ID. Must be numeric.`);
            return;
        }
        
        // Validate MMR
        const mmrNum = parseInt(mmr);
        if (isNaN(mmrNum) || mmrNum < 0 || mmrNum > 20000) {
            errors.push(`Line ${lineNumber}: Invalid MMR. Must be between 0 and 20000.`);
            return;
        }
        
        players.push({
            name: name,
            dota2id: dota2id,
            mmr: mmrNum,
            lineNumber: lineNumber
        });
    });
    
    return { players, errors };
}

// Handle bulk import preview
function handleBulkImportPreview() {
    const data = document.getElementById('bulk-import-data').value;
    const { players, errors } = parseBulkImportData(data);
    
    const alertElement = document.getElementById('bulk-import-alert');
    const previewElement = document.getElementById('bulk-import-preview');
    const executeBtn = document.getElementById('execute-bulk-import-btn');
    
    // Clear previous alerts
    alertElement.style.display = 'none';
    
    if (errors.length > 0) {
        alertElement.className = 'alert alert-danger';
        alertElement.innerHTML = `
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Validation Errors:</strong>
            <ul class="mb-0 mt-2">
                ${errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        `;
        alertElement.style.display = 'block';
        previewElement.style.display = 'none';
        executeBtn.disabled = true;
        return;
    }
    
    if (players.length === 0) {
        alertElement.className = 'alert alert-warning';
        alertElement.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>No valid players found in the data.';
        alertElement.style.display = 'block';
        previewElement.style.display = 'none';
        executeBtn.disabled = true;
        return;
    }
    
    // Show preview
    renderBulkImportPreview(players);
    previewElement.style.display = 'block';
    executeBtn.disabled = false;
    
    // Show success message
    alertElement.className = 'alert alert-success';
    alertElement.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        <strong>Valid data found!</strong> ${players.length} players ready for import.
    `;
    alertElement.style.display = 'block';
}

// Render bulk import preview
function renderBulkImportPreview(players) {
    const previewBody = document.getElementById('bulk-import-preview-body');
    const previewCount = document.getElementById('preview-count');
    
    previewCount.textContent = players.length;
    
    previewBody.innerHTML = players.map(player => {
        const existingPlayer = window.masterlistPlayers.find(p => p.dota2id === player.dota2id);
        let status = 'New';
        let statusClass = 'success';
        
        if (existingPlayer) {
            status = 'Update';
            statusClass = 'warning';
        }
        
        return `
            <tr>
                <td>${escapeHtml(player.name)}</td>
                <td><code>${escapeHtml(player.dota2id)}</code></td>
                <td>${player.mmr}</td>
                <td><span class="badge bg-${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');
}

// Handle bulk import submission
async function handleBulkImportSubmit(event) {
    event.preventDefault();
    
    const data = document.getElementById('bulk-import-data').value;
    const { players, errors } = parseBulkImportData(data);
    
    // Only send valid players (as shown in preview) - improved validation
    const validPlayers = players.filter(player => 
        player.name && 
        player.name.trim().length >= 2 && 
        player.dota2id && 
        player.dota2id.trim().length > 0 && 
        !isNaN(player.mmr) && 
        player.mmr >= 0 && 
        player.mmr <= 20000
    );
    const skippedCount = players.length - validPlayers.length;
    
    if (errors.length > 0 || validPlayers.length === 0) {
        handleBulkImportPreview();
        return;
    }
    
    const skipDuplicates = document.getElementById('bulk-import-skip-duplicates').checked;
    const updateExisting = document.getElementById('bulk-import-update-existing').checked;
    
    // Prepare players for import
    const playersToImport = validPlayers.filter(player => {
        const existingPlayer = window.masterlistPlayers.find(p => p.dota2id === player.dota2id);
        
        if (existingPlayer) {
            return updateExisting; // Only include if update existing is checked
        }
        
        return true; // Include new players
    });
    
    if (playersToImport.length === 0) {
        const alertElement = document.getElementById('bulk-import-alert');
        alertElement.className = 'alert alert-warning';
        alertElement.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>No players to import. All players already exist and update existing is disabled.';
        alertElement.style.display = 'block';
        return;
    }
    
    // Disable submit button and show loading
    const executeBtn = document.getElementById('execute-bulk-import-btn');
    const originalText = executeBtn.innerHTML;
    executeBtn.disabled = true;
    executeBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Importing...';
    
    try {
        // Debug: Log the payload being sent to the server
        console.log('Payload sent to server:', playersToImport);
        
        const response = await fetch('/api/masterlist/bulk-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': localStorage.getItem('adminSessionId')
            },
            body: JSON.stringify({
                players: playersToImport,
                skipDuplicates: skipDuplicates,
                updateExisting: updateExisting
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            const alertElement = document.getElementById('bulk-import-alert');
            let msg = `<i class="bi bi-check-circle me-2"></i><strong>Import successful!</strong><br>Added: ${result.added || 0} players<br>Updated: ${result.updated || 0} players<br>Skipped: ${result.skipped || 0} players`;
            if (skippedCount > 0) {
                msg += `<br><span class="text-warning">${skippedCount} player(s) were skipped due to missing/invalid data.</span>`;
            }
            if (result.errors && result.errors.length > 0) {
                msg += `<br><span class="text-danger">${result.errors.length} error(s) during import.</span>`;
            }
            alertElement.className = 'alert alert-success';
            alertElement.innerHTML = msg;
            alertElement.style.display = 'block';
            
            // Reload masterlist data
            await loadMasterlistData();
            
            // Close modal after a delay
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('bulk-import-masterlist-modal'));
                modal.hide();
            }, 2000);
            
        } else {
            throw new Error(result.message || 'Import failed');
        }
        
    } catch (error) {
        console.error('Bulk import error:', error);
        
        const alertElement = document.getElementById('bulk-import-alert');
        alertElement.className = 'alert alert-danger';
        alertElement.innerHTML = `
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Import failed:</strong> ${error.message}
        `;
        alertElement.style.display = 'block';
        
    } finally {
        // Re-enable submit button
        executeBtn.disabled = false;
        executeBtn.innerHTML = originalText;
    }
} 