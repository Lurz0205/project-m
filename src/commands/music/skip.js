//...src/commands/music/skip.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài hát hiện tại.'),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        if (!audioManager || !audioManager.isPlaying()) {
            return interaction.reply({ content: 'Không có bài hát nào đang phát để bỏ qua!', ephemeral: true });
        }

        await interaction.deferReply();
        const skipped = await audioManager.skip();

        if (skipped) {
            await interaction.editReply('Đã bỏ qua bài hát hiện tại.');
        } else {
            await interaction.editReply('Không thể bỏ qua bài hát. Có lẽ không có bài nào đang phát.');
        }
    },
};
