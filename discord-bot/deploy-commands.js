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
        name: 'register',
        description: 'Register for a tournament',
        options: [
            {
                name: 'tournament',
                description: 'The tournament to register for',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'dota2id',
                description: 'Your Dota 2 ID',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'mmr',
                description: 'Your peak MMR',
                type: 4, // INTEGER
                required: true,
            }
        ],
    },
    {
        name: 'teams',
        description: 'View team information for a tournament',
        options: [
            {
                name: 'tournament',
                description: 'The tournament to view teams for',
                type: 3, // STRING
                required: true,
            }
        ],
    },
    {
        name: 'status',
        description: 'Check your registration status',
    },
    {
        name: 'login',
        description: 'Login as admin. Usage: /login username: <username> password: <password>',
        options: [
            {
                name: 'username',
                type: 3, // STRING
                description: 'Your admin username',
                required: true
            },
            {
                name: 'password',
                type: 3, // STRING
                description: 'Your admin password',
                required: true
            }
        ]
    },
    {
        name: 'attendance',
        description: 'Post an attendance message for a tournament session',
    },
    {
        name: 'closeattendance',
        description: 'Close attendance for a tournament session',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})(); 