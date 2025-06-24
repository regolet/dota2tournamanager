const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🤖 Tournament Discord Bot Setup\n');
console.log('This script will help you configure your Discord bot.\n');

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function setup() {
    try {
        console.log('📋 Please provide the following information:\n');

        const discordToken = await askQuestion('Discord Bot Token: ');
        const clientId = await askQuestion('Discord Client ID: ');
        const guildId = await askQuestion('Discord Server (Guild) ID: ');
        const webappUrl = await askQuestion('Tournament Webapp URL (e.g., https://your-app.netlify.app): ');
        const sessionId = await askQuestion('Admin Session ID (optional, press Enter to skip): ');

        // Create .env file
        const envContent = `# Discord Bot Configuration
DISCORD_TOKEN=${discordToken}
CLIENT_ID=${clientId}
GUILD_ID=${guildId}

# Tournament Webapp Integration
WEBAPP_URL=${webappUrl}
WEBAPP_SESSION_ID=${sessionId || ''}
`;

        fs.writeFileSync(path.join(__dirname, '.env'), envContent);

        console.log('\n✅ Configuration saved to .env file!');
        console.log('\n📝 Next steps:');
        console.log('1. Run: node deploy-commands.js');
        console.log('2. Run: npm start');
        console.log('\n🎉 Your bot should now be ready to use!');

    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        rl.close();
    }
}

setup(); 