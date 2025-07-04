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
                    'x-session-id': getSessionId()
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
                    'x-session-id': getSessionId()
                }
            });

            const result = await response.json();

            if (result.success) {
                this.renderBannedPlayers(result.data, container);
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
                    'x-session-id': getSessionId()
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
                    'x-session-id': getSessionId()
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
        // Create a simple message display
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        
        // Add to page
        document.body.appendChild(messageDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize ban manager when page loads
let banManager;
document.addEventListener('DOMContentLoaded', () => {
    banManager = new BanManager();
}); 