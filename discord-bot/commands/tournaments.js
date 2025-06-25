const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    name: 'tournaments',
    description: 'List available tournaments',
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fetch tournaments from your webapp
            console.log('[tournaments] Fetching tournaments from API:', `${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
            console.log('[tournaments] API response status:', response.status);
            let data = {};
            try {
                data = await response.json();
                console.log('[tournaments] API response data:', data);
            } catch (jsonErr) {
                console.error('[tournaments] Error parsing API response JSON:', jsonErr);
            }

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
                        text: 'Click a button below to register!'
                    }
                };

                // Create a row of buttons for each tournament
                const rows = [];
                data.sessions.filter(session => session.isActive).forEach(session => {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`register_tournament_${session.sessionId}`)
                            .setLabel(`Register for ${session.title}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                    rows.push(row);
                });

                await interaction.editReply({ embeds: [embed], components: rows });
            } else {
                console.warn('[tournaments] No active tournaments found or API returned error:', data);
                await interaction.editReply('❌ No active tournaments found at the moment.');
            }
        } catch (error) {
            console.error('[tournaments] Error fetching tournaments:', error);
            await interaction.editReply('❌ Failed to fetch tournaments. Please try again later.');
        }
    },
}; 