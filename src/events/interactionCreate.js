//...src/events/interactionCreate.js
const { Events, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const QueueManager = require('../modules/queueManager'); // Đảm bảo đúng đường dẫn
const AudioManager = require('../modules/audioManager'); // Đảm bảo đúng đường dẫn

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, io) {
        // Xử lý Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`Không tìm thấy lệnh ${interaction.commandName}.`);
                return;
            }

            try {
                await command.execute(interaction, interaction.client, io); // Truyền io instance
            } catch (error) {
                console.error(`Lỗi khi thực hiện lệnh ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Đã có lỗi xảy ra khi thực hiện lệnh!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Đã có lỗi xảy ra khi thực hiện lệnh!', ephemeral: true });
                }
            }
        }
        // Xử lý Button Interactions
        else if (interaction.isButton()) {
            const { customId, guild, member, channel } = interaction;
            const queueManager = client.queueManagers.get(guild.id);
            const audioManager = client.audioManagers.get(guild.id);

            // Kiểm tra quyền của người dùng (tùy chọn, có thể thêm DJ role check)
            if (!member.voice.channel || member.voice.channel.id !== audioManager?.connection?.joinConfig.channelId) {
                return interaction.reply({ content: 'Bạn phải ở trong cùng kênh thoại với bot để điều khiển nhạc!', ephemeral: true });
            }

            await interaction.deferUpdate(); // Defer the button interaction

            let replyContent = '';
            let updateMessage = false; // Cờ để quyết định có cập nhật embed không

            try {
                switch (customId) {
                    case 'music_pause_play':
                        if (audioManager.isPlaying()) {
                            await audioManager.pause();
                            replyContent = 'Đã tạm dừng nhạc.';
                            updateMessage = true;
                        } else {
                            await audioManager.resume();
                            replyContent = 'Đã tiếp tục phát nhạc.';
                            updateMessage = true;
                        }
                        break;
                    case 'music_skip':
                        await audioManager.skip();
                        replyContent = 'Đã bỏ qua bài hát.';
                        updateMessage = true; // Cần cập nhật để hiển thị bài hát tiếp theo
                        break;
                    case 'music_stop':
                        await audioManager.stop();
                        replyContent = 'Đã dừng phát nhạc và ngắt kết nối.';
                        updateMessage = true; // Cập nhật để ẩn các controls
                        break;
                    case 'music_loop':
                        if (!queueManager) return; // Should not happen if bot is playing
                        const currentLoopMode = queueManager.getLoopMode();
                        let newLoopMode;
                        let loopMessage;
                        if (currentLoopMode === 'off') {
                            newLoopMode = 'song';
                            loopMessage = 'Lặp bài hát hiện tại (Song)';
                        } else if (currentLoopMode === 'song') {
                            newLoopMode = 'queue';
                            loopMessage = 'Lặp lại hàng chờ (Queue)';
                        } else {
                            newLoopMode = 'off';
                            loopMessage = 'Tắt lặp (Off)';
                        }
                        queueManager.setLoopMode(newLoopMode);
                        replyContent = `Đã đặt chế độ lặp: **${loopMessage}**`;
                        updateMessage = true; // Cập nhật trạng thái nút
                        break;
                    case 'music_queue_menu':
                        if (!queueManager || queueManager.getQueue().length === 0) {
                            return interaction.followUp({ content: 'Hàng chờ trống để quản lý.', ephemeral: true });
                        }
                        // Gửi Select Menu để quản lý hàng chờ
                        const queueOptions = queueManager.getQueue().slice(0, 25).map((song, index) => ({ // Tối đa 25 lựa chọn
                            label: `${index + 1}. ${song.info.title.substring(0, 50)}`, // Giới hạn 50 ký tự
                            value: `${index}`, // Sử dụng index để xóa
                            description: song.info.artist ? `Bởi ${song.info.artist.substring(0, 100)}` : undefined // Giới hạn 100 ký tự
                        }));

                        if (queueOptions.length === 0) {
                             return interaction.followUp({ content: 'Hàng chờ trống để quản lý.', ephemeral: true });
                        }

                        const selectRow = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('queue_select_action')
                                    .setPlaceholder('Chọn bài hát để xóa hoặc nhảy tới...')
                                    .addOptions(queueOptions),
                            );
                        // Cần gửi followUp để không bị lỗi "Unknown interaction"
                        await interaction.followUp({
                            content: 'Chọn bài hát từ hàng chờ để thực hiện hành động:',
                            components: [selectRow],
                            ephemeral: true // Chỉ hiển thị cho người dùng tương tác
                        });
                        break;
                    default:
                        break;
                }
            } catch (error) {
                console.error(`Lỗi khi xử lý tương tác nút [${customId}]:`, error);
                await interaction.followUp({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.', ephemeral: true });
            }

            // Sau khi xử lý lệnh, gửi phản hồi tạm thời cho người dùng
            if (replyContent) {
                await interaction.followUp({ content: replyContent, ephemeral: true });
            }

            // Nếu cần cập nhật message gốc (ví dụ: message của lệnh /play)
            if (updateMessage && channel.type === ChannelType.GuildText) {
                const playingMessage = client.playingMessages.get(guild.id);
                if (playingMessage && playingMessage.channelId === channel.id) {
                    const embed = new EmbedBuilder(playingMessage.embeds[0]); // Clone embed
                    const actionRow = createMusicControlButtons(audioManager.isPlaying(), queueManager.getLoopMode()); // Tạo lại ActionRow

                    // Cập nhật trường nowPlaying trong embed nếu bài hát thay đổi
                    const nowPlaying = queueManager?.getCurrentSong()?.info;
                    if (nowPlaying) {
                        embed.setDescription(`**[${nowPlaying.title}](${nowPlaying.url})**\nNghệ sĩ: ${nowPlaying.artist || 'N/A'}\nAlbum: ${nowPlaying.album || 'N/A'}`);
                        embed.setThumbnail(nowPlaying.thumbnail || null);
                    } else {
                        embed.setDescription('Không có bài hát nào đang phát.');
                        embed.setThumbnail(null);
                    }

                    await playingMessage.edit({ embeds: [embed], components: [actionRow] }).catch(err => console.error("Lỗi cập nhật tin nhắn chơi nhạc:", err));
                }
            }

        }
        // Xử lý Select Menu Interactions (từ nút "Queue Menu")
        else if (interaction.isStringSelectMenu()) {
            const { customId, guild, member, values, channel } = interaction;
            const queueManager = client.queueManagers.get(guild.id);
            const audioManager = client.audioManagers.get(guild.id);

            // Kiểm tra quyền của người dùng
            if (!member.voice.channel || member.voice.channel.id !== audioManager?.connection?.joinConfig.channelId) {
                return interaction.reply({ content: 'Bạn phải ở trong cùng kênh thoại với bot để điều khiển nhạc!', ephemeral: true });
            }

            await interaction.deferUpdate(); // Defer the select menu interaction

            try {
                if (customId === 'queue_select_action') {
                    const selectedIndex = parseInt(values[0]); // Lấy index của bài hát được chọn
                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`queue_remove_${selectedIndex}`)
                                .setLabel('Xóa')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`queue_jump_${selectedIndex}`)
                                .setLabel('Nhảy tới')
                                .setStyle(ButtonStyle.Primary),
                        );
                    
                    // Gửi một tin nhắn mới với các nút hành động cho bài hát đã chọn
                    await interaction.followUp({
                        content: `Bạn muốn làm gì với bài hát thứ **${selectedIndex + 1}**?`,
                        components: [actionRow],
                        ephemeral: true
                    });
                } else if (customId.startsWith('queue_')) { // Xử lý các nút hành động từ select menu
                    const parts = customId.split('_'); // e.g., 'queue', 'remove', 'index'
                    const action = parts[1]; // 'remove' or 'jump'
                    const songIndex = parseInt(parts[2]);

                    if (action === 'remove') {
                        const removedSong = queueManager.removeSong(songIndex);
                        if (removedSong) {
                            await interaction.followUp({ content: `Đã xóa **${removedSong.info.title}** khỏi hàng chờ.`, ephemeral: true });
                        } else {
                            await interaction.followUp({ content: 'Không thể xóa bài hát này.', ephemeral: true });
                        }
                    } else if (action === 'jump') {
                        const success = await audioManager.jumpToSong(songIndex); // Cần triển khai jumpToSong trong audioManager
                        if (success) {
                            await interaction.followUp({ content: `Đã chuyển đến bài hát thứ **${songIndex + 1}** trong hàng chờ.`, ephemeral: true });
                        } else {
                            await interaction.followUp({ content: 'Không thể chuyển đến bài hát này.', ephemeral: true });
                        }
                    }
                     // Cập nhật lại message của play command sau khi hành động
                     if (channel.type === ChannelType.GuildText) {
                        const playingMessage = client.playingMessages.get(guild.id);
                        if (playingMessage && playingMessage.channelId === channel.id) {
                            const embed = new EmbedBuilder(playingMessage.embeds[0]);
                            const actionRow = createMusicControlButtons(audioManager.isPlaying(), queueManager.getLoopMode());
                            const nowPlaying = queueManager?.getCurrentSong()?.info;
                            if (nowPlaying) {
                                embed.setDescription(`**[${nowPlaying.title}](${nowPlaying.url})**\nNghệ sĩ: ${nowPlaying.artist || 'N/A'}\nAlbum: ${nowPlaying.album || 'N/A'}`);
                                embed.setThumbnail(nowPlaying.thumbnail || null);
                            } else {
                                embed.setDescription('Không có bài hát nào đang phát.');
                                embed.setThumbnail(null);
                            }
                            await playingMessage.edit({ embeds: [embed], components: [actionRow] }).catch(err => console.error("Lỗi cập nhật tin nhắn chơi nhạc sau hành động select menu:", err));
                        }
                    }
                }
            } catch (error) {
                console.error(`Lỗi khi xử lý tương tác Select Menu [${customId}]:`, error);
                await interaction.followUp({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.', ephemeral: true });
            }
        }
    },
};

/**
 * Hàm tạo các nút điều khiển nhạc.
 * @param {boolean} isPlaying - Bot đang phát nhạc hay không.
 * @param {string} loopMode - Chế độ lặp lại ('off', 'song', 'queue').
 * @returns {ActionRowBuilder} Hàng chứa các nút điều khiển.
 */
function createMusicControlButtons(isPlaying, loopMode) {
    const playPauseButton = new ButtonBuilder()
        .setCustomId('music_pause_play')
        .setLabel(isPlaying ? 'Tạm dừng' : 'Tiếp tục')
        .setStyle(isPlaying ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setEmoji(isPlaying ? '⏸️' : '▶️');

    const skipButton = new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('Bỏ qua')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏭️');

    const stopButton = new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('Dừng')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️');

    let loopButtonLabel;
    let loopButtonStyle;
    switch (loopMode) {
        case 'off':
            loopButtonLabel = 'Lặp: Tắt';
            loopButtonStyle = ButtonStyle.Secondary;
            break;
        case 'song':
            loopButtonLabel = 'Lặp: Bài hát';
            loopButtonStyle = ButtonStyle.Success;
            break;
        case 'queue':
            loopButtonLabel = 'Lặp: Hàng chờ';
            loopButtonStyle = ButtonStyle.Success;
            break;
    }

    const loopButton = new ButtonBuilder()
        .setCustomId('music_loop')
        .setLabel(loopButtonLabel)
        .setStyle(loopButtonStyle)
        .setEmoji('🔁');

    const queueMenuButton = new ButtonBuilder()
        .setCustomId('music_queue_menu')
        .setLabel('Hàng chờ (Menu)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📜');

    return new ActionRowBuilder()
        .addComponents(playPauseButton, skipButton, stopButton, loopButton, queueMenuButton);
}
