//...src/commands/music/seek.js
const { SlashCommandBuilder } = require('discord.js');
const AudioManager = require('../../modules/audioManager');
const QueueManager = require('../../modules/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Tua đến một thời điểm cụ thể trong bài hát đang phát (ví dụ: 1:30, 0:45).')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Thời điểm tua đến (phút:giây hoặc giây)')
                .setRequired(true)),
    async execute(interaction, client) {
        const member = interaction.member;
        const guild = interaction.guild;
        const timeString = interaction.options.getString('time');

        if (!member.voice.channel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        const audioManager = client.audioManagers.get(guild.id);
        const queueManager = client.queueManagers.get(guild.id);

        if (!audioManager || !queueManager || !queueManager.getCurrentSong() || !audioManager.isPlaying()) {
            return interaction.reply({ content: 'Không có bài hát nào đang phát để tua.', ephemeral: true });
        }

        let timeInSeconds;
        // Parse time string (e.g., "1:30" or "90")
        if (timeString.includes(':')) {
            const parts = timeString.split(':');
            if (parts.length === 2) {
                timeInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else if (parts.length === 3) { // HH:MM:SS
                timeInSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
            } else {
                return interaction.reply({ content: 'Định dạng thời gian không hợp lệ. Vui lòng dùng MM:SS hoặc SS.', ephemeral: true });
            }
        } else {
            timeInSeconds = parseInt(timeString);
        }

        if (isNaN(timeInSeconds) || timeInSeconds < 0) {
            return interaction.reply({ content: 'Thời điểm tua không hợp lệ.', ephemeral: true });
        }

        await interaction.deferReply();

        const currentSong = queueManager.getCurrentSong().info;
        const maxDurationSeconds = currentSong.duration_ms / 1000;

        if (timeInSeconds >= maxDurationSeconds) {
            return interaction.editReply(`Thời điểm tua (${formatDuration(timeInSeconds * 1000)}) vượt quá thời lượng bài hát (${currentSong.duration}).`);
        }

        const success = await audioManager.seek(timeInSeconds);

        if (success) {
            await interaction.editReply(`Đã tua đến thời điểm **${formatDuration(timeInSeconds * 1000)}**.`);
        } else {
            await interaction.editReply('Không thể tua bài hát. Đã có lỗi xảy ra.');
        }
    },
};

// Hàm định dạng thời lượng từ miligiây sang HH:MM:SS
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    const formattedHours = (hours < 10) ? "0" + hours : hours;
    const formattedMinutes = (minutes < 10) ? "0" + minutes : minutes;
    const formattedSeconds = (seconds < 10) ? "0" + seconds : seconds;

    if (hours > 0) {
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
        return `${formattedMinutes}:${formattedSeconds}`;
    }
}
