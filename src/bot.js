//...src/bot.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const express = require('express');
require('dotenv').config();

console.log('[DEBUG] Bắt đầu khởi tạo bot.js...');

// Khởi tạo các module quản lý
const QueueManager = require('./modules/queueManager');
const AudioManager = require('./modules/audioManager');
const SpotifyHandler = require('./modules/spotifyHandler');

console.log('[DEBUG] Đã tải các module quản lý.');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server);

console.log('[DEBUG] Đã khởi tạo Express, HTTP server và Socket.IO.');

// Ưu tiên PORT của Render, sau đó là WEB_PORT trong .env, nếu không thì dùng 3000
const WEB_PORT = process.env.PORT || process.env.WEB_PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.queueManagers = new Collection();
client.audioManagers = new Collection();
client.spotifyHandler = SpotifyHandler;
client.playingMessages = new Collection();

console.log('[DEBUG] Client Discord đã được khởi tạo.');

app.use(express.static('src/web/public'));

io.on('connection', (socket) => {
    console.log(`[DASHBOARD] Một Dashboard đã kết nối: ${socket.id}`);
    // ... (phần code xử lý socket.io) ...
});

server.listen(WEB_PORT, () => {
    console.log(`[WEB SERVER] Dashboard web đang chạy tại http://localhost:${WEB_PORT}`);
});

console.log('[DEBUG] Bắt đầu tải Commands...');
const commandFolders = readdirSync('./src/commands');
for (const folder of commandFolders) {
    const subCommandFolders = readdirSync(`./src/commands/${folder}`);
    for (const subFolder of subCommandFolders) {
        const commandFiles = readdirSync(`./src/commands/${folder}/${subFolder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${subFolder}/${file}`);
            if (command.data) {
                 client.commands.set(command.data.name, command);
            } else {
                 console.warn(`[COMMAND LOADER] Lệnh ${file} trong ${folder}/${subFolder} thiếu thuộc tính 'data'.`);
            }
        }
    }
}
console.log(`[DEBUG] Đã tải ${client.commands.size} lệnh.`);

console.log('[DEBUG] Bắt đầu tải Events...');
const eventFiles = readdirSync('./src/events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client, io));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client, io));
    }
}
console.log('[DEBUG] Đã tải Events.');

console.log('[DEBUG] Bắt đầu đăng nhập Discord...');
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log('[DEBUG] Đã gọi client.login(), chờ sự kiện ready...');
}).catch(err => {
    console.error('[ERROR] Lỗi khi đăng nhập Discord:', err.message);
    process.exit(1); // Thoát nếu lỗi đăng nhập
});

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('Đang tắt bot...');
    for (const [guildId, audioManager] of client.audioManagers) {
        await audioManager.stop();
    }
    io.close(() => console.log('[SOCKET.IO] Socket.IO server đã đóng.'));
    server.close(() => console.log('[WEB SERVER] Web server đã đóng.'));
    client.destroy();
    process.exit(0);
});

// Cập nhật trạng thái bot cho dashboard định kỳ
setInterval(() => {
    if (!client.isReady()) return;
    // ... (code gửi trạng thái bot) ...
}, 10000);
