//...src/commands/music/nowplaying.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');
const AudioManager = require('../../modules/audioManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Hiển thị thông tin bài hát đang phát.'),
    async execute(interaction, client) {
        const guild = interaction.guild;
        const queueManager = client.queueManagers.get(guild.id);
        const audioManager = client.audioManagers.get(guild.id);

        if (!queueManager || !queueManager.getCurrentSong() || !audioManager || !audioManager.isPlaying()) {
            return interaction.reply({ content: 'Hiện không có bài hát nào đang phát.', ephemeral: true });
        }

        await interaction.deferReply();

        const song = queueManager.getCurrentSong().info;

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎶 Đang phát')
            .setDescription(`**[${song.title}](${song.url})**\n`)
            .setThumbnail(song.thumbnail || null)
            .addFields(
                { name: 'Thời lượng', value: song.duration || 'N/A', inline: true },
                { name: 'Nghệ sĩ', value: song.artist || 'N/A', inline: true },
                { name: 'Album', value: song.album || 'N/A', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
