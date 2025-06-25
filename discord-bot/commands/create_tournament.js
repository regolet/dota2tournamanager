const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fetch = require('node-fetch');
const teamBalancer = require('../teamBalancer');

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
  name: 'create_tournament',
  description: 'Generate teams and create tournament bracket in one step.',
  data: new SlashCommandBuilder()
    .setName('create_tournament')
    .setDescription('Generate teams and create tournament bracket in one step.'),
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      // Fetch tournaments
      const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
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
        .setCustomId('create_tournament_tournament')
        .setPlaceholder('Select a tournament')
        .addOptions(activeSessions.map(session => ({
          label: session.title,
          value: session.sessionId
        })));

      // Balance type dropdown
      const balanceMenu = new StringSelectMenuBuilder()
        .setCustomId('create_tournament_balance')
        .setPlaceholder('Select balance type')
        .addOptions(BALANCE_TYPES.map(type => ({
          label: type.label,
          value: type.value
        })));

      // Number of teams dropdown
      const teamCountMenu = new StringSelectMenuBuilder()
        .setCustomId('create_tournament_teamcount')
        .setPlaceholder('Select number of teams')
        .addOptions(TEAM_COUNT_OPTIONS);

      const row1 = new ActionRowBuilder().addComponents(tournamentMenu);
      const row2 = new ActionRowBuilder().addComponents(balanceMenu);
      const row3 = new ActionRowBuilder().addComponents(teamCountMenu);

      await interaction.editReply({
        content: 'Select tournament, balance type, and team count to create tournament:',
        components: [row1, row2, row3]
      });

    } catch (error) {
      console.error('Error in create_tournament command:', error);
      try {
        await interaction.editReply('❌ An error occurred while loading tournaments. Please try again.');
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
}; 