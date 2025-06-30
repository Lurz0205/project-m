//...src/modules/audioManager.js
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ffmpeg = require('ffmpeg-static');
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
                const queueManager = this.client.queueManagers.get(this.guildId);

                if (newState.reason === 'channelDeleted') {
                    console.log(`[AUDIO] Kênh thoại ${voiceChannel.name} đã bị xóa. Dừng bot.`);
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                    this._emitVoiceConnectionStatus('disconnected');
                    return;
                }
                // Nếu bị ngắt kết nối mà không phải do kênh bị xóa, và không ở chế độ 24/7
                if (newState.reason === 'left' || (newState.status === VoiceConnectionStatus.Disconnected && !queueManager?.is247())) {
                    console.log(`[AUDIO] Bot đã bị ngắt kết nối khỏi kênh thoại. Dừng bot.`);
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                    this._emitVoiceConnectionStatus('disconnected');
                    return;
                }
                // Tự động kết nối lại nếu bị ngắt kết nối không mong muốn và đang ở chế độ 24/7
                if (newState.status === VoiceConnectionStatus.Disconnected && queueManager?.is247()) {
                    console.log(`[AUDIO] Bot bị ngắt kết nối trong chế độ 24/7. Thử kết nối lại...`);
                    try {
                        this.connection = joinVoiceChannel({
                            channelId: voiceChannel.id,
                            guildId: voiceChannel.guild.id,
                            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                        });
                        console.log(`[AUDIO] Đã kết nối lại thành công.`);
                        this._emitVoiceConnectionStatus('connected');
                    } catch (error) {
                        console.error(`[AUDIO] Không thể kết nối lại: ${error.message}`);
                        this.stop(); // Dừng nếu không thể kết nối lại
                        this._emitPlaybackStatus('stopped');
                        this._emitVoiceConnectionStatus('disconnected');
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
                if (!queueManager) {
                    this.stop(); // Không có queueManager, dừng bot
                    return;
                }

                const nextSong = queueManager.nextSong(); // Lấy bài hát tiếp theo, đã xử lý loopMode

                if (nextSong) {
                    this.setNowPlaying(nextSong);
                    this.player.play(nextSong.resource);
                    this._emitPlaybackStatus('playing');
                } else if (queueManager.is247()) {
                    this.setNowPlaying(null); // Bot vẫn ở trong kênh thoại nhưng không phát nhạc
                    this._emitPlaybackStatus('idle');
                    // Gửi thông báo đến kênh Discord nếu cần
                    const guild = this.client.guilds.cache.get(this.guildId);
                    if (guild) {
                        const channel = guild.channels.cache.find(c => c.type === 0 && c.members.has(this.client.user.id)); // Kênh văn bản bot đang ở
                        if (channel) {
                             // channel.send('Hàng chờ trống, nhưng bot vẫn ở trong kênh (chế độ 24/7).');
                        }
                    }
                } else if (queueManager.isAutoplay()) {
                    // TODO: Implement autoplay logic here (tìm bài hát liên quan)
                    // For now, just stop if autoplay is not fully implemented
                    console.log('[AUDIO] Autoplay: đang tìm bài hát liên quan (chưa triển khai đầy đủ)...');
                    this.stop();
                    this._emitPlaybackStatus('stopped');
                } else {
                    this.stop(); // Dừng và thoát kênh nếu không còn bài hát nào và không có 24/7
                    this._emitPlaybackStatus('stopped');
                }
            });

            this.player.on('error', error => {
                console.error(`[AUDIO] Lỗi AudioPlayer: ${error.message}`, error);
                this._emitPlaybackStatus('error');
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

        // Đảm bảo resource có inlineVolume để điều chỉnh âm lượng
        if (!song.resource.volume) {
             song.resource = createAudioResource(song.resource.stream, { inputType: song.resource.inputType, inlineVolume: true });
        }
        song.resource.volume.setVolume(this.volume / 100); // Áp dụng âm lượng hiện tại

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
            this.isPlayingAudio = false; // Sẽ được đặt lại thành true nếu có bài tiếp theo
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
            queueManager.setLoopMode('off'); // Reset loop mode
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

            // Gán lại resource mới cho bài hát hiện tại trong QueueManager
            currentSong.resource = resource; 
            // Sau khi seek, bài hát hiện tại vẫn là bài đó, không cần gọi queueManager.setNowPlaying()
            // chỉ cần play lại resource mới
            this.player.play(resource);
            this.isPlayingAudio = true;
            this._emitPlaybackStatus('playing'); // Sau khi seek, bot đang phát
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

    static getOrCreate(guildId, client, io) {
        if (!client.audioManagers.has(guildId)) {
            client.audioManagers.set(guildId, new AudioManager(guildId, io, client));
        }
        return client.audioManagers.get(guildId);
    }
}

module.exports = AudioManager;
