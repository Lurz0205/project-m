//...src/modules/audioManager.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ffmpeg = require('ffmpeg-static'); // Đảm bảo ffmpeg-static được cài đặt
const playdl = require('play-dl');

/**
 * Quản lý kết nối kênh thoại và trình phát âm thanh cho từng guild.
 */
class AudioManager {
    constructor(guildId, io, client) {
        this.guildId = guildId;
        this.io = io;
        this.client = client; // Truy cập client để lấy QueueManager
        this.connection = null;
        this.player = null;
        this.volume = 100; // Mặc định 100%
        this.isPlayingAudio = false; // Trạng thái đang phát
    }

    /**
     * Kết nối bot vào kênh thoại.
     * @param {object} voiceChannel - Kênh thoại để kết nối.
     */
    async join(voiceChannel) {
        if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            return this.connection; // Đã có kết nối
        }

        try {
            this.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            this.connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                if (newState.reason === 'channelDeleted') { // Nếu kênh bị xóa, dừng bot
                    console.log(`[AUDIO] Kênh thoại ${voiceChannel.name} đã bị xóa. Dừng bot.`);
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                    this._emitVoiceConnectionStatus('disconnected');
                    return;
                }
                if (newState.reason === 'left' && !this.client.queueManagers.get(this.guildId)?.is247()) {
                    console.log(`[AUDIO] Bot đã bị ngắt kết nối khỏi kênh thoại. Dừng bot.`);
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                    this._emitVoiceConnectionStatus('disconnected');
                    return;
                }
                // Tự động kết nối lại nếu không phải do bị đá hoặc kênh bị xóa, và không ở chế độ 24/7
                if (newState.status === VoiceConnectionStatus.Disconnected && !this.client.queueManagers.get(this.guildId)?.is247()) {
                    if (newState.reason === 'websocketClose' && newState.closeCode === 4014) {
                        try {
                            await voiceChannel.guild.members.me.voice.setChannel(null); // Leave current voice channel
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
                            this.connection = joinVoiceChannel({
                                channelId: voiceChannel.id,
                                guildId: voiceChannel.guild.id,
                                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                            });
                            console.log(`[AUDIO] Đã kết nối lại thành công sau lỗi 4014.`);
                            this._emitVoiceConnectionStatus('connected');
                        } catch (error) {
                            console.error(`[AUDIO] Không thể kết nối lại sau lỗi 4014: ${error.message}`);
                            this.stop();
                            this._emitPlaybackStatus('stopped');
                            this._emitVoiceConnectionStatus('disconnected');
                        }
                    } else if (newState.reason === 'timeout') {
                         console.log(`[AUDIO] Bot bị ngắt kết nối do timeout. Thử kết nối lại...`);
                         try {
                             this.connection = joinVoiceChannel({
                                 channelId: voiceChannel.id,
                                 guildId: voiceChannel.guild.id,
                                 adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                             });
                             console.log(`[AUDIO] Đã kết nối lại thành công sau timeout.`);
                             this._emitVoiceConnectionStatus('connected');
                         } catch (error) {
                             console.error(`[AUDIO] Không thể kết nối lại sau timeout: ${error.message}`);
                             this.stop();
                             this._emitPlaybackStatus('stopped');
                             this._emitVoiceConnectionStatus('disconnected');
                         }
                    }
                }
            });

            this._emitVoiceConnectionStatus('connected');
            return this.connection;
        } catch (error) {
            console.error(`[AUDIO] Lỗi khi kết nối kênh thoại: ${error.message}`);
            this.connection = null;
            this._emitVoiceConnectionStatus('disconnected');
            throw error;
        }
    }

    /**
     * Phát một bài hát.
     * @param {object} song - Đối tượng bài hát từ QueueManager.
     */
    async play(song) {
        if (!this.connection) {
            console.error('[AUDIO] Bot chưa kết nối kênh thoại.');
            return;
        }

        if (!this.player) {
            this.player = createAudioPlayer();
            this.player.on(AudioPlayerStatus.Idle, async () => {
                const queueManager = this.client.queueManagers.get(this.guildId);
                if (!queueManager) return;

                const nextSong = queueManager.nextSong();
                if (nextSong) {
                    this.setNowPlaying(nextSong);
                    this.player.play(nextSong.resource);
                    this._emitPlaybackStatus('playing');
                } else if (queueManager.is247()) {
                    this.setNowPlaying(null); // Không có bài hát nào đang phát
                    this._emitPlaybackStatus('idle'); // Bot vẫn ở trong kênh thoại nhưng không phát
                } else if (queueManager.isAutoplay()) {
                    // TODO: Implement autoplay logic here
                    // This would involve searching for a related song and adding it to the queue
                    console.log('[AUDIO] Autoplay: đang tìm bài hát liên quan...');
                    // For now, just stop if autoplay not fully implemented
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                }
                else {
                    this.stop(); // Dừng và thoát kênh nếu không còn bài hát nào và không có 24/7
                    this._emitPlaybackStatus('stopped');
                }
            });

            this.player.on('error', error => {
                console.error(`[AUDIO] Lỗi AudioPlayer: ${error.message}`, error);
                this._emitPlaybackStatus('error');
                // Try to play next song or stop
                const queueManager = this.client.queueManagers.get(this.guildId);
                if (queueManager) {
                    const nextSong = queueManager.nextSong();
                    if (nextSong) {
                        this.setNowPlaying(nextSong);
                        this.player.play(nextSong.resource);
                        this._emitPlaybackStatus('playing');
                    } else {
                        this.stop();
                        this._emitPlaybackStatus('stopped');
                    }
                }
            });
            this.connection.subscribe(this.player);
        }

        this.player.play(song.resource);
        this.setNowPlaying(song);
        this.isPlayingAudio = true;
        this._emitPlaybackStatus('playing');
    }

    /**
     * Bỏ qua bài hát hiện tại.
     */
    async skip() {
        if (this.player && this.player.state.status !== AudioPlayerStatus.Idle) {
            this.player.stop(); // Chuyển player sang trạng thái Idle, kích hoạt logic nextSong
            this.isPlayingAudio = false;
            this._emitPlaybackStatus('skipped');
            return true;
        }
        return false;
    }

    /**
     * Tạm dừng phát nhạc.
     */
    async pause() {
        if (this.player && this.player.state.status === AudioPlayerStatus.Playing) {
            this.player.pause();
            this.isPlayingAudio = false;
            this._emitPlaybackStatus('paused');
            return true;
        }
        return false;
    }

    /**
     * Tiếp tục phát nhạc.
     */
    async resume() {
        if (this.player && this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause();
            this.isPlayingAudio = true;
            this._emitPlaybackStatus('playing');
            return true;
        }
        return false;
    }

    /**
     * Dừng phát nhạc và ngắt kết nối khỏi kênh thoại.
     */
    async stop() {
        if (this.player) {
            this.player.stop();
            this.player = null;
        }
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (queueManager) {
            queueManager.clearQueue();
            queueManager.setNowPlaying(null);
            queueManager.set247(false); // Reset 24/7 mode
            queueManager.setAutoplay(false); // Reset autoplay mode
        }
        this.client.audioManagers.delete(this.guildId); // Xóa khỏi danh sách audioManagers
        this.client.queueManagers.delete(this.guildId); // Xóa khỏi danh sách queueManagers
        this.isPlayingAudio = false;
        this._emitPlaybackStatus('stopped');
        this._emitVoiceConnectionStatus('disconnected');
        return true;
    }

    /**
     * Điều chỉnh âm lượng.
     * @param {number} volume - Giá trị âm lượng (0-200).
     */
    setVolume(volume) {
        if (this.player && this.player.state.resource) {
            const scaledVolume = volume / 100;
            this.player.state.resource.volume.setVolume(scaledVolume);
            this.volume = volume;
            this._emitVolumeUpdate();
            return true;
        }
        return false;
    }

    /**
     * Tua đến một thời điểm cụ thể trong bài hát.
     * Lưu ý: Việc tua nhạc phức tạp hơn vì cần tạo lại AudioResource với offset.
     * Cần cài đặt FFmpeg và dùng các option thích hợp.
     * @param {number} timeSeconds - Thời điểm tua đến (tính bằng giây).
     */
    async seek(timeSeconds) {
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (!this.player || !queueManager || !queueManager.getCurrentSong()) {
            return false;
        }

        const currentSong = queueManager.getCurrentSong();
        try {
            // Tạm dừng player hiện tại
            this.player.stop();

            // Tạo lại stream từ thời điểm mới
            const stream = await playdl.stream(currentSong.info.url, { seek: timeSeconds });
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true // Bật inlineVolume để có thể điều chỉnh volume
            });
            resource.volume.setVolume(this.volume / 100); // Áp dụng lại volume hiện tại

            currentSong.resource = resource; // Cập nhật resource trong bài hát hiện tại
            this.player.play(resource);
            this.isPlayingAudio = true;
            this._emitPlaybackStatus('seeking'); // Có thể thêm trạng thái "seeking"
            return true;
        } catch (error) {
            console.error(`[AUDIO] Lỗi khi tua nhạc: ${error.message}`);
            return false;
        }
    }

    /**
     * Kiểm tra bot có đang phát nhạc hay không.
     * @returns {boolean}
     */
    isPlaying() {
        return this.isPlayingAudio;
    }

    /**
     * Thiết lập bài hát hiện đang phát trong QueueManager.
     * @param {Object} song - Đối tượng bài hát.
     */
    setNowPlaying(song) {
        const queueManager = this.client.queueManagers.get(this.guildId);
        if (queueManager) {
            queueManager.setNowPlaying(song);
        }
        this._emitPlaybackStatus('playing'); // Phát thành công
    }

    /**
     * Gửi cập nhật trạng thái phát nhạc đến Dashboard.
     * @param {string} status - 'playing', 'paused', 'stopped', 'idle', 'skipped', 'error', 'seeking'.
     */
    _emitPlaybackStatus(status) {
        if (this.io) {
            this.io.to(this.guildId).emit('playback_status_update', { status, guildId: this.guildId });
        }
    }

    /**
     * Gửi cập nhật trạng thái kết nối kênh thoại đến Dashboard.
     * @param {string} status - 'connected', 'disconnected'.
     */
    _emitVoiceConnectionStatus(status) {
        if (this.io) {
            this.io.to(this.guildId).emit('voice_connection_status_update', { status, guildId: this.guildId });
        }
    }

    /**
     * Gửi cập nhật âm lượng đến Dashboard.
     */
    _emitVolumeUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('volume_update', { volume: this.volume, guildId: this.guildId });
        }
    }

    // Khi bot khởi động, các guild đã có có thể cần AudioManager
    static getOrCreate(guildId, client, io) {
        if (!client.audioManagers.has(guildId)) {
            client.audioManagers.set(guildId, new AudioManager(guildId, io, client));
        }
        return client.audioManagers.get(guildId);
    }
}

module.exports = AudioManager;
