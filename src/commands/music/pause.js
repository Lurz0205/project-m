//...src/commands/music/pause.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng bài hát hiện tại.'),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        if (!audioManager || !audioManager.isPlaying()) {
            return interaction.reply({ content: 'Không có bài hát nào đang phát để tạm dừng!', ephemeral: true });
        }

        await interaction.deferReply();
        const paused = await audioManager.pause();

        if (paused) {
            await interaction.editReply('Đã tạm dừng bài hát.');
        } else {
            await interaction.editReply('Không thể tạm dừng bài hát.');
        }
    },
};
