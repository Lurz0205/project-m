//...src/commands/music/247.js
const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');
const AudioManager = require('../../modules/audioManager'); // Để kiểm tra bot có trong kênh thoại không

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Bật/tắt chế độ 24/7 (bot sẽ không rời kênh thoại).')
        .addStringOption(option =>
            option.setName('state')
                .setDescription('Bật hoặc tắt chế độ 24/7')
                .setRequired(true)
                .addChoices(
                    { name: 'Bật', value: 'on' },
                    { name: 'Tắt', value: 'off' },
                )),
    async execute(interaction, client) {
        const guild = interaction.guild;
        const state = interaction.options.getString('state');
        const queueManager = QueueManager.getOrCreate(guild.id, client);
        const audioManager = client.audioManagers.get(guild.id);

        if (!audioManager || !audioManager.connection) {
            return interaction.reply({ content: 'Bot không đang ở trong kênh thoại. Vui lòng phát nhạc trước.', ephemeral: true });
        }

        await interaction.deferReply();

        if (state === 'on') {
            queueManager.set247(true);
            await interaction.editReply('Chế độ 24/7 đã được **BẬT**. Bot sẽ không rời kênh thoại.');
        } else {
            queueManager.set247(false);
            if (!audioManager.isPlaying() && queueManager.getQueue().length === 0) {
                 // Nếu không phát và hàng chờ trống, bot có thể rời kênh
                 await audioManager.stop(); // Dừng và ngắt kết nối
                 await interaction.editReply('Chế độ 24/7 đã được **TẮT**. Bot đã rời kênh thoại do không có nhạc.');
            } else {
                await interaction.editReply('Chế độ 24/7 đã được **TẮT**. Bot sẽ rời kênh khi hàng chờ hết hoặc không có nhạc.');
            }
        }
    },
};
