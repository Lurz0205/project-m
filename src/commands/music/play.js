//...src/commands/music/play.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // Loại bỏ ActionRowBuilder, ButtonBuilder, ButtonStyle
const { createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const QueueManager = require('../../modules/queueManager');
const AudioManager = require('../../modules/audioManager');
const SpotifyHandler = require('../../modules/spotifyHandler');
// KHÔNG IMPORT createMusicControlButtons NỮA

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube, Spotify, hoặc SoundCloud.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('URL hoặc tên bài hát bạn muốn phát.')
                .setRequired(true)),
    async execute(interaction, client) { // KHÔNG TRUYỀN io NỮA
        const query = interaction.options.getString('query');
        const member = interaction.member;
        const guild = interaction.guild;
        const voiceChannel = member.voice.channel;
        // KHÔNG CẦN textChannel NỮA (nếu không gửi buttons/embeds)

        if (!voiceChannel) {
            return interaction.reply({ content: 'Bạn phải ở trong kênh thoại để sử dụng lệnh này!', ephemeral: true });
        }

        if (!guild.members.me.permissionsIn(voiceChannel).has('Connect') || !guild.members.me.permissionsIn(voiceChannel).has('Speak')) {
            return interaction.reply({ content: 'Tôi không có quyền tham gia hoặc nói trong kênh thoại này!', ephemeral: true });
        }

        await interaction.deferReply();

        const queueManager = QueueManager.getOrCreate(guild.id, client); // KHÔNG TRUYỀN io NỮA
        const audioManager = AudioManager.getOrCreate(guild.id, client); // KHÔNG TRUYỀN io NỮA

        try {
            await audioManager.join(voiceChannel);

            let songsToAdd = [];
            let initialReplyContent = '';

            if (playdl.validate(query) === 'yt_video' || playdl.validate(query) === 'yt_playlist' || playdl.validate(query) === 'yt_channel') {
                if (playdl.validate(query) === 'yt_playlist') {
                    const playlist = await playdl.playlist_info(query, { incomplete: true });
                    const videos = await playlist.all_videos();
                    for (const video of videos) {
                        const stream = await playdl.stream(video.url);
                        songsToAdd.push({
                            resource: createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true }),
                            info: {
                                title: video.title,
                                url: video.url,
                                thumbnail: video.thumbnails[0]?.url || null,
                                duration: video.durationRaw,
                                duration_ms: video.durationInSec * 1000
                            }
                        });
                    }
                    initialReplyContent = `Đã thêm ${songsToAdd.length} bài hát từ playlist YouTube vào hàng chờ!`;
                } else {
                    const ytInfo = await playdl.video_info(query);
                    const videoDetails = ytInfo.video_details;
                    const stream = await playdl.stream(query);
                    songsToAdd.push({
                        resource: createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true }),
                        info: {
                            title: videoDetails.title,
                            url: videoDetails.url,
                            thumbnail: videoDetails.thumbnails[0]?.url || null,
                            duration: videoDetails.durationRaw,
                            duration_ms: videoDetails.durationInSec * 1000
                        }
                    });
                    initialReplyContent = `Đã thêm **${videoDetails.title}** vào hàng chờ!`;
                }
            } else if (playdl.validate(query) === 'spotify_track') {
                const trackInfo = await SpotifyHandler.getTrackInfo(query);
                if (trackInfo) {
                    const searchResult = await playdl.search(`${trackInfo.title} ${trackInfo.artist}`, { limit: 1 });
                    if (searchResult.length > 0) {
                        const ytInfo = await playdl.video_info(searchResult[0].url);
                        const stream = await playdl.stream(searchResult[0].url);
                        songsToAdd.push({
                            resource: createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true }),
                            info: {
                                title: trackInfo.title,
                                url: searchResult[0].url,
                                thumbnail: trackInfo.thumbnail || searchResult[0].thumbnails[0]?.url || null,
                                artist: trackInfo.artist,
                                album: trackInfo.album,
                                duration_ms: trackInfo.duration_ms,
                                duration: formatDuration(trackInfo.duration_ms)
                            }
                        });
                        initialReplyContent = `Đã thêm **${trackInfo.title}** (Spotify qua YouTube) vào hàng chờ!`;
                    } else {
                        return interaction.editReply('Không tìm thấy bài hát tương ứng trên YouTube.');
                    }
                } else {
                    return interaction.editReply('Không thể lấy thông tin bài hát từ Spotify.');
                }
            } else if (playdl.validate(query) === 'spotify_playlist') {
                const playlistTracks = await SpotifyHandler.getPlaylistTracks(query);
                if (playlistTracks && playlistTracks.length > 0) {
                    let addedCount = 0;
                    for (const trackInfo of playlistTracks) {
                        const searchResult = await playdl.search(`${trackInfo.title} ${trackInfo.artist}`, { limit: 1 });
                        if (searchResult.length > 0) {
                            const stream = await playdl.stream(searchResult[0].url);
                            songsToAdd.push({
                                resource: createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true }),
                                info: {
                                    title: trackInfo.title,
                                    url: searchResult[0].url,
                                    thumbnail: trackInfo.thumbnail || searchResult[0].thumbnails[0]?.url || null,
                                    artist: trackInfo.artist,
                                    album: trackInfo.album,
                                    duration_ms: trackInfo.duration_ms,
                                    duration: formatDuration(trackInfo.duration_ms)
                                }
                            });
                            addedCount++;
                        }
                    }
                    initialReplyContent = `Đã thêm ${addedCount} bài hát từ playlist Spotify vào hàng chờ!`;
                } else {
                    return interaction.editReply('Không thể lấy thông tin playlist từ Spotify hoặc playlist trống.');
                }
            }
            else {
                const searchResults = await playdl.search(query, { limit: 1 });
                if (searchResults.length > 0) {
                    const ytInfo = await playdl.video_info(searchResults[0].url);
                    const videoDetails = ytInfo.video_details;
                    const stream = await playdl.stream(searchResults[0].url);
                    songsToAdd.push({
                        resource: createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true }),
                        info: {
                            title: videoDetails.title,
                            url: videoDetails.url,
                            thumbnail: videoDetails.thumbnails[0]?.url || null,
                            duration: videoDetails.durationRaw,
                            duration_ms: videoDetails.durationInSec * 1000
                        }
                    });
                    initialReplyContent = `Đã tìm thấy **${videoDetails.title}** và thêm vào hàng chờ!`;
                } else {
                    return interaction.editReply('Không tìm thấy kết quả phù hợp với từ khóa của bạn.');
                }
            }

            if (songsToAdd.length === 0) {
                return interaction.editReply('Không có bài hát nào được thêm vào hàng chờ.');
            }

            const currentSongInQueue = queueManager.getCurrentSong();
            const isPlaying = audioManager.isPlaying();

            for (const song of songsToAdd) {
                queueManager.addSong(song);
            }

            if (!isPlaying && !currentSongInQueue) {
                const firstSong = queueManager.getQueue()[0];
                if (firstSong) {
                    await audioManager.play(firstSong);
                    await interaction.editReply(`Đang phát: **${firstSong.info.title}**`);
                    // KHÔNG LƯU TIN NHẮN VÀ GỬI BUTTONS Ở ĐÂY NỮA
                }
            } else {
                await interaction.editReply(initialReplyContent);
            }

        } catch (error) {
            console.error(`Lỗi khi phát nhạc:`, error);
            await interaction.editReply('Đã có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại sau.');
        }
    },
};

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
