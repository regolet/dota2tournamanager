const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
global.fetch = require('node-fetch');
const teamBalancer = require('./teamBalancer');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Collection to store commands
client.commands = new Collection();

// Load commands from commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Ensure global.lastAttendanceMessages is initialized
if (!global.lastAttendanceMessages) global.lastAttendanceMessages = {};

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
    console.log(`[interaction] Received interaction type: ${interaction.type}, customId: ${interaction.customId || 'N/A'}`);
    
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
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
        return;
    }
    
    // Handle button interactions
    if (interaction.isButton()) {
        // Register tournament button
        if (interaction.customId.startsWith('register_tournament_')) {
            const sessionId = interaction.customId.replace('register_tournament_', '');
            console.log(`[button] Showing registration modal for session ${sessionId}`);
            
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

        // Save teams and create tournament bracket button
        if (interaction.customId.startsWith('save_teams_')) {
            const userId = interaction.user.id;
            const teamsData = global.generatedTeamsData?.[userId];
            
            if (!teamsData) {
                try {
                    await interaction.reply({ 
                        content: '❌ No teams data found. Please generate teams again.', 
                        ephemeral: true 
                    });
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
                return;
            }

            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Restrict button usage to the creator/admin
                if (teamsData.creatorId && interaction.user.id !== teamsData.creatorId) {
                    await interaction.editReply({
                        content: '❌ Only the admin/creator who generated the teams can proceed to the tournament bracket.',
                        ephemeral: true
                    });
                    return;
                }
                
                // Format teams for saving to database
                const formattedTeams = teamsData.teams.map((team, index) => ({
                    teamNumber: index + 1,
                    name: `Team ${index + 1}`,
                    players: team.map(player => ({
                        id: player.id,
                        name: player.name,
                        dota2id: player.dota2id,
                        peakmmr: player.peakmmr || 0
                    })),
                    averageMmr: Math.round(team.reduce((sum, p) => sum + (p.peakmmr || 0), 0) / (team.length || 1))
                }));

                // Create tournament bracket
                const tournamentData = {
                    id: `tournament_${Date.now()}`,
                    team_set_id: `teamset_${Date.now()}`,
                    name: `${teamsData.sessionTitle || 'Tournament'} - Single Elimination`,
                    description: `Generated from ${teamsData.balance} balance with ${teamsData.teamcount} teams`,
                    format: 'single_elimination',
                    teams: formattedTeams,
                    rounds: [],
                    currentRound: 0,
                    status: 'created',
                    createdAt: new Date().toISOString()
                };

                // Generate single elimination bracket
                const shuffledTeams = [...formattedTeams];
                for (let i = shuffledTeams.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
                }

                const numRounds = Math.ceil(Math.log2(shuffledTeams.length));
                tournamentData.rounds = [];

                // Generate first round matches
                const firstRoundMatches = [];
                for (let i = 0; i < shuffledTeams.length; i += 2) {
                    if (i + 1 < shuffledTeams.length) {
                        firstRoundMatches.push({
                            id: `match_r1_${Math.floor(i/2) + 1}`,
                            round: 1,
                            team1: shuffledTeams[i],
                            team2: shuffledTeams[i + 1],
                            winner: null,
                            status: 'pending'
                        });
                    } else {
                        firstRoundMatches.push({
                            id: `match_r1_${Math.floor(i/2) + 1}`,
                            round: 1,
                            team1: shuffledTeams[i],
                            team2: null,
                            winner: shuffledTeams[i],
                            status: 'bye'
                        });
                    }
                }

                tournamentData.rounds.push({
                    round: 1,
                    name: 'First Round',
                    matches: firstRoundMatches,
                    status: 'ready'
                });

                // Generate subsequent rounds
                for (let round = 2; round <= numRounds; round++) {
                    const roundMatches = [];
                    const numMatches = Math.ceil(Math.pow(2, numRounds - round));
                    
                    for (let i = 0; i < numMatches; i++) {
                        roundMatches.push({
                            id: `match_r${round}_${i + 1}`,
                            round: round,
                            team1: null,
                            team2: null,
                            winner: null,
                            status: 'waiting'
                        });
                    }
                    
                    tournamentData.rounds.push({
                        round: round,
                        name: round === numRounds ? 'Final' : 
                              round === numRounds - 1 ? 'Semi-Final' : 
                              `Round ${round}`,
                        matches: roundMatches,
                        status: 'waiting'
                    });
                }

                // Save teams to database
                const saveResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/save-teams-discord`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: `${teamsData.sessionTitle || 'Tournament'} - ${teamsData.balance} Balance`,
                        teams: formattedTeams,
                        tournament: teamsData.tournament,
                        balance: teamsData.balance,
                        description: `Generated from Discord bot with ${teamsData.teamcount} teams`,
                        tournamentData: tournamentData
                    })
                });

                if (!saveResponse.ok) {
                    const errorData = await saveResponse.text();
                    console.error('Save teams response error:', saveResponse.status, errorData);
                    throw new Error(`Failed to save teams to database: ${saveResponse.status} - ${errorData}`);
                }

                const saveData = await saveResponse.json();
                const teamSetId = saveData.teamSetId;

                // Create bracket visualization embed
                const bracketEmbed = {
                    color: 0x00ff00,
                    title: '🏆 Tournament Bracket Created!',
                    description: `**Tournament:** ${tournamentData.name}\n**Format:** Single Elimination\n**Teams:** ${shuffledTeams.length}\n**Rounds:** ${numRounds}`,
                    fields: [
                        {
                            name: '📋 First Round Matches',
                            value: firstRoundMatches.map(match => {
                                if (match.status === 'bye') {
                                    return `• ${match.team1.name} (Bye)`;
                                }
                                return `• ${match.team1.name} vs ${match.team2.name}`;
                            }).join('\n'),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Tournament bracket saved to database'
                    },
                    timestamp: new Date().toISOString()
                };
                // Send the bracket embed to the bracket channel as a public announcement
                await sendAnnouncement(client, '1387453843394007120', bracketEmbed);
                // Also reply to the user for confirmation
                await interaction.editReply({
                    content: '✅ Teams saved and tournament bracket created! Announcement posted in the bracket channel.',
                    ephemeral: true
                });

                // Clean up stored data
                delete global.generatedTeamsData[userId];

            } catch (error) {
                console.error('Error saving teams and creating tournament:', error);
                try {
                    await interaction.editReply({ 
                        content: `❌ Error: ${error.message}`, 
                        ephemeral: true 
                    });
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            }
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

                // Fetch all tournaments to get the title
                const sessionsResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
                const sessionsData = await sessionsResponse.json();
                let tournamentTitle = sessionId;
                if (sessionsData.success && Array.isArray(sessionsData.sessions)) {
                    const session = sessionsData.sessions.find(s => s.sessionId === sessionId);
                    if (session) tournamentTitle = session.title;
                }

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
                // Post attendance message in the attendance channel as a public announcement
                const attendanceEmbed = {
                    color: 0x00ff00,
                    title: '📋 Tournament Attendance',
                    description: `**Tournament ID:** ${sessionId}\n**Tournament:** ${tournamentTitle}\n**Registered Players:** ${players.length}\n\nReact with ✅ to mark yourself as **PRESENT** for the tournament.\n\nOnly registered players can mark attendance.`,
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
                const attendanceMsg = await sendAnnouncement(client, '1387298566858477648', attendanceEmbed);
                global.lastAttendanceMessages[sessionId] = {
                    channelId: '1387298566858477648',
                    messageId: attendanceMsg ? attendanceMsg.id : null
                };
                // Fetch the channel to get the message URL for confirmation
                const attendanceChannel = await client.channels.fetch('1387298566858477648');
                const messages = await attendanceChannel.messages.fetch({ limit: 1 });
                const attendanceMessage = messages.first();
                if (attendanceMessage) {
                    await attendanceMessage.react('✅');
                    await interaction.editReply(`✅ Attendance message posted! [View Message](${attendanceMessage.url})`);
                } else {
                    await interaction.editReply('✅ Attendance message posted!');
                }
            } catch (error) {
                console.error('[attendance] Error posting attendance message:', error);
                try {
                    await interaction.editReply('❌ Failed to post attendance message. Please try again.');
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            }
            return;
        }
        
        // Close attendance tournament selection
        if (interaction.customId === 'closeattendance_tournament_select') {
            const sessionId = interaction.values[0];
            try {
                await interaction.deferReply({ ephemeral: true });
                // Fetch all tournaments to get the title
                const sessionsResponse = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/registration-sessions`);
                const sessionsData = await sessionsResponse.json();
                let tournamentTitle = sessionId;
                if (sessionsData.success && Array.isArray(sessionsData.sessions)) {
                    const session = sessionsData.sessions.find(s => s.sessionId === sessionId);
                    if (session) tournamentTitle = session.title;
                }
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
                // Post attendance summary in the attendance channel as a public announcement
                const summaryEmbed = {
                    color: 0xff9900,
                    title: '🏁 Tournament Attendance Closed',
                    description: `**Tournament:** ${tournamentTitle}\n**Attendance Period:** Closed`,
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
                if (absentPlayers.length > 0) {
                    const absentList = absentPlayers.slice(0, 10).join(', ');
                    const moreText = absentPlayers.length > 10 ? ` and ${absentPlayers.length - 10} more` : '';
                    summaryEmbed.fields.push({
                        name: '❌ Absent Players',
                        value: `${absentList}${moreText}`,
                        inline: false
                    });
                }
                await sendAnnouncement(client, '1387298566858477648', summaryEmbed);
                // Fetch the channel to get the message URL for confirmation
                const attendanceChannel = await client.channels.fetch('1387298566858477648');
                const messages = await attendanceChannel.messages.fetch({ limit: 1 });
                const summaryMessage = messages.first();
                if (summaryMessage) {
                    await interaction.editReply(`✅ Attendance closed! **${presentCount}** present, **${absentCount}** absent. [View Summary](${summaryMessage.url})`);
                } else {
                    await interaction.editReply(`✅ Attendance closed! **${presentCount}** present, **${absentCount}** absent.`);
                }

                // When closing attendance, before posting summary:
                const lastMsg = global.lastAttendanceMessages[sessionId];
                if (lastMsg && lastMsg.channelId && lastMsg.messageId) {
                    try {
                        const channel = await client.channels.fetch(lastMsg.channelId);
                        const message = await channel.messages.fetch(lastMsg.messageId);
                        if (message) await message.delete();
                        delete global.lastAttendanceMessages[sessionId];
                    } catch (err) {
                        console.error('Failed to delete previous attendance message:', err);
                    }
                }
            } catch (error) {
                console.error('[closeattendance] Error closing attendance:', error);
                await interaction.editReply('❌ Failed to close attendance. Please try again.');
            }
            return;
        }
        
        // Generate Teams: Tournament, Balance, Team Count selection
        if (
            interaction.customId === 'generate_teams_tournament' ||
            interaction.customId === 'generate_teams_balance' ||
            interaction.customId === 'generate_teams_teamcount'
        ) {
            try {
                // Store selections in a temporary map (in-memory, per process)
                if (!global.generateTeamsSelections) global.generateTeamsSelections = {};
                const userId = interaction.user.id;
                if (!global.generateTeamsSelections[userId]) global.generateTeamsSelections[userId] = {};
                // Save the selection
                if (interaction.customId === 'generate_teams_tournament') {
                    global.generateTeamsSelections[userId].tournament = interaction.values[0];
                }
                if (interaction.customId === 'generate_teams_balance') {
                    global.generateTeamsSelections[userId].balance = interaction.values[0];
                }
                if (interaction.customId === 'generate_teams_teamcount') {
                    global.generateTeamsSelections[userId].teamcount = parseInt(interaction.values[0], 10);
                }
                // If all three are selected, proceed
                const selection = global.generateTeamsSelections[userId];
                if (selection.tournament && selection.balance && selection.teamcount) {
                    await interaction.deferReply({ ephemeral: true });
                    // Fetch present players for the selected tournament
                    const playersRes = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${selection.tournament}`);
                    const playersData = await playersRes.json();
                    if (!playersData.success) {
                        await interaction.editReply('❌ Failed to fetch players.');
                        return;
                    }
                    const presentPlayers = (playersData.players || []).filter(p => p.present);
                    if (presentPlayers.length < 2) {
                        await interaction.editReply('❌ Not enough present players to form teams.');
                        delete global.generateTeamsSelections[userId];
                        return;
                    }
                    // Force 5 players per team
                    const teamSize = 5;
                    const numTeams = selection.teamcount;
                    const maxTeams = Math.floor(presentPlayers.length / teamSize);
                    if (numTeams > maxTeams) {
                        await interaction.editReply(`❌ Not enough players for ${numTeams} teams of 5. You can form up to ${maxTeams} teams with the current number of present players.`);
                        delete global.generateTeamsSelections[userId];
                        return;
                    }
                    // Run the selected balance logic
                    let result;
                    switch (selection.balance) {
                        case 'highRanked':
                            result = teamBalancer.highRanked(presentPlayers, numTeams, teamSize); break;
                        case 'perfectMmr':
                            result = teamBalancer.perfectMmr(presentPlayers, numTeams, teamSize); break;
                        case 'highLowShuffle':
                            result = teamBalancer.highLowShuffle(presentPlayers, numTeams, teamSize); break;
                        case 'random':
                            result = teamBalancer.random(presentPlayers, numTeams, teamSize); break;
                        default:
                            await interaction.editReply('❌ Invalid balance type.');
                            delete global.generateTeamsSelections[userId];
                            return;
                    }
                    // Arrange teams in 2 columns (3 if more than 8 teams)
                    const numCols = numTeams > 8 ? 3 : 2;
                    const teamsPerCol = Math.ceil(numTeams / numCols);
                    // Build each team block as plain text
                    let teamBlock;
                    if (numTeams === 2) {
                        // Special formatting for 2 teams: vertical listing
                        teamBlock = result.teams.map((team, i) => {
                            const avgMmr = Math.round(team.reduce((sum, p) => sum + (p.peakmmr || 0), 0) / (team.length || 1));
                            const header = `Team ${i + 1} (Avg MMR: ${avgMmr})`;
                            const players = team.map(p => `${p.name} (${p.peakmmr || 0})`).join('\n');
                            return `${header}\n${players}`;
                        }).join('\n\n');
                    } else {
                        const teamBlocks = result.teams.map((team, i) => {
                            const avgMmr = Math.round(team.reduce((sum, p) => sum + (p.peakmmr || 0), 0) / (team.length || 1));
                            const header = `Team ${i + 1} (Avg MMR: ${avgMmr})`;
                            const players = team.map(p => `${p.name} (${p.peakmmr || 0})`).join('\n');
                            return [header, players];
                        });
                        // Find max width for each block for alignment
                        const colBlocks = Array.from({ length: numCols }, (_, c) => teamBlocks.slice(c * teamsPerCol, (c + 1) * teamsPerCol));
                        const colWidths = colBlocks.map(col => Math.max(...col.map(block => Math.max(...block.map(line => line.length)))));
                        // Pad each block for alignment
                        for (let c = 0; c < numCols; c++) {
                            for (let t = 0; t < colBlocks[c].length; t++) {
                                colBlocks[c][t] = colBlocks[c][t].map(line => line.padEnd(colWidths[c], ' '));
                            }
                        }
                        // Build the final lines row by row
                        const lines = [];
                        for (let row = 0; row < teamsPerCol; row++) {
                            // Header line (no padding)
                            const headerLine = colBlocks.map(col => col[row]?.[0] || '').join('  ');
                            lines.push(headerLine);
                            // Player lines (max 5 per team, no padding)
                            for (let p = 0; p < 5; p++) {
                                const playerLine = colBlocks.map(col => (col[row]?.[1]?.split('\n')[p] || '')).join('  ');
                                lines.push(playerLine);
                            }
                            // Blank line between rows
                            if (row < teamsPerCol - 1) lines.push('');
                        }
                        teamBlock = lines.join('\n');
                    }
                    const reservesText = result.reserves.length > 0 ? `Reserve players: ${result.reserves.map(p => p.name).join(', ')}` : 'No reserves';
                    const fullTeamText = `${teamBlock}\n\n${reservesText}`;
                    let embed, files = [];
                    if (fullTeamText.length > 4000) {
                        // Too long for embed, send as file
                        embed = {
                            color: 0x0099ff,
                            title: `Balanced Teams (${numTeams} teams, ${teamSize} per team)` + (playersData.sessionTitle ? ` - ${playersData.sessionTitle}` : ''),
                            description: `Balance type: **${selection.balance}**\nTotal present: **${presentPlayers.length}**\nPlayers in teams: **${numTeams * teamSize}**\nReserves: **${result.reserves.length}**\n\n:page_facing_up: **Full team list attached as file.**`,
                            timestamp: new Date().toISOString()
                        };
                        files = [{ attachment: Buffer.from(fullTeamText, 'utf-8'), name: 'teams.txt' }];
                    } else {
                        embed = {
                            color: 0x0099ff,
                            title: `Balanced Teams (${numTeams} teams, ${teamSize} per team)` + (playersData.sessionTitle ? ` - ${playersData.sessionTitle}` : ''),
                            description: `Balance type: **${selection.balance}**\nTotal present: **${presentPlayers.length}**\nPlayers in teams: **${numTeams * teamSize}**\nReserves: **${result.reserves.length}**\n\n\u200B\n\u200B\n\
\`\`\`\n${teamBlock}\n\`\`\`\n${reservesText}`,
                            timestamp: new Date().toISOString()
                        };
                    }

                    // Create button to save teams and create tournament bracket
                    const saveButton = new ButtonBuilder()
                        .setCustomId(`save_teams_${selection.tournament}_${selection.balance}_${selection.teamcount}`)
                        .setLabel('Save & Proceed to Tournament Bracket')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🏆');

                    const buttonRow = new ActionRowBuilder().addComponents(saveButton);

                    // Store the generated teams data for later use
                    if (!global.generatedTeamsData) global.generatedTeamsData = {};
                    global.generatedTeamsData[userId] = {
                        teams: result.teams,
                        reserves: result.reserves,
                        tournament: selection.tournament,
                        balance: selection.balance,
                        teamcount: selection.teamcount,
                        sessionTitle: playersData.sessionTitle,
                        creatorId: userId // Store the creator's Discord ID
                    };

                    // Send the embed to the teams channel as a public announcement
                    await sendAnnouncement(client, '1387454177743208609', embed, [buttonRow], files);
                    // Also reply to the user for confirmation
                    await interaction.editReply({
                        content: '✅ Teams generated and posted in the teams channel!',
                        files
                    });
                    delete global.generateTeamsSelections[userId];
                } else {
                    // Acknowledge the selection and prompt for the others
                    await interaction.reply({
                        content: 'Selection saved! Please select the remaining options to proceed.',
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Error in team generation selection:', error);
                try {
                    if (interaction.deferred) {
                        await interaction.editReply('❌ An error occurred while processing your selection. Please try again.');
                    } else {
                        await interaction.reply({ 
                            content: '❌ An error occurred while processing your selection. Please try again.', 
                            ephemeral: true 
                        });
                    }
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
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
        
        console.log(`[modal] Processing registration for ${playerName} (${discordId}) in session ${sessionId}`);
        
        try {
            // Defer reply immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });
            console.log(`[modal] Deferred reply for ${playerName}`);
            
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
            console.log('[modal] Registration API response status:', response.status);
            console.log('[modal] Registration API response data:', data);

            if (response.ok && data.success) {
                await interaction.editReply({
                    content: `✅ Registration successful! You have been registered for the tournament.\n\n**Player Info:**\n• Name: ${playerName}\n• Dota 2 ID: ${dota2id}\n• MMR: ${mmr}\n• Tournament: ${sessionId}`,
                    ephemeral: true
                });
                console.log(`[modal] Registration successful for ${playerName}`);
            } else {
                // Handle API errors (400, 500, etc.) - these are expected for validation/duplicate errors
                const errorMessage = data.message || 'Unknown error occurred';
                await interaction.editReply({
                    content: `❌ Registration failed: ${errorMessage}`,
                    ephemeral: true
                });
                console.log(`[modal] Registration failed for ${playerName}: ${errorMessage}`);
            }
        } catch (error) {
            console.error('[modal] Error registering player via modal:', error);
            
            // Check if interaction is still valid and not already replied to
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply({
                        content: '❌ Failed to register. Please try again later.',
                        ephemeral: true
                    });
                    console.log('[modal] Sent error reply via editReply');
                } catch (editError) {
                    console.error('[modal] Failed to edit reply:', editError);
                }
            } else if (!interaction.deferred && !interaction.replied) {
                try {
                    await interaction.reply({
                        content: '❌ Failed to register. Please try again later.',
                        ephemeral: true
                    });
                    console.log('[modal] Sent error reply via reply');
                } catch (replyError) {
                    console.error('[modal] Failed to send reply:', replyError);
                }
            } else {
                console.log('[modal] Interaction already handled, cannot send error message');
            }
        }
    }

    // Handle modal submission for generate teams
    if (interaction.isModalSubmit() && interaction.customId === 'modal_generate_teams') {
        const tournamentId = interaction.fields.getTextInputValue('tournament_id').trim();
        const balanceType = interaction.fields.getTextInputValue('balance_type').trim();
        const teamCountStr = interaction.fields.getTextInputValue('team_count').trim();
        const validBalanceTypes = ['highRanked', 'perfectMmr', 'highLowShuffle', 'random'];
        let teamCount = parseInt(teamCountStr, 10);

        await interaction.deferReply({ ephemeral: true });

        // Validate inputs
        if (!tournamentId) {
            await interaction.editReply('❌ Tournament ID is required.');
            return;
        }
        if (!validBalanceTypes.includes(balanceType)) {
            await interaction.editReply('❌ Invalid balance type. Use one of: highRanked, perfectMmr, highLowShuffle, random');
            return;
        }
        if (isNaN(teamCount) || teamCount < 2) {
            await interaction.editReply('❌ Number of teams must be a number (2 or more).');
            return;
        }

        // Fetch present players for the selected tournament
        try {
            const playersRes = await fetch(`${process.env.WEBAPP_URL}/.netlify/functions/players?sessionId=${tournamentId}`);
            const playersData = await playersRes.json();
            if (!playersData.success) {
                await interaction.editReply('❌ Failed to fetch players for this tournament.');
                return;
            }
            const presentPlayers = (playersData.players || []).filter(p => p.present);
            if (presentPlayers.length < 2) {
                await interaction.editReply('❌ Not enough present players to form teams.');
                return;
            }
            // Force 5 players per team
            const teamSize = 5;
            const numTeams = teamCount;
            const maxTeams = Math.floor(presentPlayers.length / teamSize);
            if (numTeams > maxTeams) {
                await interaction.editReply(`❌ Not enough players for ${numTeams} teams of 5. You can form up to ${maxTeams} teams with the current number of present players.`);
                return;
            }
            // Run the selected balance logic
            let result;
            switch (balanceType) {
                case 'highRanked':
                    result = teamBalancer.highRanked(presentPlayers, numTeams, teamSize); break;
                case 'perfectMmr':
                    result = teamBalancer.perfectMmr(presentPlayers, numTeams, teamSize); break;
                case 'highLowShuffle':
                    result = teamBalancer.highLowShuffle(presentPlayers, numTeams, teamSize); break;
                case 'random':
                    result = teamBalancer.random(presentPlayers, numTeams, teamSize); break;
                default:
                    await interaction.editReply('❌ Invalid balance type.');
                    return;
            }
            // Arrange teams in 2 columns (3 if more than 8 teams)
            const numCols = numTeams > 8 ? 3 : 2;
            const teamsPerCol = Math.ceil(numTeams / numCols);
            // Build each team block as plain text
            let teamBlock;
            if (numTeams === 2) {
                // Special formatting for 2 teams: vertical listing
                teamBlock = result.teams.map((team, i) => {
                    const avgMmr = Math.round(team.reduce((sum, p) => sum + (p.peakmmr || 0), 0) / (team.length || 1));
                    const header = `Team ${i + 1} (Avg MMR: ${avgMmr})`;
                    const players = team.map(p => `${p.name} (${p.peakmmr || 0})`).join('\n');
                    return `${header}\n${players}`;
                }).join('\n\n');
            } else {
                const teamBlocks = result.teams.map((team, i) => {
                    const avgMmr = Math.round(team.reduce((sum, p) => sum + (p.peakmmr || 0), 0) / (team.length || 1));
                    const header = `Team ${i + 1} (Avg MMR: ${avgMmr})`;
                    const players = team.map(p => `${p.name} (${p.peakmmr || 0})`).join('\n');
                    return [header, players];
                });
                // Find max width for each block for alignment
                const colBlocks = Array.from({ length: numCols }, (_, c) => teamBlocks.slice(c * teamsPerCol, (c + 1) * teamsPerCol));
                const colWidths = colBlocks.map(col => Math.max(...col.map(block => Math.max(...block.map(line => line.length)))));
                // Pad each block for alignment
                for (let c = 0; c < numCols; c++) {
                    for (let t = 0; t < colBlocks[c].length; t++) {
                        colBlocks[c][t] = colBlocks[c][t].map(line => line.padEnd(colWidths[c], ' '));
                    }
                }
                // Build the final lines row by row
                const lines = [];
                for (let row = 0; row < teamsPerCol; row++) {
                    // Header line (no padding)
                    const headerLine = colBlocks.map(col => col[row]?.[0] || '').join('  ');
                    lines.push(headerLine);
                    // Player lines (max 5 per team, no padding)
                    for (let p = 0; p < 5; p++) {
                        const playerLine = colBlocks.map(col => (col[row]?.[1]?.split('\n')[p] || '')).join('  ');
                        lines.push(playerLine);
                    }
                    // Blank line between rows
                    if (row < teamsPerCol - 1) lines.push('');
                }
                teamBlock = lines.join('\n');
            }
            const reservesText = result.reserves.length > 0 ? `Reserve players: ${result.reserves.map(p => p.name).join(', ')}` : 'No reserves';
            const fullTeamText = `${teamBlock}\n\n${reservesText}`;
            let embed, files = [];
            if (fullTeamText.length > 4000) {
                // Too long for embed, send as file
                embed = {
                    color: 0x0099ff,
                    title: `Balanced Teams (${numTeams} teams, ${teamSize} per team)` + (playersData.sessionTitle ? ` - ${playersData.sessionTitle}` : ''),
                    description: `Balance type: **${balanceType}**\nTotal present: **${presentPlayers.length}**\nPlayers in teams: **${numTeams * teamSize}**\nReserves: **${result.reserves.length}**\n\n:page_facing_up: **Full team list attached as file.**`,
                    timestamp: new Date().toISOString()
                };
                files = [{ attachment: Buffer.from(fullTeamText, 'utf-8'), name: 'teams.txt' }];
            } else {
                embed = {
                    color: 0x0099ff,
                    title: `Balanced Teams (${numTeams} teams, ${teamSize} per team)` + (playersData.sessionTitle ? ` - ${playersData.sessionTitle}` : ''),
                    description: `Balance type: **${balanceType}**\nTotal present: **${presentPlayers.length}**\nPlayers in teams: **${numTeams * teamSize}**\nReserves: **${result.reserves.length}**\n\n\u200B\n\u200B\n\
\`\`\`\n${teamBlock}\n\`\`\`\n${reservesText}`,
                    timestamp: new Date().toISOString()
                };
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[generate_teams modal] Error:', error);
            await interaction.editReply('❌ An error occurred while generating teams.');
        }
        return;
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

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Handle reaction events for attendance tracking
client.on('messageReactionAdd', async (reaction, user) => {
    console.log(`[DEBUG] Reaction added by ${user.username} (${user.id}) with emoji ${reaction.emoji.name}`);
    
    // Ignore bot reactions
    if (user.bot) {
        console.log('[DEBUG] Ignoring bot reaction');
        return;
    }
    
    // Check if this is an attendance message (has attendance embed)
    if (reaction.message.embeds.length > 0) {
        const embed = reaction.message.embeds[0];
        console.log(`[DEBUG] Message has embed with title: "${embed.title}"`);
        
        if (embed.title === '📋 Tournament Attendance' && reaction.emoji.name === '✅') {
            console.log('[DEBUG] Processing attendance reaction');
            try {
                // Extract session ID from the embed description
                const description = embed.description;
                const sessionMatch = description.match(/\*\*Tournament ID:\*\* ([^\n]+)/);
                
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
                // Debug: print all player Discord IDs and names
                console.log('[attendance][DEBUG] Player list for session:', sessionId);
                players.forEach(p => console.log(`  - name: ${p.name}, discordid: ${p.discordid}`));
                console.log(`[attendance][DEBUG] Looking for Discord ID: ${discordId}`);
                const registeredPlayer = players.find(player => player.discordid === discordId);
                
                if (!registeredPlayer) {
                    // Remove reaction if user is not registered
                    // await reaction.users.remove(user.id); // <-- Commented out to avoid permission errors
                    console.log(`[attendance] Would remove reaction from unregistered user ${user.username} (skipped)`);
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
        } else {
            console.log(`[DEBUG] Not an attendance message or wrong emoji. Title: "${embed.title}", Emoji: ${reaction.emoji.name}`);
        }
    } else {
        console.log('[DEBUG] Message has no embeds');
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
                const sessionMatch = description.match(/\*\*Tournament ID:\*\* ([^\n]+)/);
                
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

// Utility function to send announcements to specific channels
async function sendAnnouncement(client, channelId, embed, components = [], files = []) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            const sentMsg = await channel.send({ embeds: [embed], components, files });
            return sentMsg;
        } else {
            console.error(`Announcement channel ${channelId} not found!`);
            return null;
        }
    } catch (err) {
        console.error(`Error sending announcement to channel ${channelId}:`, err);
        return null;
    }
}

client.sendAnnouncement = sendAnnouncement; 