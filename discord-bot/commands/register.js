const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'register',
    description: 'Register for a tournament',
    options: [
        {
            name: 'tournament',
            type: 3, // STRING
            description: 'Tournament ID to register for',
            required: true
        },
        {
            name: 'dota2id',
            type: 3, // STRING
            description: 'Your Dota 2 ID',
            required: true
        },
        {
            name: 'mmr',
            type: 4, // INTEGER
            description: 'Your peak MMR',
            required: true
        }
    ],
    async execute(interaction) {
        const tournamentId = interaction.options.getString('tournament');
        const dota2id = interaction.options.getString('dota2id');
        const mmr = interaction.options.getInteger('mmr');
        const discordId = interaction.user.id;
        const playerName = interaction.user.username;

        try {
            // Register player through the correct add-player API endpoint
            const response = await global.fetch(`${process.env.WEBAPP_URL}/.netlify/functions/add-player`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: playerName,
                    dota2id: dota2id,
                    peakmmr: mmr,
                    registrationSessionId: tournamentId
                })
            });

            const data = await response.json();
            // Debug: log the full response and data
            console.log('Register API response status:', response.status);
            console.log('Register API response data:', data);

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

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: `❌ Registration failed: ${data.message || 'Unknown error'}`, flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error('Error registering player:', error);
            await interaction.reply({ content: '❌ Failed to register. Please try again later.', flags: MessageFlags.Ephemeral });
        }
    },
}; 