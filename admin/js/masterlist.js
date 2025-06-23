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

// Enhanced Bulk Import Functions
let bulkImportData = {
    players: [],
    errors: [],
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1,
    isPaginated: true
};

// Show bulk import modal with enhanced features
function showBulkImportModal() {
    const modal = new bootstrap.Modal(document.getElementById('bulk-import-masterlist-modal'));
    modal.show();
    
    // Reset form state
    resetBulkImportForm();
    
    // Set up event listeners
    setupBulkImportEventListeners();
}

// Reset bulk import form
function resetBulkImportForm() {
    // Reset form fields
    document.getElementById('bulk-import-data').value = '';
    document.getElementById('bulk-import-file').value = '';
    
    // Reset options
    document.getElementById('bulk-import-skip-duplicates').checked = true;
    document.getElementById('bulk-import-update-existing').checked = false;
    document.getElementById('bulk-import-validate-only').checked = false;
    
    // Reset method to tab
    document.getElementById('method-tab').checked = true;
    updateImportMethodUI('tab');
    
    // Hide all sections
    hideAllBulkImportSections();
    
    // Reset data
    bulkImportData = {
        players: [],
        errors: [],
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1,
        isPaginated: true
    };
}

// Setup bulk import event listeners
function setupBulkImportEventListeners() {
    // Import method change
    document.querySelectorAll('input[name="import-method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateImportMethodUI(e.target.value);
        });
    });
    
    // File input change
    document.getElementById('bulk-import-file').addEventListener('change', handleFileUpload);
    
    // Preview button
    document.getElementById('preview-bulk-import-btn').addEventListener('click', handleBulkImportPreview);
    
    // Validate only button
    document.getElementById('validate-bulk-import-btn').addEventListener('click', handleValidateOnly);
    
    // Form submission
    document.getElementById('bulk-import-form').addEventListener('submit', handleBulkImportSubmit);
    
    // Preview navigation
    document.getElementById('preview-prev-page').addEventListener('click', () => changePreviewPage(-1));
    document.getElementById('preview-next-page').addEventListener('click', () => changePreviewPage(1));
    document.getElementById('preview-all-btn').addEventListener('click', () => togglePreviewMode(false));
    document.getElementById('preview-paginated-btn').addEventListener('click', () => togglePreviewMode(true));
}

// Update UI based on import method
function updateImportMethodUI(method) {
    const textSection = document.getElementById('text-input-section');
    const fileSection = document.getElementById('file-input-section');
    const inputHint = document.getElementById('input-hint');
    
    // Hide all instruction divs
    document.querySelectorAll('#format-instructions > div').forEach(div => {
        div.style.display = 'none';
    });
    
    // Show relevant instruction
    document.getElementById(`${method}-instructions`).style.display = 'block';
    
    // Update input sections
    if (method === 'file') {
        textSection.style.display = 'none';
        fileSection.style.display = 'block';
    } else {
        textSection.style.display = 'block';
        fileSection.style.display = 'none';
        
        // Update placeholder and hint
        const textarea = document.getElementById('bulk-import-data');
        switch (method) {
            case 'tab':
                textarea.placeholder = 'Paste tab-separated data here...\nFormat: PlayerName\tDota2ID\tMMR\tNotes(optional)';
                inputHint.textContent = 'Use Tab character to separate fields. Each player on a new line.';
                break;
            case 'csv':
                textarea.placeholder = 'Paste CSV data here...\nFormat: PlayerName,Dota2ID,MMR,Notes(optional)';
                inputHint.textContent = 'Use comma to separate fields. Each player on a new line.';
                break;
            case 'json':
                textarea.placeholder = 'Paste JSON data here...\nFormat: [{"name": "...", "dota2id": "...", "mmr": 0, "notes": "..."}]';
                inputHint.textContent = 'Paste valid JSON array of player objects.';
                break;
        }
    }
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showBulkImportAlert('File size exceeds 5MB limit.', 'danger');
        event.target.value = '';
        return;
    }
    
    // Validate file type
    const allowedTypes = ['.txt', '.csv', '.json', 'text/plain', 'text/csv', 'application/json'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidType = allowedTypes.includes(file.type) || allowedTypes.includes(fileExtension);
    
    if (!isValidType) {
        showBulkImportAlert('Invalid file type. Please upload .txt, .csv, or .json files.', 'danger');
        event.target.value = '';
        return;
    }
    
    try {
        const text = await file.text();
        document.getElementById('bulk-import-data').value = text;
        
        // Auto-detect format based on file extension
        if (fileExtension === '.csv') {
            document.getElementById('method-csv').checked = true;
            updateImportMethodUI('csv');
        } else if (fileExtension === '.json') {
            document.getElementById('method-json').checked = true;
            updateImportMethodUI('json');
        } else {
            document.getElementById('method-tab').checked = true;
            updateImportMethodUI('tab');
        }
        
        showBulkImportAlert('File loaded successfully!', 'success');
    } catch (error) {
        showBulkImportAlert('Error reading file: ' + error.message, 'danger');
        event.target.value = '';
    }
}

// Parse bulk import data based on selected method
function parseBulkImportData(data, method) {
    const players = [];
    const errors = [];
    
    try {
        switch (method) {
            case 'tab':
                return parseTabSeparatedData(data);
            case 'csv':
                return parseCSVData(data);
            case 'json':
                return parseJSONData(data);
            default:
                errors.push('Invalid import method selected.');
                return { players, errors };
        }
    } catch (error) {
        errors.push(`Parsing error: ${error.message}`);
        return { players, errors };
    }
}

// Parse tab-separated data
function parseTabSeparatedData(data) {
    const players = [];
    const errors = [];
    const lines = data.trim().split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return; // Skip empty lines
        
        const parts = trimmedLine.split('\t');
        
        if (parts.length < 3) {
            errors.push(`Line ${lineNumber}: Invalid format. Expected at least 3 fields (PlayerName, Dota2ID, MMR).`);
            return;
        }
        
        const [name, dota2id, mmr, notes] = parts.map(part => part.trim());
        
        // Validate and add player
        const validationResult = validatePlayerData(name, dota2id, mmr, notes, lineNumber);
        if (validationResult.isValid) {
            players.push(validationResult.player);
        } else {
            errors.push(validationResult.error);
        }
    });
    
    return { players, errors };
}

// Parse CSV data
function parseCSVData(data) {
    const players = [];
    const errors = [];
    const lines = data.trim().split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return; // Skip empty lines
        
        // Simple CSV parsing (handles quoted fields)
        const parts = parseCSVLine(trimmedLine);
        
        if (parts.length < 3) {
            errors.push(`Line ${lineNumber}: Invalid format. Expected at least 3 fields (PlayerName, Dota2ID, MMR).`);
            return;
        }
        
        const [name, dota2id, mmr, notes] = parts.map(part => part.trim());
        
        // Validate and add player
        const validationResult = validatePlayerData(name, dota2id, mmr, notes, lineNumber);
        if (validationResult.isValid) {
            players.push(validationResult.player);
        } else {
            errors.push(validationResult.error);
        }
    });
    
    return { players, errors };
}

// Simple CSV line parser
function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    parts.push(current);
    return parts;
}

// Parse JSON data
function parseJSONData(data) {
    const players = [];
    const errors = [];
    
    try {
        const jsonData = JSON.parse(data);
        
        if (!Array.isArray(jsonData)) {
            errors.push('JSON data must be an array of player objects.');
            return { players, errors };
        }
        
        jsonData.forEach((player, index) => {
            const lineNumber = index + 1;
            
            if (!player || typeof player !== 'object') {
                errors.push(`Line ${lineNumber}: Invalid player object.`);
                return;
            }
            
            const { name, dota2id, mmr, notes } = player;
            
            // Validate and add player
            const validationResult = validatePlayerData(name, dota2id, mmr, notes, lineNumber);
            if (validationResult.isValid) {
                players.push(validationResult.player);
            } else {
                errors.push(validationResult.error);
            }
        });
        
    } catch (error) {
        errors.push(`JSON parsing error: ${error.message}`);
    }
    
    return { players, errors };
}

// Validate player data
function validatePlayerData(name, dota2id, mmr, notes, lineNumber) {
    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid name (must be at least 2 characters) - got: "${name}"`
        };
    }
    
    if (name.trim().length > 50) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Name too long (max 50 characters) - got: "${name}"`
        };
    }
    
    // Dota2 ID validation
    if (!dota2id || typeof dota2id !== 'string' || !/^\d{6,20}$/.test(dota2id.trim())) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid Dota2 ID (must be 6-20 digits) - got: "${dota2id}"`
        };
    }
    
    // MMR validation
    const mmrNum = parseInt(mmr);
    if (isNaN(mmrNum) || mmrNum < 0 || mmrNum > 20000) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid MMR (must be 0-20000) - got: ${mmr}`
        };
    }
    
    // Notes validation (optional)
    if (notes && notes.length > 500) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Notes too long (max 500 characters)`
        };
    }
    
    return {
        isValid: true,
        player: {
            name: name.trim(),
            dota2id: dota2id.trim(),
            mmr: mmrNum,
            notes: notes ? notes.trim() : '',
            lineNumber: lineNumber
        }
    };
}

// Handle bulk import preview
function handleBulkImportPreview() {
    const method = document.querySelector('input[name="import-method"]:checked').value;
    const data = document.getElementById('bulk-import-data').value;
    
    if (!data.trim()) {
        showBulkImportAlert('Please enter data to preview.', 'warning');
        return;
    }
    
    const { players, errors } = parseBulkImportData(data, method);
    
    // Update global data
    bulkImportData.players = players;
    bulkImportData.errors = errors;
    bulkImportData.currentPage = 1;
    bulkImportData.totalPages = Math.ceil(players.length / bulkImportData.itemsPerPage);
    
    // Show results
    showBulkImportResults(players, errors);
}

// Handle validate only
function handleValidateOnly() {
    const method = document.querySelector('input[name="import-method"]:checked').value;
    const data = document.getElementById('bulk-import-data').value;
    
    if (!data.trim()) {
        showBulkImportAlert('Please enter data to validate.', 'warning');
        return;
    }
    
    const { players, errors } = parseBulkImportData(data, method);
    
    // Show validation results
    showBulkImportAlert(`Validation complete: ${players.length} valid players, ${errors.length} errors.`, 
                       errors.length === 0 ? 'success' : 'warning');
    
    // Show detailed results
    showBulkImportResults(players, errors);
}

// Show bulk import results
function showBulkImportResults(players, errors) {
    // Update statistics
    updateBulkImportStats(players, errors);
    
    // Show preview
    renderBulkImportPreview(players);
    
    // Show error details if any
    if (errors.length > 0) {
        renderErrorDetails(errors);
    }
    
    // Enable/disable import button
    const executeBtn = document.getElementById('execute-bulk-import-btn');
    executeBtn.disabled = players.length === 0;
    
    // Show relevant sections
    document.getElementById('import-stats').style.display = 'block';
    document.getElementById('bulk-import-preview').style.display = 'block';
    if (errors.length > 0) {
        document.getElementById('error-details').style.display = 'block';
    }
}

// Update bulk import statistics
function updateBulkImportStats(players, errors) {
    const existingPlayers = window.masterlistPlayers || [];
    const existingDota2Ids = new Set(existingPlayers.map(p => p.dota2id));
    
    let updates = 0;
    let skipped = 0;
    
    players.forEach(player => {
        if (existingDota2Ids.has(player.dota2id)) {
            updates++;
        } else {
            skipped++;
        }
    });
    
    document.getElementById('stats-valid').textContent = players.length;
    document.getElementById('stats-errors').textContent = errors.length;
    document.getElementById('stats-updates').textContent = updates;
    document.getElementById('stats-skipped').textContent = skipped;
}

// Render bulk import preview
function renderBulkImportPreview(players) {
    const previewBody = document.getElementById('bulk-import-preview-body');
    const previewCount = document.getElementById('preview-count');
    const previewRange = document.getElementById('preview-range');
    const previewTotal = document.getElementById('preview-total');
    
    previewCount.textContent = players.length;
    previewTotal.textContent = players.length;
    
    if (bulkImportData.isPaginated && players.length > bulkImportData.itemsPerPage) {
        const start = (bulkImportData.currentPage - 1) * bulkImportData.itemsPerPage;
        const end = Math.min(start + bulkImportData.itemsPerPage, players.length);
        const pagePlayers = players.slice(start, end);
        
        previewRange.textContent = `${start + 1}-${end}`;
        renderPreviewTable(pagePlayers, start + 1);
        
        // Update navigation buttons
        document.getElementById('preview-prev-page').disabled = bulkImportData.currentPage === 1;
        document.getElementById('preview-next-page').disabled = bulkImportData.currentPage === bulkImportData.totalPages;
    } else {
        previewRange.textContent = `1-${players.length}`;
        renderPreviewTable(players, 1);
        
        // Disable navigation buttons
        document.getElementById('preview-prev-page').disabled = true;
        document.getElementById('preview-next-page').disabled = true;
    }
}

// Render preview table
function renderPreviewTable(players, startIndex) {
    const previewBody = document.getElementById('bulk-import-preview-body');
    const existingPlayers = window.masterlistPlayers || [];
    const existingDota2Ids = new Set(existingPlayers.map(p => p.dota2id));
    
    previewBody.innerHTML = players.map((player, index) => {
        const rowNumber = startIndex + index;
        const existingPlayer = existingPlayers.find(p => p.dota2id === player.dota2id);
        let status = 'New';
        let statusClass = 'success';
        
        if (existingPlayer) {
            status = 'Update';
            statusClass = 'warning';
        }
        
        return `
            <tr>
                <td>${rowNumber}</td>
                <td>${escapeHtml(player.name)}</td>
                <td><code>${escapeHtml(player.dota2id)}</code></td>
                <td>${player.mmr.toLocaleString()}</td>
                <td>${escapeHtml(player.notes || '')}</td>
                <td><span class="badge bg-${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');
}

// Render error details
function renderErrorDetails(errors) {
    const errorBody = document.getElementById('error-details-body');
    
    errorBody.innerHTML = errors.map(error => {
        const parts = error.split(': ');
        const lineField = parts[0];
        const errorMessage = parts.slice(1).join(': ');
        
        return `
            <tr>
                <td><code>${lineField}</code></td>
                <td>Validation</td>
                <td>${escapeHtml(errorMessage)}</td>
            </tr>
        `;
    }).join('');
}

// Change preview page
function changePreviewPage(direction) {
    const newPage = bulkImportData.currentPage + direction;
    if (newPage >= 1 && newPage <= bulkImportData.totalPages) {
        bulkImportData.currentPage = newPage;
        renderBulkImportPreview(bulkImportData.players);
    }
}

// Toggle preview mode
function togglePreviewMode(isPaginated) {
    bulkImportData.isPaginated = isPaginated;
    bulkImportData.currentPage = 1;
    renderBulkImportPreview(bulkImportData.players);
}

// Hide all bulk import sections
function hideAllBulkImportSections() {
    const sections = [
        'import-progress',
        'bulk-import-preview',
        'import-stats',
        'error-details',
        'bulk-import-alert'
    ];
    
    sections.forEach(sectionId => {
        document.getElementById(sectionId).style.display = 'none';
    });
}

// Show bulk import alert
function showBulkImportAlert(message, type = 'info') {
    const alertElement = document.getElementById('bulk-import-alert');
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    alertElement.style.display = 'block';
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 3000);
    }
}

// Enhanced bulk import submission
async function handleBulkImportSubmit(event) {
    event.preventDefault();
    
    const method = document.querySelector('input[name="import-method"]:checked').value;
    const data = document.getElementById('bulk-import-data').value;
    const validateOnly = document.getElementById('bulk-import-validate-only').checked;
    
    if (!data.trim()) {
        showBulkImportAlert('Please enter data to import.', 'warning');
        return;
    }
    
    const { players, errors } = parseBulkImportData(data, method);
    
    if (players.length === 0) {
        showBulkImportAlert('No valid players found to import.', 'warning');
        return;
    }
    
    if (validateOnly) {
        showBulkImportAlert(`Validation complete: ${players.length} valid players, ${errors.length} errors.`, 
                           errors.length === 0 ? 'success' : 'warning');
        return;
    }
    
    // Show progress
    showImportProgress();
    
    const skipDuplicates = document.getElementById('bulk-import-skip-duplicates').checked;
    const updateExisting = document.getElementById('bulk-import-update-existing').checked;
    
    // Prepare players for import
    const playersToImport = players.map(player => ({
        name: player.name,
        dota2id: player.dota2id,
        mmr: player.mmr,
        notes: player.notes || ""
    }));
    
    // Disable submit button and show loading
    const executeBtn = document.getElementById('execute-bulk-import-btn');
    const originalText = executeBtn.innerHTML;
    executeBtn.disabled = true;
    executeBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Importing...';
    
    try {
        // Update progress
        updateImportProgress(25, 'Sending data to server...');
        
        // Debug: Log the exact payload being sent
        console.log('=== BULK IMPORT DEBUG ===');
        console.log('Method:', method);
        console.log('Raw data:', data);
        console.log('Parsed players:', players);
        console.log('Players to import:', playersToImport);
        console.log('Skip duplicates:', skipDuplicates);
        console.log('Update existing:', updateExisting);
        console.log('Payload being sent:', {
            players: playersToImport,
            skipDuplicates: skipDuplicates,
            updateExisting: updateExisting
        });
        console.log('=== END DEBUG ===');
        
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
        
        updateImportProgress(75, 'Processing import...');
        
        const result = await response.json();
        
        updateImportProgress(100, 'Import completed!');
        
        if (result.success) {
            // Show success message
            let msg = `<i class="bi bi-check-circle me-2"></i><strong>Import successful!</strong><br>`;
            msg += `Added: ${result.added || 0} players<br>`;
            msg += `Updated: ${result.updated || 0} players<br>`;
            msg += `Skipped: ${result.skipped || 0} players`;
            
            if (errors.length > 0) {
                msg += `<br><span class="text-warning">${errors.length} player(s) had validation errors.</span>`;
            }
            
            if (result.errors && result.errors.length > 0) {
                msg += `<br><span class="text-danger">${result.errors.length} error(s) during import.</span>`;
            }
            
            showBulkImportAlert(msg, 'success');
            
            // Reload masterlist data
            await loadMasterlistData();
            
            // Close modal after a delay
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('bulk-import-masterlist-modal'));
                modal.hide();
            }, 3000);
            
        } else {
            throw new Error(result.message || 'Import failed');
        }
        
    } catch (error) {
        console.error('Bulk import error:', error);
        showBulkImportAlert(`<i class="bi bi-exclamation-triangle me-2"></i><strong>Import failed:</strong> ${error.message}`, 'danger');
        
    } finally {
        // Re-enable submit button
        executeBtn.disabled = false;
        executeBtn.innerHTML = originalText;
        
        // Hide progress after a delay
        setTimeout(() => {
            document.getElementById('import-progress').style.display = 'none';
        }, 2000);
    }
}

// Show import progress
function showImportProgress() {
    document.getElementById('import-progress').style.display = 'block';
    updateImportProgress(0, 'Starting import...');
}

// Update import progress
function updateImportProgress(percentage, text) {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = text;
    progressPercentage.textContent = `${percentage}%`;
} 