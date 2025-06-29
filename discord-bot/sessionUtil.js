const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();
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

async function requireValidSession(interaction) {
    const guildId = interaction.guildId;
    const sessionId = getGuildSessionId(guildId);
    if (!sessionId) {
        await interaction.reply({ content: '❌ No valid session found for this server. Please use `/login` to authenticate.', ephemeral: true });
        return false;
    }
    try {
        const res = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/check-session`, {
            headers: { 'x-session-id': sessionId }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            await interaction.reply({ content: '❌ Session is invalid or expired. Please use `/login` to authenticate.', ephemeral: true });
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error validating session:', err);
        await interaction.reply({ content: '❌ Failed to validate session. Please try again later.', ephemeral: true });
        return false;
    }
}

module.exports = { loadSessions, getGuildSessionId, requireValidSession }; 