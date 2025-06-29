const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { getGuildSessionId } = require('../sessionUtil');

module.exports = {
  name: 'closeattendance',
  description: 'Close attendance for a tournament session',
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error('[closeattendance] Failed to defer reply:', error);
      return;
    }

    try {
      // Fetch tournaments from your webapp
      console.log('[closeattendance] Fetching tournaments from API:', `${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`, {
        signal: controller.signal,
        headers: {
          'x-session-id': getGuildSessionId(interaction.guildId)
        }
      });
      
      clearTimeout(timeoutId);
      console.log('[closeattendance] API response status:', response.status);
      
      let data = {};
      try {
        data = await response.json();
        console.log('[closeattendance] API response data:', data);
      } catch (jsonErr) {
        console.error('[closeattendance] Error parsing API response JSON:', jsonErr);
        await interaction.editReply('❌ Error processing tournament data. Please try again later.');
        return;
      }

      if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
        const activeSessions = data.sessions.filter(session => session.isActive);
        
        if (activeSessions.length === 0) {
          await interaction.editReply('❌ No active tournaments found at the moment.');
          return;
        }

        // Create select menu with tournament options
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('closeattendance_tournament_select')
          .setPlaceholder('Select a tournament to close attendance')
          .addOptions(
            activeSessions.map(session => ({
              label: session.title,
              description: `${session.playerCount} players registered`,
              value: session.sessionId
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
          content: '🏁 **Close Tournament Attendance**\nSelect a tournament to close attendance and mark absent players:',
          components: [row]
        });
      } else {
        console.warn('[closeattendance] No active tournaments found or API returned error:', data);
        await interaction.editReply('❌ No active tournaments found at the moment.');
      }
    } catch (error) {
      console.error('[closeattendance] Error fetching tournaments:', error);
      
      if (error.name === 'AbortError') {
        console.error('[closeattendance] Request timed out');
        await interaction.editReply('❌ Request timed out. Please try again later.');
      } else {
        await interaction.editReply('❌ Failed to fetch tournaments. Please try again later.');
      }
    }
  },
}; 