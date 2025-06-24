# Tournament Discord Bot

A Discord bot for managing tournament registrations and team coordination.

## 🚀 Quick Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Tournament Bot")
4. Go to "Bot" section and click "Add Bot"
5. Copy the **Bot Token** (you'll need this later)
6. Go to "OAuth2" → "General" and copy the **Client ID**

### 2. Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Copy the generated URL and open it in a browser
5. Select your server and authorize the bot

### 3. Get Your Server ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server name and select "Copy Server ID"

### 4. Setup Environment

1. Copy `env.example` to `.env`
2. Fill in your Discord credentials:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_server_id_here
   WEBAPP_URL=https://your-tournament-app.netlify.app
   WEBAPP_SESSION_ID=your_admin_session_id_here
   ```

### 5. Install Dependencies

```bash
npm install
```

### 6. Deploy Commands

```bash
node deploy-commands.js
```

### 7. Start the Bot

```bash
npm start
```

## 📋 Available Commands

### Basic Commands
- `!ping` - Check if bot is online
- `!help` - Show help message

### Slash Commands
- `/ping` - Check bot latency
- `/tournaments` - List available tournaments
- `/register` - Register for a tournament
- `/teams` - View team information
- `/status` - Check your registration status

## 🔧 Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `CLIENT_ID` | Your Discord application client ID |
| `GUILD_ID` | Your Discord server ID |
| `WEBAPP_URL` | URL of your tournament webapp |
| `WEBAPP_SESSION_ID` | Admin session ID for webapp API access |

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### Adding New Commands
1. Create a new file in `commands/` folder
2. Export an object with `name`, `description`, and `execute` function
3. Add the command to `deploy-commands.js`
4. Run `node deploy-commands.js` to deploy

## 🔗 Integration with Tournament Webapp

The bot connects to your tournament webapp through the Netlify functions API. Make sure your webapp is deployed and accessible.

## 📝 Troubleshooting

### Common Issues

1. **Bot not responding**: Check if the bot token is correct
2. **Commands not working**: Make sure you ran `deploy-commands.js`
3. **Permission errors**: Ensure the bot has the required permissions in your server
4. **Webapp connection fails**: Verify the webapp URL and session ID

### Logs
Check the console output for error messages and debugging information.

## 🤝 Contributing

Feel free to add new features or improve existing functionality! 