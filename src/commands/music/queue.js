//...src/commands/music/queue.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Hiển thị danh sách các bài hát trong hàng chờ.')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Trang hàng chờ muốn xem')
                .setMinValue(1)
                .setRequired(false)),
    async execute(interaction, client) {
        const guild = interaction.guild;
        const queueManager = client.queueManagers.get(guild.id);

        if (!queueManager || (queueManager.getQueue().length === 0 && !queueManager.getCurrentSong())) {
            return interaction.reply({ content: 'Hàng chờ rỗng. Hãy thêm bài hát vào!', ephemeral: true });
        }

        await interaction.deferReply();

        const queue = queueManager.getQueue();
        const nowPlaying = queueManager.getCurrentSong();
        const itemsPerPage = 10;
        const totalPages = Math.ceil(queue.length / itemsPerPage);
        const page = interaction.options.getInteger('page') || 1;

        if (page < 1 || page > totalPages && totalPages > 0) {
            return interaction.editReply({ content: `Trang không hợp lệ. Vui lòng nhập số từ 1 đến ${totalPages}.` });
        }

        let description = '';
        if (nowPlaying) {
            description += `**Đang phát:** [${nowPlaying.info.title}](${nowPlaying.info.url})\n\n`;
        } else {
            description += '**Không có bài hát nào đang phát.**\n\n';
        }

        if (queue.length === 0) {
            description += 'Hàng chờ trống.';
        } else {
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, queue.length);

            const songsOnPage = queue.slice(startIndex, endIndex);

            songsOnPage.forEach((song, index) => {
                description += `${startIndex + index + 1}. [${song.info.title}](${song.info.url})\n`;
            });

            if (totalPages > 1) {
                description += `\n**Trang ${page}/${totalPages}**`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Hàng chờ của ${guild.name}`)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
