const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
    },
    name: 'remove_teamchannel',
    description: 'Remove all team voice channels (Team 1, Team 2, etc.)',
    data: new SlashCommandBuilder()
        .setName('remove_teamchannel')
        .setDescription('Remove all team voice channels (Team 1, Team 2, etc.)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            return;
        }
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: '❌ Guild not found.', ephemeral: true });
            return;
        }
        let deleted = 0;
        let failed = 0;
        let details = [];
        const teamChannels = guild.channels.cache.filter(
            ch => ch.type === 2 && /^Team \d+$/.test(ch.name)
        );
        for (const [id, channel] of teamChannels) {
            try {
                await channel.delete('Bulk team channel cleanup');
                details.push(`✅ Deleted ${channel.name}`);
                deleted++;
            } catch (err) {
                details.push(`❌ Failed to delete ${channel.name}: ${err.message}`);
                failed++;
            }
        }
        await interaction.reply({
            embeds: [{
                color: deleted > 0 ? 0x00ff00 : 0xff9900,
                title: 'Team Channel Cleanup',
                description: `**Deleted:** ${deleted}\n**Failed:** ${failed}`,
                fields: [
                    { name: 'Details', value: details.length ? details.join('\n') : 'No team voice channels found.' }
                ],
                timestamp: new Date().toISOString()
            }],
            ephemeral: true
        });
    }
}; 