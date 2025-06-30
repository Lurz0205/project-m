//...src/web/public/script.js
const socket = io();

// Get elements
const botUptime = document.getElementById('bot-uptime');
const botGuildCount = document.getElementById('bot-guild-count');
const botUserCount = document.getElementById('bot-user-count');
const guildSelect = document.getElementById('guild-select');
const playerControlsCard = document.getElementById('player-controls-card');
const queueCard = document.getElementById('queue-card');
const currentGuildName = document.getElementById('current-guild-name');
const nowPlayingTitle = document.getElementById('now-playing-title');
const nowPlayingArtist = document.getElementById('now-playing-artist');
const pausePlayBtn = document.getElementById('pause-play-btn');
const skipBtn = document.getElementById('skip-btn');
const stopBtn = document.getElementById('stop-btn');
const prevBtn = document.getElementById('prev-btn'); // Currently disabled in HTML, but kept for future use
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const toggle247Btn = document.getElementById('247-toggle-btn');
const toggleAutoplayBtn = document.getElementById('autoplay-toggle-btn');
const queueList = document.getElementById('queue-list');
const noQueueItem = document.getElementById('no-queue-item');

let selectedGuildId = null;
let currentBotStatus = {}; // Store the full bot status

// Utility to format duration (similar to bot's formatDuration)
function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return 'N/A';
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

// Update UI functions
function updateBotStats(data) {
    const days = Math.floor(data.uptime / 86400);
    const hours = Math.floor(data.uptime / 3600) % 24;
    const minutes = Math.floor(data.uptime / 60) % 60;
    const seconds = Math.floor(data.uptime % 60);
    botUptime.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    botGuildCount.textContent = data.guildCount;
    botUserCount.textContent = data.userCount;

    // Populate guild select dropdown
    guildSelect.innerHTML = '<option value="">-- Chọn Server --</option>';
    data.guilds.forEach(guild => {
        const option = document.createElement('option');
        option.value = guild.id;
        option.textContent = guild.name;
        guildSelect.appendChild(option);
    });

    // If a guild was previously selected, try to re-select it
    if (selectedGuildId && data.guilds.some(g => g.id === selectedGuildId)) {
        guildSelect.value = selectedGuildId;
        updateSelectedGuildUI(selectedGuildId);
    } else if (data.guilds.length > 0) {
        // Automatically select the first guild if nothing was selected
        selectedGuildId = data.guilds[0].id;
        guildSelect.value = selectedGuildId;
        updateSelectedGuildUI(selectedGuildId);
    } else {
        // No guilds available
        hideGuildSpecificUI();
    }
}

function updateSelectedGuildUI(guildId) {
    const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
    if (!guildData) {
        hideGuildSpecificUI();
        return;
    }

    playerControlsCard.classList.remove('hidden');
    queueCard.classList.remove('hidden');

    currentGuildName.textContent = guildData.name;

    // Update now playing
    if (guildData.nowPlaying) {
        nowPlayingTitle.textContent = guildData.nowPlaying.title;
        nowPlayingArtist.textContent = guildData.nowPlaying.artist || '';
        // Could also update a thumbnail image if available
    } else {
        nowPlayingTitle.textContent = 'Chưa có bài hát';
        nowPlayingArtist.textContent = '';
    }

    // Update playback status
    if (guildData.isPlaying) {
        pausePlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        pausePlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    // Update volume
    volumeSlider.value = guildData.volume || 100;
    volumeValue.textContent = `${volumeSlider.value}%`;

    // Update 24/7 toggle
    if (guildData.is247) {
        toggle247Btn.classList.remove('toggle-btn-off');
        toggle247Btn.classList.add('toggle-btn-on');
        toggle247Btn.textContent = '24/7 ON';
    } else {
        toggle247Btn.classList.remove('toggle-btn-on');
        toggle247Btn.classList.add('toggle-btn-off');
        toggle247Btn.textContent = '24/7 OFF';
    }

    // Update Autoplay toggle
    if (guildData.isAutoplay) {
        toggleAutoplayBtn.classList.remove('toggle-btn-off');
        toggleAutoplayBtn.classList.add('toggle-btn-on');
        toggleAutoplayBtn.textContent = 'Autoplay ON';
    } else {
        toggleAutoplayBtn.classList.remove('toggle-btn-on');
        toggleAutoplayBtn.classList.add('toggle-btn-off');
        toggleAutoplayBtn.textContent = 'Autoplay OFF';
    }

    // Update queue
    queueList.innerHTML = '';
    if (guildData.queue && guildData.queue.length > 0) {
        guildData.queue.forEach((song, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${index + 1}. ${song.title} (${song.duration || formatDuration(song.duration_ms)})`;
            queueList.appendChild(listItem);
        });
        noQueueItem.classList.add('hidden');
    } else {
        const noQueueItemClone = noQueueItem.cloneNode(true);
        noQueueItemClone.classList.remove('hidden');
        queueList.appendChild(noQueueItemClone);
    }
}

function hideGuildSpecificUI() {
    playerControlsCard.classList.add('hidden');
    queueCard.classList.add('hidden');
    currentGuildName.textContent = '';
    nowPlayingTitle.textContent = 'Chưa có bài hát';
    nowPlayingArtist.textContent = '';
    pausePlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    volumeSlider.value = 100;
    volumeValue.textContent = '100%';
    toggle247Btn.classList.remove('toggle-btn-on');
    toggle247Btn.classList.add('toggle-btn-off');
    toggle247Btn.textContent = '24/7 OFF';
    toggleAutoplayBtn.classList.remove('toggle-btn-on');
    toggleAutoplayBtn.classList.add('toggle-btn-off');
    toggleAutoplayBtn.textContent = 'Autoplay OFF';
    queueList.innerHTML = '';
    const noQueueItemClone = noQueueItem.cloneNode(true);
    noQueueItemClone.classList.remove('hidden');
    queueList.appendChild(noQueueItemClone);
}

// Event Listeners for controls
pausePlayBtn.addEventListener('click', () => {
    if (!selectedGuildId) return;
    const guildData = currentBotStatus.guilds.find(g => g.id === selectedGuildId);
    if (guildData) {
        const command = guildData.isPlaying ? 'pause' : 'resume';
        socket.emit('dashboard_command', { command, guildId: selectedGuildId });
    }
});

skipBtn.addEventListener('click', () => {
    if (!selectedGuildId) return;
    socket.emit('dashboard_command', { command: 'skip', guildId: selectedGuildId });
});

stopBtn.addEventListener('click', () => {
    if (!selectedGuildId) return;
    socket.emit('dashboard_command', { command: 'stop', guildId: selectedGuildId });
});

volumeSlider.addEventListener('input', () => {
    volumeValue.textContent = `${volumeSlider.value}%`;
    // Send volume update immediately
    if (selectedGuildId) {
        socket.emit('dashboard_command', { command: 'set_volume', guildId: selectedGuildId, value: parseInt(volumeSlider.value) });
    }
});

// For 24/7 and Autoplay, send a general command and let the bot decide the state
toggle247Btn.addEventListener('click', () => {
    if (!selectedGuildId) return;
    const guildData = currentBotStatus.guilds.find(g => g.id === selectedGuildId);
    if (guildData) {
        const command = guildData.is247 ? '247_off' : '247_on'; // Custom command names for dashboard
        socket.emit('dashboard_command', { command: command, guildId: selectedGuildId });
    }
});

toggleAutoplayBtn.addEventListener('click', () => {
    if (!selectedGuildId) return;
    const guildData = currentBotStatus.guilds.find(g => g.id === selectedGuildId);
    if (guildData) {
        const command = guildData.isAutoplay ? 'autoplay_off' : 'autoplay_on'; // Custom command names for dashboard
        socket.emit('dashboard_command', { command: command, guildId: selectedGuildId });
    }
});


// Guild selection change
guildSelect.addEventListener('change', (event) => {
    selectedGuildId = event.target.value;
    if (selectedGuildId) {
        updateSelectedGuildUI(selectedGuildId);
    } else {
        hideGuildSpecificUI();
    }
});

// Socket.IO Events
socket.on('connect', () => {
    console.log('Đã kết nối tới Dashboard Server');
});

socket.on('disconnect', () => {
    console.log('Đã ngắt kết nối khỏi Dashboard Server');
    // Clear UI or show a disconnected message
});

socket.on('bot_status', (data) => {
    console.log('Nhận trạng thái bot ban đầu:', data);
    currentBotStatus = data;
    updateBotStats(data);
});

socket.on('queue_update', ({ guildId, queue }) => {
    if (guildId === selectedGuildId) {
        const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
        if (guildData) {
            guildData.queue = queue;
            updateSelectedGuildUI(guildId); // Update UI
        }
    }
});

socket.on('now_playing_update', ({ guildId, song }) => {
    if (guildId === selectedGuildId) {
        const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
        if (guildData) {
            guildData.nowPlaying = song;
            updateSelectedGuildUI(guildId); // Update UI
        }
    }
});

socket.on('playback_status_update', ({ guildId, status }) => {
    if (guildId === selectedGuildId) {
        const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
        if (guildData) {
            guildData.isPlaying = (status === 'playing'); // Update playback status based on actual bot state
            updateSelectedGuildUI(guildId);
        }
    }
});

socket.on('volume_update', ({ guildId, volume }) => {
    if (guildId === selectedGuildId) {
        const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
        if (guildData) {
            guildData.volume = volume;
            updateSelectedGuildUI(guildId);
        }
    }
});

socket.on('mode_update', ({ guildId, is247, isAutoplay }) => {
    if (guildId === selectedGuildId) {
        const guildData = currentBotStatus.guilds.find(g => g.id === guildId);
        if (guildData) {
            guildData.is247 = is247;
            guildData.isAutoplay = isAutoplay;
            updateSelectedGuildUI(guildId);
        }
    }
});

socket.on('dashboard_response', (response) => {
    console.log('Phản hồi từ bot:', response);
    // You could display a temporary message to the user here
    // e.g., using a simple alert or a custom modal
    if (response.status === 'error') {
        alert(`Lỗi: ${response.message}`);
    } else {
        // For success, UI should update via other socket events from bot
    }
});
