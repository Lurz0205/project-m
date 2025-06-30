//...src/modules/queueManager.js
const { Collection } = require('discord.js');

/**
 * Quản lý hàng chờ và trạng thái phát nhạc cho từng guild.
 */
class QueueManager {
    constructor(guildId, io) {
        this.guildId = guildId;
        this.queue = [];
        this.nowPlaying = null;
        this.is247Mode = false;
        this.isAutoplayMode = false;
        this.io = io; // Tham chiếu đến Socket.IO server để gửi cập nhật Dashboard
    }

    /**
     * Thêm một bài hát vào hàng chờ.
     * @param {Object} song - Đối tượng bài hát chứa resource và info.
     */
    addSong(song) {
        this.queue.push(song);
        this._emitQueueUpdate();
    }

    /**
     * Lấy toàn bộ hàng chờ.
     * @returns {Array} Mảng các bài hát trong hàng chờ.
     */
    getQueue() {
        return this.queue;
    }

    /**
     * Lấy bài hát hiện đang phát.
     * @returns {Object|null} Bài hát hiện tại.
     */
    getCurrentSong() {
        return this.nowPlaying;
    }

    /**
     * Đặt bài hát hiện đang phát.
     * @param {Object} song - Bài hát đang phát.
     */
    setNowPlaying(song) {
        this.nowPlaying = song;
        this._emitNowPlayingUpdate();
    }

    /**
     * Lấy bài hát tiếp theo trong hàng chờ và xóa bài hiện tại.
     * @returns {Object|null} Bài hát tiếp theo.
     */
    nextSong() {
        this.queue.shift(); // Xóa bài hát đã phát
        this.nowPlaying = null; // Reset nowPlaying khi chuyển bài
        this._emitQueueUpdate();
        return this.queue[0] || null;
    }

    /**
     * Xóa toàn bộ hàng chờ.
     */
    clearQueue() {
        this.queue = [];
        this._emitQueueUpdate();
    }

    /**
     * Thiết lập chế độ 24/7.
     * @param {boolean} state - true để bật, false để tắt.
     */
    set247(state) {
        this.is247Mode = state;
        this._emitModeUpdate();
    }

    /**
     * Kiểm tra trạng thái chế độ 24/7.
     * @returns {boolean}
     */
    is247() {
        return this.is247Mode;
    }

    /**
     * Thiết lập chế độ Autoplay.
     * @param {boolean} state - true để bật, false để tắt.
     */
    setAutoplay(state) {
        this.isAutoplayMode = state;
        this._emitModeUpdate();
    }

    /**
     * Kiểm tra trạng thái chế độ Autoplay.
     * @returns {boolean}
     */
    isAutoplay() {
        return this.isAutoplayMode;
    }

    /**
     * Gửi cập nhật hàng chờ đến Dashboard thông qua Socket.IO.
     * Chỉ gửi thông tin cần thiết của bài hát (info), không gửi resource.
     */
    _emitQueueUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('queue_update', this.queue.map(song => song.info));
        }
    }

    /**
     * Gửi cập nhật bài hát đang phát đến Dashboard.
     */
    _emitNowPlayingUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('now_playing_update', this.nowPlaying ? this.nowPlaying.info : null);
        }
    }

    /**
     * Gửi cập nhật các chế độ (24/7, autoplay) đến Dashboard.
     */
    _emitModeUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('mode_update', {
                is247: this.is247Mode,
                isAutoplay: this.isAutoplayMode
            });
        }
    }

    // Khi bot khởi động, các guild đã có có thể cần QueueManager
    static getOrCreate(guildId, client, io) {
        if (!client.queueManagers.has(guildId)) {
            client.queueManagers.set(guildId, new QueueManager(guildId, io));
        }
        return client.queueManagers.get(guildId);
    }
}

module.exports = QueueManager;
