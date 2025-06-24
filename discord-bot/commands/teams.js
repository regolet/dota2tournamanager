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
            // Fetch teams from your webapp (public, no session required)
            const response = await global.fetch(`${process.env.WEBAPP_URL}/.netlify/functions/teams?sessionId=${tournamentId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const teams = await response.json();

            if (Array.isArray(teams) && teams.length > 0) {
                const embed = {
                    color: 0x0099ff,
                    title: '🏆 Tournament Teams',
                    description: `Teams for tournament \`${tournamentId}\``,
                    fields: teams.map((team, index) => ({
                        name: `${team.name}`,
                        value: `👥 Players: ${team.players.length}\n📊 Total MMR: ${team.totalMmr}\n📈 Avg MMR: ${Math.round(team.totalMmr / team.players.length)}`,
                        inline: true
                    })),
                    footer: {
                        text: `Total Teams: ${teams.length}`
                    }
                };

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ No teams found for this tournament yet.', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            await interaction.reply({ content: '❌ Failed to fetch teams. Please try again later.', flags: MessageFlags.Ephemeral });
        }
    },
}; 