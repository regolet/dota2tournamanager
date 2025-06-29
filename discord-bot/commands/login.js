const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

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
    name: 'login',
    description: 'Log in to the webapp as an admin (per guild session)',
    async execute(interaction) {
        const username = interaction.options.getString('username');
        const password = interaction.options.getString('password');
        const guildId = interaction.guildId;

        if (!username || !password) {
            await interaction.reply({ content: '❌ Username and password are required.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const res = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success && data.sessionId) {
                // Store session per guild
                const sessions = loadSessions();
                sessions[guildId] = data.sessionId;
                saveSessions(sessions);
                await interaction.editReply('✅ Login successful! Session is now active for this server.');
            } else {
                await interaction.editReply(`❌ Login failed: ${data.error || data.message || 'Unknown error.'}`);
            }
        } catch (error) {
            console.error('Login command error:', error);
            await interaction.editReply('❌ Login failed due to an internal error.');
        }
    }
}; 