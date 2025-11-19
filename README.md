# Valiance Bot - JavaScript Version

This is the complete JavaScript recreation of the Valiance Discord bot, identical to the Python version.

## Features

- **Core Commands**: ping, uptime, purge, delete, rename_channel, embed
- **Game Sessions**: Automatic CW (Clan Wars) session management
- **Verification System**: Button-based verification with role management
- **Help System**: Interactive help menu with categories
- **Fun Commands**: userinfo, serverinfo, avatar, coinflip, roll
- **AutoRole**: Reaction role system
- **Birthdays**: Birthday tracking and notifications
- **Reputation**: User reputation system with cooldowns
- **Rules**: Server rules display
- **Welcome/Boost Messages**: Automatic welcome and boost messages
- **Status Management**: Dynamic bot status with member count

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your bot token:
```bash
cp .env.example .env
```

3. Edit `.env` and add your bot token:
```
TOKEN=your_bot_token_here
```

4. Make sure the `config.json` file exists in the parent directory (shared with Python version)

5. Run the bot:
```bash
npm start
```

## Structure

- `index.js` - Main bot file with core functionality
- `utils/` - Utility functions (logger, botUtils, jsonStore)
- `views/` - UI components (VerifyView)
- `cogs/` - Feature modules (help, fun, autorole, birthdays, rep, regole)
- `data/` - Data storage directory

## Commands

All slash commands are identical to the Python version:

- `/help` - Interactive help system
- `/ping` - Bot latency
- `/uptime` - Bot uptime
- `/userinfo` - User information
- `/serverinfo` - Server information
- `/avatar` - User avatar
- `/coinflip` - Coin flip
- `/roll` - Dice roll
- `/birthday set/remove/when/next` - Birthday management
- `/rep add/remove/show` - Reputation system
- `/regole` - Server rules
- `/createreact` - Reaction roles
- `/verify panel/forceverify` - Verification system
- `/cwend` - End CW session
- `/ruleset` - Show ruleset
- `/setruleset` - Set ruleset
- And many more...

## Configuration

The bot uses the same `config.json` file as the Python version, ensuring identical behavior and settings.

## Logging

Logs are stored in the `../logs/` directory (shared with Python version) using Winston logger.