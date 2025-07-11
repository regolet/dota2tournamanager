const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, InteractionResponseType } = require('discord.js');
const fetch = require('node-fetch');
const teamBalancer = require('../teamBalancer');
const { getGuildSessionId, requireValidSession } = require('../sessionUtil');

const BALANCE_TYPES = [
  { value: 'highRanked', label: 'High Ranked Balance' },
  { value: 'perfectMmr', label: 'Perfect MMR Balance' },
  { value: 'highLowShuffle', label: 'High/Low Shuffle' },
  { value: 'random', label: 'Random Teams' }
];

// Generate options for number of teams (2-20)
const TEAM_COUNT_OPTIONS = Array.from({ length: 19 }, (_, i) => ({
  value: String(i + 2),
  label: `${i + 2} Teams`
}));

module.exports = {
  name: 'generate_teams',
  description: 'Generate balanced teams for a tournament (present players only).',
  data: new SlashCommandBuilder()
    .setName('generate_teams')
    .setDescription('Generate balanced teams for a tournament (present players only).'),
  async execute(interaction) {
    try {
      // Validate session first
      if (!(await requireValidSession(interaction))) {
        return;
      }

      // Defer reply only if not already deferred or replied
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag
      }
      
      // Fetch tournaments
      const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`, {
        headers: {
          'x-session-id': getGuildSessionId(interaction.guildId)
        }
      });

      if (!response.ok) {
        await interaction.editReply('❌ Failed to fetch tournaments. Please try again.');
        return;
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.sessions) || data.sessions.length === 0) {
        await interaction.editReply('❌ No tournaments found.');
        return;
      }

      const activeSessions = data.sessions.filter(s => s.isActive);
      if (activeSessions.length === 0) {
        await interaction.editReply('❌ No active tournaments found.');
        return;
      }

      // Tournament dropdown
      const tournamentMenu = new StringSelectMenuBuilder()
        .setCustomId('generate_teams_tournament')
        .setPlaceholder('Select a tournament')
        .addOptions(activeSessions.map(session => ({
          label: session.title,
          value: session.sessionId
        })));

      // Balance type dropdown
      const balanceMenu = new StringSelectMenuBuilder()
        .setCustomId('generate_teams_balance')
        .setPlaceholder('Select balance type')
        .addOptions(BALANCE_TYPES.map(type => ({
          label: type.label,
          value: type.value
        })));

      // Number of teams dropdown
      const teamCountMenu = new StringSelectMenuBuilder()
        .setCustomId('generate_teams_teamcount')
        .setPlaceholder('Select number of teams')
        .addOptions(TEAM_COUNT_OPTIONS);

      const row1 = new ActionRowBuilder().addComponents(tournamentMenu);
      const row2 = new ActionRowBuilder().addComponents(balanceMenu);
      const row3 = new ActionRowBuilder().addComponents(teamCountMenu);

      await interaction.editReply({
        content: 'Select a tournament, balance type, and number of teams to generate teams:',
        components: [row1, row2, row3]
      });

    } catch (error) {
      console.error('Error in generate_teams command:', error);
      
      // Check if interaction is still valid and can be replied to
      if (interaction.deferred && !interaction.replied) {
        try {
          await interaction.editReply('❌ An error occurred while loading tournaments. Please try again.');
        } catch (replyError) {
          console.error('Failed to send error reply via editReply:', replyError);
        }
      } else if (!interaction.deferred && !interaction.replied) {
        try {
          await interaction.reply({ 
            content: '❌ An error occurred while loading tournaments. Please try again.',
            flags: 64 // ephemeral flag
          });
        } catch (replyError) {
          console.error('Failed to send error reply via reply:', replyError);
        }
      }
    }
  }
}; 