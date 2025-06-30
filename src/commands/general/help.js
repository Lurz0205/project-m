//...src/commands/general/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị danh sách các lệnh và hướng dẫn sử dụng bot.'),
    async execute(interaction, client) {
        await interaction.deferReply();

        const commands = client.commands;
        let musicCommands = '';
        let generalCommands = '';

        commands.forEach(command => {
            if (command.data.name === 'play' || command.data.name === 'skip' || command.data.name === 'stop' ||
                command.data.name === 'pause' || command.data.name === 'resume' || command.data.name === 'queue' ||
                command.data.name === 'nowplaying' || command.data.name === 'volume' || command.data.name === '247' ||
                command.data.name === 'autoplay' || command.data.name === 'seek') {
                musicCommands += `\`/${command.data.name}\`: ${command.data.description}\n`;
            } else {
                generalCommands += `\`/${command.data.name}\`: ${command.data.description}\n`;
            }
        });

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Danh sách lệnh của Project M')
            .setDescription('Dưới đây là các lệnh bạn có thể sử dụng:')
            .addFields(
                { name: '🎵 Lệnh Nhạc', value: musicCommands || 'Không có lệnh nhạc nào.' },
                { name: '✨ Lệnh Chung', value: generalCommands || 'Không có lệnh chung nào.' }
            )
            .setTimestamp()
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
