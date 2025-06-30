//...src/commands/music/stop.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc và ngắt kết nối.'),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        if (!audioManager || (!audioManager.isPlaying() && !client.queueManagers.get(guild.id)?.is247())) {
            return interaction.reply({ content: 'Bot không đang phát nhạc hoặc không ở chế độ 24/7!', ephemeral: true });
        }

        await interaction.deferReply();
        const stopped = await audioManager.stop();

        if (stopped) {
            await interaction.editReply('Đã dừng phát nhạc và ngắt kết nối.');
        } else {
            await interaction.editReply('Đã có lỗi khi dừng bot.');
        }
    },
};
