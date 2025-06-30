//...src/commands/music/volume.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Điều chỉnh âm lượng phát nhạc của bot.')
        .addIntegerOption(option =>
            option.setName('value')
                .setDescription('Giá trị âm lượng từ 1 đến 200 (mặc định 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(200)),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const volume = interaction.options.getInteger('value');

        if (!member.voice.channel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        if (!audioManager || !audioManager.isPlaying()) {
            return interaction.reply({ content: 'Bot không đang phát nhạc!', ephemeral: true });
        }

        await interaction.deferReply();
        const success = audioManager.setVolume(volume);

        if (success) {
            await interaction.editReply(`Đã điều chỉnh âm lượng lên **${volume}%**.`);
        } else {
            await interaction.editReply('Không thể điều chỉnh âm lượng. Có lẽ không có bài hát nào đang phát.');
        }
    },
};
