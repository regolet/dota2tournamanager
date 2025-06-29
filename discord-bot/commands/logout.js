const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '../guild_sessions.json');

function loadSessions() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load session file:', e);
    }
    return {};
}

function saveSessions(sessions) {
    try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save session file:', e);
    }
}

module.exports = {
    name: 'logout',
    description: 'Log out and remove the stored session for this server',
    async execute(interaction) {
        const guildId = interaction.guildId;
        await interaction.deferReply({ ephemeral: true });
        const sessions = loadSessions();
        if (sessions[guildId]) {
            delete sessions[guildId];
            saveSessions(sessions);
            await interaction.editReply('✅ Successfully logged out and removed the session for this server.');
        } else {
            await interaction.editReply('ℹ️ No active session found for this server.');
        }
    }
}; 