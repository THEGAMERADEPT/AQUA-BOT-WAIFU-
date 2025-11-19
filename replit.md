# Telegram Waifu Collection Bot

## Project Overview
A Telegram bot for collecting and trading anime character (waifu) cards with a comprehensive gacha/collection system.

## Recent Changes (November 18, 2025)

### Critical Bug Fixes Implemented

#### 1. AMV Upload Fix (Rarity 16)
**Problem**: AMV (Animated Music Video) waifus were being uploaded using `sendPhoto` which doesn't support video/animation files.

**Solution**:
- Added media type detection for photo/video/animation
- Implemented conditional sending based on rarity and media type:
  - Rarity 16 or video files → `sendVideo`
  - Animation files → `sendAnimation`
  - Photo files → `sendPhoto`
- Applied fix to all three upload destinations: channel, notification group, and reply message

**Files Modified**: `bot.js` (lines 1773-1862)

#### 2. Strict Name Validation for /grab Command
**Problem**: Users could claim waifus with partial name matches (e.g., "Sai" for "Saitama").

**Solution**:
- Changed validation from partial match (`includes()`) to exact case-insensitive match
- Made name parameter mandatory (previously optional)
- User must now type the exact waifu name to claim
- Updated spawn message to show `/grab <name>` instruction
- Added `active_spawn_name` column to `spawn_tracker` table for proper validation

**Files Modified**: 
- `bot.js` (lines 2558, 2570, 2577-2625)
- `database.sql` (spawn_tracker table schema)

#### 3. Database Race Condition Fix
**Problem**: Duplicate key violations when multiple messages arrived simultaneously from new groups.

**Solution**:
- Changed spawn_tracker initialization from INSERT-then-SELECT to INSERT ON CONFLICT
- Prevents race conditions in group message tracking

**Files Modified**: `bot.js` (lines 2518-2523)

## Project Architecture

### Technology Stack
- **Runtime**: Node.js 20
- **Bot Framework**: node-telegram-bot-api
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Web Server**: Express (health checks & backups)
- **HTTP Client**: Axios
- **Environment**: dotenv for configuration

### Database Schema
Key tables:
- `users`: User profiles, berries (currency), streaks
- `waifus`: Character cards with rarity, anime, images
- `harem`: User collections (many-to-many)
- `spawn_tracker`: Group spawn state tracking (includes `active_spawn_name` for validation)
- `roles`: Permission system (uploader, sudo, dev)
- `group_bids`: Auction system
- `bazaar_items`: Player-to-player marketplace

### Rarity System
16 levels from Common (1) to AMV (16):
1. Common
2. Medium
3. High
4. Rare
5. Legendary
6. Astral
7. Limited
8. Premium Edition
9. Special Edition
10. Celestial
11. Divine
12. Exclusive
13. Cosmic
14. Valentine
15. Christmas
16. AMV (Video/Animation files)

### Key Features
- **Spawning System**: Waifus spawn every 100 messages in groups
- **Auction System**: High-rarity waifus trigger auctions every 150 messages
- **Bazaar**: Player marketplace for trading
- **Daily Claims**: Free daily waifu claims
- **Redeem Codes**: Promotional codes for rewards
- **File Backups**: JSON backups of user data in `/users` directory

## Environment Variables
Required secrets (configured via Replit Secrets):
- `BOT_TOKEN`: Telegram Bot API token
- `CHANNEL_ID`: Channel for waifu announcements
- `UPLOAD_GROUP_ID`: Group for upload notifications
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)

## Project Structure
```
/
├── bot.js              # Main bot logic (3200+ lines)
├── package.json        # Dependencies
├── database.sql        # Schema definitions
├── .env.example        # Example environment variables
├── .gitignore          # Git ignore patterns
├── users/              # User data backups (JSON)
└── backups/            # Automated database backups
```

## Running the Bot
The bot runs automatically via the "Start Bot" workflow configured in Replit.

**Workflow**: `node bot.js`
- Starts bot listener
- Initializes PostgreSQL connection
- Starts Express server on port 3000
- Creates automated backups every hour

## User Preferences
None specified yet.

## Development Notes
- Bot uses file-based user backups in addition to database
- Express server provides health check endpoint
- Automated hourly backups to `/backups` directory
- Uses PostgreSQL transactions for critical operations
- Implements spam protection and cooldown system
