const fetch = require('node-fetch');

module.exports = {
    name: 'teams',
    description: 'View team information for a tournament',
    async execute(interaction) {
        await interaction.deferReply();

        const tournamentId = interaction.options.getString('tournament');

        try {
            // Fetch teams from your webapp
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/teams?sessionId=${tournamentId}`, {
                headers: {
                    'x-session-id': process.env.WEBAPP_SESSION_ID
                }
            });

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

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply('❌ No teams found for this tournament yet.');
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            await interaction.editReply('❌ Failed to fetch teams. Please try again later.');
        }
    },
}; 