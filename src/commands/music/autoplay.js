//...src/commands/music/autoplay.js
const { SlashCommandBuilder } = require('discord.js');
const QueueManager = require('../../modules/queueManager');
const AudioManager = require('../../modules/audioManager'); // Để kiểm tra bot có trong kênh thoại không

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Bật/tắt chế độ tự động phát nhạc liên quan khi hàng chờ trống.')
        .addStringOption(option =>
            option.setName('state')
                .setDescription('Bật hoặc tắt chế độ Autoplay')
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
            queueManager.setAutoplay(true);
            await interaction.editReply('Chế độ Autoplay đã được **BẬT**. Bot sẽ tự động tìm nhạc liên quan khi hàng chờ trống.');
        } else {
            queueManager.setAutoplay(false);
            await interaction.editReply('Chế độ Autoplay đã được **TẮT**.');
        }
    },
};
