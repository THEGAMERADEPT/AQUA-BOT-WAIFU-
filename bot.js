require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const uploadGroupId = process.env.UPLOAD_GROUP_ID || '-1002503593313';
const uploadNotificationGroup = '-1002503593313';
const OWNER_ID = 6245574035;

if (!token) {
    console.error('Error: BOT_TOKEN not found in environment variables');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Waifu Bot Status</title>
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
            <meta http-equiv="Pragma" content="no-cache">
            <meta http-equiv="Expires" content="0">
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .status { background: #4CAF50; color: white; padding: 20px; border-radius: 10px; text-align: center; }
                .info { background: #f5f5f5; padding: 20px; margin-top: 20px; border-radius: 10px; }
                h1 { margin: 0; }
                p { margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="status">
                <h1>✅ Waifu Bot is Running!</h1>
                <p>Last checked: ${new Date().toLocaleString()}</p>
            </div>
            <div class="info">
                <h2>🤖 Bot Information</h2>
                <p><strong>Status:</strong> Online and Active</p>
                <p><strong>Platform:</strong> Telegram</p>
                <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                <p><strong>Server:</strong> Replit</p>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ 
        status: 'online', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

const USER_DATA_DIR = './users';

const BACKUP_DIR = './backups';

async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating backup directory:', error);
    }
}

ensureBackupDir();

async function backupAllData() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const users = await pool.query('SELECT * FROM users');
        const waifus = await pool.query('SELECT * FROM waifus');
        const harem = await pool.query('SELECT * FROM harem');
        const roles = await pool.query('SELECT * FROM roles');

        const backupData = {
            timestamp: new Date().toISOString(),
            users: users.rows,
            waifus: waifus.rows,
            harem: harem.rows,
            roles: roles.rows
        };

        const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

        console.log(`✅ Backup saved: ${backupPath}`);
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

setInterval(backupAllData, 6 * 60 * 60 * 1000);
backupAllData();

const RARITY_NAMES = {
    1: 'Common ⚪',
    2: 'Rare 🟢',
    3: 'Normal 🟣',
    4: 'Legendary 🟡',
    5: 'Summer 🏖',
    6: 'Winter ❄️',
    7: 'Valentine 💕',
    8: 'Manga ✨',
    9: 'Unique 👑',
    10: 'Neon 💫',
    11: 'Celestial 🪽',
    12: 'Mythical 🪭',
    13: 'Special 🫧',
    14: 'Masterpiece 💸',
    15: 'Limited 🔮',
    16: 'AMV 🎥'
};

const bazaarMessageTimers = new Map();

const RARITY_PRICES = {
    1: 20000,    // Common ⚪
    2: 20000,    // Rare 🟢
    3: 40000,    // Normal 🟣
    4: 50000,    // Legendary 🟡
    5: 400000,   // Summer 🏖
    6: 600000,   // Winter ❄️
    7: 300000,   // Valentine 💕
    8: 20000,    // Manga ✨
    9: 400000,   // Unique 👑
    10: 700000,  // Neon 💫
    11: 800000,  // Celestial 🪽
    12: 900000,  // Mythical 🪭
    13: 1000000, // Special 🫧
    14: 1200000, // Masterpiece 💸
    15: 1300000, // Limited 🔮
    16: 1400000  // AMV 🎥
};

const userCommandCount = new Map();
const SPAM_THRESHOLD = 10;
const SPAM_WINDOW = 10000;
const SPAM_BLOCK_DURATION = 20 * 60 * 1000;

async function ensureUserDataDir() {
    try {
        await fs.mkdir(USER_DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating user data directory:', error);
    }
}

ensureUserDataDir();

async function saveUserDataToFile(userId) {
    try {
        const user = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        if (user.rows.length === 0) return;

        const harem = await pool.query('SELECT waifu_id FROM harem WHERE user_id = $1', [userId]);

        const userData = {
            user_id: userId,
            username: user.rows[0].username,
            first_name: user.rows[0].first_name,
            berries: user.rows[0].berries,
            daily_streak: user.rows[0].daily_streak,
            weekly_streak: user.rows[0].weekly_streak,
            favorite_waifu_id: user.rows[0].favorite_waifu_id,
            waifus: harem.rows.map(h => h.waifu_id),
            last_updated: new Date().toISOString()
        };

        const filePath = path.join(USER_DATA_DIR, `${userId}.json`);
        await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
    } catch (error) {
        console.error('Error saving user data to file:', error);
    }
}

async function checkMonthlyReset() {
    try {
        const now = new Date();
        if (now.getDate() === 1) {
            const lastReset = await pool.query('SELECT value FROM bot_settings WHERE key = $1', ['last_monthly_reset']);
            const lastResetMonth = lastReset.rows.length > 0 ? new Date(lastReset.rows[0].value).getMonth() : -1;

            if (lastResetMonth !== now.getMonth()) {
                await pool.query('UPDATE users SET daily_streak = 0, weekly_streak = 0');
                await pool.query(
                    'INSERT INTO bot_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                    ['last_monthly_reset', now.toISOString()]
                );
                console.log('✅ Monthly streak reset completed');
            }
        }
    } catch (error) {
        console.error('Error in monthly reset:', error);
    }
}

setInterval(checkMonthlyReset, 60 * 60 * 1000);
checkMonthlyReset();

async function ensureUser(userId, username, firstName) {
    const result = await pool.query(
        'INSERT INTO users (user_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET username = $2, first_name = $3 RETURNING *',
        [userId, username, firstName]
    );
    await saveUserDataToFile(userId);
    return result.rows[0];
}

async function checkBanned(userId) {
    const result = await pool.query('SELECT * FROM banned_users WHERE user_id = $1', [userId]);
    return result.rows.length > 0;
}

async function checkSpamBlock(userId) {
    const result = await pool.query('SELECT * FROM spam_blocks WHERE user_id = $1 AND blocked_until > NOW()', [userId]);
    if (result.rows.length > 0) {
        return result.rows[0].blocked_until;
    }

    await pool.query('DELETE FROM spam_blocks WHERE user_id = $1 AND blocked_until <= NOW()', [userId]);
    return null;
}

async function trackSpam(userId) {
    const now = Date.now();
    const userData = userCommandCount.get(userId) || { count: 0, resetTime: now };

    if (now - userData.resetTime > SPAM_WINDOW) {
        userData.count = 1;
        userData.resetTime = now;
    } else {
        userData.count++;
    }

    userCommandCount.set(userId, userData);

    if (userData.count > SPAM_THRESHOLD) {
        const blockUntil = new Date(now + SPAM_BLOCK_DURATION);
        await pool.query(
            'INSERT INTO spam_blocks (user_id, blocked_until, spam_count) VALUES ($1, $2, 1) ON CONFLICT (user_id) DO UPDATE SET blocked_until = $2, spam_count = spam_blocks.spam_count + 1',
            [userId, blockUntil]
        );
        userCommandCount.delete(userId);
        return blockUntil;
    }

    return null;
}

async function hasRole(userId, role) {
    const result = await pool.query('SELECT * FROM roles WHERE user_id = $1 AND role_type = $2', [userId, role]);
    return result.rows.length > 0;
}

async function checkCooldown(userId, command, cooldownSeconds) {
    const result = await pool.query('SELECT last_used FROM cooldowns WHERE user_id = $1 AND command = $2', [userId, command]);
    if (result.rows.length > 0) {
        const lastUsed = new Date(result.rows[0].last_used);
        const now = new Date();
        const diff = (now - lastUsed) / 1000;
        if (diff < cooldownSeconds) {
            return Math.ceil(cooldownSeconds - diff);
        }
    }
    await pool.query(
        'INSERT INTO cooldowns (user_id, command, last_used) VALUES ($1, $2, NOW()) ON CONFLICT (user_id, command) DO UPDATE SET last_used = NOW()',
        [userId, command]
    );
    return 0;
}

async function getRandomWaifu(rarityRange = [1, 13], excludeRarities = []) {
    let query = 'SELECT * FROM waifus WHERE rarity BETWEEN $1 AND $2 AND is_locked = FALSE';
    let params = rarityRange;

    if (excludeRarities.length > 0) {
        query += ' AND rarity NOT IN (' + excludeRarities.join(',') + ')';
    }

    query += ' ORDER BY RANDOM() LIMIT 1';

    const result = await pool.query(query, params);
    return result.rows[0];
}

async function sendReply(chatId, messageId, text, options = {}) {
    return bot.sendMessage(chatId, text, {
        reply_to_message_id: messageId,
        parse_mode: 'HTML',
        ...options
    });
}

async function sendPhotoReply(chatId, messageId, photo, caption, options = {}) {
    return bot.sendPhoto(chatId, photo, {
        reply_to_message_id: messageId,
        caption,
        parse_mode: 'HTML',
        ...options
    });
}

async function checkUserAccess(msg) {
    if (!msg.from || msg.from.is_bot) return false;

    const userId = msg.from.id;

    if (await checkBanned(userId)) {
        await sendReply(msg.chat.id, msg.message_id, '🚫 You are banned from using this bot.');
        return false;
    }

    const spamBlock = await checkSpamBlock(userId);
    if (spamBlock) {
        const minutes = Math.ceil((new Date(spamBlock) - new Date()) / 60000);
        await sendReply(msg.chat.id, msg.message_id, `⏱️ You're blocked for spamming. Wait ${minutes} more minutes.`);
        return false;
    }

    const spamTriggered = await trackSpam(userId);
    if (spamTriggered) {
        await sendReply(msg.chat.id, msg.message_id, '🚫 Spam detected! You are blocked for 20 minutes.');
        return false;
    }

    return true;
}

async function getTargetUser(msg, args) {
    let targetId = null;
    let targetName = null;

    if (msg.reply_to_message) {
        targetId = msg.reply_to_message.from.id;
        targetName = msg.reply_to_message.from.first_name;
    } else if (args.length > 0) {
        if (args[0].startsWith('@')) {
            const username = args[0].substring(1);
            const result = await pool.query('SELECT user_id, first_name FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                targetId = result.rows[0].user_id;
                targetName = result.rows[0].first_name;
            }
        } else {
            targetId = parseInt(args[0]);
            const result = await pool.query('SELECT first_name FROM users WHERE user_id = $1', [targetId]);
            if (result.rows.length > 0) {
                targetName = result.rows[0].first_name;
            }
        }
    }

    return { targetId, targetName };
}

bot.onText(/\/start/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const botUsername = (await bot.getMe()).username;
    const mainMenuKeyboard = {
        inline_keyboard: [
            [
                { text: 'SUPPORT', url: 'https://t.me/+jhEIZcNrvtcxZjc1' },
                { text: 'UPDATES', url: 'https://t.me/+_oaZBApwiFsyNzU1' }
            ],
            [{ text: 'ADD ME BABY 💖', url: `https://t.me/${botUsername}?startgroup=true` }],
            [
                { text: 'OFFICIALGC', url: 'https://t.me/+jhEIZcNrvtcxZjc1' },
                { text: 'CREDITS', callback_data: 'menu_credits' }
            ]
        ]
    };

    const welcomeText = `👋 ʜɪ, ᴍʏ ɴᴀᴍᴇ ɪs 𝗔𝗾𝘂𝗮 𝗪𝗮𝗶𝗳𝘂 𝗯𝗼𝘁, ᴀɴ ᴀɴɪᴍᴇ-ʙᴀsᴇᴅ ɢᴀᴍᴇs ʙᴏᴛ! ᴀᴅᴅ ᴍᴇ ᴛᴏ ʏᴏᴜʀ ɢʀᴏᴜᴘ ᴀɴᴅ ᴛʜᴇ ᴇxᴘᴇʀɪᴇɴᴄᴇ ɢᴇᴛs ᴇxᴘᴀɴᴅᴇᴅ. ʟᴇᴛ's ɪɴɪᴛɪᴀᴛᴇ ᴏᴜʀ ᴊᴏᴜʀɴᴇʏ ᴛᴏɢᴇᴛʜᴇʀ!`;

    try {
        await bot.sendAnimation(msg.chat.id, 'https://www.kapwing.com/videos/691767e22b998271d946fb99', {
            caption: welcomeText,
            reply_to_message_id: msg.message_id,
            reply_markup: mainMenuKeyboard,
            parse_mode: 'HTML'
        });
    } catch (error) {
        await sendReply(msg.chat.id, msg.message_id, welcomeText, { reply_markup: mainMenuKeyboard });
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {
        if (data === 'menu_credits') {
            const creditsText = `ʙᴏᴛ ᴄʀᴇᴅɪᴛs\n\nᴜsᴇʀs ʙᴇʟᴏᴡ ᴀʀᴇ ᴛʜᴇ ᴅᴇᴠᴇʟᴏᴘᴇʀs, ᴜᴘʟᴏᴀᴅᴇʀs, ᴇᴛᴄ... ᴏғ ᴛʜɪs ʙᴏᴛ, ʏᴏᴜ ᴄᴀɴ ᴘᴇʀsᴏɴᴀʟʟʏ ᴄᴏɴᴛᴀᴄᴛ ᴛʜᴇᴍ ғᴏʀ ɪssᴜᴇs, ᴅᴏ ɴᴏᴛ ᴅᴍ ᴜɴɴᴇᴄᴇssᴀʀɪʟʏ.\n\nᴛʜᴀɴᴋ ʏᴏᴜ!`;
            const creditsKeyboard = {
                inline_keyboard: [
                    [{ text: 'DEVELOPER', callback_data: 'credits_developers' }, { text: 'SUDOS', callback_data: 'credits_sudos' }],
                    [{ text: 'UPLOADERS', callback_data: 'credits_uploaders' }, { text: 'BACK', callback_data: 'menu_credits' }]
                ]
            };
            await bot.editMessageText(creditsText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: creditsKeyboard
            });
        } else if (data === 'credits_uploaders') {
            const uploaders = await pool.query("SELECT DISTINCT u.user_id, u.username, u.first_name FROM users u JOIN roles r ON u.user_id = r.user_id WHERE r.role_type = 'uploader'");
            let text = '👤 <b>Uploaders</b>\n\n';

            if (uploaders.rows.length === 0) {
                text += 'No uploaders found.';
            } else {
                uploaders.rows.forEach(u => {
                    const name = u.username ? `@${u.username}` : u.first_name;
                    text += `• ${name} (ID: ${u.user_id})\n`;
                });
            }

            const keyboard = {
                inline_keyboard: [[{ text: '« BACK', callback_data: 'menu_credits' }]]
            };

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data === 'credits_developers') {
            const devs = await pool.query("SELECT DISTINCT u.user_id, u.username, u.first_name FROM users u JOIN roles r ON u.user_id = r.user_id WHERE r.role_type = 'dev' ORDER BY u.user_id");

            let text = '💻 <b>Developers</b>\n\n';
            const keyboard = { inline_keyboard: [] };

            if (devs.rows.length === 0) {
                text += 'No developers found.';
            } else {
                devs.rows.forEach(u => {
                    const name = u.username ? `@${u.username}` : u.first_name;
                    text += `• ${name}\n`;
                    keyboard.inline_keyboard.push([
                        { text: `${name}`, callback_data: `dev_info_${u.user_id}` }
                    ]);
                });
            }

            keyboard.inline_keyboard.push([{ text: '« BACK', callback_data: 'menu_credits' }]);

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data === 'credits_sudos') {
            const sudos = await pool.query("SELECT DISTINCT u.user_id, u.username, u.first_name FROM users u JOIN roles r ON u.user_id = r.user_id WHERE r.role_type = 'sudo' ORDER BY u.user_id");

            let text = '⚡ <b>Sudo Users</b>\n\n';
            const keyboard = { inline_keyboard: [] };

            if (sudos.rows.length === 0) {
                text += 'No sudo users found.';
            } else {
                sudos.rows.forEach(u => {
                    const name = u.username ? `@${u.username}` : u.first_name;
                    text += `• ${name}\n`;
                    keyboard.inline_keyboard.push([
                        { text: `${name}`, callback_data: `sudo_info_${u.user_id}` }
                    ]);
                });
            }

            keyboard.inline_keyboard.push([{ text: '« BACK', callback_data: 'menu_credits' }]);

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data.startsWith('dev_info_') || data.startsWith('sudo_info_')) {
            const userId = parseInt(data.split('_')[2]);
            const user = await pool.query('SELECT user_id, username, first_name FROM users WHERE user_id = $1', [userId]);

            if (user.rows.length > 0) {
                const u = user.rows[0];
                const name = u.username ? `@${u.username}` : u.first_name;
                const roleType = data.startsWith('dev_info_') ? 'Developer' : 'Sudo User';

                let text = `👤 <b>${roleType}</b>\n\n`;
                text += `Name: ${name}\n`;
                text += `ID: <code>${u.user_id}</code>`;

                const keyboard = {
                    inline_keyboard: [
                        [{ text: '💬 Send DM', url: `tg://user?id=${u.user_id}` }],
                        [{ text: '« BACK', callback_data: data.startsWith('dev_info_') ? 'credits_developers' : 'credits_sudos' }]
                    ]
                };

                await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                });
            }
        } else if (data === 'menu_help') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: 'BOT OFFICIAL GROUP', url: 'https://t.me/+jhEIZcNrvtcxZjc1' }],
                    [{ text: '« BACK', callback_data: 'menu_main' }]
                ]
            };
            const helpText = '💁 <b>Help & Support</b>\n\nJoin our official group for help and support!';
            await bot.editMessageText(helpText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data === 'menu_main') {
            const botUsername = (await bot.getMe()).username;
            const mainMenuKeyboard = {
                inline_keyboard: [
                    [{ text: 'ADD ME BABY 💖', url: `https://t.me/${botUsername}?startgroup=true` }],
                    [{ text: 'CREDITS', callback_data: 'menu_credits' }],
                    [{ text: 'HELP', callback_data: 'menu_help' }],
                    [{ text: 'UPDATES', url: 'https://t.me/+_oaZBApwiFsyNzU1' }]
                ]
            };
            const welcomeText = `👋 ʜɪ, ᴍʏ ɴᴀᴍᴇ ɪs 𝗔𝗾𝘂𝗮 𝗪𝗮𝗶𝗳𝘂 𝗯𝗼𝘁, ᴀɴ ᴀɴɪᴍᴇ-ʙᴀsᴇᴅ ɢᴀᴍᴇs ʙᴏᴛ! ᴀᴅᴅ ᴍᴇ ᴛᴏ ʏᴏᴜʀ ɢʀᴏᴜᴘ ᴀɴᴅ ᴛʜᴇ ᴇxᴘᴇʀɪᴇɴᴄᴇ ɢᴇᴛs ᴇxᴘᴀɴᴅᴇᴅ. ʟᴇᴛ's ɪɴɪᴛɪᴀᴛᴇ ᴏᴜʀ ᴊᴏᴜʀɴᴇʏ ᴛᴏɢᴇᴛʜᴇʀ!`;
            await bot.editMessageText(welcomeText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: mainMenuKeyboard
            });
        } else if (data === 'top_cash') {
            const topCash = await pool.query('SELECT user_id, username, first_name, berries FROM users ORDER BY berries DESC LIMIT 10');
            let message = '💸 <b>Top Cash Holders</b>\n\n';
            topCash.rows.forEach((u, i) => {
                const name = u.username ? `@${u.username}` : u.first_name;
                message += `${i + 1}. ${name} - <b>${u.berries} 💸 ᴄᴀꜱʜ</b>\n`;
            });
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🩷 ᴡᴀɪғᴜs', callback_data: 'top_waifus' }],
                    [{ text: '« CLOSE', callback_data: 'delete_message' }]
                ]
            };
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data === 'top_waifus') {
            const topWaifus = await pool.query(
                'SELECT u.user_id, u.username, u.first_name, COUNT(h.waifu_id) as count FROM users u JOIN harem h ON u.user_id = h.user_id GROUP BY u.user_id ORDER BY count DESC LIMIT 10'
            );
            let message = '🩷 <b>Top Waifu Collectors</b>\n\n';
            topWaifus.rows.forEach((u, i) => {
                const name = u.username ? `@${u.username}` : u.first_name;
                message += `${i + 1}. ${name} - <b>${u.count} waifus</b>\n`;
            });
            const keyboard = {
                inline_keyboard: [
                    [{ text: '💸 ᴄᴀꜱʜ', callback_data: 'top_cash' }],
                    [{ text: '« CLOSE', callback_data: 'delete_message' }]
                ]
            };
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } else if (data === 'delete_message') {
            await bot.deleteMessage(chatId, messageId);
        } else if (data.startsWith('show_char_')) {
            const waifuId = parseInt(data.split('_')[2]);
            const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
            if (waifu.rows.length > 0) {
                const w = waifu.rows[0];
                if (w.image_file_id) {
                    await bot.sendPhoto(chatId, w.image_file_id, {
                        caption: `<b>${w.name}</b>\nFrom: ${w.anime}\nRarity: ${RARITY_NAMES[w.rarity]}`,
                        parse_mode: 'HTML'
                    });
                }
            }
            await bot.answerCallbackQuery(query.id);
            return;
        }

        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Callback query error:', error);
        try {
            await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
        } catch (e) {}
    }
});

bot.onText(/\/explore/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const cooldown = await checkCooldown(userId, 'explore', 60);
    if (cooldown > 0) {
        return sendReply(msg.chat.id, msg.message_id, `ʏᴏᴜ ᴍᴜꜱᴛ ᴡᴀɪᴛ ${cooldown} ꜱᴇᴄᴏɴᴅꜱ ʙᴇꜰᴏʀᴇ ᴜꜱɪɴɢ ᴇxᴘʟᴏʀᴇ ᴀɢᴀɪɴ.`);
    }

    const cash = Math.floor(Math.random() * 5001) + 2000;
    await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [cash, userId]);
    await saveUserDataToFile(userId);

    let message;
    if (cash >= 6500 && cash <= 7000) {
        message = `ʏᴏᴜ ᴇxᴘʟᴏʀᴇ ᴀ ᴅᴜɴɢᴇᴏɴ ᴀɴᴅ ɢᴏᴛ TREASURE <b>${cash} ᴄᴀꜱʜ💸</b>`;
    } else {
        message = `ʏᴏᴜ ᴇxᴘʟᴏʀᴇ ᴀ ᴅᴜɴɢᴇᴏɴ ᴀɴᴅ ɢᴏᴛ <b>${cash} ᴄᴀꜱʜ💸</b>`;
    }

    sendReply(msg.chat.id, msg.message_id, message);
});

bot.onText(/\/bal/, async (msg) => {
    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);
    sendReply(msg.chat.id, msg.message_id, `💰 You have <b>${user.berries} 💸 ᴄᴀꜱʜ</b>`);
});

bot.onText(/\/claim/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    if (user.last_claim_date) {
        return sendReply(msg.chat.id, msg.message_id, '❌ You have already claimed your first-time reward!');
    }

    const rewardAmount = 5000000;
    await pool.query('UPDATE users SET berries = berries + $1, last_claim_date = CURRENT_DATE WHERE user_id = $2', [rewardAmount, userId]);
    await saveUserDataToFile(userId);

    sendReply(msg.chat.id, msg.message_id, `🎁 First-time claim successful! You received <b>${rewardAmount} 💸 ᴄᴀꜱʜ</b>!`);
});

bot.onText(/\/daily/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    const now = new Date();
    const lastDaily = user.last_daily_claim ? new Date(user.last_daily_claim) : null;

    if (lastDaily && (now - lastDaily) / (1000 * 60 * 60 * 24) < 1) {
        const nextDaily = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
        const hoursUntilDaily = Math.ceil((nextDaily - now) / (1000 * 60 * 60));
        return sendReply(msg.chat.id, msg.message_id, `⏱️ Daily bonus already claimed! Available in ${hoursUntilDaily}h`);
    }

    const streak = (!lastDaily || (now - lastDaily) / (1000 * 60 * 60 * 48) < 1) ? user.daily_streak + 1 : 1;
    let dailyReward = 50000;

    await pool.query('UPDATE users SET berries = berries + $1, daily_streak = $2, last_daily_claim = NOW() WHERE user_id = $3', 
        [dailyReward, streak, userId]);
    await saveUserDataToFile(userId);

    sendReply(msg.chat.id, msg.message_id, `🎁 Daily bonus claimed!\n\n💸 Reward: ${dailyReward} 💸\n🔥 Streak: ${streak}\n\n✅ Congratulations!`);
});

bot.onText(/\/weekly/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    const now = new Date();
    const lastWeekly = user.last_weekly_claim ? new Date(user.last_weekly_claim) : null;

    if (lastWeekly && (now - lastWeekly) / (1000 * 60 * 60 * 24 * 7) < 1) {
        const nextWeekly = new Date(lastWeekly.getTime() + 7 * 24 * 60 * 60 * 1000);
        const daysUntilWeekly = Math.ceil((nextWeekly - now) / (1000 * 60 * 60 * 24));
        return sendReply(msg.chat.id, msg.message_id, `⏱️ Weekly bonus already claimed! Available in ${daysUntilWeekly}d`);
    }

    const streak = (!lastWeekly || (now - lastWeekly) / (1000 * 60 * 60 * 24 * 14) < 1) ? user.weekly_streak + 1 : 1;
    let weeklyReward = 3000000;

    await pool.query('UPDATE users SET berries = berries + $1, weekly_streak = $2, last_weekly_claim = NOW() WHERE user_id = $3', 
        [weeklyReward, streak, userId]);
    await saveUserDataToFile(userId);

    sendReply(msg.chat.id, msg.message_id, `🎁 Weekly bonus claimed!\n\n💸 Reward: ${weeklyReward} 💸\n📊 Streak: ${streak}\n\n✅ Congratulations!`);
});

bot.onText(/\/bonus/, async (msg) => {
    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    const now = new Date();
    const lastDaily = user.last_daily_claim ? new Date(user.last_daily_claim) : null;
    const lastWeekly = user.last_weekly_claim ? new Date(user.last_weekly_claim) : null;

    const dailyReady = !lastDaily || (now - lastDaily) / (1000 * 60 * 60 * 24) >= 1;
    const weeklyReady = !lastWeekly || (now - lastWeekly) / (1000 * 60 * 60 * 24 * 7) >= 1;

    const keyboard = {
        inline_keyboard: []
    };

    if (dailyReady) {
        keyboard.inline_keyboard.push([{ text: '📅 Claim Daily Bonus', callback_data: 'claim_daily' }]);
    }

    if (weeklyReady) {
        keyboard.inline_keyboard.push([{ text: '📆 Claim Weekly Bonus', callback_data: 'claim_weekly' }]);
    }

    let message = '🎁 <b>Bonus Menu</b>\n\n';

    if (!dailyReady) {
        const nextDaily = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
        const hoursUntilDaily = Math.ceil((nextDaily - now) / (1000 * 60 * 60));
        message += `📅 Daily: Available in ${hoursUntilDaily}h\n`;
    } else {
        message += `📅 Daily: Ready to claim!\n`;
    }

    if (!weeklyReady) {
        const nextWeekly = new Date(lastWeekly.getTime() + 7 * 24 * 60 * 60 * 1000);
        const daysUntilWeekly = Math.ceil((nextWeekly - now) / (1000 * 60 * 60 * 24));
        message += `📆 Weekly: Available in ${daysUntilWeekly}d\n`;
    } else {
        message += `📆 Weekly: Ready to claim!\n`;
    }

    message += `\n🔥 Daily Streak: ${user.daily_streak}\n📊 Weekly Streak: ${user.weekly_streak}`;
    message += `\n\n⚠️ <i>Streaks reset on 1st of each month</i>`;

    if (keyboard.inline_keyboard.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, message);
    }

    sendReply(msg.chat.id, msg.message_id, message, { reply_markup: keyboard });
});

bot.on('callback_query', async (query) => {
    if (query.data === 'claim_daily') {
        const userId = query.from.id;
        const user = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);

        if (user.rows.length === 0) return;

        const u = user.rows[0];
        const now = new Date();
        const lastDaily = u.last_daily_claim ? new Date(u.last_daily_claim) : null;

        if (lastDaily && (now - lastDaily) / (1000 * 60 * 60 * 24) < 1) {
            return bot.answerCallbackQuery(query.id, { text: 'Already claimed today!', show_alert: true });
        }

        const streak = (!lastDaily || (now - lastDaily) / (1000 * 60 * 60 * 48) < 1) ? u.daily_streak + 1 : 1;
        let dailyReward = 100 * streak;

        if (streak === 3) dailyReward = Math.floor(dailyReward * 1.5);
        if (streak === 7) dailyReward = Math.floor(dailyReward * 2);
        if (streak === 14) dailyReward = Math.floor(dailyReward * 2.5);
        if (streak === 30) dailyReward = Math.floor(dailyReward * 3);

        await pool.query('UPDATE users SET berries = berries + $1, daily_streak = $2, last_daily_claim = NOW() WHERE user_id = $3', 
            [dailyReward, streak, userId]);
        await saveUserDataToFile(userId);

        bot.answerCallbackQuery(query.id, { text: `✅ Claimed ${dailyReward} 💸 ᴄᴀꜱʜ! Streak: ${streak}`, show_alert: true });

        try {
            await bot.editMessageText(`🎁 Daily bonus claimed!\n\n💸 Reward: ${dailyReward} ᴄᴀꜱʜ\n🔥 Streak: ${streak}`, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        } catch (e) {}
    } else if (query.data === 'claim_weekly') {
        const userId = query.from.id;
        const user = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);

        if (user.rows.length === 0) return;

        const u = user.rows[0];
        const now = new Date();
        const lastWeekly = u.last_weekly_claim ? new Date(u.last_weekly_claim) : null;

        if (lastWeekly && (now - lastWeekly) / (1000 * 60 * 60 * 24 * 7) < 1) {
            return bot.answerCallbackQuery(query.id, { text: 'Already claimed this week!', show_alert: true });
        }

        const streak = (!lastWeekly || (now - lastWeekly) / (1000 * 60 * 60 * 24 * 14) < 1) ? u.weekly_streak + 1 : 1;
        let weeklyReward = 500 * streak;

        if (streak === 3) weeklyReward = Math.floor(weeklyReward * 1.5);
        if (streak === 7) weeklyReward = Math.floor(weeklyReward * 2);
        if (streak === 14) weeklyReward = Math.floor(weeklyReward * 2.5);
        if (streak === 30) weeklyReward = Math.floor(weeklyReward * 3);

        await pool.query('UPDATE users SET berries = berries + $1, weekly_streak = $2, last_weekly_claim = NOW() WHERE user_id = $3', 
            [weeklyReward, streak, userId]);
        await saveUserDataToFile(userId);

        bot.answerCallbackQuery(query.id, { text: `✅ Claimed ${weeklyReward} 💸 ᴄᴀꜱʜ! Streak: ${streak}`, show_alert: true });

        try {
            await bot.editMessageText(`🎁 Weekly bonus claimed!\n\n💸 Reward: ${weeklyReward} ᴄᴀꜱʜ\n📊 Streak: ${streak}`, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        } catch (e) {}
    }
});

bot.onText(/\/marry/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const cooldown = await checkCooldown(userId, 'marry', 3600);
    if (cooldown > 0) {
        const minutes = Math.floor(cooldown / 60);
        const seconds = cooldown % 60;
        return sendReply(msg.chat.id, msg.message_id, `⏱️ Wait ${minutes}m ${seconds}s before marrying again!`);
    }

    await bot.sendDice(msg.chat.id, { emoji: '🎲', reply_to_message_id: msg.message_id });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const waifu = await getRandomWaifu([1, 4]);
    if (!waifu) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No waifus available yet!');
    }

    const marriageSuccess = Math.random() < 0.7;

    if (!marriageSuccess) {
        return sendReply(msg.chat.id, msg.message_id, `${msg.from.first_name}, ʏᴏᴜʀ ᴍᴀʀʀɪᴀɢᴇ ᴘʀᴏᴘᴏꜱᴀʟ ᴡᴀꜱ ʀᴇᴊᴇᴄᴛᴇᴅ ᴀɴᴅ ꜱʜᴇ ʀᴀɴ ᴀᴡᴀʏ! 🤡`);
    }

    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, waifu.waifu_id]);
    await saveUserDataToFile(userId);

    const message = `ᴄᴏɴɢʀᴀᴛᴜʟᴀᴛɪᴏɴꜱ! ${msg.from.first_name}, ʏᴏᴜ ᴀʀᴇ ɴᴏᴡ ᴍᴀʀʀɪᴇᴅ! ʜᴇʀᴇ ɪꜱ ʏᴏᴜʀ ᴄʜᴀʀᴀᴄᴛᴇʀ:\n\n𝗡𝗔𝗠𝗘: ${waifu.name}\n𝗔𝗡𝗜𝗠𝗘: ${waifu.anime}\n𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[waifu.rarity]}`;

    if (waifu.image_file_id) {
        sendPhotoReply(msg.chat.id, msg.message_id, waifu.image_file_id, message);
    } else {
        sendReply(msg.chat.id, msg.message_id, message);
    }
});

bot.onText(/\/dart\s+(\d+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const amount = parseInt(match[1]);
    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    if (amount <= 0 || isNaN(amount)) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Invalid amount! Use: /dart <amount>');
    }

    if (user.berries < amount) {
        return sendReply(msg.chat.id, msg.message_id, `❌ Insufficient cash! You have ${user.berries} 💸`);
    }

    const diceMsg = await bot.sendDice(msg.chat.id, { emoji: '🎯', reply_to_message_id: msg.message_id });

    await new Promise(resolve => setTimeout(resolve, 4000));

    const win = Math.random() < 0.30;

    if (win) {
        const winAmount = amount * 3;
        await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [amount * 2, userId]);
        await saveUserDataToFile(userId);
        sendReply(msg.chat.id, msg.message_id, `🎯 <b>Bullseye!</b> You won <b>${winAmount} 💸</b>! (Net: +${amount * 2} 💸)`);
    } else {
        await pool.query('UPDATE users SET berries = berries - $1 WHERE user_id = $2', [amount, userId]);
        await saveUserDataToFile(userId);
        sendReply(msg.chat.id, msg.message_id, `💔 Missed! You lost <b>${amount} 💸</b>.`);
    }
});

bot.onText(/\/top/, async (msg) => {
    const keyboard = {
        inline_keyboard: [
            [{ text: '💸 ᴄᴀꜱʜ', callback_data: 'top_cash' }, { text: '🩷 ᴡᴀɪғᴜs', callback_data: 'top_waifus' }]
        ]
    };

    sendReply(msg.chat.id, msg.message_id, '🏆 <b>Leaderboards</b>\n\nChoose a category:', { reply_markup: keyboard });
});

bot.onText(/\/uploaderlist/, async (msg) => {
    const uploaders = await pool.query("SELECT DISTINCT u.user_id, u.username, u.first_name FROM users u JOIN roles r ON u.user_id = r.user_id WHERE r.role_type = 'uploader' ORDER BY u.first_name");

    let message = '👤 <b>Uploaders List</b>\n\n';

    if (uploaders.rows.length === 0) {
        message += 'No uploaders found.';
    } else {
        uploaders.rows.forEach((u, i) => {
            const name = u.username ? `@${u.username}` : u.first_name;
            message += `${i + 1}. ${name} (ID: <code>${u.user_id}</code>)\n`;
        });
    }

    sendReply(msg.chat.id, msg.message_id, message);
});

bot.onText(/\/sudolist/, async (msg) => {
    const sudos = await pool.query("SELECT DISTINCT u.user_id, u.username, u.first_name FROM users u JOIN roles r ON u.user_id = r.user_id WHERE r.role_type = 'sudo' ORDER BY u.first_name");

    let message = '⚡ <b>Sudo Users List</b>\n\n';

    if (sudos.rows.length === 0) {
        message += 'No sudo users found.';
    } else {
        sudos.rows.forEach((u, i) => {
            const name = u.username ? `@${u.username}` : u.first_name;
            message += `${i + 1}. ${name} (ID: <code>${u.user_id}</code>)\n`;
        });
    }

    sendReply(msg.chat.id, msg.message_id, message);
});



bot.onText(/\/pay\s+(.+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user to send cash!');
    }

    const amount = parseInt(match[1]);
    const fromId = msg.from.id;
    const toId = msg.reply_to_message.from.id;

    if (fromId === toId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Cannot send cash to yourself!');
    }

    if (amount <= 0 || isNaN(amount)) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Invalid amount!');
    }

    const fromUser = await ensureUser(fromId, msg.from.username, msg.from.first_name);
    const toUser = await ensureUser(toId, msg.reply_to_message.from.username, msg.reply_to_message.from.first_name);

    if (fromUser.berries < amount) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Insufficient cash!');
    }

    await pool.query('UPDATE users SET berries = berries - $1 WHERE user_id = $2', [amount, fromId]);
    await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [amount, toId]);
    await saveUserDataToFile(fromId);
    await saveUserDataToFile(toId);

    sendReply(msg.chat.id, msg.message_id, `✅ Successfully sent <b>${amount} 💸 ᴄᴀꜱʜ</b> to ${toUser.first_name}!`);
});

bot.onText(/\/dinfo(?:\s+(.+))?/, async (msg, match) => {
    if (!match || !match[1]) {
        if (msg.reply_to_message) {
            return sendReply(msg.chat.id, msg.message_id, '🜲ᴀ×ᴡ 𓆩🖤𓆪');
        }
        return sendReply(msg.chat.id, msg.message_id, '❌ Use: /dinfo upload format OR /dinfo rarity OR /dinfo price');
    }

    const arg = match[1].toLowerCase().trim();

    if (arg === 'upload format') {
        const message = `📤 <b>Upload Format Guide</b>\n\nName - \nAnime - \nRarity - \n\n<b>Example:</b>\nName - Naruto Uzumaki\nAnime - Naruto Shippuden\nRarity - 6\n\n𝗨𝗦𝗘 𝗢𝗡𝗟𝗬 𝗧𝗛𝗜𝗦 𝗙𝗢𝗥𝗠𝗔𝗧 𝗙𝗢𝗥 𝗨𝗣𝗟𝗢𝗔𝗗𝗜𝗡𝗚`;
        return sendReply(msg.chat.id, msg.message_id, message);
    } else if (arg === 'rarity') {
        const message = `🎨 <b>Rarity List</b>\n\n1. Common ⚪\n2. Rare 🟢\n3. Normal 🟣\n4. Legendary 🟡\n5. Summer 🏖\n6. Winter ❄️\n7. Valentine 💕\n8. Manga ✨\n9. Unique 👑\n10. Neon 💫\n11. Celestial 🪽\n12. Mythical 🪭\n13. Special 🫧\n14. Masterpiece 💸\n15. Limited 🔮\n16. Amv 🎥\n\n𝗧𝗢𝗧𝗔𝗟 𝟭six 𝗥𝗔𝗥𝗜𝗧𝗬`;
        return sendReply(msg.chat.id, msg.message_id, message);
    } else if (arg === 'price') {
        const message = `💰 <b>Rarity Prices</b>\n\nCommon ⚪ – 20,000 💸\nRare 🟢 – 20,000 💸\nNormal 🟣 – 40,000 💸\nLegendary 🟡 – 50,000 💸\nSummer 🏖 – 400,000 💸\nWinter ❄️ – 600,000 💸\nValentine 💕 – 300,000 💸\nManga ✨ – 20,000 💸\nUnique 👑 – 400,000 💸\nNeon 💫 – 700,000 💸\nCelestial 🪽 – 800,000 💸\nMythical 🪭 – 900,000 💸\nSpecial 🫧 – 1,000,000 💸\nMasterpiece 💸 – 1,200,000 💸\nLimited 🔮 – 1,300,000 💸\nAmv 🎥 – 1,400,000 💸`;
        return sendReply(msg.chat.id, msg.message_id, message);
    } else {
        return sendReply(msg.chat.id, msg.message_id, '❌ Invalid option! Use: upload format, rarity, or price');
    }
});

bot.onText(/\/cmode/, async (msg) => {
    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const keyboard = {
        inline_keyboard: [
            [{ text: 'All', callback_data: 'cmode_all' }, { text: '𝑪𝒐𝒎𝒎𝒐𝒏 🔘', callback_data: 'cmode_1' }],
            [{ text: '𝑹𝒂𝒓𝒆 🧩', callback_data: 'cmode_2' }, { text: '𝑬𝒑𝒊𝒄 🟣', callback_data: 'cmode_3' }],
            [{ text: '𝑳𝒆𝒈𝒆𝒏𝒅𝒂𝒓𝒚 🟡', callback_data: 'cmode_4' }, { text: '𝑺𝒖𝒎𝒎𝒆𝒓 🏖️', callback_data: 'cmode_5' }],
            [{ text: '𝑾𝒊𝒏𝒕𝒆𝒓 ☃️', callback_data: 'cmode_6' }, { text: '𝑽𝒂𝒍𝒆𝒏𝒕𝒊𝒏𝒆 💘', callback_data: 'cmode_7' }],
            [{ text: '𝑴𝒂𝒏𝒈𝒂 ✨', callback_data: 'cmode_8' }, { text: '𝑹𝒐𝒚𝒂𝒍 🏰', callback_data: 'cmode_9' }],
            [{ text: 'Next →', callback_data: 'cmode_next' }]
        ]
    };

    sendReply(msg.chat.id, msg.message_id, '🎨 <b>Collection Mode</b>\n\nSelect a rarity to filter your harem:', { reply_markup: keyboard });
});

bot.on('callback_query', async (query) => {
    const data = query.data;

    if (data.startsWith('cmode_')) {
        const userId = query.from.id;

        if (data === 'cmode_next') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '𝑵𝒆𝒐𝒏 🔮', callback_data: 'cmode_10' }, { text: '𝑪𝒆𝒍𝒆𝒔𝒕𝒊𝒂𝒍 🌌', callback_data: 'cmode_11' }],
                    [{ text: '𝑴𝒚𝒕𝒉𝒊𝒄𝒂𝒍 🐉', callback_data: 'cmode_12' }, { text: '𝑺𝒑𝒆𝒄𝒊𝒂𝒍 🫧', callback_data: 'cmode_13' }],
                    [{ text: '𝑴𝒂𝒔𝒕𝒆𝒓𝒑𝒊𝒆𝒄𝒆 🖼️', callback_data: 'cmode_14' }, { text: '𝑨𝑴𝑽 🎬', callback_data: 'cmode_15' }],
                    [{ text: '← Back', callback_data: 'cmode_back' }]
                ]
            };

            await bot.editMessageReplyMarkup(keyboard, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
        } else if (data === 'cmode_back') {
            const keyboard = {
                inline_keyboard: [
                    [{ text: 'All', callback_data: 'cmode_all' }, { text: '𝑪𝒐𝒎𝒎𝒐𝒏 🔘', callback_data: 'cmode_1' }],
                    [{ text: '𝑹𝒂𝒓𝒆 🧩', callback_data: 'cmode_2' }, { text: '𝑬𝒑𝒊𝒄 🟣', callback_data: 'cmode_3' }],
                    [{ text: '𝑳𝒆𝒈𝒆𝒏𝒅𝒂𝒓𝒚 🟡', callback_data: 'cmode_4' }, { text: '𝑺𝒖𝒎𝒎𝒆𝒓 🏖️', callback_data: 'cmode_5' }],
                    [{ text: '𝑾𝒊𝒏𝒕𝒆𝒓 ☃️', callback_data: 'cmode_6' }, { text: '𝑽𝒂𝒍𝒆𝒏𝒕𝒊𝒏𝒆 💘', callback_data: 'cmode_7' }],
                    [{ text: '𝑴𝒂𝒏𝒈𝒂 ✨', callback_data: 'cmode_8' }, { text: '𝑹𝒐𝒚𝒂𝒍 🏰', callback_data: 'cmode_9' }],
                    [{ text: 'Next →', callback_data: 'cmode_next' }]
                ]
            };

            await bot.editMessageReplyMarkup(keyboard, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
        } else if (data === 'cmode_all') {
            await pool.query('UPDATE users SET harem_filter_rarity = NULL WHERE user_id = $1', [userId]);
            await bot.answerCallbackQuery(query.id, { text: '✅ Filter set to: All', show_alert: true });
            await bot.editMessageText('✅ Harem filter set to: <b>All</b>\n\nUse /harem to view your collection.', {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        } else {
            const rarity = parseInt(data.split('_')[1]);
            await pool.query('UPDATE users SET harem_filter_rarity = $1 WHERE user_id = $2', [rarity, userId]);
            await bot.answerCallbackQuery(query.id, { text: `✅ Filter set to: ${RARITY_NAMES[rarity]}`, show_alert: true });
            await bot.editMessageText(`✅ Harem filter set to: <b>${RARITY_NAMES[rarity]}</b>\n\nUse /harem to view your collection.`, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        }
    }
});

bot.onText(/\/harem(?:\s+(\d+))?/, async (msg, match) => {
    const userId = msg.from.id;
    const user = await ensureUser(userId, msg.from.username, msg.from.first_name);

    const page = parseInt(match[1]) || 1;
    const limit = 40;
    const offset = (page - 1) * limit;

    let query;
    let params;

    if (user.harem_filter_rarity) {
        query = `SELECT w.*, h.acquired_date FROM harem h 
                 JOIN waifus w ON h.waifu_id = w.waifu_id 
                 WHERE h.user_id = $1 AND w.rarity = $2
                 ORDER BY h.acquired_date DESC 
                 LIMIT $3 OFFSET $4`;
        params = [userId, user.harem_filter_rarity, limit, offset];
    } else {
        query = `SELECT w.*, h.acquired_date FROM harem h 
                 JOIN waifus w ON h.waifu_id = w.waifu_id 
                 WHERE h.user_id = $1 
                 ORDER BY h.acquired_date DESC 
                 LIMIT $2 OFFSET $3`;
        params = [userId, limit, offset];
    }

    const result = await pool.query(query, params);

    let countQuery;
    let countParams;

    if (user.harem_filter_rarity) {
        countQuery = 'SELECT COUNT(*) FROM harem h JOIN waifus w ON h.waifu_id = w.waifu_id WHERE h.user_id = $1 AND w.rarity = $2';
        countParams = [userId, user.harem_filter_rarity];
    } else {
        countQuery = 'SELECT COUNT(*) FROM harem WHERE user_id = $1';
        countParams = [userId];
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    if (total === 0) {
        const filterMsg = user.harem_filter_rarity ? ` in ${RARITY_NAMES[user.harem_filter_rarity]}` : '';
        return sendReply(msg.chat.id, msg.message_id, `📭 Your harem is empty${filterMsg}! Use /marry to get waifus.`);
    }

    const favId = user.favorite_waifu_id;
    const username = user.username ? `@${user.username}` : user.first_name;
    const totalPages = Math.ceil(total / limit);

    let message = `📚 <b>${username}'s Harem`;
    if (user.harem_filter_rarity) {
        message += ` (${RARITY_NAMES[user.harem_filter_rarity]})`;
    }
    message += ` (Page ${page}/${totalPages}):</b>\n\n`;

    if (user.harem_filter_rarity) {
        result.rows.forEach((w, i) => {
            const fav = w.waifu_id === favId ? '⭐' : '';
            message += `${offset + i + 1}. ${fav} ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
        });
    } else {
        let currentRarity = null;
        let index = offset;

        result.rows.forEach((w) => {
            if (currentRarity !== w.rarity) {
                currentRarity = w.rarity;
                message += `\n<b>${RARITY_NAMES[w.rarity]}</b>\n`;
            }
            const fav = w.waifu_id === favId ? '⭐' : '';
            index++;
            message += `${index}. ${fav} ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
        });
    }

    message += `\nTotal: ${total} waifus`;

    const keyboard = {
        inline_keyboard: []
    };

    if (page > 1) {
        keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `harem_${page - 1}` }]);
    }

    if (page < totalPages) {
        if (keyboard.inline_keyboard.length === 0) {
            keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `harem_${page + 1}` }]);
        } else {
            keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `harem_${page + 1}` });
        }
    }

    if (favId) {
        const favResult = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [favId]);
        if (favResult.rows.length > 0 && favResult.rows[0].image_file_id) {
            return sendPhotoReply(msg.chat.id, msg.message_id, favResult.rows[0].image_file_id, message, { reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined });
        }
    }

    sendReply(msg.chat.id, msg.message_id, message, { reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined });
});

bot.on('callback_query', async (query) => {
    if (query.data.startsWith('harem_')) {
        const page = parseInt(query.data.split('_')[1]);
        const userId = query.from.id;
        const user = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);

        if (user.rows.length === 0) return;

        const u = user.rows[0];
        const limit = 40;
        const offset = (page - 1) * limit;

        let queryStr;
        let params;

        if (u.harem_filter_rarity) {
            queryStr = `SELECT w.*, h.acquired_date FROM harem h 
                     JOIN waifus w ON h.waifu_id = w.waifu_id 
                     WHERE h.user_id = $1 AND w.rarity = $2
                     ORDER BY h.acquired_date DESC 
                     LIMIT $3 OFFSET $4`;
            params = [userId, u.harem_filter_rarity, limit, offset];
        } else {
            queryStr = `SELECT w.*, h.acquired_date FROM harem h 
                     JOIN waifus w ON h.waifu_id = w.waifu_id 
                     WHERE h.user_id = $1 
                     ORDER BY h.acquired_date DESC 
                     LIMIT $2 OFFSET $3`;
            params = [userId, limit, offset];
        }

        const result = await pool.query(queryStr, params);

        let countQuery;
        let countParams;

        if (u.harem_filter_rarity) {
            countQuery = 'SELECT COUNT(*) FROM harem h JOIN waifus w ON h.waifu_id = w.waifu_id WHERE h.user_id = $1 AND w.rarity = $2';
            countParams = [userId, u.harem_filter_rarity];
        } else {
            countQuery = 'SELECT COUNT(*) FROM harem WHERE user_id = $1';
            countParams = [userId];
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        const favId = u.favorite_waifu_id;
        const username = u.username ? `@${u.username}` : u.first_name;
        const totalPages = Math.ceil(total / limit);

        let message = `📚 <b>${username}'s Harem`;
        if (u.harem_filter_rarity) {
            message += ` (${RARITY_NAMES[u.harem_filter_rarity]})`;
        }
        message += ` (Page ${page}/${totalPages}):</b>\n\n`;

        if (u.harem_filter_rarity) {
            result.rows.forEach((w, i) => {
                const fav = w.waifu_id === favId ? '⭐' : '';
                message += `${offset + i + 1}. ${fav} ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
            });
        } else {
            let currentRarity = null;
            let index = offset;

            result.rows.forEach((w) => {
                if (currentRarity !== w.rarity) {
                    currentRarity = w.rarity;
                    message += `\n<b>${RARITY_NAMES[w.rarity]}</b>\n`;
                }
                const fav = w.waifu_id === favId ? '⭐' : '';
                index++;
                message += `${index}. ${fav} ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
            });
        }

        message += `\nTotal: ${total} waifus`;

        const keyboard = {
            inline_keyboard: []
        };

        if (page > 1) {
            keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `harem_${page - 1}` }]);
        }

        if (page < totalPages) {
            if (keyboard.inline_keyboard.length === 0) {
                keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `harem_${page + 1}` }]);
            } else {
                keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `harem_${page + 1}` });
            }
        }

        try {
            await bot.editMessageCaption(message, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined
            });
        } catch (e) {
            try {
                await bot.editMessageText(message, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                    reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined
                });
            } catch (err) {}
        }

        bot.answerCallbackQuery(query.id);
    }
});

bot.onText(/\/adev(?:\s+(.+))?/, async (msg, match) => {
    const userId = msg.from.id;

    if (userId !== OWNER_ID) {
        return sendReply(msg.chat.id, msg.message_id, `❌ Only the owner (id: ${OWNER_ID}) can use this command!`);
    }

    // If no args and no reply, give dev to yourself
    if (!msg.reply_to_message && !match[1]) {
        await pool.query('INSERT INTO roles (user_id, role_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, 'dev']);
        return sendReply(msg.chat.id, msg.message_id, '✅ You now have developer role!');
    }

    let targetId = null;
    let targetName = null;

    // If replying to someone
    if (msg.reply_to_message) {
        targetId = msg.reply_to_message.from.id;
        targetName = msg.reply_to_message.from.first_name;
    } else if (match[1]) {
        // If username provided
        const args = match[1].trim();
        if (args.startsWith('@')) {
            const username = args.substring(1);
            const result = await pool.query('SELECT user_id, first_name FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                targetId = result.rows[0].user_id;
                targetName = result.rows[0].first_name;
            }
        } else {
            // If user ID provided
            targetId = parseInt(args);
            const result = await pool.query('SELECT first_name FROM users WHERE user_id = $1', [targetId]);
            if (result.rows.length > 0) {
                targetName = result.rows[0].first_name;
            } else {
                targetName = `User ${targetId}`;
            }
        }
    }

    if (!targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or use: /adev @username or /adev <user_id>');
    }

    await pool.query('INSERT INTO roles (user_id, role_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [targetId, 'dev']);
    await ensureUser(targetId, null, targetName);

    sendReply(msg.chat.id, msg.message_id, `✅ ${targetName} is now a developer!`);
});

bot.onText(/\/rdev(?:\s+(.+))?/, async (msg, match) => {
    const userId = msg.from.id;

    if (userId !== OWNER_ID) {
        return sendReply(msg.chat.id, msg.message_id, `❌ Only the owner (id: ${OWNER_ID}) can use this command!`);
    }

    let targetId = null;
    let targetName = null;

    // If replying to someone
    if (msg.reply_to_message) {
        targetId = msg.reply_to_message.from.id;
        targetName = msg.reply_to_message.from.first_name;
    } else if (match[1]) {
        // If username provided
        const args = match[1].trim();
        if (args.startsWith('@')) {
            const username = args.substring(1);
            const result = await pool.query('SELECT user_id, first_name FROM users WHERE username = $1', [username]);
            if (result.rows.length > 0) {
                targetId = result.rows[0].user_id;
                targetName = result.rows[0].first_name;
            }
        } else {
            // If user ID provided
            targetId = parseInt(args);
            const result = await pool.query('SELECT first_name FROM users WHERE user_id = $1', [targetId]);
            if (result.rows.length > 0) {
                targetName = result.rows[0].first_name;
            } else {
                targetName = `User ${targetId}`;
            }
        }
    }

    if (!targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or use: /rdev @username or /rdev <user_id>');
    }

    const result = await pool.query("DELETE FROM roles WHERE user_id = $1 AND role_type = 'dev' RETURNING *", [targetId]);

    if (result.rowCount === 0) {
        return sendReply(msg.chat.id, msg.message_id, `❌ ${targetName} is not a developer!`);
    }

    sendReply(msg.chat.id, msg.message_id, `✅ Removed developer role from ${targetName}!`);
});

bot.onText(/\/reset_waifu\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');

    if (args[0] === 'all') {
        const target = await getTargetUser(msg, args.slice(1));

        if (!target.targetId) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
        }

        await pool.query('DELETE FROM harem WHERE user_id = $1', [target.targetId]);
        await saveUserDataToFile(target.targetId);

        sendReply(msg.chat.id, msg.message_id, `✅ All waifus removed from ${target.targetName}!`);
    } else {
        const waifuId = parseInt(args[0]);
        const target = await getTargetUser(msg, args.slice(1));

        if (!target.targetId) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
        }

        const result = await pool.query('DELETE FROM harem WHERE user_id = $1 AND waifu_id = $2 RETURNING *', [target.targetId, waifuId]);

        if (result.rowCount === 0) {
            return sendReply(msg.chat.id, msg.message_id, '❌ User does not own this waifu!');
        }

        await saveUserDataToFile(target.targetId);
        sendReply(msg.chat.id, msg.message_id, `✅ Waifu ID ${waifuId} removed from ${target.targetName}!`);
    }
});

bot.onText(/\/reset_cash\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');

    if (args[0] === 'all') {
        await pool.query('UPDATE users SET berries = 0');

        const users = await pool.query('SELECT user_id FROM users');
        for (const u of users.rows) {
            await saveUserDataToFile(u.user_id);
        }

        sendReply(msg.chat.id, msg.message_id, '✅ All users cash reset to zero!');
    } else {
        const amount = parseInt(args[0]);
        const target = await getTargetUser(msg, args.slice(1));

        if (!target.targetId) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
        }

        if (isNaN(amount) || amount < 0) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Invalid amount!');
        }

        await pool.query('UPDATE users SET berries = GREATEST(berries - $1, 0) WHERE user_id = $2', [amount, target.targetId]);
        await saveUserDataToFile(target.targetId);

        sendReply(msg.chat.id, msg.message_id, `✅ Removed ${amount} 💸 ᴄᴀꜱʜ from ${target.targetName}!`);
    }
});

bot.onText(/\/gban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await pool.query('INSERT INTO banned_users (user_id, reason) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET reason = $2', [target.targetId, reason]);
    await pool.query('DELETE FROM harem WHERE user_id = $1', [target.targetId]);
    await pool.query('UPDATE users SET berries = 0, daily_streak = 0, weekly_streak = 0 WHERE user_id = $1', [target.targetId]);
    await saveUserDataToFile(target.targetId);

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been globally banned!\n\nReason: ${reason}`);
});

bot.onText(/\/gunban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const result = await pool.query('DELETE FROM banned_users WHERE user_id = $1 RETURNING *', [target.targetId]);

    if (result.rowCount === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ User is not banned!');
    }

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been unbanned!`);
});

bot.onText(/\/gen\s+(\d+)\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'sudo') && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Sudo permission required!');
    }

    const amount = parseInt(match[1]);
    const quantity = parseInt(match[2]);

    const code = 'CASH' + Math.random().toString(36).substring(2, 10).toUpperCase();

    await pool.query(
        'INSERT INTO redeem_codes (code, code_type, amount, quantity) VALUES ($1, $2, $3, $4)',
        [code, 'cash', amount, quantity]
    );

    sendReply(msg.chat.id, msg.message_id, `✅ Cash code generated!\n\nCode: <code>${code}</code>\nAmount: ${amount} 💸 ᴄᴀꜱʜ\nUses: ${quantity}`);
});

bot.onText(/\/dgen\s+(\d+)\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'sudo') && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Sudo permission required!');
    }

    const waifuId = parseInt(match[1]);
    const quantity = parseInt(match[2]);

    const waifuCheck = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifuCheck.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    const code = 'WAIFU' + Math.random().toString(36).substring(2, 10).toUpperCase();

    await pool.query(
        'INSERT INTO redeem_codes (code, code_type, waifu_id, quantity) VALUES ($1, $2, $3, $4)',
        [code, 'waifu', waifuId, quantity]
    );

    sendReply(msg.chat.id, msg.message_id, `✅ Waifu code generated!\n\nCode: <code>${code}</code>\nWaifu: ${waifuCheck.rows[0].name}\nUses: ${quantity}`);
});

bot.onText(/\/give\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'sudo') && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Sudo permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user!');
    }

    const waifuId = parseInt(match[1]);
    const targetId = msg.reply_to_message.from.id;

    const waifuCheck = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifuCheck.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    await ensureUser(targetId, msg.reply_to_message.from.username, msg.reply_to_message.from.first_name);
    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [targetId, waifuId]);
    await saveUserDataToFile(targetId);

    sendReply(msg.chat.id, msg.message_id, `✅ Gave ${waifuCheck.rows[0].name} to ${msg.reply_to_message.from.first_name}!`);
});

bot.onText(/\/gift\s+(.+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user to send a gift!');
    }

    const waifuId = parseInt(match[1]);
    const fromId = msg.from.id;
    const toId = msg.reply_to_message.from.id;

    if (fromId === toId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Cannot gift to yourself!');
    }

    const owned = await pool.query('SELECT * FROM harem WHERE user_id = $1 AND waifu_id = $2', [fromId, waifuId]);
    if (owned.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, "❌ You don't own this waifu!");
    }

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);

    await pool.query('DELETE FROM harem WHERE user_id = $1 AND waifu_id = $2', [fromId, waifuId]);
    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [toId, waifuId]);
    await ensureUser(toId, msg.reply_to_message.from.username, msg.reply_to_message.from.first_name);
    await saveUserDataToFile(fromId);
    await saveUserDataToFile(toId);

    sendReply(msg.chat.id, msg.message_id, `🎁 ${msg.from.first_name} gifted ${waifu.rows[0].name} to ${msg.reply_to_message.from.first_name}!`);
});

bot.onText(/\/adduploader/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user!');
    }

    const targetId = msg.reply_to_message.from.id;
    await ensureUser(targetId, msg.reply_to_message.from.username, msg.reply_to_message.from.first_name);
    await pool.query('INSERT INTO roles (user_id, role_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [targetId, 'uploader']);

    sendReply(msg.chat.id, msg.message_id, `✅ ${msg.reply_to_message.from.first_name} is now an uploader!`);
});

bot.onText(/\/ruploader/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user!');
    }

    const targetId = msg.reply_to_message.from.id;
    await pool.query("DELETE FROM roles WHERE user_id = $1 AND role_type = 'uploader'", [targetId]);

    sendReply(msg.chat.id, msg.message_id, `✅ ${msg.reply_to_message.from.first_name} is no longer an uploader!`);
});

bot.onText(/\/addsudo/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user!');
    }

    const targetId = msg.reply_to_message.from.id;
    await ensureUser(targetId, msg.reply_to_message.from.username, msg.reply_to_message.from.first_name);
    await pool.query('INSERT INTO roles (user_id, role_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [targetId, 'sudo']);

    sendReply(msg.chat.id, msg.message_id, `✅ ${msg.reply_to_message.from.first_name} is now a sudo user!`);
});

bot.onText(/\/rsudo/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user!');
    }

    const targetId = msg.reply_to_message.from.id;
    await pool.query("DELETE FROM roles WHERE user_id = $1 AND role_type = 'sudo'", [targetId]);

    sendReply(msg.chat.id, msg.message_id, `✅ ${msg.reply_to_message.from.first_name} is no longer a sudo user!`);
});

bot.onText(/\/upload/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'uploader') && !await hasRole(userId, 'sudo') && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Uploader permission required!');
    }

    if (!msg.reply_to_message || (!msg.reply_to_message.photo && !msg.reply_to_message.video && !msg.reply_to_message.animation) || !msg.reply_to_message.caption) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a photo/video/AMV with the correct caption format!\n\n📤 <b>Upload Format Guide</b>\n\nUser sends photo/video with caption in this exact format (each on a new line):\n\n<code>Name - \nAnime - \nRarity - </code>\n\n<b>Example:</b>\n<code>Name - Saitama\nAnime - One Punch Man\nRarity - 1</code>\n\nThen reply to that message with /upload\n\n💡 For AMV (rarity 16), send as video or animation');
    }

    const caption = msg.reply_to_message.caption.trim();

    const lines = caption.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const data = {};

    for (const line of lines) {
        const parts = line.split(' - ');
        if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(' - ').trim();
            data[key] = value;
        }
    }

    if (!data.name || !data.anime || !data.rarity) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Invalid format! Caption must contain:\n\n<code>Name - \nAnime - \nRarity - </code>\n\n<b>Example:</b>\n<code>Name - Saitama\nAnime - One Punch Man\nRarity - 1</code>');
    }

    const name = data.name;
    const anime = data.anime;
    const rarity = parseInt(data.rarity);

    if (isNaN(rarity) || rarity < 1 || rarity > 16) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Rarity must be a number between 1 and 16!');
    }

    let fileId;
    let mediaType = 'photo';
    if (msg.reply_to_message.photo) {
        fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
        mediaType = 'photo';
    } else if (msg.reply_to_message.video) {
        fileId = msg.reply_to_message.video.file_id;
        mediaType = 'video';
    } else if (msg.reply_to_message.animation) {
        fileId = msg.reply_to_message.animation.file_id;
        mediaType = 'animation';
    }

    try {
        const price = RARITY_PRICES[rarity] || 5000;

        const result = await pool.query(
            'INSERT INTO waifus (name, anime, rarity, image_file_id, price, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING waifu_id',
            [name, anime, rarity, fileId, price, userId]
        );

        const waifuId = result.rows[0].waifu_id;
        const uploadCaption = `Name: ${name}\nAnime: ${anime}\nRarity: ${RARITY_NAMES[rarity]}\nID: ${waifuId}\nPrice: ${price} 💸\nUploaded by: ${msg.from.first_name}`;
        const notificationCaption = `⚠️ 𝗧𝗛𝗜𝗦 𝗪𝗔𝗜𝗙𝗨 𝗛𝗔𝗦 𝗕𝗘𝗘𝗡 𝗨𝗣𝗟𝗢𝗔𝗗𝗘𝗗, 𝗡𝗢 𝗢𝗡𝗘 𝗦𝗛𝗢𝗨𝗟𝗗 𝗨𝗣𝗟𝗢𝗔𝗗 𝗜𝗧 𝗡𝗢𝗪.`;

        if (channelId) {
            try {
                if (rarity === 16 || mediaType === 'video') {
                    await bot.sendVideo(channelId, fileId, {
                        caption: uploadCaption,
                        parse_mode: 'HTML'
                    });
                } else if (mediaType === 'animation') {
                    await bot.sendAnimation(channelId, fileId, {
                        caption: uploadCaption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await bot.sendPhoto(channelId, fileId, {
                        caption: uploadCaption,
                        parse_mode: 'HTML'
                    });
                }
            } catch (e) {
                console.error('Channel post error:', e);
            }
        }

        if (uploadNotificationGroup) {
            try {
                if (rarity === 16 || mediaType === 'video') {
                    await bot.sendVideo(uploadNotificationGroup, fileId, {
                        caption: notificationCaption,
                        parse_mode: 'HTML'
                    });
                } else if (mediaType === 'animation') {
                    await bot.sendAnimation(uploadNotificationGroup, fileId, {
                        caption: notificationCaption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await bot.sendPhoto(uploadNotificationGroup, fileId, {
                        caption: notificationCaption,
                        parse_mode: 'HTML'
                    });
                }
            } catch (e) {
                console.error('Upload group post error:', e);
            }
        }

        const successCaption = `✅ <b>Waifu Successfully Added to Collection!</b>\n\n𝗡𝗔𝗠𝗘: ${name}\n𝗔𝗡𝗜𝗠𝗘: ${anime}\n𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[rarity]}\n𝗜𝗗: ${waifuId}\n𝗣𝗥𝗜𝗖𝗘: ${price}💸`;
        
        if (rarity === 16 || mediaType === 'video') {
            await bot.sendVideo(msg.chat.id, fileId, {
                caption: successCaption,
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        } else if (mediaType === 'animation') {
            await bot.sendAnimation(msg.chat.id, fileId, {
                caption: successCaption,
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        } else {
            await sendPhotoReply(msg.chat.id, msg.message_id, fileId, successCaption);
        }
    } catch (error) {
        console.error('Upload error:', error);
        sendReply(msg.chat.id, msg.message_id, '❌ Failed to upload waifu. Please try again.');
    }
});

bot.onText(/\/delete\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const waifuId = parseInt(match[1]);

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    await pool.query('DELETE FROM harem WHERE waifu_id = $1', [waifuId]);
    await pool.query('DELETE FROM waifus WHERE waifu_id = $1', [waifuId]);

    const users = await pool.query('SELECT DISTINCT user_id FROM harem');
    for (const u of users.rows) {
        await saveUserDataToFile(u.user_id);
    }

    sendReply(msg.chat.id, msg.message_id, `✅ Deleted ${waifu.rows[0].name} from database and all user harems!`);
});

bot.onText(/\/dwaifu/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const now = new Date();
    const lastClaim = user.last_claim_date ? new Date(user.last_claim_date) : null;

    if (lastClaim && (now - lastClaim) / (1000 * 60 * 60 * 24) < 1) {
        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        const hoursUntilClaim = Math.ceil((nextClaim - now) / (1000 * 60 * 60));
        return sendReply(msg.chat.id, msg.message_id, `⏱️ Daily waifu already claimed! Available in ${hoursUntilClaim}h`);
    }

    const waifu = await getRandomWaifu([1, 4]);
    if (!waifu) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No waifus available yet!');
    }

    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, waifu.waifu_id]);
    await pool.query('UPDATE users SET last_claim_date = CURRENT_DATE WHERE user_id = $1', [userId]);
    await saveUserDataToFile(userId);

    const message = `🎁 Daily Waifu Claimed!\n\n𝗡𝗔𝗠𝗘: ${waifu.name}\n𝗔𝗡𝗜𝗠𝗘: ${waifu.anime}\n𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[waifu.rarity]}`;

    if (waifu.image_file_id) {
        sendPhotoReply(msg.chat.id, msg.message_id, waifu.image_file_id, message);
    } else {
        sendReply(msg.chat.id, msg.message_id, message);
    }
});

bot.onText(/\/lock\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const waifuId = parseInt(match[1]);

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    await pool.query('UPDATE waifus SET is_locked = NOT is_locked WHERE waifu_id = $1', [waifuId]);

    const updated = await pool.query('SELECT is_locked FROM waifus WHERE waifu_id = $1', [waifuId]);
    const status = updated.rows[0].is_locked ? 'locked' : 'unlocked';

    sendReply(msg.chat.id, msg.message_id, `✅ ${waifu.rows[0].name} is now ${status}!`);
});

bot.onText(/\/fav\s+(\d+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const waifuId = parseInt(match[1]);

    const owned = await pool.query('SELECT * FROM harem WHERE user_id = $1 AND waifu_id = $2', [userId, waifuId]);
    if (owned.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, "❌ You don't own this waifu!");
    }

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);

    await pool.query('UPDATE users SET favorite_waifu_id = $1 WHERE user_id = $2', [waifuId, userId]);
    await saveUserDataToFile(userId);

    sendReply(msg.chat.id, msg.message_id, `⭐ Set ${waifu.rows[0].name} as your favorite!`);
});

bot.onText(/\/send/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev') && userId !== OWNER_ID) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (msg.chat.type !== 'private') {
        return sendReply(msg.chat.id, msg.message_id, '❌ This command only works in DM!');
    }

    if (!msg.reply_to_message || !msg.reply_to_message.text) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a message to broadcast it!');
    }

    const broadcastMessage = msg.reply_to_message.text;
    const groups = await pool.query('SELECT DISTINCT group_id FROM group_settings');

    if (groups.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No groups found to broadcast to!');
    }

    let successCount = 0;
    let failCount = 0;

    for (const group of groups.rows) {
        try {
            await bot.sendMessage(group.group_id, broadcastMessage);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failCount++;
            console.error(`Failed to broadcast to ${group.group_id}:`, error.message);
        }
    }

    sendReply(msg.chat.id, msg.message_id, `✅ Broadcast complete!\n\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`);
});

bot.onText(/\/fwd(?:\s+(.+))?/, async (msg, match) => {
    const userId = msg.from.id;

    if (userId !== OWNER_ID && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Only the bot owner/developer can use the /fwd broadcast command.');
    }

    let broadcastMessage = null;
    let forwardMessage = null;

    if (msg.reply_to_message) {
        forwardMessage = msg.reply_to_message;
    } else if (match[1]) {
        broadcastMessage = match[1];
    } else {
        return sendReply(msg.chat.id, msg.message_id, '❌ Usage: /fwd <message> or reply to a message with /fwd');
    }

    const groups = await pool.query('SELECT DISTINCT group_id FROM group_settings');

    if (groups.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No groups found to broadcast to!');
    }

    let successCount = 0;
    let failCount = 0;

    for (const group of groups.rows) {
        try {
            if (forwardMessage) {
                await bot.forwardMessage(group.group_id, msg.chat.id, forwardMessage.message_id);
            } else {
                await bot.sendMessage(group.group_id, `📢 <b>Broadcast from Owner</b>\n\n${broadcastMessage}`, { parse_mode: 'HTML' });
            }
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failCount++;
            console.error(`Failed to broadcast to ${group.group_id}:`, error.message);
        }
    }

    sendReply(msg.chat.id, msg.message_id, `✅ Broadcast complete!\n\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`);
});

bot.onText(/\/d\s+(\d+)/, async (msg, match) => {
    const waifuId = parseInt(match[1]);

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No waifu found with this ID.');
    }

    const w = waifu.rows[0];

    const huntCount = await pool.query('SELECT COUNT(DISTINCT user_id) FROM harem WHERE waifu_id = $1', [waifuId]);
    const totalHunts = parseInt(huntCount.rows[0].count);

    const topHunters = await pool.query(
        'SELECT u.user_id, u.first_name, u.username FROM harem h JOIN users u ON h.user_id = u.user_id WHERE h.waifu_id = $1 GROUP BY u.user_id, u.first_name, u.username ORDER BY u.user_id LIMIT 10',
        [waifuId]
    );

    let huntersList = '';
    topHunters.rows.forEach((hunter, i) => {
        const name = hunter.username ? `@${hunter.username}` : hunter.first_name;
        huntersList += `${i + 1}. ${name}\n`;
    });

    const message = `💠 𝗖𝗛𝗔𝗥𝗔𝗖𝗧𝗘𝗥 𝗜𝗡𝗙𝗢:\n┏━━━━━━━━━━━━━⧫\n◈𝗡𝗔𝗠𝗘: ${w.name}\n◈𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[w.rarity] || 'Unknown'}\n◈𝗔𝗡𝗜𝗠𝗘: ${w.anime}\n┗━━━━━━━━━━━━━⧫\n\n𝕋𝕆ℙ ℍ𝕌ℕ𝕋𝔼ℝ𝕊 (${totalHunts})📊\n\n${huntersList || 'No hunters yet'}`;

    if (w.image_file_id) {
        // For rarity 16 (AMV) or if it's a video/animation, try sending as video/animation
        try {
            if (w.rarity === 16) {
                await bot.sendAnimation(msg.chat.id, w.image_file_id, {
                    caption: message,
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
            } else {
                await bot.sendPhoto(msg.chat.id, w.image_file_id, {
                    caption: message,
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
            }
        } catch (error) {
            // If sending as animation fails, try as photo
            try {
                await bot.sendPhoto(msg.chat.id, w.image_file_id, {
                    caption: message,
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
            } catch (e) {
                // If both fail, send as text
                sendReply(msg.chat.id, msg.message_id, message);
            }
        }
    } else {
        sendReply(msg.chat.id, msg.message_id, message);
    }
});



bot.onText(/\/redeem\s+(.+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const code = match[1].trim().toUpperCase();

    const codeData = await pool.query('SELECT * FROM redeem_codes WHERE code = $1', [code]);
    if (codeData.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Invalid code!');
    }

    const c = codeData.rows[0];

    if (c.uses >= c.quantity) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Code has been fully redeemed!');
    }

    if (c.code_type === 'cash') {
        await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [c.amount, userId]);
        await pool.query('UPDATE redeem_codes SET uses = uses + 1 WHERE code = $1', [code]);
        await saveUserDataToFile(userId);

        sendReply(msg.chat.id, msg.message_id, `✅ Redeemed ${c.amount} 💸 ᴄᴀꜱʜ!`);
    } else if (c.code_type === 'waifu') {
        const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [c.waifu_id]);
        if (waifu.rows.length === 0) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
        }

        await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, c.waifu_id]);
        await pool.query('UPDATE redeem_codes SET uses = uses + 1 WHERE code = $1', [code]);
        await saveUserDataToFile(userId);

        sendReply(msg.chat.id, msg.message_id, `✅ Redeemed ${waifu.rows[0].name}!`);
    }
});

bot.onText(/\/dredeem\s+(.+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const code = match[1].trim().toUpperCase();

    const codeData = await pool.query('SELECT * FROM redeem_codes WHERE code = $1', [code]);
    if (codeData.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Code not found!');
    }

    const c = codeData.rows[0];

    if (c.uses >= c.quantity) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Code has been fully redeemed!');
    }

    if (c.code_type === 'cash') {
        await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [c.amount, userId]);
        await pool.query('UPDATE redeem_codes SET uses = uses + 1 WHERE code = $1', [code]);
        await saveUserDataToFile(userId);

        sendReply(msg.chat.id, msg.message_id, `✅ Redeemed ${c.amount} 💸 ᴄᴀꜱʜ!`);
    } else if (c.code_type === 'waifu') {
        const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [c.waifu_id]);
        if (waifu.rows.length === 0) {
            return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
        }

        await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, c.waifu_id]);
        await pool.query('UPDATE redeem_codes SET uses = uses + 1 WHERE code = $1', [code]);
        await saveUserDataToFile(userId);

        sendReply(msg.chat.id, msg.message_id, `✅ Redeemed ${waifu.rows[0].name}!`);
    }
});

bot.onText(/\/chtime/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    await ensureUser(userId, msg.from.username, msg.from.first_name);

    const cooldowns = await pool.query('SELECT command, last_used FROM cooldowns WHERE user_id = $1', [userId]);

    let message = '⏰ <b>Your Cooldown Status:</b>\n\n';

    const now = new Date();
    const cooldownTimes = {
        'explore': 60,
        'marry': 3600
    };

    if (cooldowns.rows.length === 0) {
        message += '✅ All commands are ready to use!';
    } else {
        let hasCooldowns = false;
        for (const cd of cooldowns.rows) {
            const lastUsed = new Date(cd.last_used);
            const requiredCooldown = cooldownTimes[cd.command];

            if (!requiredCooldown) continue;

            const elapsed = Math.floor((now - lastUsed) / 1000);
            const remaining = Math.max(0, requiredCooldown - elapsed);

            if (remaining > 0) {
                hasCooldowns = true;
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                message += `/${cd.command}: ${minutes}m ${seconds}s remaining\n`;
            } else {
                message += `/${cd.command}: ✅ Ready\n`;
            }
        }

        if (!hasCooldowns) {
            message = '⏰ <b>Your Cooldown Status:</b>\n\n✅ All commands are ready to use!';
        }
    }

    sendReply(msg.chat.id, msg.message_id, message);
});

bot.onText(/\/changetime/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user to reset their cooldowns!');
    }

    const targetId = msg.reply_to_message.from.id;

    await pool.query('DELETE FROM cooldowns WHERE user_id = $1', [targetId]);

    sendReply(msg.chat.id, msg.message_id, `✅ Reset all cooldowns for ${msg.reply_to_message.from.first_name}!`);
});

const bazaarState = new Map();

bot.onText(/\/bazaar/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const storeWaifus = await pool.query(
        'SELECT * FROM waifus WHERE is_locked = FALSE ORDER BY RANDOM() LIMIT 3'
    );

    if (storeWaifus.rows.length === 0) {
        return sendReply(chatId, msg.message_id, '🏪 Bazaar is empty! Come back later.');
    }

    bazaarState.set(userId, { waifus: storeWaifus.rows, currentIndex: 0 });

    await showBazaarCard(chatId, msg.message_id, userId);
});

bot.onText(/\/delcode\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const code = match[1].trim().toUpperCase();

    const result = await pool.query('DELETE FROM redeem_codes WHERE code = $1 RETURNING *', [code]);

    if (result.rowCount === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Code not found!');
    }

    sendReply(msg.chat.id, msg.message_id, `✅ Deleted redeem code: <code>${code}</code>`);
});

async function showBazaarCard(chatId, replyToId, userId, editMessageId = null) {
    const state = bazaarState.get(userId);
    if (!state) return;

    const waifu = state.waifus[state.currentIndex];
    if (!waifu) return;

    const price = RARITY_PRICES[waifu.rarity] || 5000;

    const owned = await pool.query('SELECT COUNT(*) FROM harem WHERE user_id = $1 AND waifu_id = $2', [userId, waifu.waifu_id]);
    const ownCount = parseInt(owned.rows[0].count);

    const currentPage = state.currentIndex + 1;
    const totalPages = state.waifus.length;

    let message = `🏪 <b>BAZAAR (Page ${currentPage}/${totalPages})</b>\n\n`;
    message += `𝗡𝗔𝗠𝗘: ${waifu.name}\n`;
    message += `𝗔𝗡𝗜𝗠𝗘: ${waifu.anime}\n`;
    message += `𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[waifu.rarity]}\n`;
    message += `𝗜𝗗: ${waifu.waifu_id}\n`;
    message += `𝗣𝗥𝗜𝗖𝗘: ${price} 💸\n`;
    message += `𝗬𝗢𝗨 𝗢𝗪𝗡: ${ownCount}\n`;

    const keyboard = {
        inline_keyboard: [
            [{ text: '🎟️ Buy', callback_data: `bazaar_buy_${waifu.waifu_id}_${userId}` }]
        ]
    };

    const navRow = [];
    navRow.push({ text: '⬅️ Back', callback_data: `bazaar_back_${userId}` });
    navRow.push({ text: 'Next ➡️', callback_data: `bazaar_next_${userId}` });

    keyboard.inline_keyboard.push(navRow);
    keyboard.inline_keyboard.push([{ text: '♻️ Refresh', callback_data: `bazaar_refresh_${userId}` }]);
    keyboard.inline_keyboard.push([{ text: '✖️ Close', callback_data: 'delete_message' }]);

    if (editMessageId) {
        // Edit existing message
        if (waifu.image_file_id) {
            try {
                await bot.editMessageMedia({
                    type: 'photo',
                    media: waifu.image_file_id,
                    caption: message,
                    parse_mode: 'HTML',
                    has_spoiler: true
                }, {
                    chat_id: chatId,
                    message_id: editMessageId,
                    reply_markup: keyboard
                });
            } catch (e) {
                // If edit fails, try caption only
                try {
                    await bot.editMessageCaption(message, {
                        chat_id: chatId,
                        message_id: editMessageId,
                        parse_mode: 'HTML',
                        reply_markup: keyboard
                    });
                } catch (e2) {}
            }
        }
        state.messageId = editMessageId;
    } else {
        // Send new message
        let sentMsg;
        if (waifu.image_file_id) {
            sentMsg = await bot.sendPhoto(chatId, waifu.image_file_id, {
                caption: message,
                parse_mode: 'HTML',
                has_spoiler: true,
                reply_markup: keyboard
            });
        } else {
            sentMsg = await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }

        state.messageId = sentMsg.message_id;

        setTimeout(async () => {
            try {
                await bot.deleteMessage(chatId, sentMsg.message_id);
                bazaarState.delete(userId);
            } catch (e) {}
        }, 600000);
    }
}

bot.on('callback_query', async (query) => {
    if (query.data.startsWith('bazaar_buy_')) {
        const parts = query.data.split('_');
        const waifuId = parseInt(parts[2]);
        const targetUserId = parseInt(parts[3]);
        const userId = query.from.id;

        if (userId !== targetUserId) {
            return bot.answerCallbackQuery(query.id, { text: '❌ This is not your bazaar session!', show_alert: true });
        }

        const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
        if (waifu.rows.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: '❌ Waifu not found!', show_alert: true });
        }

        const price = RARITY_PRICES[waifu.rows[0].rarity] || 5000;
        const user = await pool.query('SELECT berries FROM users WHERE user_id = $1', [userId]);

        if (user.rows.length === 0 || user.rows[0].berries < price) {
            return bot.answerCallbackQuery(query.id, { text: '❌ Insufficient cash!', show_alert: true });
        }

        await pool.query('UPDATE users SET berries = berries - $1 WHERE user_id = $2', [price, userId]);
        await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, waifuId]);
        await ensureUser(userId, query.from.username, query.from.first_name);
        await saveUserDataToFile(userId);

        await bot.answerCallbackQuery(query.id, { text: 'THANK YOU FOR BUYING ❤️🔥', show_alert: true });

        try {
            await bot.editMessageCaption(`✅ THANK YOU FOR BUYING ❤️🔥\n\nYou bought ${waifu.rows[0].name} for ${price}💸!\n\nCheck your /harem now! 🦋`, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            });
        } catch (e) {
            console.error('Edit message error:', e);
        }

        bazaarState.delete(userId);
        return;
    } else if (query.data.startsWith('bazaar_next_')) {
        const targetUserId = parseInt(query.data.split('_')[2]);
        const userId = query.from.id;

        if (userId !== targetUserId) {
            return bot.answerCallbackQuery(query.id, { text: '❌ This is not your bazaar session!', show_alert: true });
        }

        const state = bazaarState.get(userId);
        if (state) {
            state.currentIndex = (state.currentIndex + 1) % state.waifus.length;
            await showBazaarCard(query.message.chat.id, null, userId, query.message.message_id);
        }
        bot.answerCallbackQuery(query.id);
    } else if (query.data.startsWith('bazaar_back_')) {
        const targetUserId = parseInt(query.data.split('_')[2]);
        const userId = query.from.id;

        if (userId !== targetUserId) {
            return bot.answerCallbackQuery(query.id, { text: '❌ This is not your bazaar session!', show_alert: true });
        }

        const state = bazaarState.get(userId);
        if (state) {
            state.currentIndex = (state.currentIndex - 1 + state.waifus.length) % state.waifus.length;
            await showBazaarCard(query.message.chat.id, null, userId, query.message.message_id);
        }
        bot.answerCallbackQuery(query.id);
    } else if (query.data.startsWith('bazaar_refresh_')) {
        const targetUserId = parseInt(query.data.split('_')[2]);
        const userId = query.from.id;

        if (userId !== targetUserId) {
            return bot.answerCallbackQuery(query.id, { text: '❌ This is not your bazaar session!', show_alert: true });
        }

        const storeWaifus = await pool.query(
            'SELECT * FROM waifus WHERE is_locked = FALSE ORDER BY RANDOM() LIMIT 3'
        );

        if (storeWaifus.rows.length === 0) {
            return bot.answerCallbackQuery(query.id, { text: 'Bazaar is empty!', show_alert: true });
        }

        bazaarState.set(userId, { waifus: storeWaifus.rows, currentIndex: 0, messageId: query.message.message_id });
        await showBazaarCard(query.message.chat.id, null, userId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: '♻️ Bazaar refreshed!' });
    }
});



bot.onText(/\/buy\s+(\d+)/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const itemId = parseInt(match[1]);

    const item = await pool.query(
        'SELECT b.*, w.name FROM bazaar_items b JOIN waifus w ON b.waifu_id = w.waifu_id WHERE b.item_id = $1 AND b.status = $2',
        [itemId, 'active']
    );

    if (item.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Item not found or already sold!');
    }

    const i = item.rows[0];

    if (i.seller_id === userId) {
        return sendReply(msg.chat.id, msg.message_id, "❌ Can't buy your own item!");
    }

    const buyer = await pool.query('SELECT berries FROM users WHERE user_id = $1', [userId]);
    if (buyer.rows[0].berries < i.price) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Insufficient cash!');
    }

    await pool.query('UPDATE users SET berries = berries - $1 WHERE user_id = $2', [i.price, userId]);
    await pool.query('UPDATE users SET berries = berries + $1 WHERE user_id = $2', [i.price, i.seller_id]);
    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, i.waifu_id]);
    await pool.query('DELETE FROM harem WHERE user_id = $1 AND waifu_id = $2', [i.seller_id, i.waifu_id]);
    await pool.query("UPDATE bazaar_items SET status = 'sold' WHERE item_id = $1", [itemId]);
    await saveUserDataToFile(userId);
    await saveUserDataToFile(i.seller_id);

    sendReply(msg.chat.id, msg.message_id, `✅ Purchased ${i.name} for ${i.price} 💸 ᴄᴀꜱʜ!`);
});

bot.onText(/\/auction(?:\s+(\d+)\s+(\d+))?/, async (msg, match) => {
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;

    if (!match[1] || !match[2]) {
        const activeAuctions = await pool.query(
            `SELECT b.*, w.name, w.anime, w.rarity, u.username, u.first_name 
             FROM bazaar_items b 
             JOIN waifus w ON b.waifu_id = w.waifu_id 
             JOIN users u ON b.seller_id = u.user_id 
             WHERE b.status = 'active' 
             ORDER BY b.listed_at DESC 
             LIMIT 5`
        );

        if (activeAuctions.rows.length === 0) {
            return sendReply(msg.chat.id, msg.message_id, '📭 No waifu auctions right now.');
        }

        let message = '🔨 <b>Active Auctions</b>\n\n';
        activeAuctions.rows.forEach((item, i) => {
            const seller = item.username ? `@${item.username}` : item.first_name;
            message += `${i + 1}. <b>${item.name}</b> - ${item.anime}\n`;
            message += `   Rarity: ${RARITY_NAMES[item.rarity]}\n`;
            message += `   Price: ${item.price} 💸\n`;
            message += `   Seller: ${seller}\n\n`;
        });

        message += 'Use /auction <waifu_id> <price> to list your waifu';

        return sendReply(msg.chat.id, msg.message_id, message);
    }

    const waifuId = parseInt(match[1]);
    const price = parseInt(match[2]);

    if (price <= 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Price must be positive!');
    }

    const owned = await pool.query('SELECT * FROM harem WHERE user_id = $1 AND waifu_id = $2', [userId, waifuId]);
    if (owned.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, "❌ You don't own this waifu!");
    }

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);

    await pool.query('INSERT INTO bazaar_items (waifu_id, seller_id, price) VALUES ($1, $2, $3)', [waifuId, userId, price]);

    sendReply(msg.chat.id, msg.message_id, `✅ Listed ${waifu.rows[0].name} for ${price} 💸 ᴄᴀꜱʜ in the bazaar!`);
});

bot.on('message', async (msg) => {
    if (!msg.chat || msg.chat.type === 'private') return;
    if (msg.from.is_bot) return;

    const groupId = msg.chat.id;

    await pool.query(
        'INSERT INTO group_settings (group_id) VALUES ($1) ON CONFLICT (group_id) DO NOTHING',
        [groupId]
    );

    await pool.query(
        'INSERT INTO spawn_tracker (group_id, message_count) VALUES ($1, 0) ON CONFLICT (group_id) DO NOTHING',
        [groupId]
    );

    const tracker = await pool.query('SELECT * FROM spawn_tracker WHERE group_id = $1', [groupId]);

    const currentCount = tracker.rows[0].message_count + 1;
    const activeSpawn = tracker.rows[0].active_spawn_waifu_id;

    if (activeSpawn && currentCount >= 150) {
        const bidData = await pool.query('SELECT * FROM group_bids WHERE group_id = $1', [groupId]);

        if (bidData.rows.length > 0) {
            const bid = bidData.rows[0];
            const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [bid.waifu_id]);

            if (bid.current_bidder_id) {
                await pool.query('UPDATE users SET berries = berries - $1 WHERE user_id = $2', [bid.current_bid, bid.current_bidder_id]);
                await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [bid.current_bidder_id, bid.waifu_id]);
                await ensureUser(bid.current_bidder_id, null, 'Bidder');
                await saveUserDataToFile(bid.current_bidder_id);

                const winner = await pool.query('SELECT first_name FROM users WHERE user_id = $1', [bid.current_bidder_id]);
                await bot.sendMessage(groupId, `🎉 Auction ended! ${winner.rows[0].first_name} won ${waifu.rows[0].name} for ${bid.current_bid} 💸 ᴄᴀꜱʜ!`);
            } else {
                await bot.sendMessage(groupId, `❌ Auction ended with no bids for ${waifu.rows[0].name}.`);
            }

            await pool.query('DELETE FROM group_bids WHERE group_id = $1', [groupId]);
        }

        await pool.query('UPDATE spawn_tracker SET message_count = 0, active_spawn_waifu_id = NULL, bid_message_count = 0 WHERE group_id = $1', [groupId]);
        return;
    }

    if (!activeSpawn && currentCount >= 100) {
        const waifu = await getRandomWaifu([1, 13]);

        if (waifu) {
            let message = `🎊 A wild waifu appeared!\n\nUse /grab <name> to claim!`;

            if (waifu.image_file_id) {
                await bot.sendPhoto(groupId, waifu.image_file_id, { 
                    caption: message, 
                    parse_mode: 'HTML',
                    has_spoiler: true
                });
            } else {
                await bot.sendMessage(groupId, message, { parse_mode: 'HTML' });
            }

            await pool.query('UPDATE spawn_tracker SET active_spawn_waifu_id = $1, active_spawn_name = $2, bid_message_count = 0 WHERE group_id = $3', [waifu.waifu_id, waifu.name, groupId]);
        }
    } else {
        await pool.query('UPDATE spawn_tracker SET message_count = $1 WHERE group_id = $2', [currentCount, groupId]);
    }
});

bot.onText(/\/grab(?:\s+(.+))?/, async (msg, match) => {
    if (msg.chat.type === 'private') return;
    if (!await checkUserAccess(msg)) return;

    const userId = msg.from.id;
    const groupId = msg.chat.id;

    const tracker = await pool.query('SELECT * FROM spawn_tracker WHERE group_id = $1', [groupId]);

    if (tracker.rows.length === 0 || !tracker.rows[0].active_spawn_waifu_id) {
        return sendReply(msg.chat.id, msg.message_id, '❌ No active spawn! Wait for a waifu to appear.');
    }

    const activeBid = await pool.query('SELECT * FROM group_bids WHERE group_id = $1', [groupId]);
    if (activeBid.rows.length > 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Auction is active! Use /bid to participate.');
    }

    const waifuId = tracker.rows[0].active_spawn_waifu_id;
    const spawnedName = tracker.rows[0].active_spawn_name;

    if (!spawnedName) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Spawn data corrupted! Please wait for next spawn.');
    }

    if (!match || !match[1]) {
        return sendReply(msg.chat.id, msg.message_id, `❌ Please provide the waifu name! Use: /grab <name>`);
    }

    const guess = match[1].trim().toLowerCase();
    const actualName = spawnedName.toLowerCase();
    
    if (guess !== actualName) {
        return sendReply(msg.chat.id, msg.message_id, `❌ Wrong name! Try again with the exact correct name.`);
    }

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);

    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    const w = waifu.rows[0];

    await pool.query('INSERT INTO harem (user_id, waifu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, waifuId]);
    await pool.query('UPDATE spawn_tracker SET active_spawn_waifu_id = NULL, active_spawn_name = NULL, message_count = 0 WHERE group_id = $1', [groupId]);
    await ensureUser(userId, msg.from.username, msg.from.first_name);
    await saveUserDataToFile(userId);

    const userName = msg.from.first_name;

    const grabMessage = `✨ <b>𝐂𝐎𝐍𝐆𝐑𝐀𝐓𝐔𝐋𝐀𝐓𝐈𝐎𝐍𝐒 🎉</b>\n${userName}\n•➵࿐•┈────┈•\n┊╰•➢ ɴᴀᴍᴇ: ${w.name}\n┊╰•➢ ᴀɴɪᴍᴇ: ${w.anime}\n╰─•➢ ʀᴀʀɪᴛʏ: ${RARITY_NAMES[w.rarity]}\n╰─•➢ 𝗜ᴅ: ${w.waifu_id}\n💫 ʏᴏᴜ ɢʀᴀʙʙᴇᴅ ᴀ ɴᴇᴡ ᴡᴀɪғᴜ\nᴄʜᴇᴄᴋ ɪɴ ʏᴏᴜʀ /harem ɴᴏᴡ 🦋`;

    sendReply(msg.chat.id, msg.message_id, grabMessage);
});



bot.onText(/\/propose/, async (msg) => {
    if (!await checkUserAccess(msg)) return;

    if (!msg.reply_to_message) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to someone to propose!');
    }

    const fromId = msg.from.id;
    const toId = msg.reply_to_message.from.id;

    if (fromId === toId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Cannot propose to yourself!');
    }

    const existing = await pool.query('SELECT * FROM proposals WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)', [fromId, toId]);

    if (existing.rows.length > 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Proposal already exists!');
    }

    const success = Math.random() < 0.6;

    if (!success) {
        return sendReply(msg.chat.id, msg.message_id, `💔 ${msg.reply_to_message.from.first_name} rejected your proposal!`);
    }

    await pool.query('INSERT INTO proposals (from_user, to_user, status) VALUES ($1, $2, $3)', [fromId, toId, 'accepted']);

    sendReply(msg.chat.id, msg.message_id, `💍 Congratulations! ${msg.from.first_name} and ${msg.reply_to_message.from.first_name} are now engaged!`);
});

bot.onText(/\/dprofile/, async (msg) => {
    let targetUser;
    let userId;

    if (msg.reply_to_message && msg.reply_to_message.from) {
        targetUser = msg.reply_to_message.from;
        userId = targetUser.id;
    } else {
        targetUser = msg.from;
        userId = targetUser.id;
    }

    const user = await ensureUser(userId, targetUser.username, targetUser.first_name);

    const haremCount = await pool.query('SELECT COUNT(*) FROM harem WHERE user_id = $1', [userId]);
    const total = parseInt(haremCount.rows[0].count);

    const favCount = await pool.query('SELECT COUNT(*) FROM harem WHERE user_id = $1 AND waifu_id = $2', [userId, user.favorite_waifu_id || 0]);


    const favorites = user.favorite_waifu_id ? 1 : 0;

    const displayName = targetUser.first_name || 'Unknown';
    const username = targetUser.username ? `@${targetUser.username}` : 'N/A';

    let message = `🏷️ 𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘:\n`;
    message += `┏━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗡𝗔𝗠𝗘: ${displayName}\n`;
    message += `◈𝗨𝗦𝗘𝗥𝗡𝗔𝗠𝗘: ${username}\n`;
    message += `◈𝗨𝗦𝗘𝗥 𝗜𝗗: ${userId}\n`;
    message += `┣━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗖𝗔𝗦𝗛: 💸 ${user.berries}\n`;
    message += `┣━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗖𝗛𝗔𝗥𝗔𝗖𝗧𝗘𝗥𝗦: ${total}\n`;
    message += `◈𝗙𝗔𝗩𝗢𝗥𝗜𝗧𝗘𝗦: ${favorites}\n`;
    message += `┗━━━━━━━━━━━━━⧫`;

    try {
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count > 0 && photos.photos.length > 0) {
            const fileId = photos.photos[0][0].file_id;
            await bot.sendPhoto(msg.chat.id, fileId, {
                caption: message,
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        } else {
            sendReply(msg.chat.id, msg.message_id, message);
        }
    } catch (error) {
        sendReply(msg.chat.id, msg.message_id, message);
    }
});

bot.onText(/\/lock\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const waifuId = parseInt(match[1]);

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    await pool.query('UPDATE waifus SET is_locked = NOT is_locked WHERE waifu_id = $1', [waifuId]);

    const updated = await pool.query('SELECT is_locked FROM waifus WHERE waifu_id = $1', [waifuId]);
    const status = updated.rows[0].is_locked ? 'locked' : 'unlocked';

    sendReply(msg.chat.id, msg.message_id, `✅ ${waifu.rows[0].name} is now ${status}!`);
});

bot.onText(/\/gban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await pool.query('INSERT INTO banned_users (user_id, reason) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET reason = $2', [target.targetId, reason]);
    await pool.query('DELETE FROM harem WHERE user_id = $1', [target.targetId]);
    await pool.query('UPDATE users SET berries = 0, daily_streak = 0, weekly_streak = 0 WHERE user_id = $1', [target.targetId]);
    await saveUserDataToFile(target.targetId);

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been globally banned!\n\nReason: ${reason}`);
});

bot.onText(/\/gunban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const result = await pool.query('DELETE FROM banned_users WHERE user_id = $1 RETURNING *', [target.targetId]);

    if (result.rowCount === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ User is not banned!');
    }

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been unbanned!`);
});

bot.onText(/\/tgm/, async (msg) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'uploader') && !await hasRole(userId, 'sudo') && !await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Uploader permission required!');
    }

    if (!msg.reply_to_message || (!msg.reply_to_message.photo && !msg.reply_to_message.video)) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a photo or video to get the file_id!');
    }

    try {
        let fileId;
        let fileType;
        
        if (msg.reply_to_message.photo) {
            fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
            fileType = 'Photo';
        } else if (msg.reply_to_message.video) {
            fileId = msg.reply_to_message.video.file_id;
            fileType = 'Video';
        }

        sendReply(msg.chat.id, msg.message_id, `📎 <b>${fileType} File ID:</b>\n\n<code>${fileId}</code>\n\n💡 Use this with /update command:\n<code>/update &lt;waifu_id&gt; image_url ${fileId}</code>`);
    } catch (error) {
        console.error('TGM error:', error);
        sendReply(msg.chat.id, msg.message_id, '❌ Failed to process file. Please try again.');
    }
});

bot.onText(/\/update\s+(\d+)\s+(image_url|anime|name|rarity)\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev') && !await hasRole(userId, 'uploader')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer or Uploader permission required!');
    }

    const waifuId = parseInt(match[1]);
    const field = match[2];
    const value = match[3].trim();

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    const oldWaifu = waifu.rows[0];

    try {
        if (field === 'image_url') {
            await pool.query('UPDATE waifus SET image_file_id = $1 WHERE waifu_id = $2', [value, waifuId]);
            
            const updatedWaifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
            const w = updatedWaifu.rows[0];
            
            if (w.image_file_id) {
                await sendPhotoReply(msg.chat.id, msg.message_id, w.image_file_id, 
                    `✅ Image updated successfully!\n\n𝗡𝗔𝗠𝗘: ${w.name}\n𝗔𝗡𝗜𝗠𝗘: ${w.anime}\n𝗥𝗔𝗥𝗜𝗧𝗬: ${RARITY_NAMES[w.rarity]}\n𝗜𝗗: ${w.waifu_id}`
                );
            }
        } else if (field === 'anime') {
            await pool.query('UPDATE waifus SET anime = $1 WHERE waifu_id = $2', [value, waifuId]);
            sendReply(msg.chat.id, msg.message_id, `✅ Anime updated from "${oldWaifu.anime}" to "${value}"`);
        } else if (field === 'name') {
            await pool.query('UPDATE waifus SET name = $1 WHERE waifu_id = $2', [value, waifuId]);
            sendReply(msg.chat.id, msg.message_id, `✅ Name updated from "${oldWaifu.name}" to "${value}"`);
        } else if (field === 'rarity') {
            const rarity = parseInt(value);
            if (isNaN(rarity) || rarity < 1 || rarity > 16) {
                return sendReply(msg.chat.id, msg.message_id, '❌ Rarity must be between 1 and 16!');
            }
            const price = RARITY_PRICES[rarity] || 5000;
            await pool.query('UPDATE waifus SET rarity = $1, price = $2 WHERE waifu_id = $3', [rarity, price, waifuId]);
            sendReply(msg.chat.id, msg.message_id, `✅ Rarity updated from ${RARITY_NAMES[oldWaifu.rarity]} to ${RARITY_NAMES[rarity]}\nPrice updated to ${price} 💸`);
        }

        const users = await pool.query('SELECT DISTINCT user_id FROM harem WHERE waifu_id = $1', [waifuId]);
        for (const u of users.rows) {
            await saveUserDataToFile(u.user_id);
        }
    } catch (error) {
        console.error('Update error:', error);
        sendReply(msg.chat.id, msg.message_id, `❌ Failed to update waifu: ${error.message}`);
    }
});

bot.onText(/\/rfind\s+(\d+)(?:\s+(\d+))?/, async (msg, match) => {
    const rarity = parseInt(match[1]);
    const page = parseInt(match[2]) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    if (isNaN(rarity) || rarity < 1 || rarity > 16) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Rarity must be between 1 and 16!');
    }

    const waifus = await pool.query(
        'SELECT * FROM waifus WHERE rarity = $1 ORDER BY name LIMIT $2 OFFSET $3',
        [rarity, limit, offset]
    );

    const count = await pool.query('SELECT COUNT(*) FROM waifus WHERE rarity = $1', [rarity]);
    const total = parseInt(count.rows[0].count);

    if (total === 0) {
        return sendReply(msg.chat.id, msg.message_id, `❌ No waifus found with rarity ${RARITY_NAMES[rarity]}`);
    }

    const totalPages = Math.ceil(total / limit);
    let message = `🔍 <b>Waifus with ${RARITY_NAMES[rarity]} (Page ${page}/${totalPages})</b>\n\n`;

    waifus.rows.forEach((w, i) => {
        message += `${offset + i + 1}. ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
    });

    message += `\nTotal: ${total} waifus`;

    const keyboard = {
        inline_keyboard: []
    };

    if (page > 1) {
        keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `rfind_${rarity}_${page - 1}` }]);
    }

    if (page < totalPages) {
        if (keyboard.inline_keyboard.length === 0) {
            keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `rfind_${rarity}_${page + 1}` }]);
        } else {
            keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `rfind_${rarity}_${page + 1}` });
        }
    }

    sendReply(msg.chat.id, msg.message_id, message, { reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined });
});

bot.onText(/\/find\s+(.+?)(?:\s+(\d+))?$/, async (msg, match) => {
    const searchName = match[1].trim();
    const page = parseInt(match[2]) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const waifus = await pool.query(
        'SELECT * FROM waifus WHERE LOWER(name) LIKE LOWER($1) ORDER BY rarity, name LIMIT $2 OFFSET $3',
        [`%${searchName}%`, limit, offset]
    );

    const count = await pool.query(
        'SELECT COUNT(*) FROM waifus WHERE LOWER(name) LIKE LOWER($1)',
        [`%${searchName}%`]
    );
    const total = parseInt(count.rows[0].count);

    if (total === 0) {
        return sendReply(msg.chat.id, msg.message_id, `❌ No waifus found matching "${searchName}"`);
    }

    const totalPages = Math.ceil(total / limit);
    let message = `🔍 <b>Search Results for "${searchName}" (Page ${page}/${totalPages})</b>\n\n`;

    let currentRarity = null;
    waifus.rows.forEach((w) => {
        if (currentRarity !== w.rarity) {
            currentRarity = w.rarity;
            message += `\n<b>${RARITY_NAMES[w.rarity]}</b>\n`;
        }
        message += `${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
    });

    message += `\nTotal: ${total} results`;

    const keyboard = {
        inline_keyboard: []
    };

    if (page > 1) {
        keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page - 1}` }]);
    }

    if (page < totalPages) {
        if (keyboard.inline_keyboard.length === 0) {
            keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page + 1}` }]);
        } else {
            keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page + 1}` });
        }
    }

    sendReply(msg.chat.id, msg.message_id, message, { reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined });
});

bot.on('callback_query', async (query) => {
    if (query.data.startsWith('rfind_')) {
        const parts = query.data.split('_');
        const rarity = parseInt(parts[1]);
        const page = parseInt(parts[2]);

        const limit = 20;
        const offset = (page - 1) * limit;

        const waifus = await pool.query(
            'SELECT * FROM waifus WHERE rarity = $1 ORDER BY name LIMIT $2 OFFSET $3',
            [rarity, limit, offset]
        );

        const count = await pool.query('SELECT COUNT(*) FROM waifus WHERE rarity = $1', [rarity]);
        const total = parseInt(count.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        let message = `🔍 <b>Waifus with ${RARITY_NAMES[rarity]} (Page ${page}/${totalPages})</b>\n\n`;

        waifus.rows.forEach((w, i) => {
            message += `${offset + i + 1}. ${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
        });

        message += `\nTotal: ${total} waifus`;

        const keyboard = {
            inline_keyboard: []
        };

        if (page > 1) {
            keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `rfind_${rarity}_${page - 1}` }]);
        }

        if (page < totalPages) {
            if (keyboard.inline_keyboard.length === 0) {
                keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `rfind_${rarity}_${page + 1}` }]);
            } else {
                keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `rfind_${rarity}_${page + 1}` });
            }
        }

        try {
            await bot.editMessageText(message, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined
            });
        } catch (e) {}

        bot.answerCallbackQuery(query.id);
    } else if (query.data.startsWith('find_')) {
        const parts = query.data.split('_');
        const searchName = Buffer.from(parts[1], 'base64').toString('utf-8');
        const page = parseInt(parts[2]);

        const limit = 20;
        const offset = (page - 1) * limit;

        const waifus = await pool.query(
            'SELECT * FROM waifus WHERE LOWER(name) LIKE LOWER($1) ORDER BY rarity, name LIMIT $2 OFFSET $3',
            [`%${searchName}%`, limit, offset]
        );

        const count = await pool.query(
            'SELECT COUNT(*) FROM waifus WHERE LOWER(name) LIKE LOWER($1)',
            [`%${searchName}%`]
        );
        const total = parseInt(count.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        let message = `🔍 <b>Search Results for "${searchName}" (Page ${page}/${totalPages})</b>\n\n`;

        let currentRarity = null;
        waifus.rows.forEach((w) => {
            if (currentRarity !== w.rarity) {
                currentRarity = w.rarity;
                message += `\n<b>${RARITY_NAMES[w.rarity]}</b>\n`;
            }
            message += `${w.name} - ${w.anime} (ID: ${w.waifu_id})\n`;
        });

        message += `\nTotal: ${total} results`;

        const keyboard = {
            inline_keyboard: []
        };

        if (page > 1) {
            keyboard.inline_keyboard.push([{ text: '⬅️ Previous', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page - 1}` }]);
        }

        if (page < totalPages) {
            if (keyboard.inline_keyboard.length === 0) {
                keyboard.inline_keyboard.push([{ text: 'Next ➡️', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page + 1}` }]);
            } else {
                keyboard.inline_keyboard[0].push({ text: 'Next ➡️', callback_data: `find_${Buffer.from(searchName).toString('base64')}_${page + 1}` });
            }
        }

        try {
            await bot.editMessageText(message, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined
            });
        } catch (e) {}

        bot.answerCallbackQuery(query.id);
    }
});

bot.onText(/\/dprofile/, async (msg) => {
    let targetUser;
    let userId;

    if (msg.reply_to_message && msg.reply_to_message.from) {
        targetUser = msg.reply_to_message.from;
        userId = targetUser.id;
    } else {
        targetUser = msg.from;
        userId = targetUser.id;
    }

    const user = await ensureUser(userId, targetUser.username, targetUser.first_name);

    const haremCount = await pool.query('SELECT COUNT(*) FROM harem WHERE user_id = $1', [userId]);
    const total = parseInt(haremCount.rows[0].count);

    const favCount = await pool.query('SELECT COUNT(*) FROM harem WHERE user_id = $1 AND waifu_id = $2', [userId, user.favorite_waifu_id || 0]);


    const favorites = user.favorite_waifu_id ? 1 : 0;

    const displayName = targetUser.first_name || 'Unknown';
    const username = targetUser.username ? `@${targetUser.username}` : 'N/A';

    let message = `🏷️ 𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘:\n`;
    message += `┏━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗡𝗔𝗠𝗘: ${displayName}\n`;
    message += `◈𝗨𝗦𝗘𝗥𝗡𝗔𝗠𝗘: ${username}\n`;
    message += `◈𝗨𝗦𝗘𝗥 𝗜𝗗: ${userId}\n`;
    message += `┣━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗖𝗔𝗦𝗛: 💸 ${user.berries}\n`;
    message += `┣━━━━━━━━━━━━━⧫\n`;
    message += `◈𝗖𝗛𝗔𝗥𝗔𝗖𝗧𝗘𝗥𝗦: ${total}\n`;
    message += `◈𝗙𝗔𝗩𝗢𝗥𝗜𝗧𝗘𝗦: ${favorites}\n`;
    message += `┗━━━━━━━━━━━━━⧫`;

    try {
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count > 0 && photos.photos.length > 0) {
            const fileId = photos.photos[0][0].file_id;
            await bot.sendPhoto(msg.chat.id, fileId, {
                caption: message,
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        } else {
            sendReply(msg.chat.id, msg.message_id, message);
        }
    } catch (error) {
        sendReply(msg.chat.id, msg.message_id, message);
    }
});

bot.onText(/\/lock\s+(\d+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const waifuId = parseInt(match[1]);

    const waifu = await pool.query('SELECT * FROM waifus WHERE waifu_id = $1', [waifuId]);
    if (waifu.rows.length === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Waifu not found!');
    }

    await pool.query('UPDATE waifus SET is_locked = NOT is_locked WHERE waifu_id = $1', [waifuId]);

    const updated = await pool.query('SELECT is_locked FROM waifus WHERE waifu_id = $1', [waifuId]);
    const status = updated.rows[0].is_locked ? 'locked' : 'unlocked';

    sendReply(msg.chat.id, msg.message_id, `✅ ${waifu.rows[0].name} is now ${status}!`);
});

bot.onText(/\/gban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await pool.query('INSERT INTO banned_users (user_id, reason) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET reason = $2', [target.targetId, reason]);
    await pool.query('DELETE FROM harem WHERE user_id = $1', [target.targetId]);
    await pool.query('UPDATE users SET berries = 0, daily_streak = 0, weekly_streak = 0 WHERE user_id = $1', [target.targetId]);
    await saveUserDataToFile(target.targetId);

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been globally banned!\n\nReason: ${reason}`);
});

bot.onText(/\/gunban\s+(.+)/, async (msg, match) => {
    const userId = msg.from.id;

    if (!await hasRole(userId, 'dev')) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Developer permission required!');
    }

    const args = match[1].split(' ');
    const target = await getTargetUser(msg, args);

    if (!target.targetId) {
        return sendReply(msg.chat.id, msg.message_id, '❌ Reply to a user or provide username/ID!');
    }

    const result = await pool.query('DELETE FROM banned_users WHERE user_id = $1 RETURNING *', [target.targetId]);

    if (result.rowCount === 0) {
        return sendReply(msg.chat.id, msg.message_id, '❌ User is not banned!');
    }

    sendReply(msg.chat.id, msg.message_id, `✅ ${target.targetName} has been unbanned!`);
});

console.log('✅ Waifu Collection Bot started successfully!');
console.log(`Owner ID: ${OWNER_ID}`);
console.log('Waiting for messages...');