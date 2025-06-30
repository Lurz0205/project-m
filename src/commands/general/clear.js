//...src/commands/general/clear.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Xóa một số lượng tin nhắn nhất định trong kênh hiện tại (tối đa 100).')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Số lượng tin nhắn muốn xóa (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        // Kiểm tra quyền của người dùng để quản lý tin nhắn
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: 'Bạn không có quyền `Quản lý tin nhắn` để sử dụng lệnh này!', ephemeral: true });
        }

        // Kiểm tra quyền của bot để quản lý tin nhắn
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: 'Tôi không có quyền `Quản lý tin nhắn` để thực hiện lệnh này!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const fetched = await interaction.channel.messages.fetch({ limit: amount });
            const deletedMessages = await interaction.channel.bulkDelete(fetched, true); // true để bỏ qua các tin nhắn quá cũ (trên 14 ngày)
            await interaction.editReply(`Đã xóa thành công ${deletedMessages.size} tin nhắn.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('Đã có lỗi xảy ra khi xóa tin nhắn. Vui lòng đảm bảo các tin nhắn không quá 14 ngày tuổi.');
        }
    },
};
