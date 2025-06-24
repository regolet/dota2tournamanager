const fetch = require('node-fetch');

module.exports = {
    name: 'tournaments',
    description: 'List available tournaments',
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fetch tournaments from your webapp
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
                const embed = {
                    color: 0x00ff00,
                    title: '🏆 Available Tournaments',
                    description: 'Here are the tournaments you can register for:',
                    fields: data.sessions
                        .filter(session => session.isActive)
                        .map(session => ({
                            name: `${session.title}`,
                            value: `👥 Players: ${session.playerCount}\n📅 Created: ${new Date(session.createdAt).toLocaleDateString()}\n🆔 ID: \`${session.sessionId}\``,
                            inline: true
                        })),
                    footer: {
                        text: 'Use /register to join a tournament'
                    }
                };

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply('❌ No active tournaments found at the moment.');
            }
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            await interaction.editReply('❌ Failed to fetch tournaments. Please try again later.');
        }
    },
}; 