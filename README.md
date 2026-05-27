# 🎮 Discord Account Management Bot v2.0

## Features

✨ **Complete Rewrite**
- ✅ JSON-based database (no SQLite)
- ✅ Discord Components v2 embeds throughout
- ✅ Hypixel stats integration (rank, level, capes)
- ✅ New `/ticketpanel` command
- ✅ New `/list` command with button disabling
- ✅ New `/sold` command
- ✅ Private thread creation for account details
- ✅ Secure account information storage
- ✅ Button disable on list command

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `.env`:
   ```
   TOKEN=your_discord_bot_token
   HYPIXEL_API_KEY=your_hypixel_api_key
   HITS_CHANNEL_ID=your_channel_id
   ```

3. Start the bot:
   ```bash
   npm start
   ```

## Commands

- `/ticketpanel` - Drop ticket panel with buy/support buttons
- `/list` - List all your claimed accounts
- `/sold` - View sold accounts

## Database

All data is stored in JSON files in the `data/` directory:
- `accounts.json` - Claimed accounts
- `licenses.json` - License keys
- `subscriptions.json` - User subscriptions
- `logs.json` - Action logs

## Security

- Account details are shown only in private threads
- Only account owners can view details
- Security email/recovery codes are encrypted in display

## Features Coming Soon

- Account trading system
- Price history tracking
- Admin dashboard
- Automated backup system
