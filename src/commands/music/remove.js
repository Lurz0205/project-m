//...src/commands/music/remove.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Xóa một bài hát khỏi hàng chờ bằng số thứ tự.')
        .addIntegerOption(option =>
            option.setName('index')
                .setDescription('Số thứ tự của bài hát trong hàng chờ (/queue)')
                .setRequired(true)
                .setMinValue(1)),
    async execute(interaction, client) {
        const guild = interaction.guild;
        const index = interaction.options.getInteger('index');
        const member = interaction.member;

        if (!member.voice.channel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const queueManager = client.queueManagers.get(guild.id);

        if (!queueManager || queueManager.getQueue().length === 0) {
            return interaction.reply({ content: 'Hàng chờ trống, không có bài hát để xóa.', ephemeral: true });
        }

        await interaction.deferReply();

        const removedSong = queueManager.removeSong(index - 1); // Trừ 1 vì index bắt đầu từ 0 trong mảng

        if (removedSong) {
            await interaction.editReply(`Đã xóa **${removedSong.info.title}** khỏi hàng chờ.`);
        } else {
            await interaction.editReply(`Không tìm thấy bài hát với số thứ tự **${index}** trong hàng chờ.`);
        }
    },
};
