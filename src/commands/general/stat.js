//...src/commands/general/stat.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stat')
        .setDescription('Hiển thị thông tin thống kê của bot.'),
    async execute(interaction, client) {
        await interaction.deferReply();

        const uptime = process.uptime(); // Thời gian bot hoạt động tính bằng giây
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);

        const totalGuilds = client.guilds.cache.size;
        const totalChannels = client.channels.cache.size;
        const totalUsers = client.users.cache.size; // Lưu ý: Số lượng người dùng có thể không chính xác nếu không có GuildMembersIntent

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Thống kê của Project M')
            .addFields(
                { name: '📈 Máy chủ đang phục vụ', value: `${totalGuilds}`, inline: true },
                { name: '💬 Kênh', value: `${totalChannels}`, inline: true },
                { name: '👥 Người dùng', value: `${totalUsers}`, inline: true },
                { name: '⏰ Thời gian hoạt động', value: `${days}d ${hours}h ${minutes}m ${seconds}s` },
                { name: '🌐 Phiên bản Node.js', value: process.version, inline: true },
                { name: '⚙️ Phiên bản Discord.js', value: require('discord.js').version, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
