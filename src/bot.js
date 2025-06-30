//...src/bot.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const express = require('express');
require('dotenv').config();

console.log('[DEBUG] Bắt đầu khởi tạo bot.js...');

// Xử lý các lỗi không được bắt (uncaught exceptions) và promise bị từ chối không được xử lý (unhandled rejections)
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
    // Ghi lỗi vào một file log hoặc gửi thông báo đến kênh admin nếu cần
    // Để bot không crash ngay lập tức trong môi trường sản xuất, nhưng vẫn thông báo lỗi
});

process.on('uncaughtException', (err, origin) => {
    console.error('[ERROR] Uncaught Exception:', err, 'at origin:', origin);
    // Ghi lỗi vào một file log hoặc gửi thông báo đến kênh admin nếu cần
    // Có thể thực hiện graceful shutdown ở đây nếu lỗi nghiêm trọng
    process.exit(1); // Thoát ứng dụng sau khi báo lỗi nghiêm trọng
});


// Khởi tạo các module quản lý
try {
    const QueueManager = require('./modules/queueManager');
    const AudioManager = require('./modules/audioManager');
    const SpotifyHandler = require('./modules/spotifyHandler');

    // Gán các Manager/Handler cho client để dễ dàng truy cập
    client.queueManagers = new Collection();
    client.audioManagers = new Collection();
    client.spotifyHandler = SpotifyHandler;
    client.playingMessages = new Collection(); // MỚI: Lưu trữ tin nhắn điều khiển nhạc của mỗi guild

    console.log('[DEBUG] Đã tải và khởi tạo các module quản lý.');

} catch (error) {
    console.error('[ERROR] Lỗi khi tải hoặc khởi tạo modules:', error.message);
    process.exit(1); // Thoát nếu lỗi modules
}


const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server);

console.log('[DEBUG] Đã khởi tạo Express, HTTP server và Socket.IO.');

const WEB_PORT = process.env.PORT || process.env.WEB_PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Quan trọng để đếm user và một số tính năng khác
        GatewayIntentBits.DirectMessages, // Tùy chọn nếu bot tương tác DM
        GatewayIntentBits.GuildPresences, // Tùy chọn nếu muốn theo dõi trạng thái hiện diện (presence)
    ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

console.log('[DEBUG] Client Discord đã được khởi tạo.');

app.use(express.static('src/web/public'));

io.on('connection', (socket) => {
    console.log(`[DASHBOARD] Một Dashboard đã kết nối: ${socket.id}`);
    // Gửi trạng thái hiện tại của bot đến dashboard khi nó kết nối
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
            isAutoplay: queueManager?.isAutoplay() || false,
            loopMode: queueManager?.getLoopMode() || 'off'
        };
    });
    socket.emit('bot_status', {
        uptime: process.uptime(),
        guildCount: client.guilds.cache.size,
        userCount: client.users.cache.size,
        guilds: guilds
    });

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
                        await audioManager.stop();
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
                case 'set_loop_off':
                    if (queueManager) queueManager.setLoopMode('off');
                    success = true;
                    message = 'Chế độ lặp đã TẮT.';
                    break;
                case 'set_loop_song':
                    if (queueManager) queueManager.setLoopMode('song');
                    success = true;
                    message = 'Đã đặt lặp bài hát.';
                    break;
                case 'set_loop_queue':
                    if (queueManager) queueManager.setLoopMode('queue');
                    success = true;
                    message = 'Đã đặt lặp hàng chờ.';
                    break;
                case 'remove_song_by_index':
                    const removed = queueManager.removeSong(value); // Value is the 0-indexed position
                    success = !!removed;
                    message = success ? `Đã xóa **${removed.info.title}** khỏi hàng chờ.` : `Không thể xóa bài hát ở vị trí ${value + 1}.`;
                    break;
                case 'jump_to_song_by_index':
                    const jumpSuccess = await audioManager.seek(0, value); // seek(timeInSeconds, queueIndex)
                    success = jumpSuccess;
                    message = success ? `Đã nhảy đến bài hát thứ ${value + 1}.` : `Không thể nhảy đến bài hát thứ ${value + 1}.`;
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
                    isAutoplay: qm?.isAutoplay() || false,
                    loopMode: qm?.getLoopMode() || 'off'
                };
            });
            io.emit('bot_status', {
                uptime: process.uptime(),
                guildCount: client.guilds.cache.size,
                userCount: client.users.cache.size,
                guilds: updatedGuilds
            });

        } catch (error) {
            console.error(`[ERROR] Lỗi khi xử lý lệnh Dashboard (${command}):`, error);
            socket.emit('dashboard_response', { status: 'error', message: `Lỗi khi xử lý lệnh: ${error.message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[DASHBOARD] Một Dashboard đã ngắt kết nối: ${socket.id}`);
    });
});

server.listen(WEB_PORT, () => {
    console.log(`[WEB SERVER] Dashboard web đang chạy tại http://localhost:${WEB_PORT}`);
}).on('error', (err) => {
    console.error(`[ERROR] Lỗi khi khởi động Web Server: ${err.message}`);
    process.exit(1); // Thoát nếu không khởi động được web server
});

console.log('[DEBUG] Bắt đầu tải Commands...');
try {
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
} catch (error) {
    console.error('[ERROR] Lỗi khi tải Commands:', error.message);
    process.exit(1);
}


console.log('[DEBUG] Bắt đầu tải Events...');
try {
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
} catch (error) {
    console.error('[ERROR] Lỗi khi tải Events:', error.message);
    process.exit(1);
}


console.log('[DEBUG] Bắt đầu đăng nhập Discord...');
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log('[DEBUG] Đã gọi client.login(), chờ sự kiện ready...');
}).catch(err => {
    console.error('[ERROR] Lỗi khi đăng nhập Discord:', err.message);
    process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('[INFO] Đang tắt bot...');
    try {
        for (const [guildId, audioManager] of client.audioManagers) {
            await audioManager.stop();
        }
        io.close(() => console.log('[INFO] Socket.IO server đã đóng.'));
        server.close(() => console.log('[INFO] Web server đã đóng.'));
        client.destroy();
        console.log('[INFO] Bot đã tắt thành công.');
    } catch (cleanupErr) {
        console.error('[ERROR] Lỗi trong quá trình tắt bot:', cleanupErr.message);
    } finally {
        process.exit(0);
    }
});

// Cập nhật trạng thái bot cho dashboard định kỳ
setInterval(() => {
    if (!client.isReady()) {
        // console.log('[DEBUG] Bot chưa sẵn sàng để gửi trạng thái dashboard.');
        return;
    }

    const guilds = client.guilds.cache.map(guild => {
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
            isAutoplay: qm?.isAutoplay() || false,
            loopMode: qm?.getLoopMode() || 'off'
        };
    });

    io.emit('bot_status', {
        uptime: process.uptime(),
        guildCount: client.guilds.cache.size,
        userCount: client.users.cache.size,
        guilds: guilds
    });
}, 10000); // Gửi cập nhật mỗi 10 giây
