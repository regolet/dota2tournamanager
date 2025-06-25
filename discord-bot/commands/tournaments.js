const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    name: 'tournaments',
    description: 'List available tournaments',
    async execute(interaction) {
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('[tournaments] Failed to defer reply:', error);
            return;
        }

        try {
            // Fetch tournaments from your webapp with timeout
            console.log('[tournaments] Fetching tournaments from API:', `${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log('[tournaments] API response status:', response.status);
            
            let data = {};
            try {
                data = await response.json();
                console.log('[tournaments] API response data:', data);
            } catch (jsonErr) {
                console.error('[tournaments] Error parsing API response JSON:', jsonErr);
                if (interaction.deferred) {
                    await interaction.editReply('❌ Error processing tournament data. Please try again later.');
                }
                return;
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

                if (interaction.deferred) {
                    await interaction.editReply({ embeds: [embed], components: rows });
                    // Announce in registration channel if triggered by admin
                    const adminIds = [process.env.ADMIN_DISCORD_ID, 'user_admin_001', '1387059600930639992']; // Add your admin Discord IDs here
                    if (adminIds.includes(interaction.user.id)) {
                        const regChannel = interaction.client.channels.cache.get('1387298687214161940');
                        if (regChannel) {
                            await regChannel.send({ embeds: [embed], components: rows });
                        } else {
                            console.error('Registration channel not found!');
                        }
                    }
                }
            } else {
                console.warn('[tournaments] No active tournaments found or API returned error:', data);
                if (interaction.deferred) {
                    await interaction.editReply('❌ No active tournaments found at the moment.');
                }
            }
        } catch (error) {
            console.error('[tournaments] Error fetching tournaments:', error);
            
            if (error.name === 'AbortError') {
                console.error('[tournaments] Request timed out');
                if (interaction.deferred) {
                    await interaction.editReply('❌ Request timed out. Please try again later.');
                }
            } else {
                if (interaction.deferred) {
                    await interaction.editReply('❌ Failed to fetch tournaments. Please try again later.');
                }
            }
        }
    },
}; 