//...src/modules/queueManager.js
const { Collection } = require('discord.js');

/**
 * Quản lý hàng chờ và trạng thái phát nhạc cho từng guild.
 */
class QueueManager {
    // KHÔNG CÓ IO TRONG CONSTRUCTOR NỮA
    constructor(guildId) {
        this.guildId = guildId;
        this.queue = [];
        this.nowPlaying = null;
        this.is247Mode = false;
        this.isAutoplayMode = false;
        this.loopMode = 'off';
        console.log(`[QueueManager] Khởi tạo cho Guild ID: ${guildId}`);
    }

    addSong(song) {
        this.queue.push(song);
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    getQueue() {
        return this.queue;
    }

    getCurrentSong() {
        return this.nowPlaying;
    }

    setNowPlaying(song) {
        this.nowPlaying = song;
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    nextSong() {
        if (this.loopMode === 'song' && this.nowPlaying) {
            return this.nowPlaying;
        }

        if (this.nowPlaying && this.loopMode === 'queue') {
            this.queue.push(this.nowPlaying);
        }

        this.queue.shift();
        this.nowPlaying = null;
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
        return this.queue[0] || null;
    }

    removeSong(index) {
        if (index >= 0 && index < this.queue.length) {
            const [removed] = this.queue.splice(index, 1);
            // KHÔNG CÓ EMIT ĐẾN IO NỮA
            return removed;
        }
        return null;
    }

    clearQueue() {
        this.queue = [];
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    set247(state) {
        this.is247Mode = state;
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    is247() {
        return this.is247Mode;
    }

    setAutoplay(state) {
        this.isAutoplayMode = state;
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    isAutoplay() {
        return this.isAutoplayMode;
    }

    setLoopMode(mode) {
        this.loopMode = mode;
        // KHÔNG CÓ EMIT ĐẾN IO NỮA
    }

    getLoopMode() {
        return this.loopMode;
    }

    static getOrCreate(guildId, client) { // KHÔNG CÓ IO TRONG GETORCREATE NỮA
        if (!client.queueManagers.has(guildId)) {
            client.queueManagers.set(guildId, new QueueManager(guildId));
        }
        return client.queueManagers.get(guildId);
    }
}

module.exports = QueueManager;
