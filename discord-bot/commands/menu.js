const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Show the admin control panel with quick action buttons'),
  name: 'menu',
  description: 'Show the admin control panel with quick action buttons',
  async execute(interaction) {
    // Only allow admins
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
      return;
    }
    // Build the admin menu buttons
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('menu_generate_teams')
        .setLabel('Generate Teams')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛠️'),
      new ButtonBuilder()
        .setCustomId('menu_attendance')
        .setLabel('Attendance')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('menu_bracket_update')
        .setLabel('Bracket Update')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏆'),
      new ButtonBuilder()
        .setCustomId('menu_register_tournament')
        .setLabel('Register Tournament')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('menu_close_attendance')
        .setLabel('Close Attendance')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('menu_remove_teamchannel')
        .setLabel('Remove Team Channels')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('menu_login')
        .setLabel('Login')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔑'),
      new ButtonBuilder()
        .setCustomId('menu_logout')
        .setLabel('Logout')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🚪')
    );
    await interaction.reply({
      content: '### 🛡️ **Admin Control Panel**\nClick a button below to perform an action:',
      components: [row1, row2],
      flags: 64
    });
  }
}; 