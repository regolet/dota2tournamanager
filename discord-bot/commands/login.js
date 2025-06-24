const fetch = require('node-fetch');

// In-memory session store per Discord user
const userSessions = new Map();

module.exports = {
    name: 'login',
    description: 'Login as admin. Usage: /login username: <username> password: <password>',
    options: [
        {
            name: 'username',
            type: 3, // STRING
            description: 'Your admin username',
            required: true
        },
        {
            name: 'password',
            type: 3, // STRING
            description: 'Your admin password',
            required: true
        }
    ],
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const username = interaction.options.getString('username');
        const password = interaction.options.getString('password');
        const discordId = interaction.user.id;

        try {
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok && data.success && data.sessionId) {
                userSessions.set(discordId, data.sessionId);
                await interaction.editReply({ content: `✅ Login successful! Session ID stored for your account.`, ephemeral: true });
            } else {
                await interaction.editReply({ content: `❌ Login failed: ${data.error || data.message || 'Unknown error'}`, ephemeral: true });
            }
        } catch (error) {
            console.error('Login command error:', error);
            await interaction.editReply({ content: '❌ Login failed due to a server or network error.', ephemeral: true });
        }
    },
    // Helper to get sessionId for a Discord user
    getSessionId(discordId) {
        return userSessions.get(discordId);
    }
}; 