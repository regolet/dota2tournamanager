const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collection to store commands
client.commands = new Collection();

// Load commands from commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        console.log(`✅ Loaded command: ${command.name}`);
    } else {
        console.log(`⚠️ The command at ${filePath} is missing a required "name" or "execute" property.`);
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    console.log(`👥 Serving ${client.users.cache.size} users`);
    console.log(`⚡ Loaded ${client.commands.size} commands`);
});

// Message interaction handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true
        });
    }
});

// Basic message handler for testing
client.on('messageCreate', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Simple ping command
    if (message.content.toLowerCase() === '!ping') {
        await message.reply('🏓 Pong! Bot is online and working!');
    }

    // Help command
    if (message.content.toLowerCase() === '!help') {
        const helpEmbed = {
            color: 0x0099ff,
            title: '🏆 Tournament Bot Commands',
            description: 'Here are the available commands:',
            fields: [
                {
                    name: 'Basic Commands',
                    value: '`!ping` - Check if bot is online\n`!help` - Show this help message',
                    inline: false
                },
                {
                    name: 'Slash Commands',
                    value: '`/ping` - Check bot latency\n`/tournaments` - List available tournaments\n`/register` - Register for a tournament\n`/teams` - View team information\n`/status` - Check your registration status',
                    inline: false
                }
            ],
            footer: {
                text: 'Tournament Management Bot'
            }
        };
        
        await message.reply({ embeds: [helpEmbed] });
    }

    // Register button
    if (message.content.toLowerCase() === '!register') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('register_button')
                .setLabel('Register')
                .setStyle(ButtonStyle.Primary)
        );
        await message.reply({ content: 'Click the button below to register for the tournament!', components: [row] });
    }

    // View Teams button
    if (message.content.toLowerCase() === '!teams') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('view_teams_button')
                .setLabel('View Teams')
                .setStyle(ButtonStyle.Success)
        );
        await message.reply({ content: 'Click the button below to view teams!', components: [row] });
    }
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'register_button') {
        // Here you would call your registration logic or API
        await interaction.reply({ content: 'You are now registered for the tournament! (Button action)', ephemeral: true });
    }
    if (interaction.customId === 'view_teams_button') {
        // Here you would call your view teams logic or API
        await interaction.reply({ content: 'Here are the teams! (Button action)', ephemeral: true });
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 