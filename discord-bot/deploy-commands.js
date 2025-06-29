const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'ping',
        description: 'Check if the bot is online',
    },
    {
        name: 'tournaments',
        description: 'List available tournaments',
    },
    {
        name: 'status',
        description: 'Check your registration status',
    },
    {
        name: 'attendance',
        description: 'Post an attendance message for a tournament session',
    },
    {
        name: 'closeattendance',
        description: 'Close attendance for a tournament session',
    },
    {
        name: 'generate_teams',
        description: 'Generate balanced teams for a tournament (present players only)'
    },
    {
        name: 'remove_teamchannel',
        description: 'Remove all team voice channels (Team 1, Team 2, etc.)',
    },
    {
        name: 'menu',
        description: 'Show the admin control panel with quick action buttons',
        default_member_permissions: 8 // Administrator only
    },
    {
        name: 'setup_bot',
        description: 'Setup tournament channels and permissions for this server',
        default_member_permissions: 8 // Administrator only
    },
    {
        name: 'bracket_update',
        description: 'Update the current tournament bracket (admin/creator only)',
        default_member_permissions: 8 // Administrator only
    },
    {
        name: 'login',
        description: 'Log in to the webapp as an admin (per guild session)',
        options: [
            {
                name: 'username',
                description: 'Webapp admin username',
                type: 3, // STRING
                required: true
            },
            {
                name: 'password',
                description: 'Webapp admin password',
                type: 3, // STRING (Discord does not support password type, so use string)
                required: true
            }
        ],
        default_member_permissions: 8 // Administrator only
    },
    {
        name: 'logout',
        description: 'Log out and remove the stored session for this server',
        default_member_permissions: 8 // Administrator only
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const guildId = '1388898207215648908'; // updated to your actual server ID

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})(); 