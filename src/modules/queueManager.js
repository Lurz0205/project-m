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
        this.loopMode = 'off'; // 'off', 'song', 'queue'
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
     * Xóa bài hát đầu tiên trong hàng chờ và xử lý chế độ lặp.
     * @returns {Object|null} Bài hát tiếp theo sẽ được phát.
     */
    nextSong() {
        if (this.loopMode === 'song' && this.nowPlaying) {
            // Nếu lặp bài hát, không xóa khỏi hàng chờ, chỉ đặt lại resource
            return this.nowPlaying;
        }

        if (this.nowPlaying && this.loopMode === 'queue') {
            // Nếu lặp hàng chờ, đưa bài hát hiện tại về cuối hàng chờ
            this.queue.push(this.nowPlaying);
        }

        this.queue.shift(); // Xóa bài hát đã phát (hoặc bài cũ khi lặp queue)
        this.nowPlaying = null; // Reset nowPlaying
        this._emitQueueUpdate(); // Cập nhật hàng chờ trên Dashboard

        return this.queue[0] || null;
    }

    /**
     * Xóa một bài hát tại vị trí index cụ thể.
     * @param {number} index - Vị trí của bài hát trong mảng hàng chờ (0-indexed).
     * @returns {Object|null} Bài hát đã xóa hoặc null nếu không tìm thấy.
     */
    removeSong(index) {
        if (index >= 0 && index < this.queue.length) {
            const [removed] = this.queue.splice(index, 1);
            this._emitQueueUpdate();
            return removed;
        }
        return null;
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
     * Thiết lập chế độ lặp lại.
     * @param {string} mode - 'off', 'song', 'queue'.
     */
    setLoopMode(mode) {
        this.loopMode = mode;
        this._emitModeUpdate();
    }

    /**
     * Lấy chế độ lặp lại hiện tại.
     * @returns {string} - 'off', 'song', 'queue'.
     */
    getLoopMode() {
        return this.loopMode;
    }

    /**
     * Gửi cập nhật hàng chờ đến Dashboard thông qua Socket.IO.
     * Chỉ gửi thông tin cần thiết của bài hát (info), không gửi resource.
     */
    _emitQueueUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('queue_update', {
                guildId: this.guildId,
                queue: this.queue.map(song => song.info)
            });
        }
    }

    /**
     * Gửi cập nhật bài hát đang phát đến Dashboard.
     */
    _emitNowPlayingUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('now_playing_update', {
                guildId: this.guildId,
                song: this.nowPlaying ? this.nowPlaying.info : null
            });
        }
    }

    /**
     * Gửi cập nhật các chế độ (24/7, autoplay, loop) đến Dashboard.
     */
    _emitModeUpdate() {
        if (this.io) {
            this.io.to(this.guildId).emit('mode_update', {
                guildId: this.guildId,
                is247: this.is247Mode,
                isAutoplay: this.isAutoplayMode,
                loopMode: this.loopMode
            });
        }
    }

    static getOrCreate(guildId, client, io) {
        if (!client.queueManagers.has(guildId)) {
            client.queueManagers.set(guildId, new QueueManager(guildId, io));
        }
        return client.queueManagers.get(guildId);
    }
}

module.exports = QueueManager;
