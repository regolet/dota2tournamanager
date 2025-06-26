const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
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