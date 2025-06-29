const fs = require('fs');
const path = require('path');
const SESSION_FILE = path.join(__dirname, 'guild_sessions.json');

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

function getGuildSessionId(guildId) {
    const sessions = loadSessions();
    return sessions[guildId] || '';
}

module.exports = { loadSessions, getGuildSessionId }; 