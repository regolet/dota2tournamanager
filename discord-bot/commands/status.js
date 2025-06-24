const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Check your registration status for a tournament',
    options: [
        {
            name: 'tournament',
            type: 3, // STRING
            description: 'Tournament ID to check status for',
            required: true
        }
    ],
    async execute(interaction) {
        const tournamentId = interaction.options.getString('tournament');
        const playerName = interaction.user.username;

        try {
            // Fetch players for the specific tournament (public access)
            const response = await global.fetch(`${process.env.WEBAPP_URL}/.netlify/functions/api-players?sessionId=${tournamentId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.players) && data.players.length > 0) {
                // Find the player by name (case-insensitive)
                const player = data.players.find(p => 
                    p.name && p.name.toLowerCase() === playerName.toLowerCase()
                );
                
                if (player) {
                    const embed = {
                        color: 0x00ff00,
                        title: '✅ Registration Status',
                        description: `You are registered for tournament \`${tournamentId}\`!`,
                        fields: [
                            {
                                name: 'Player Info',
                                value: `**Name:** ${player.name}\n**Dota 2 ID:** ${player.dota2id}\n**MMR:** ${player.peakmmr}`,
                                inline: true
                            },
                            {
                                name: 'Tournament',
                                value: `\`${tournamentId}\``,
                                inline: true
                            }
                        ],
                        footer: {
                            text: 'Use /teams to see your team assignment'
                        }
                    };

                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    const embed = {
                        color: 0xff9900,
                        title: '❌ Not Registered',
                        description: `You are not registered for tournament \`${tournamentId}\`.`,
                        fields: [
                            {
                                name: 'How to Register',
                                value: `Use \`/register tournament:${tournamentId} dota2id:YOUR_ID mmr:YOUR_MMR\` to join!`,
                                inline: false
                            }
                        ]
                    };

                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }
            } else {
                const embed = {
                    color: 0xff9900,
                    title: '❌ Tournament Not Found',
                    description: `Tournament \`${tournamentId}\` not found or has no registrations.`,
                    fields: [
                        {
                            name: 'Available Tournaments',
                            value: 'Use `/tournaments` to see available tournaments',
                            inline: false
                        }
                    ]
                };

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Error checking status:', error);
            await interaction.reply({ content: '❌ Failed to check status. Please try again later.', flags: MessageFlags.Ephemeral });
        }
    },
}; 