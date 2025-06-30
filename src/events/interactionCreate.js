//...src/events/interactionCreate.js
const { Events } = require('discord.js');
const QueueManager = require('../modules/queueManager');
const AudioManager = require('../modules/audioManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) { // KHÔNG TRUYỀN io NỮA
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Không tìm thấy lệnh ${interaction.commandName}.`);
            return;
        }

        try {
            await command.execute(interaction, interaction.client); // KHÔNG TRUYỀN io NỮA
        } catch (error) {
            console.error(`Lỗi khi thực hiện lệnh ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Đã có lỗi xảy ra khi thực hiện lệnh!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Đã có lỗi xảy ra khi thực hiện lệnh!', ephemeral: true });
            }
        }
        // Loại bỏ toàn bộ phần xử lý button và select menu để tối giản
    },
};
