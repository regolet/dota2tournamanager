const fetch = require('node-fetch');

module.exports = {
    name: 'register',
    description: 'Register for a tournament',
    async execute(interaction) {
        await interaction.deferReply();

        const tournamentId = interaction.options.getString('tournament');
        const dota2id = interaction.options.getString('dota2id');
        const mmr = interaction.options.getInteger('mmr');
        const discordId = interaction.user.id;
        const playerName = interaction.user.username;

        try {
            // Register player through your webapp API
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': process.env.WEBAPP_SESSION_ID
                },
                body: JSON.stringify({
                    sessionId: tournamentId,
                    player: {
                        name: playerName,
                        dota2id: dota2id,
                        peakmmr: mmr,
                        discordId: discordId
                    }
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const embed = {
                    color: 0x00ff00,
                    title: '✅ Registration Successful!',
                    description: `You have been registered for the tournament.`,
                    fields: [
                        {
                            name: 'Player Info',
                            value: `**Name:** ${playerName}\n**Dota 2 ID:** ${dota2id}\n**MMR:** ${mmr}`,
                            inline: true
                        },
                        {
                            name: 'Tournament ID',
                            value: `\`${tournamentId}\``,
                            inline: true
                        }
                    ],
                    footer: {
                        text: 'You will be notified when teams are formed!'
                    }
                };

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply(`❌ Registration failed: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error registering player:', error);
            await interaction.editReply('❌ Failed to register. Please try again later.');
        }
    },
}; 