// Ban Management System
class BanManager {
    constructor() {
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
                this.renderBannedPlayers(result.bannedPlayers, container);
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
            container.innerHTML = '<div class="no-data">No currently banned players</div>';
            return;
        }

        const html = bannedPlayers.map(player => `
            <div class="banned-player-card">
                <div class="player-info">
                    <h3>${this.escapeHtml(player.player_name)}</h3>
                    <p><strong>Dota 2 ID:</strong> ${this.escapeHtml(player.dota2id)}</p>
                    <p><strong>Reason:</strong> ${this.escapeHtml(player.reason)}</p>
                    <p><strong>Ban Type:</strong> ${player.ban_type}</p>
                    ${player.expires_at ? `<p><strong>Expires:</strong> ${new Date(player.expires_at).toLocaleString()}</p>` : ''}
                    <p><strong>Banned by:</strong> ${this.escapeHtml(player.banned_by_username)}</p>
                    <p><strong>Banned on:</strong> ${new Date(player.created_at).toLocaleString()}</p>
                </div>
                <div class="player-actions">
                    <button onclick="banManager.unbanPlayer('${player.dota2id}')" class="btn btn-success">
                        Unban Player
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    renderBanHistory(banHistory, container) {
        if (!banHistory || banHistory.length === 0) {
            container.innerHTML = '<div class="no-data">No ban history available</div>';
            return;
        }

        const html = banHistory.map(ban => `
            <div class="ban-history-card ${ban.is_active ? 'active-ban' : 'inactive-ban'}">
                <div class="ban-info">
                    <h3>${this.escapeHtml(ban.player_name)}</h3>
                    <p><strong>Dota 2 ID:</strong> ${this.escapeHtml(ban.dota2id)}</p>
                    <p><strong>Reason:</strong> ${this.escapeHtml(ban.reason)}</p>
                    <p><strong>Ban Type:</strong> ${ban.ban_type}</p>
                    ${ban.expires_at ? `<p><strong>Expires:</strong> ${new Date(ban.expires_at).toLocaleString()}</p>` : ''}
                    <p><strong>Banned by:</strong> ${this.escapeHtml(ban.banned_by_username)}</p>
                    <p><strong>Status:</strong> ${ban.is_active ? 'Active' : 'Inactive'}</p>
                    <p><strong>Date:</strong> ${new Date(ban.created_at).toLocaleString()}</p>
                </div>
                ${ban.is_active ? `
                    <div class="ban-actions">
                        <button onclick="banManager.unbanPlayer('${ban.dota2id}')" class="btn btn-success">
                            Unban Player
                        </button>
                    </div>
                ` : ''}
            </div>
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