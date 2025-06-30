//...src/commands/music/loop.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Đặt chế độ lặp lại cho bài hát hoặc hàng chờ.')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Chế độ lặp lại')
                .setRequired(true)
                .addChoices(
                    { name: 'Tắt lặp (Off)', value: 'off' },
                    { name: 'Lặp bài hát hiện tại (Song)', value: 'song' },
                    { name: 'Lặp lại hàng chờ (Queue)', value: 'queue' },
                )),
    async execute(interaction, client) {
        const guild = interaction.guild;
        const member = interaction.member;
        const mode = interaction.options.getString('mode');

        if (!member.voice.channel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const queueManager = client.queueManagers.get(guild.id);
        const audioManager = client.audioManagers.get(guild.id);

        if (!audioManager || (!audioManager.isPlaying() && !queueManager?.is247())) {
            return interaction.reply({ content: 'Bot không đang phát nhạc hoặc không hoạt động.', ephemeral: true });
        }

        await interaction.deferReply();

        if (queueManager) {
            queueManager.setLoopMode(mode);
            let replyMessage;
            switch (mode) {
                case 'off':
                    replyMessage = 'Đã tắt chế độ lặp lại.';
                    break;
                case 'song':
                    replyMessage = 'Đã đặt chế độ lặp lại **bài hát hiện tại**.';
                    break;
                case 'queue':
                    replyMessage = 'Đã đặt chế độ lặp lại **toàn bộ hàng chờ**.';
                    break;
            }
            await interaction.editReply(replyMessage);
        } else {
            await interaction.editReply('Không thể đặt chế độ lặp lại. Bot chưa hoạt động trong server này.');
        }
    },
};
