const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Sẵn sàng! Đã đăng nhập với tên ${client.user.tag}`);
    },
};
