const fetch = require('node-fetch');

module.exports = {
    name: 'status',
    description: 'Check your registration status',
    async execute(interaction) {
        await interaction.deferReply();

        const discordId = interaction.user.id;
        const playerName = interaction.user.username;

        try {
            // Fetch player status from your webapp
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/api-players?discordId=${discordId}`, {
                headers: {
                    'x-session-id': process.env.WEBAPP_SESSION_ID
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.players) && data.players.length > 0) {
                const player = data.players[0]; // Assuming one player per Discord ID
                
                const embed = {
                    color: 0x00ff00,
                    title: '✅ Registration Status',
                    description: `You are registered for tournaments!`,
                    fields: [
                        {
                            name: 'Player Info',
                            value: `**Name:** ${player.name}\n**Dota 2 ID:** ${player.dota2id}\n**MMR:** ${player.peakmmr}`,
                            inline: true
                        },
                        {
                            name: 'Tournament',
                            value: `\`${player.sessionId || 'Unknown'}\``,
                            inline: true
                        }
                    ],
                    footer: {
                        text: 'Use /teams to see your team assignment'
                    }
                };

                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = {
                    color: 0xff9900,
                    title: '❌ Not Registered',
                    description: `You are not registered for any tournaments yet.`,
                    fields: [
                        {
                            name: 'How to Register',
                            value: 'Use `/tournaments` to see available tournaments\nThen use `/register` to join one!',
                            inline: false
                        }
                    ]
                };

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error checking status:', error);
            await interaction.editReply('❌ Failed to check status. Please try again later.');
        }
    },
}; 