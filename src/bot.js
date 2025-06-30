//...src/bot.js
// Đây là phiên bản bot tối giản chỉ để debug lỗi khởi động trên Render.
// KHÔNG CÓ CÁC CHỨC NĂNG NHẠC, WEB DASHBOARD, HOẶC LỆNH NÀO KHÁC.

const { Client, GatewayIntentBits } = require('discord.js');
// Đảm bảo thư viện dotenv đã được cài đặt và hoạt động để đọc biến môi trường
require('dotenv').config();

console.log('[DEBUG_MINIMAL] Bắt đầu khởi tạo bot TỐI GIẢN...');
console.log(`[DEBUG_MINIMAL] Discord Token đọc được: ${process.env.DISCORD_TOKEN ? 'CÓ' : 'KHÔNG'}`);
console.log(`[DEBUG_MINIMAL] Discord Client ID đọc được: ${process.env.DISCORD_CLIENT_ID ? 'CÓ' : 'KHÔNG'}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Bắt buộc cho Discord bot
        GatewayIntentBits.GuildMessages,    // Để bot có thể đọc tin nhắn và tương tác cơ bản
        GatewayIntentBits.GuildVoiceStates, // Để bot biết trạng thái kênh thoại
        GatewayIntentBits.MessageContent,   // Cần thiết để đọc nội dung tin nhắn nếu bạn dùng tin nhắn thường
        GatewayIntentBits.GuildMembers,     // Cần để quản lý thành viên (ví dụ: đếm số user chính xác)
        GatewayIntentBits.GuildPresences    // Tùy chọn, để xem trạng thái online/offline của thành viên
    ],
});

client.once('ready', () => {
    console.log(`[DEBUG_MINIMAL] Bot TỐI GIẢN ĐÃ SẴN SÀNG! Đã đăng nhập với tên ${client.user.tag}`);
    console.log(`[DEBUG_MINIMAL] Bot đang ở ${client.guilds.cache.size} server.`);
    console.log('[DEBUG_MINIMAL] ✅ Triển khai có vẻ thành công!');
    // Không cần dừng bot ở đây, để Render thấy bot online
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('[DEBUG_MINIMAL] Đã gọi client.login(), đang chờ sự kiện ready...');
    })
    .catch(error => {
        console.error(`[ERROR_MINIMAL] Lỗi khi đăng nhập Discord: ${error.message}`);
        console.error(`[ERROR_MINIMAL] Vui lòng kiểm tra lại DISCORD_TOKEN trong biến môi trường Render.`);
        process.exit(1); // Thoát nếu lỗi đăng nhập
    });

console.log('[DEBUG_MINIMAL] Kết thúc file bot.js tối giản.');

// Không có code cho Express, Socket.IO, Commands, Events (ngoại trừ ready)
// Hoàn toàn không có logic phức tạp nào khác.
