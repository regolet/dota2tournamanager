# 🚀 Quick Start Guide

## Step 1: Create Discord Application

1. **Go to Discord Developer Portal**: https://discord.com/developers/applications
2. **Click "New Application"**
3. **Name it** (e.g., "Tournament Bot")
4. **Go to "Bot" section** → Click "Add Bot"
5. **Copy the Bot Token** (you'll need this)
6. **Go to "OAuth2" → "General"** → Copy the **Client ID**

## Step 2: Invite Bot to Your Server

1. **Go to "OAuth2" → "URL Generator"**
2. **Select scopes**: `bot`, `applications.commands`
3. **Select permissions**: 
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
4. **Copy the generated URL** and open it in browser
5. **Select your server** and authorize

## Step 3: Get Your Server ID

1. **Enable Developer Mode** in Discord:
   - User Settings → Advanced → Developer Mode
2. **Right-click your server name** → "Copy Server ID"

## Step 4: Run Setup

```bash
npm run setup
```

Follow the prompts to enter:
- Discord Bot Token
- Client ID
- Server ID
- Your webapp URL
- Admin session ID (optional)

## Step 5: Deploy Commands

```bash
npm run deploy
```

## Step 6: Start the Bot

```bash
npm start
```

## Step 7: Test the Bot

In your Discord server, try these commands:
- `!ping` - Should reply "Pong!"
- `!help` - Shows available commands
- `/ping` - Slash command version

## 🎉 You're Done!

Your Discord bot is now running and connected to your tournament webapp!

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

## 🔧 Troubleshooting

### Bot not responding?
- Check if the bot token is correct
- Make sure the bot is online (green dot)
- Verify bot has permissions in your server

### Commands not working?
- Run `npm run deploy` again
- Check console for error messages
- Make sure bot has "Use Slash Commands" permission

### Webapp connection fails?
- Verify your webapp URL is correct
- Check if your webapp is deployed and accessible
- Ensure admin session ID is valid (if using)

## 📞 Need Help?

Check the main README.md for detailed documentation and troubleshooting tips. 