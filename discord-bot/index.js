const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
global.fetch = require('node-fetch');

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

    // Register button for each tournament
    if (message.content.toLowerCase() === '!register') {
        // Fetch tournaments from API
        const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`, {
            headers: {
                'x-session-id': process.env.WEBAPP_SESSION_ID || ''
            }
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
            const row = new ActionRowBuilder();
            data.sessions.filter(s => s.isActive).forEach(session => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`register_tournament_${session.sessionId}`)
                        .setLabel(session.title)
                        .setStyle(ButtonStyle.Primary)
                );
            });
            await message.reply({ content: 'Select a tournament to register:', components: [row] });
        } else {
            await message.reply('No available tournaments to register.');
        }
    }

    // Teams button for each tournament
    if (message.content.toLowerCase() === '!teams') {
        // Fetch tournaments from API
        const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`, {
            headers: {
                'x-session-id': process.env.WEBAPP_SESSION_ID || ''
            }
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0) {
            const row = new ActionRowBuilder();
            data.sessions.filter(s => s.isActive).forEach(session => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`teams_tournament_${session.sessionId}`)
                        .setLabel(session.title)
                        .setStyle(ButtonStyle.Success)
                );
            });
            await message.reply({ content: 'Select a tournament to view teams:', components: [row] });
        } else {
            await message.reply('No available tournaments to view teams.');
        }
    }
});

// Handle tournament button interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    // Register tournament button
    if (interaction.customId.startsWith('register_tournament_')) {
        const sessionId = interaction.customId.replace('register_tournament_', '');
        await interaction.reply({ content: `You selected to register for tournament with sessionId: ${sessionId}`, ephemeral: true });
        // Registration logic can be added here
    }
    // Teams tournament button
    if (interaction.customId.startsWith('teams_tournament_')) {
        const sessionId = interaction.customId.replace('teams_tournament_', '');
        await interaction.reply({ content: `You selected to view teams for tournament with sessionId: ${sessionId}`, ephemeral: true });
        // Team display logic can be added here
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