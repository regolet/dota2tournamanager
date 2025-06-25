const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
        // Check if interaction is still valid before replying
        if (interaction.isRepliable()) {
            try {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
        }
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
    if (interaction.isButton()) {
        // Register tournament button
        if (interaction.customId.startsWith('register_tournament_')) {
            const sessionId = interaction.customId.replace('register_tournament_', '');
            // Show modal for Dota2 ID and MMR
            const modal = new ModalBuilder()
                .setCustomId(`modal_register_${sessionId}`)
                .setTitle('Tournament Registration')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('dota2id')
                            .setLabel('Dota 2 ID')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Your Dota 2 Friend ID')
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('mmr')
                            .setLabel('Peak MMR')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Your highest MMR')
                            .setRequired(true)
                    )
                );
            try {
                await interaction.showModal(modal);
            } catch (error) {
                console.error('Error showing modal:', error);
            }
            return;
        }
        // Teams tournament button
        if (interaction.customId.startsWith('teams_tournament_')) {
            const sessionId = interaction.customId.replace('teams_tournament_', '');
            try {
                await interaction.reply({ content: `You selected to view teams for tournament with sessionId: ${sessionId}`, ephemeral: true });
            } catch (error) {
                console.error('Error replying to teams button:', error);
            }
            // Team display logic can be added here
            return;
        }
    }
    
    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        // Attendance tournament selection
        if (interaction.customId === 'attendance_tournament_select') {
            const sessionId = interaction.values[0];
            
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Fetch registered players for this session
                const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${sessionId}`);
                const data = await response.json();
                
                if (!data.success) {
                    await interaction.editReply('❌ Failed to fetch tournament players. Please try again.');
                    return;
                }
                
                const players = data.players || [];
                
                if (players.length === 0) {
                    await interaction.editReply('❌ No players registered for this tournament yet.');
                    return;
                }
                
                // Post attendance message in the channel
                const attendanceEmbed = {
                    color: 0x00ff00,
                    title: '📋 Tournament Attendance',
                    description: `**Tournament:** ${sessionId}\n**Registered Players:** ${players.length}\n\nReact with ✅ to mark yourself as **PRESENT** for the tournament.\n\nOnly registered players can mark attendance.`,
                    fields: [
                        {
                            name: '📝 Instructions',
                            value: 'Click the ✅ reaction below to confirm your attendance. This will mark you as present for the tournament.',
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Attendance will be closed by an admin'
                    },
                    timestamp: new Date().toISOString()
                };
                
                const attendanceMessage = await interaction.channel.send({
                    embeds: [attendanceEmbed]
                });
                
                // Add reaction button
                await attendanceMessage.react('✅');
                
                // Store attendance message info for later use
                // TODO: Store in database or cache for tracking
                
                await interaction.editReply(`✅ Attendance message posted! [View Message](${attendanceMessage.url})`);
                
            } catch (error) {
                console.error('[attendance] Error posting attendance message:', error);
                await interaction.editReply('❌ Failed to post attendance message. Please try again.');
            }
            return;
        }
        
        // Close attendance tournament selection
        if (interaction.customId === 'closeattendance_tournament_select') {
            const sessionId = interaction.values[0];
            
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Fetch registered players for this session
                const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${sessionId}`);
                const data = await response.json();
                
                if (!data.success) {
                    await interaction.editReply('❌ Failed to fetch tournament players. Please try again.');
                    return;
                }
                
                const players = data.players || [];
                
                if (players.length === 0) {
                    await interaction.editReply('❌ No players registered for this tournament.');
                    return;
                }
                
                // Mark all non-present players as absent
                let presentCount = 0;
                let absentCount = 0;
                const absentPlayers = [];
                
                for (const player of players) {
                    if (!player.present) {
                        // Mark as absent
                        const updateResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/update-player`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                playerId: player.id,
                                updates: {
                                    present: false
                                }
                            })
                        });
                        
                        if (updateResponse.ok) {
                            absentCount++;
                            absentPlayers.push(player.name);
                        }
                    } else {
                        presentCount++;
                    }
                }
                
                // Post attendance summary in the channel
                const summaryEmbed = {
                    color: 0xff9900,
                    title: '🏁 Tournament Attendance Closed',
                    description: `**Tournament:** ${sessionId}\n**Attendance Period:** Closed`,
                    fields: [
                        {
                            name: '📊 Attendance Summary',
                            value: `✅ **Present:** ${presentCount} players\n❌ **Absent:** ${absentCount} players\n📋 **Total Registered:** ${players.length} players`,
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Attendance closed by admin'
                    },
                    timestamp: new Date().toISOString()
                };
                
                // Add absent players list if any
                if (absentPlayers.length > 0) {
                    const absentList = absentPlayers.slice(0, 10).join(', '); // Show first 10
                    const moreText = absentPlayers.length > 10 ? ` and ${absentPlayers.length - 10} more` : '';
                    summaryEmbed.fields.push({
                        name: '❌ Absent Players',
                        value: `${absentList}${moreText}`,
                        inline: false
                    });
                }
                
                const summaryMessage = await interaction.channel.send({
                    embeds: [summaryEmbed]
                });
                
                await interaction.editReply(`✅ Attendance closed! **${presentCount}** present, **${absentCount}** absent. [View Summary](${summaryMessage.url})`);
                
            } catch (error) {
                console.error('[closeattendance] Error closing attendance:', error);
                await interaction.editReply('❌ Failed to close attendance. Please try again.');
            }
            return;
        }
    }
    
    // Handle modal submission for registration
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_register_')) {
        const sessionId = interaction.customId.replace('modal_register_', '');
        const playerName = interaction.user.username;
        const discordId = interaction.user.id;
        const dota2id = interaction.fields.getTextInputValue('dota2id');
        const mmr = interaction.fields.getTextInputValue('mmr');
        
        try {
            await interaction.deferReply({ ephemeral: true }); // Respond immediately
            
            // Register player through the add-player API endpoint
            const response = await global.fetch(`${process.env.WEBAPP_URL}/.netlify/functions/add-player`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: playerName,
                    dota2id: dota2id,
                    peakmmr: mmr,
                    registrationSessionId: sessionId,
                    discordId: discordId
                })
            });

            const data = await response.json();
            console.log('Modal registration API response status:', response.status);
            console.log('Modal registration API response data:', data);

            if (response.ok && data.success) {
                await interaction.editReply({
                    content: `✅ Registration successful! You have been registered for the tournament.\n\n**Player Info:**\n• Name: ${playerName}\n• Dota 2 ID: ${dota2id}\n• MMR: ${mmr}\n• Tournament: ${sessionId}`,
                    ephemeral: true
                });
            } else {
                // Handle API errors (400, 500, etc.) - these are expected for validation/duplicate errors
                const errorMessage = data.message || 'Unknown error occurred';
                await interaction.editReply({
                    content: `❌ Registration failed: ${errorMessage}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error registering player via modal:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ Failed to register. Please try again later.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Failed to register. Please try again later.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Error sending error reply:', replyError);
            }
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Handle reaction events for attendance tracking
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;
    
    // Check if this is an attendance message (has attendance embed)
    if (reaction.message.embeds.length > 0) {
        const embed = reaction.message.embeds[0];
        if (embed.title === '📋 Tournament Attendance' && reaction.emoji.name === '✅') {
            try {
                // Extract session ID from the embed description
                const description = embed.description;
                const sessionMatch = description.match(/\*\*Tournament:\*\* ([^\n]+)/);
                
                if (!sessionMatch) {
                    console.error('[attendance] Could not extract session ID from attendance message');
                    return;
                }
                
                const sessionId = sessionMatch[1].trim();
                const discordId = user.id;
                
                console.log(`[attendance] User ${user.username} (${discordId}) reacted to attendance for session ${sessionId}`);
                
                // Check if user is registered for this tournament
                const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${sessionId}`);
                const data = await response.json();
                
                if (!data.success) {
                    console.error('[attendance] Failed to fetch players for attendance check');
                    return;
                }
                
                const players = data.players || [];
                const registeredPlayer = players.find(player => player.discordid === discordId);
                
                if (!registeredPlayer) {
                    // Remove reaction if user is not registered
                    await reaction.users.remove(user.id);
                    console.log(`[attendance] Removed reaction from unregistered user ${user.username}`);
                    
                    // Send ephemeral message to user
                    try {
                        await user.send('❌ You are not registered for this tournament. Only registered players can mark attendance.');
                    } catch (dmError) {
                        console.error('[attendance] Failed to send DM to user:', dmError);
                    }
                    return;
                }
                
                // Update player's present status in database
                const updateResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/update-player`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        playerId: registeredPlayer.id,
                        updates: {
                            present: true
                        }
                    })
                });
                
                if (updateResponse.ok) {
                    console.log(`[attendance] Marked ${user.username} as present for session ${sessionId}`);
                    
                    // Send confirmation to user
                    try {
                        await user.send(`✅ Attendance confirmed! You are marked as present for the tournament.`);
                    } catch (dmError) {
                        console.error('[attendance] Failed to send confirmation DM:', dmError);
                    }
                } else {
                    console.error('[attendance] Failed to update player attendance status');
                }
                
            } catch (error) {
                console.error('[attendance] Error handling attendance reaction:', error);
            }
        }
    }
});

// Handle reaction removal (mark as absent)
client.on('messageReactionRemove', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;
    
    // Check if this is an attendance message
    if (reaction.message.embeds.length > 0) {
        const embed = reaction.message.embeds[0];
        if (embed.title === '📋 Tournament Attendance' && reaction.emoji.name === '✅') {
            try {
                // Extract session ID from the embed description
                const description = embed.description;
                const sessionMatch = description.match(/\*\*Tournament:\*\* ([^\n]+)/);
                
                if (!sessionMatch) {
                    console.error('[attendance] Could not extract session ID from attendance message');
                    return;
                }
                
                const sessionId = sessionMatch[1].trim();
                const discordId = user.id;
                
                console.log(`[attendance] User ${user.username} (${discordId}) removed attendance reaction for session ${sessionId}`);
                
                // Find the player and mark as absent
                const response = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${sessionId}`);
                const data = await response.json();
                
                if (data.success) {
                    const players = data.players || [];
                    const registeredPlayer = players.find(player => player.discordid === discordId);
                    
                    if (registeredPlayer) {
                        // Update player's present status to false
                        const updateResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/update-player`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                playerId: registeredPlayer.id,
                                updates: {
                                    present: false
                                }
                            })
                        });
                        
                        if (updateResponse.ok) {
                            console.log(`[attendance] Marked ${user.username} as absent for session ${sessionId}`);
                        }
                    }
                }
                
            } catch (error) {
                console.error('[attendance] Error handling attendance reaction removal:', error);
            }
        }
    }
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 