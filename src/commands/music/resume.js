//...src/commands/music/resume.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Tiếp tục phát nhạc.'),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        if (!audioManager || audioManager.isPlaying()) {
            return interaction.reply({ content: 'Không có bài hát nào đang tạm dừng để tiếp tục!', ephemeral: true });
        }

        await interaction.deferReply();
        const resumed = await audioManager.resume();

        if (resumed) {
            await interaction.editReply('Đã tiếp tục phát nhạc.');
        } else {
            await interaction.editReply('Không thể tiếp tục phát nhạc.');
        }
    },
};
