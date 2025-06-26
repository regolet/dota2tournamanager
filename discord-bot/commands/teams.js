const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'teams',
    description: 'View team information for a tournament',
    options: [
        {
            name: 'tournament',
            type: 3, // STRING
            description: 'Tournament ID to view teams for',
            required: true
        }
    ],
    async execute(interaction) {
        const tournamentId = interaction.options.getString('tournament');

        try {
            // For now, show a helpful message since team viewing requires admin access
            const embed = {
                color: 0x0099ff,
                title: '🏆 Team Information',
                description: `Team assignments for tournament \`${tournamentId}\``,
                fields: [
                    {
                        name: 'ℹ️ Information',
                        value: 'Team assignments are managed by tournament administrators.\n\n**To view teams:**\n• Contact the tournament admin\n• Check the tournament announcement channel\n• Wait for team assignments to be published',
                        inline: false
                    },
                    {
                        name: '📋 Registration Status',
                        value: `Use \`/status tournament:${tournamentId}\` to check if you're registered for this tournament.`,
                        inline: false
                    }
                ],
                footer: {
                    text: 'Team assignments will be available once the admin creates them'
                }
            };

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            
        } catch (error) {
            console.error('Error in teams command:', error);
            await interaction.reply({ content: '❌ Failed to get team information. Please try again later.', flags: MessageFlags.Ephemeral });
        }
    }
}; 