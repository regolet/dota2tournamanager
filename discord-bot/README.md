# Tournament Discord Bot

A Discord bot for managing tournaments, teams, brackets, and more!

---

## 🚀 Installation & Setup Guide (for a New Server)

### 1. **Invite the Bot to Your Server**
- Go to the [Discord Developer Portal](https://discord.com/developers/applications) and select your bot.
- Under **OAuth2 > URL Generator**:
  - Select `bot` and `applications.commands` scopes.
  - Under "Bot Permissions", select:
    - Manage Channels
    - View Channels
    - Send Messages
    - Manage Roles (if needed)
    - Move Members
    - Read Message History
  - Copy the generated URL, open it in your browser, and invite the bot to your server.

### 2. **Clone and Install the Bot**
```bash
# Clone the repository
https://github.com/regolet/dota2tournamanager.git
cd dota2tournamanager/discord-bot

# Install dependencies
npm install
```

### 3. **Configure Environment Variables**
- Create a `.env` file in the `discord-bot` directory:
```
DISCORD_TOKEN=your-bot-token-here
WEBAPP_URL=https://your-webapp-url
```
- Replace with your actual bot token and webapp URL.

### 4. **Register Slash Commands**
```bash
node deploy-commands.js
```
- This will register all slash commands for your server.

### 5. **Run the Bot**
```bash
node index.js
```
- The bot should now be online in your server.

### 6. **Automated Server Setup**
- As an admin, run the `/setup_bot` command in your server.
  - This will automatically:
    - Create all required tournament channels (including `tournament-results`)
    - Organize them under a "Tournament" category
    - Set up permissions (admins can post, everyone can view, commands is admin-only)
    - Save channel IDs for your server
- You will see a summary of all actions taken.

### 7. **Ready to Use!**
- Use the admin panel, slash commands, and all tournament features as described in this README.

---

## 🛠️ Features
- Tournament registration, attendance, team generation, bracket management, and more
- Admin control panel with quick action buttons
- Automated channel/category/permission setup
- Persistent team data for multi-admin and multi-guild support
- Robust error handling and cleanup commands

---

## 💡 Tips
- If you want to run the bot 24/7, use a VPS, cloud server, or a service like Railway, Replit, or Heroku.
- You can re-run `/setup_bot` anytime to fix channels/permissions.
- Use `/cleanup_teams` to manually clear old team data.

---

For more details, see the rest of this README or contact the maintainer.

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