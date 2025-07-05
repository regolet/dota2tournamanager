// Ban Management System
class BanManager {
    constructor() {
        this.bannedPlayers = [];
        this.filteredPlayers = [];
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBannedPlayers();
        this.loadBanHistory();
    }

    setupEventListeners() {
        // Ban form submission
        const banForm = document.getElementById('banForm');
        if (banForm) {
            banForm.addEventListener('submit', (e) => this.handleBanSubmit(e));
        }

        // Ban type change handler
        const banTypeSelect = document.getElementById('banType');
        if (banTypeSelect) {
            banTypeSelect.addEventListener('change', (e) => this.handleBanTypeChange(e));
        }
    }

    handleBanTypeChange(event) {
        const expiresAtGroup = document.getElementById('expiresAtGroup');
        const expiresAtInput = document.getElementById('banExpiresAt');
        
        if (event.target.value === 'temporary') {
            expiresAtGroup.style.display = 'block';
            expiresAtInput.required = true;
            
            // Set default expiration to 24 hours from now
            const tomorrow = new Date();
            tomorrow.setHours(tomorrow.getHours() + 24);
            expiresAtInput.value = tomorrow.toISOString().slice(0, 16);
        } else {
            expiresAtGroup.style.display = 'none';
            expiresAtInput.required = false;
            expiresAtInput.value = '';
        }
    }

    async handleBanSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const banData = {
            dota2id: formData.get('dota2id'),
            playerName: formData.get('playerName'),
            reason: formData.get('reason'),
            banType: formData.get('banType'),
            expiresAt: formData.get('expiresAt') || null
        };

        try {
            const response = await fetch('/.netlify/functions/bans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                },
                body: JSON.stringify(banData)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Player banned successfully', 'success');
                event.target.reset();
                this.loadBannedPlayers();
                this.loadBanHistory();
            } else {
                this.showMessage(result.error || 'Failed to ban player', 'error');
            }
        } catch (error) {
            this.showMessage('Error banning player: ' + error.message, 'error');
        }
    }

    async loadBannedPlayers() {
        const container = document.getElementById('bannedPlayersList');
        if (!container) return;

        try {
            const response = await fetch('/.netlify/functions/bans', {
                headers: {
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.bannedPlayers = result.bannedPlayers || [];
                this.filteredPlayers = this.bannedPlayers;
                this.renderBannedPlayers(this.filteredPlayers, container);
                this.setupSorting();
                this.setupSearch();
            } else {
                container.innerHTML = '<div class="error">Error loading banned players</div>';
            }
        } catch (error) {
            container.innerHTML = '<div class="error">Error loading banned players</div>';
        }
    }

    async loadBanHistory() {
        const container = document.getElementById('banHistoryList');
        if (!container) return;

        try {
            const response = await fetch('/.netlify/functions/bans?history=true', {
                headers: {
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderBanHistory(result.data, container);
            } else {
                container.innerHTML = '<div class="error">Error loading ban history</div>';
            }
        } catch (error) {
            container.innerHTML = '<div class="error">Error loading ban history</div>';
        }
    }

    renderBannedPlayers(bannedPlayers, container) {
        if (!bannedPlayers || bannedPlayers.length === 0) {
            container.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No currently banned players</td></tr>`;
            return;
        }

        const html = bannedPlayers.map(player => `
            <tr>
                <td>${this.escapeHtml(player.dota2id)}</td>
                <td>${this.escapeHtml(player.player_name)}</td>
                <td>${this.escapeHtml(player.reason)}</td>
                <td>${this.escapeHtml(player.ban_type)}</td>
                <td>${player.expires_at ? new Date(player.expires_at).toLocaleString() : '-'}</td>
                <td>${this.escapeHtml(player.banned_by_username)}</td>
                <td>${new Date(player.created_at).toLocaleString()}</td>
                <td>
                    <button onclick="banManager.unbanPlayer('${player.dota2id}')" class="btn btn-success btn-sm">
                        Unban Player
                    </button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = html;
    }

    renderBanHistory(banHistory, container) {
        if (!banHistory || banHistory.length === 0) {
            container.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No ban history available</td></tr>`;
            return;
        }

        const html = banHistory.map(ban => `
            <tr class="${ban.is_active ? 'table-danger' : 'table-secondary'}">
                <td>${this.escapeHtml(ban.dota2id)}</td>
                <td>${this.escapeHtml(ban.player_name)}</td>
                <td>${this.escapeHtml(ban.reason)}</td>
                <td>${this.escapeHtml(ban.ban_type)}</td>
                <td>${ban.expires_at ? new Date(ban.expires_at).toLocaleString() : '-'}</td>
                <td>${this.escapeHtml(ban.banned_by_username)}</td>
                <td>
                    <span class="badge ${ban.is_active ? 'bg-danger' : 'bg-secondary'}">
                        ${ban.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(ban.created_at).toLocaleString()}</td>
            </tr>
        `).join('');

        container.innerHTML = html;
    }

    async unbanPlayer(dota2id) {
        if (!confirm('Are you sure you want to unban this player?')) {
            return;
        }

        try {
            const response = await fetch(`/.netlify/functions/bans?dota2id=${encodeURIComponent(dota2id)}`, {
                method: 'DELETE',
                headers: {
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Player unbanned successfully', 'success');
                this.loadBannedPlayers();
                this.loadBanHistory();
            } else {
                this.showMessage(result.error || 'Failed to unban player', 'error');
            }
        } catch (error) {
            this.showMessage('Error unbanning player: ' + error.message, 'error');
        }
    }

    showMessage(message, type = 'info') {
        const alertContainer = document.getElementById('banAlert');
        if (alertContainer) {
            alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            alertContainer.style.display = 'block';
            
            setTimeout(() => {
                alertContainer.style.display = 'none';
            }, 5000);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupSorting() {
        const table = document.getElementById('bannedPlayersTable');
        if (!table) return;
        const headers = table.querySelectorAll('th');
        const columns = [
            'dota2id',
            'player_name',
            'reason',
            'ban_type',
            'expires_at',
            'banned_by_username',
            'created_at',
            'actions'
        ];
        headers.forEach((th, idx) => {
            if (columns[idx] === 'actions') return; // Skip actions column
            th.style.cursor = 'pointer';
            th.onclick = () => {
                this.handleSort(columns[idx]);
            };
        });
        this.updateSortIndicators();
    }

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.sortAndRender();
    }

    sortAndRender() {
        const sorted = [...this.filteredPlayers];
        const col = this.sortColumn;
        const dir = this.sortDirection;
        if (col) {
            sorted.sort((a, b) => {
                let valA = a[col];
                let valB = b[col];
                // Handle null/undefined
                if (valA == null) valA = '';
                if (valB == null) valB = '';
                // For dates, sort as dates
                if (col === 'expires_at' || col === 'created_at') {
                    valA = valA ? new Date(valA) : new Date(0);
                    valB = valB ? new Date(valB) : new Date(0);
                }
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        const container = document.getElementById('bannedPlayersList');
        this.renderBannedPlayers(sorted, container);
        this.updateSortIndicators();
    }

    updateSortIndicators() {
        const table = document.getElementById('bannedPlayersTable');
        if (!table) return;
        const headers = table.querySelectorAll('th');
        const columns = [
            'dota2id',
            'player_name',
            'reason',
            'ban_type',
            'expires_at',
            'banned_by_username',
            'created_at',
            'actions'
        ];
        headers.forEach((th, idx) => {
            th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim();
            if (columns[idx] === this.sortColumn) {
                th.innerHTML += this.sortDirection === 'asc' ? ' ▲' : ' ▼';
            }
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('bannedPlayersSearch');
        if (!searchInput) return;
        searchInput.value = this.searchTerm;
        searchInput.oninput = (e) => {
            this.searchTerm = e.target.value;
            this.filterAndRender();
        };
    }

    filterAndRender() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) {
            this.filteredPlayers = this.bannedPlayers;
        } else {
            this.filteredPlayers = this.bannedPlayers.filter(player => {
                return (
                    (player.dota2id && player.dota2id.toLowerCase().includes(term)) ||
                    (player.player_name && player.player_name.toLowerCase().includes(term)) ||
                    (player.reason && player.reason.toLowerCase().includes(term)) ||
                    (player.ban_type && player.ban_type.toLowerCase().includes(term)) ||
                    (player.banned_by_username && player.banned_by_username.toLowerCase().includes(term)) ||
                    (player.created_at && new Date(player.created_at).toLocaleString().toLowerCase().includes(term)) ||
                    (player.expires_at && new Date(player.expires_at).toLocaleString().toLowerCase().includes(term))
                );
            });
        }
        this.sortAndRender();
    }
}

// Initialize bans module
window.initBans = function initBans() {
    console.log('🚀 Bans: Starting initialization...');
    
    // Create global ban manager instance
    window.banManager = new BanManager();
    
    // Set up additional event listeners for the ban modal
    const banForm = document.getElementById('banForm');
    const banType = document.getElementById('banType');
    
    if (banForm) {
        banForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(banForm);
            const banData = {
                dota2id: formData.get('dota2id'),
                playerName: formData.get('playerName'),
                reason: formData.get('reason'),
                banType: formData.get('banType'),
                expiresAt: formData.get('expiresAt') || null
            };

            try {
                const res = await fetch('/.netlify/functions/bans', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                    },
                    body: JSON.stringify(banData)
                });
                const data = await res.json();
                
                if (data.success) {
                    alert('Player banned successfully!');
                    banForm.reset();
                    loadBannedPlayers();
                } else {
                    alert(data.message || 'Failed to ban player.');
                }
            } catch (err) {
                console.error('Error banning player:', err);
                alert('Error banning player.');
            }
        });
    }

    if (banType) {
        banType.addEventListener('change', (e) => {
            const expiresAtGroup = document.getElementById('expiresAtGroup');
            const expiresAtInput = document.getElementById('banExpiresAt');
            
            if (e.target.value === 'temporary') {
                expiresAtGroup.style.display = 'block';
                expiresAtInput.required = true;
                
                // Set default expiration to 24 hours from now
                const tomorrow = new Date();
                tomorrow.setHours(tomorrow.getHours() + 24);
                expiresAtInput.value = tomorrow.toISOString().slice(0, 16);
            } else {
                expiresAtGroup.style.display = 'none';
                expiresAtInput.required = false;
                expiresAtInput.value = '';
            }
        });
    }

    // Set up unban functionality
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('unban-btn')) {
            const dota2id = e.target.dataset.dota2id;
            if (dota2id && confirm('Are you sure you want to unban this player?')) {
                unbanPlayer(dota2id);
            }
        }
    });

    async function unbanPlayer(dota2id) {
        try {
            const res = await fetch('/.netlify/functions/bans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                },
                body: JSON.stringify({ action: 'unban', dota2id })
            });
            const data = await res.json();
            
            if (data.success) {
                if (window.banManager) {
                    window.banManager.loadBannedPlayers();
                }
            } else {
                alert(data.message || 'Failed to unban player.');
            }
        } catch (err) {
            console.error('Error unbanning player:', err);
            alert('Error unbanning player.');
        }
    }

    // Reset form and modal on open
    const banModalElement = document.getElementById('banModal');
    if (banModalElement) {
        banModalElement.addEventListener('show.bs.modal', () => {
            if (banForm) banForm.reset();
            if (banType) banType.dispatchEvent(new Event('change'));
        });
    }

    // Initial load
    if (window.banManager) {
        window.banManager.loadBannedPlayers();
    }
    
    // Initialize player search functionality
    if (typeof window.initPlayerSearch === 'function') {
        window.initPlayerSearch();
    }
    
    console.log('✅ Bans: Initialization complete');
};

window.cleanupBans = function cleanupBans() {
    console.log('🧹 Bans: Starting cleanup...');
    // Clean up the global banManager instance
    delete window.banManager;
    console.log('🧹 Bans: Cleanup complete');
};

// --- Player Search Table for Ban Modal ---
// Use a module pattern to avoid variable redeclaration
(function() {
    // Check if variables already exist to prevent redeclaration
    if (typeof window.bansModule === 'undefined') {
        window.bansModule = {
            allPlayers: [],
            currentPage: 1,
            itemsPerPage: 10,
            filteredPlayers: []
        };
    }

    function initPlayerSearch() {
        // Initialize player search when bans module loads
        fetchAllPlayers();
        // Wire up search input to filterPlayers
        const playerSearchInput = document.getElementById('playerSearchInput');
        if (playerSearchInput) {
            playerSearchInput.addEventListener('input', function (e) {
                window.filterPlayers(e.target.value);
            });
        }
    }

    async function fetchAllPlayers() {
        try {
            const res = await fetch('/.netlify/functions/api-players?limit=500', {
                method: 'GET',
                headers: {
                    'x-session-id': window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId')
                }
            });
            const data = await res.json();
            
            if (data.success && Array.isArray(data.players)) {
                window.bansModule.allPlayers = data.players;
                window.bansModule.filteredPlayers = [...window.bansModule.allPlayers];
                window.bansModule.currentPage = 1;
                renderPlayerSearchTable();
            } else {
                window.bansModule.allPlayers = [];
                window.bansModule.filteredPlayers = [];
                window.bansModule.currentPage = 1;
                renderPlayerSearchTable();
            }
        } catch (err) {
            console.error('Error fetching players:', err);
            window.bansModule.allPlayers = [];
            window.bansModule.filteredPlayers = [];
            window.bansModule.currentPage = 1;
            renderPlayerSearchTable();
        }
    }

    function renderPlayerSearchTable() {
        const tableBody = document.getElementById('playerSearchTableBody');
        const pagination = document.getElementById('playerPagination');
        
        if (!tableBody) return;
        
        if (!window.bansModule.filteredPlayers || window.bansModule.filteredPlayers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No players found.</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(window.bansModule.filteredPlayers.length / window.bansModule.itemsPerPage);
        const startIndex = (window.bansModule.currentPage - 1) * window.bansModule.itemsPerPage;
        const endIndex = startIndex + window.bansModule.itemsPerPage;
        const currentPlayers = window.bansModule.filteredPlayers.slice(startIndex, endIndex);
        
        // Render table
        tableBody.innerHTML = currentPlayers.map(player => `
            <tr>
                <td>${player.dota2id}</td>
                <td>${player.name || ''}</td>
                <td>${player.email || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectPlayer('${player.dota2id}', '${player.name || ''}')">
                        Select
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Render pagination
        if (pagination) {
            renderPagination(totalPages);
        }
    }

    function renderPagination(totalPages) {
        const pagination = document.getElementById('playerPagination');
        if (!pagination || totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        if (window.bansModule.currentPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${window.bansModule.currentPage - 1})">Previous</a></li>`;
        }
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === window.bansModule.currentPage) {
                paginationHTML += `<li class="page-item active"><a class="page-link" href="#">${i}</a></li>`;
            } else {
                paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${i})">${i}</a></li>`;
            }
        }
        
        // Next button
        if (window.bansModule.currentPage < totalPages) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${window.bansModule.currentPage + 1})">Next</a></li>`;
        }
        
        pagination.innerHTML = paginationHTML;
    }

    function changePage(page) {
        window.bansModule.currentPage = page;
        renderPlayerSearchTable();
    }

    function filterPlayers(searchTerm) {
        if (!searchTerm) {
            window.bansModule.filteredPlayers = [...window.bansModule.allPlayers];
        } else {
            window.bansModule.filteredPlayers = window.bansModule.allPlayers.filter(player => 
                (player.name && player.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (player.dota2id && player.dota2id.toString().includes(searchTerm)) ||
                (player.email && player.email.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        window.bansModule.currentPage = 1;
        renderPlayerSearchTable();
    }

    function selectPlayer(dota2id, name) {
        // Fill the ban form with selected player data
        const dota2idInput = document.getElementById('banDota2Id');
        const playerNameInput = document.getElementById('banPlayerName');
        
        if (dota2idInput) dota2idInput.value = dota2id;
        if (playerNameInput) playerNameInput.value = name;
        
        // Close the player search modal if it exists
        const playerSearchModal = document.getElementById('playerSearchModal');
        if (playerSearchModal) {
            const modal = bootstrap.Modal.getInstance(playerSearchModal);
            if (modal) modal.hide();
        }
    }

    // Helper function to get session ID
    function getSessionId() {
        return window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
    }

    // Make functions globally available for onclick handlers
    window.changePage = changePage;
    window.filterPlayers = filterPlayers;
    window.selectPlayer = selectPlayer;
    window.initPlayerSearch = initPlayerSearch;
})(); 