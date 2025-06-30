//...src/modules/audioManager.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ffmpeg = require('ffmpeg-static');
const playdl = require('play-dl');

/**
 * Quản lý kết nối kênh thoại và trình phát âm thanh cho từng guild.
 */
class AudioManager {
    // KHÔNG CÓ IO TRONG CONSTRUCTOR NỮA
    constructor(guildId, client) {
        this.guildId = guildId;
        this.client = client;
        this.connection = null;
        this.player = null;
        this.volume = 100;
        this.isPlayingAudio = false;
        console.log(`[AudioManager] Khởi tạo cho Guild ID: ${guildId}`);
    }

    async join(voiceChannel) {
        if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            console.log(`[AudioManager] Đã có kết nối cho Guild ID: ${this.guildId}`);
            return this.connection;
        }

        try {
            console.log(`[AudioManager] Đang cố gắng kết nối kênh thoại ${voiceChannel.id} cho Guild ID: ${this.guildId}`);
            this.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            this.connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                const queueManager = this.client.queueManagers.get(this.guildId);
                console.log(`[AudioManager] Kết nối bị ngắt cho Guild ID: ${this.guildId}. Lý do: ${newState.reason}`);

                if (newState.reason === 'channelDeleted' || newState.reason === 'left' || (!queueManager?.is247() && newState.status === VoiceConnectionStatus.Disconnected)) {
                    console.log(`[AudioManager] Dừng bot cho Guild ID: ${this.guildId} do ngắt kết nối không phải 24/7 hoặc kênh bị xóa.`);
                    this.stop();
                    return;
                }
                if (newState.status === VoiceConnectionStatus.Disconnected && queueManager?.is247()) {
                    console.log(`[AudioManager] Bot bị ngắt kết nối trong chế độ 24/7. Thử kết nối lại...`);
                    try {
                        this.connection = joinVoiceChannel({
                            channelId: voiceChannel.id,
                            guildId: voiceChannel.guild.id,
                            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                        });
                        console.log(`[AudioManager] Đã kết nối lại thành công.`);
                    } catch (error) {
                        console.error(`[AudioManager] Không thể kết nối lại: ${error.message}`);
                        this.stop();
                    }
                }
            });

            console.log(`[AudioManager] Đã kết nối kênh thoại cho Guild ID: ${this.guildId}`);
            return this.connection;
        } catch (error) {
            console.error(`[AudioManager] Lỗi khi kết nối kênh thoại cho Guild ID ${this.guildId}: ${error.message}`);
            this.connection = null;
            throw error;
        }
    }

    async play(song) {
        if (!this.connection) {
            console.error('[AudioManager] Bot chưa kết nối kênh thoại để phát nhạc.');
            return;
        }

        if (!this.player) {
            this.player = createAudioPlayer();
            this.player.on(AudioPlayerStatus.Idle, async () => {
                const queueManager = this.client.queueManagers.get(this.guildId);
                console.log(`[AudioManager] Player Idle cho Guild ID: ${this.guildId}. Chế độ lặp: ${queueManager?.getLoopMode()}`);

                if (!queueManager) {
                    this.stop();
                    return;
                }

                const nextSong = queueManager.nextSong();

                if (nextSong) {
                    this.setNowPlaying(nextSong);
                    this.player.play(nextSong.resource);
                    this.isPlayingAudio = true;
                    console.log(`[AudioManager] Đang phát bài tiếp theo: ${nextSong.info.title}`);
                } else if (queueManager.is247()) {
                    this.setNowPlaying(null);
                    this.isPlayingAudio = false;
                    console.log('[AudioManager] Hàng chờ trống, nhưng vẫn ở lại kênh (24/7).');
                } else if (queueManager.isAutoplay()) {
                    console.log('[AudioManager] Autoplay: đang tìm bài hát liên quan (chưa triển khai đầy đủ)...');
                    this.stop();
                } else {
                    console.log('[AudioManager] Hàng chờ trống và không có chế độ đặc biệt. Dừng bot.');
                    this.stop();
                }
            });

            this.player.on('error', error => {
                console.error(`[AudioManager] Lỗi AudioPlayer cho Guild ID ${this.guildId}: ${error.message}`, error);
                const queueManager = this.client.queueManagers.get(this.guildId);
                if (queueManager) {
                    const nextSong = queueManager.nextSong();
                    if (nextSong) {
                        this.setNowPlaying(nextSong);
                        this.player.play(nextSong.resource);
                        this.isPlayingAudio = true;
                    } else {
                        this.stop();
                    }
                }
            });
            this.connection.subscribe(this.player);
            console.log(`[AudioManager] Đã đăng ký AudioPlayer cho Guild ID: ${this.guildId}`);
        }

        if (!song.resource.volume) {
             song.resource = createAudioResource(song.resource.stream, { inputType: song.resource.inputType, inlineVolume: true });
        }
        song.resource.volume.setVolume(this.volume / 100);

        this.player.play(song.resource);
        this.setNowPlaying(song);
        this.isPlayingAudio = true;
        console.log(`[AudioManager] Đang phát: ${song.info.title} cho Guild ID: ${this.guildId}`);
    }

    async skip() {
        if (this.player && this.player.state.status !== AudioPlayerStatus.Idle) {
            this.player.stop();
            this.isPlayingAudio = false;
            console.log(`[AudioManager] Đã bỏ qua bài hát cho Guild ID: ${this.guildId}`);
            return true;
        }
        return false;
    }

    async pause() {
        if (this.player && this.player.state.status === AudioPlayerStatus.Playing) {
            this.player.pause();
            this.isPlayingAudio = false;
            console.log(`[AudioManager] Đã tạm dừng nhạc cho Guild ID: ${this.guildId}`);
            return true;
        }
        return false;
    }

    async resume() {
        if (this.player && this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause();
            this.isPlayingAudio = true;
            console.log(`[AudioManager] Đã tiếp tục nhạc cho Guild ID: ${this.guildId}`);
            return true;
        }
        return false;
    }

    async stop() {
        if (this.player) {
            this.player.stop();
            this.player = null;
            console.log(`[AudioManager] Đã dừng player cho Guild ID: ${this.guildId}`);
        }
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
            console.log(`[AudioManager] Đã hủy kết nối cho Guild ID: ${this.guildId}`);
        }
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (queueManager) {
            queueManager.clearQueue();
            queueManager.setNowPlaying(null);
            queueManager.set247(false);
            queueManager.setAutoplay(false);
            queueManager.setLoopMode('off');
        }
        this.client.audioManagers.delete(this.guildId);
        this.client.queueManagers.delete(this.guildId);
        this.isPlayingAudio = false;
        console.log(`[AudioManager] Đã dừng hoàn toàn cho Guild ID: ${this.guildId}`);
        return true;
    }

    setVolume(volume) {
        if (this.player && this.player.state.resource) {
            const scaledVolume = volume / 100;
            this.player.state.resource.volume.setVolume(scaledVolume);
            this.volume = volume;
            console.log(`[AudioManager] Đã đặt âm lượng ${volume}% cho Guild ID: ${this.guildId}`);
            return true;
        }
        return false;
    }

    async seek(timeSeconds) {
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (!this.player || !queueManager || !queueManager.getCurrentSong()) {
            console.log(`[AudioManager] Không thể tua nhạc. Guild ID: ${this.guildId}`);
            return false;
        }

        const currentSong = queueManager.getCurrentSong();
        try {
            this.player.stop();
            const stream = await playdl.stream(currentSong.info.url, { seek: timeSeconds });
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });
            resource.volume.setVolume(this.volume / 100);

            currentSong.resource = resource;
            this.player.play(resource);
            this.isPlayingAudio = true;
            console.log(`[AudioManager] Đã tua đến ${timeSeconds}s cho Guild ID: ${this.guildId}`);
            return true;
        } catch (error) {
            console.error(`[AudioManager] Lỗi khi tua nhạc cho Guild ID ${this.guildId}: ${error.message}`);
            return false;
        }
    }

    isPlaying() {
        return this.isPlayingAudio;
    }

    setNowPlaying(song) {
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (queueManager) {
            queueManager.setNowPlaying(song);
        }
        // Không có emit đến io nữa
    }

    static getOrCreate(guildId, client) { // KHÔNG CÓ IO TRONG GETORCREATE NỮA
        if (!client.audioManagers.has(guildId)) {
            client.audioManagers.set(guildId, new AudioManager(guildId, client));
        }
        return client.audioManagers.get(guildId);
    }
}

module.exports = AudioManager;
