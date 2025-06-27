const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CHANNELS = [
  { name: 'commands', private: true },
  { name: 'tournament-registration' },
  { name: 'tournament-attendance' },
  { name: 'tournament-teams' },
  { name: 'tournament-bracket' }
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
    const config = loadConfig();
    const channelIds = {};
    let summary = '';

    for (const ch of CHANNELS) {
      let channel = guild.channels.cache.find(c => c.name === ch.name && c.type === 0); // 0 = GUILD_TEXT
      if (!channel) {
        const options = { name: ch.name, type: 0 };
        if (ch.private && adminRole) {
          options.permissionOverwrites = [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel] }
          ];
        }
        channel = await guild.channels.create(options);
        summary += `✅ Created #${ch.name}\n`;
      } else {
        summary += `ℹ️ Found #${ch.name}\n`;
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