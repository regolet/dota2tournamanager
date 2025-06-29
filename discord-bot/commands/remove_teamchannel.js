const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'remove_teamchannel',
  description: 'Remove all team voice channels (Team 1, Team 2, etc.)',
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
      }
      return;
    }
    const guild = interaction.guild;
    if (!guild) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: '❌ Guild not found.', flags: 64 });
      }
      return;
    }
    let deleted = 0;
    let failed = 0;
    let details = [];
    const teamChannels = guild.channels.cache.filter(
      ch => ch.type === 2 && /^Team \d+$/.test(ch.name)
    );
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }
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
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [{
          color: deleted > 0 ? 0x00ff00 : 0xff9900,
          title: 'Team Channel Cleanup',
          description: `**Deleted:** ${deleted}\n**Failed:** ${failed}`,
          fields: [
            { name: 'Details', value: details.length ? details.join('\n') : 'No team voice channels found.' }
          ],
          timestamp: new Date().toISOString()
        }],
        flags: 64
      });
    } else {
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
        flags: 64
      });
    }
  }
}; 