const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    name: 'bracket_update',
    description: 'Update the current tournament bracket (admin/creator only)',
    data: new SlashCommandBuilder()
        .setName('bracket_update')
        .setDescription('Update the current tournament bracket (admin/creator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Only allow admins/creators
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Only admins can use this command.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Fetch all tournaments from the webapp with session header
        const apiUrl = `${process.env.WEBAPP_URL}/.netlify/functions/tournaments`;
        let tournaments;
        try {
            const response = await fetch(apiUrl, {
                headers: {
                    'x-session-id': process.env.WEBAPP_SESSION_ID || ''
                }
            });
            console.log('Tournaments API response status:', response.status);
            console.log('Tournaments API response headers:', response.headers);
            
            const tournaments = await response.json();
            console.log('Raw tournaments API response:', JSON.stringify(tournaments, null, 2));
            console.log('Tournaments type:', typeof tournaments);
            console.log('Is array?', Array.isArray(tournaments));
            
            // Handle both array and object responses
            let tournamentList = tournaments;
            if (tournaments && typeof tournaments === 'object' && !Array.isArray(tournaments)) {
                // If it's an object, check if it has a tournaments property
                tournamentList = tournaments.tournaments || tournaments.data || [];
                console.log('Extracted tournamentList from object:', tournamentList);
            }
            
            if (!Array.isArray(tournamentList) || tournamentList.length === 0) {
                console.log('No valid tournaments found. tournamentList:', tournamentList);
                await interaction.reply({ content: '❌ No tournaments found in the webapp.', ephemeral: true });
                return;
            }

            const options = tournaments.map(t => ({
                label: t.name || `Tournament (${t.id})`,
                value: t.id,
                description: `Created: ${new Date(t.created_at || t.createdAt).toLocaleString()}`
            })).slice(0, 25); // Discord max 25 options
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('bracket_update_tournament_select')
                .setPlaceholder('Select a tournament to update')
                .addOptions(options);
            
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.editReply({
                content: 'Please select a tournament to update:',
                components: [row]
            });
        } catch (err) {
            console.error('Error executing command bracket_update:', err);
            try {
                await interaction.reply({ content: '❌ Failed to fetch tournaments from the webapp.', ephemeral: true });
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
            return;
        }
    }
};