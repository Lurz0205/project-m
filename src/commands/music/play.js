const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube, Spotify, hoặc SoundCloud.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('URL hoặc tên bài hát bạn muốn phát.')
                .setRequired(true)),
    async execute(interaction, client) {
        const query = interaction.options.getString('query');
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        if (!guild.members.me.permissionsIn(voiceChannel).has('Connect') || !guild.members.me.permissionsIn(voiceChannel).has('Speak')) {
            return interaction.reply({ content: 'Tôi không có quyền tham gia hoặc nói trong kênh thoại này!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            // Check if there's an existing player, otherwise create one
            let player = client.voiceStates.get(guild.id)?.player;
            if (!player) {
                player = createAudioPlayer();
                client.voiceStates.set(guild.id, { connection, player, queue: [] });
            }

            connection.subscribe(player);

            // Fetch stream and handle different sources (YouTube, Spotify)
            let stream;
            let videoInfo;

            if (playdl.validate(query) === 'yt_video' || playdl.validate(query) === 'yt_playlist' || playdl.validate(query) === 'yt_channel') {
                // Handle YouTube
                const ytInfo = await playdl.video_info(query);
                videoInfo = {
                    title: ytInfo.video_details.title,
                    url: ytInfo.video_details.url,
                    thumbnail: ytInfo.video_details.thumbnail.url,
                };
                stream = await playdl.stream(query);
            } else if (playdl.validate(query) === 'spotify_track') {
                // Handle Spotify (requires you to implement the Spotify API logic)
                const spotifyHandler = require('../../modules/spotifyHandler');
                const track = await spotifyHandler.getTrackInfo(query);
                if (track) {
                    const searchResult = await playdl.search(`${track.title} ${track.artist}`, { limit: 1 });
                    if (searchResult.length > 0) {
                        const ytInfo = await playdl.video_info(searchResult[0].url);
                        videoInfo = {
                            title: ytInfo.video_details.title,
                            url: ytInfo.video_details.url,
                            thumbnail: ytInfo.video_details.thumbnail.url,
                        };
                        stream = await playdl.stream(searchResult[0].url);
                    } else {
                        return interaction.editReply('Không tìm thấy bài hát tương ứng trên YouTube.');
                    }
                } else {
                    return interaction.editReply('Không thể lấy thông tin bài hát từ Spotify.');
                }
            } else {
                // Handle search query
                const searchResults = await playdl.search(query, { limit: 1 });
                if (searchResults.length > 0) {
                    const ytInfo = await playdl.video_info(searchResults[0].url);
                    videoInfo = {
                        title: ytInfo.video_details.title,
                        url: ytInfo.video_details.url,
                        thumbnail: ytInfo.video_details.thumbnail.url,
                    };
                    stream = await playdl.stream(searchResults[0].url);
                } else {
                    return interaction.editReply('Không tìm thấy kết quả phù hợp với từ khóa của bạn.');
                }
            }

            const resource = createAudioResource(stream.stream, { inputType: stream.type });

            const currentQueue = client.voiceStates.get(guild.id).queue;
            currentQueue.push({ resource, info: videoInfo });

            if (player.state.status === AudioPlayerStatus.Playing) {
                return interaction.editReply(`Đã thêm **${videoInfo.title}** vào hàng chờ!`);
            }
            
            // Play the first item in the queue
            player.play(currentQueue[0].resource);
            client.voiceStates.get(guild.id).nowPlaying = currentQueue[0].info;

            await interaction.editReply({ content: `Đang phát: **${videoInfo.title}**` });

            // Event listener for when the track ends
            player.on(AudioPlayerStatus.Idle, () => {
                const updatedQueue = client.voiceStates.get(guild.id).queue;
                updatedQueue.shift(); // Remove the finished track
                if (updatedQueue.length > 0) {
                    player.play(updatedQueue[0].resource);
                    client.voiceStates.get(guild.id).nowPlaying = updatedQueue[0].info;
                    interaction.channel.send(`Tiếp theo: **${updatedQueue[0].info.title}**`);
                } else {
                    // Disconnect if queue is empty (unless 24/7 mode is on)
                    // You'll need to add logic for 24/7 mode here.
                    client.voiceStates.get(guild.id).connection.destroy();
                    client.voiceStates.delete(guild.id);
                }
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Đã có lỗi xảy ra khi phát nhạc. Vui lòng thử lại sau.');
        }
    },
};
