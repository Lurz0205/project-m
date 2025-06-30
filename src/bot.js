//...src/bot.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const express = require('express');
require('dotenv').config();

// Khởi tạo các module quản lý
const QueueManager = require('./modules/queueManager');
const AudioManager = require('./modules/audioManager');
const SpotifyHandler = require('./modules/spotifyHandler'); // Khởi tạo Spotify API ngay khi bot khởi động

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server); // Khởi tạo Socket.IO server

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent, // Quan trọng để đọc nội dung tin nhắn (nếu không dùng Slash Commands)
        // Nếu muốn đếm tổng số người dùng chính xác, có thể cần GuildMembersIntent
        // GatewayIntentBits.GuildMembers, 
    ],
});

// Khởi tạo các Collection để lưu trữ dữ liệu
client.commands = new Collection();
client.cooldowns = new Collection();
client.queueManagers = new Collection(); // Lưu trữ các QueueManager cho mỗi Guild
client.audioManagers = new Collection(); // Lưu trữ các AudioManager cho mỗi Guild
client.spotifyHandler = SpotifyHandler; // Gán handler Spotify

// Khởi tạo server web cho Dashboard
app.use(express.static('src/web/public')); // Phục vụ các file tĩnh từ thư mục public

io.on('connection', (socket) => {
    console.log(`[DASHBOARD] Một Dashboard đã kết nối: ${socket.id}`);

    // Gửi trạng thái hiện tại của bot đến dashboard khi nó kết nối
    const guilds = client.guilds.cache.map(guild => {
        const queueManager = client.queueManagers.get(guild.id);
        const audioManager = client.audioManagers.get(guild.id);
        return {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount, // Tổng số thành viên trong guild
            queue: queueManager?.getQueue().map(s => s.info) || [],
            nowPlaying: queueManager?.getCurrentSong()?.info || null,
            isPlaying: audioManager?.isPlaying() || false,
            volume: audioManager?.volume || 100,
            is247: queueManager?.is247() || false,
            isAutoplay: queueManager?.isAutoplay() || false
        };
    });
    socket.emit('bot_status', {
        uptime: process.uptime(),
        guildCount: client.guilds.cache.size,
        // Để có userCount chính xác, cần GuildMembersIntent và xử lý cache/fetch thành viên
        userCount: client.users.cache.size,
        guilds: guilds
    });

    // Lắng nghe các sự kiện từ Dashboard (ví dụ: skip, pause, stop, set_volume, 247_on/off, autoplay_on/off)
    socket.on('dashboard_command', async ({ command, guildId, value }) => {
        const audioManager = client.audioManagers.get(guildId);
        const queueManager = client.queueManagers.get(guildId);

        if (!audioManager) {
            socket.emit('dashboard_response', { status: 'error', message: 'Bot không hoạt động trong server này.' });
            return;
        }

        try {
            let success = false;
            let message = '';
            switch (command) {
                case 'skip':
                    success = await audioManager.skip();
                    message = success ? 'Đã bỏ qua bài hát.' : 'Không có bài hát nào để bỏ qua.';
                    break;
                case 'pause':
                    success = await audioManager.pause();
                    message = success ? 'Đã tạm dừng nhạc.' : 'Không có nhạc để tạm dừng.';
                    break;
                case 'resume':
                    success = await audioManager.resume();
                    message = success ? 'Đã tiếp tục nhạc.' : 'Không có nhạc để tiếp tục.';
                    break;
                case 'stop':
                    success = await audioManager.stop();
                    message = success ? 'Đã dừng nhạc.' : 'Bot không hoạt động.';
                    break;
                case 'set_volume':
                    success = audioManager.setVolume(value);
                    message = success ? `Đã đặt âm lượng thành ${value}%.` : 'Không thể thay đổi âm lượng.';
                    break;
                case '247_on':
                    if (queueManager) queueManager.set247(true);
                    success = true;
                    message = 'Chế độ 24/7 đã BẬT.';
                    break;
                case '247_off':
                    if (queueManager) queueManager.set247(false);
                    success = true;
                    message = 'Chế độ 24/7 đã TẮT.';
                    if (!audioManager.isPlaying() && queueManager && queueManager.getQueue().length === 0) {
                        await audioManager.stop(); // Tắt 24/7 và không có nhạc, bot rời kênh
                        message += ' Bot đã rời kênh.';
                    }
                    break;
                case 'autoplay_on':
                    if (queueManager) queueManager.setAutoplay(true);
                    success = true;
                    message = 'Chế độ Autoplay đã BẬT.';
                    break;
                case 'autoplay_off':
                    if (queueManager) queueManager.setAutoplay(false);
                    success = true;
                    message = 'Chế độ Autoplay đã TẮT.';
                    break;
                default:
                    message = 'Lệnh không hợp lệ.';
                    break;
            }
            socket.emit('dashboard_response', { status: success ? 'success' : 'error', message: message });
            // Cập nhật trạng thái bot cho tất cả các dashboard sau khi lệnh được xử lý
            const updatedGuilds = client.guilds.cache.map(guild => {
                const qm = client.queueManagers.get(guild.id);
                const am = client.audioManagers.get(guild.id);
                return {
                    id: guild.id,
                    name: guild.name,
                    memberCount: guild.memberCount,
                    queue: qm?.getQueue().map(s => s.info) || [],
                    nowPlaying: qm?.getCurrentSong()?.info || null,
                    isPlaying: am?.isPlaying() || false,
                    volume: am?.volume || 100,
                    is247: qm?.is247() || false,
                    isAutoplay: qm?.isAutoplay() || false
                };
            });
            io.emit('bot_status', {
                uptime: process.uptime(),
                guildCount: client.guilds.cache.size,
                userCount: client.users.cache.size,
                guilds: updatedGuilds
            });

        } catch (error) {
            console.error(`Lỗi khi xử lý lệnh Dashboard (${command}):`, error);
            socket.emit('dashboard_response', { status: 'error', message: `Lỗi khi xử lý lệnh: ${error.message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[DASHBOARD] Một Dashboard đã ngắt kết nối: ${socket.id}`);
    });
});


const WEB_PORT = process.env.WEB_PORT || 3000;
server.listen(WEB_PORT, () => {
    console.log(`[WEB SERVER] Dashboard web đang chạy tại http://localhost:${WEB_PORT}`);
});

// Load commands
const commandFolders = readdirSync('./src/commands');
for (const folder of commandFolders) {
    const subCommandFolders = readdirSync(`./src/commands/${folder}`); // Read sub-folders like music, general
    for (const subFolder of subCommandFolders) {
        const commandFiles = readdirSync(`./src/commands/${folder}/${subFolder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${subFolder}/${file}`);
            if (command.data) { // Ensure command has data property
                 client.commands.set(command.data.name, command);
            } else {
                 console.warn(`[COMMAND LOADER] Lệnh ${file} trong ${folder}/${subFolder} thiếu thuộc tính 'data'.`);
            }
        }
    }
}

// Load events
const eventFiles = readdirSync('./src/events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client, io)); // Truyền io instance
    } else {
        client.on(event.name, (...args) => event.execute(...args, client, io)); // Truyền io instance
    }
}

client.login(process.env.DISCORD_TOKEN);

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('Đang tắt bot...');
    for (const [guildId, audioManager] of client.audioManagers) {
        await audioManager.stop(); // Dừng tất cả các trình phát
    }
    io.close(() => console.log('[SOCKET.IO] Socket.IO server đã đóng.'));
    server.close(() => console.log('[WEB SERVER] Web server đã đóng.'));
    client.destroy();
    process.exit(0);
});

// Cập nhật trạng thái bot cho dashboard định kỳ (ví dụ mỗi 10 giây)
setInterval(() => {
    if (!client.isReady()) return; // Chỉ gửi nếu bot đã sẵn sàng

    const guilds = client.guilds.cache.map(guild => {
        const queueManager = client.queueManagers.get(guild.id);
        const audioManager = client.audioManagers.get(guild.id);
        return {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
            queue: queueManager?.getQueue().map(s => s.info) || [],
            nowPlaying: queueManager?.getCurrentSong()?.info || null,
            isPlaying: audioManager?.isPlaying() || false,
            volume: audioManager?.volume || 100,
            is247: queueManager?.is247() || false,
            isAutoplay: queueManager?.isAutoplay() || false
        };
    });

    io.emit('bot_status', {
        uptime: process.uptime(),
        guildCount: client.guilds.cache.size,
        userCount: client.users.cache.size,
        guilds: guilds
    });
}, 10000); // Gửi cập nhật mỗi 10 giây
