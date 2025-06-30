//...src/bot.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
require('dotenv').config();

console.log('[DEBUG] Bắt đầu khởi tạo bot.js (phiên bản tối giản)...');

// Khởi tạo các module quản lý
const QueueManager = require('./modules/queueManager');
const AudioManager = require('./modules/audioManager');
const SpotifyHandler = require('./modules/spotifyHandler');

console.log('[DEBUG] Đã tải các module quản lý.');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.queueManagers = new Collection();
client.audioManagers = new Collection();
client.spotifyHandler = SpotifyHandler;
client.playingMessages = new Collection();

console.log('[DEBUG] Client Discord đã được khởi tạo.');

// Tải Commands
console.log('[DEBUG] Bắt đầu tải Commands...');
try {
    const categoryFolders = readdirSync('./src/commands'); // Đọc các thư mục như 'general', 'music'
    console.log(`[DEBUG] Tìm thấy ${categoryFolders.length} thư mục danh mục lệnh: ${categoryFolders.join(', ')}`);
    for (const categoryFolder of categoryFolders) { // categoryFolder sẽ là 'general' hoặc 'music'
        const commandFiles = readdirSync(`./src/commands/${categoryFolder}`).filter(file => file.endsWith('.js'));
        console.log(`[DEBUG] Tìm thấy ${commandFiles.length} lệnh trong thư mục ${categoryFolder}.`);
        for (const file of commandFiles) { // file sẽ là 'clear.js', 'play.js', v.v.
            const command = require(`./commands/${categoryFolder}/${file}`); // Đường dẫn chính xác
            if (command.data) {
                client.commands.set(command.data.name, command);
            } else {
                console.warn(`[COMMAND LOADER] Lệnh ${file} trong ${categoryFolder} thiếu thuộc tính 'data'.`);
            }
        }
    }
    console.log(`[DEBUG] Đã tải ${client.commands.size} lệnh.`);
} catch (error) {
    console.error('[ERROR] Lỗi khi tải Commands:', error.message);
    process.exit(1);
}


// Tải Events
console.log('[DEBUG] Bắt đầu tải Events...');
try {
    const eventFiles = readdirSync('./src/events').filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(`./events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
    console.log('[DEBUG] Đã tải Events.');
} catch (error) {
    console.error('[ERROR] Lỗi khi tải Events:', error.message);
    process.exit(1);
}


// Đăng nhập Discord
console.log('[DEBUG] Bắt đầu đăng nhập Discord...');
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log('[DEBUG] Đã gọi client.login(), chờ sự kiện ready...');
}).catch(err => {
    console.error(`[ERROR] Lỗi khi đăng nhập Discord: ${err.message}. Vui lòng kiểm tra DISCORD_TOKEN.`);
    process.exit(1);
});

// Xử lý lỗi không được bắt và promise bị từ chối
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err, origin) => {
    console.error('[ERROR] Uncaught Exception:', err);
    process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('[INFO] Đang tắt bot (SIGINT)...');
    try {
        for (const [guildId, audioManager] of client.audioManagers) {
            await audioManager.stop();
        }
        client.destroy();
        console.log('[INFO] Bot đã tắt thành công.');
    } catch (cleanupErr) {
        console.error('[ERROR] Lỗi trong quá trình tắt bot:', cleanupErr.message);
    } finally {
        process.exit(0);
    }
});
