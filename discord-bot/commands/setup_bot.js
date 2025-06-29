const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CHANNELS = [
  { name: 'commands', private: true },
  { name: 'tournament-registration' },
  { name: 'tournament-attendance' },
  { name: 'tournament-teams' },
  { name: 'tournament-bracket' },
  { name: 'tournament-results' }
];

const CONFIG_PATH = path.join(__dirname, '../bot_channels.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  name: 'setup_bot',
  description: 'Setup tournament channels and permissions for this server',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));
    if (!adminRole) {
      await interaction.editReply({ content: '❌ No admin role found with Administrator permissions. Please create one and try again.', ephemeral: true });
      return;
    }
    const config = loadConfig();
    const channelIds = {};
    let summary = '';

    // Create or find the Tournament category
    let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Tournament');
    if (!category) {
      category = await guild.channels.create({ name: 'Tournament', type: ChannelType.GuildCategory });
      summary += '✅ Created Tournament category\n';
    } else {
      summary += 'ℹ️ Found Tournament category\n';
    }

    for (const ch of CHANNELS) {
      let channel = guild.channels.cache.find(c => c.name === ch.name && c.type === ChannelType.GuildText);
      if (!channel) {
        const options = { name: ch.name, type: ChannelType.GuildText, parent: category.id };
        if (ch.private && adminRole) {
          options.permissionOverwrites = [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ];
        } else {
          options.permissionOverwrites = [
            { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ];
        }
        channel = await guild.channels.create(options);
        summary += `✅ Created #${ch.name}\n`;
      } else {
        // Move to category if not already
        if (channel.parentId !== category.id) {
          await channel.setParent(category.id);
        }
        // Update permissions
        if (ch.private && adminRole) {
          await channel.permissionOverwrites.set([
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]);
        } else {
          await channel.permissionOverwrites.set([
            { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]);
        }
        summary += `ℹ️ Found #${ch.name} (updated permissions/category)\n`;
      }
      channelIds[ch.name] = channel.id;
    }

    config[guild.id] = channelIds;
    saveConfig(config);

    await interaction.editReply({
      content: `Setup complete!\n\n${summary}\nChannel IDs saved for this server.`,
      ephemeral: true
    });
  }
}; 