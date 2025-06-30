//...src/modules/spotifyHandler.js
// File này không thay đổi vì nó chỉ xử lý API Spotify độc lập
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let accessToken = null;
let tokenExpiresIn = 0;
let tokenIssuedAt = 0;

async function getAccessToken() {
    if (!accessToken || (Date.now() - tokenIssuedAt) / 1000 >= tokenExpiresIn - 300) {
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            accessToken = data.body['access_token'];
            tokenExpiresIn = data.body['expires_in'];
            tokenIssuedAt = Date.now();
            spotifyApi.setAccessToken(accessToken);
            console.log('[SPOTIFY] Đã lấy Spotify Access Token thành công.');
        } catch (error) {
            console.error('[SPOTIFY] Không thể lấy Spotify Access Token:', error.message);
            accessToken = null;
        }
    }
    return accessToken;
}

async function getTrackInfo(url) {
    const currentAccessToken = await getAccessToken();
    if (!currentAccessToken) {
        console.error('[SPOTIFY] Không có Spotify Access Token để lấy thông tin bài hát.');
        return null;
    }

    try {
        const trackId = url.split('/').pop().split('?')[0];
        const data = await spotifyApi.getTrack(trackId);
        return {
            title: data.body.name,
            artist: data.body.artists.map(artist => artist.name).join(', '),
            album: data.body.album.name,
            thumbnail: data.body.album.images[0]?.url || null,
            duration_ms: data.body.duration_ms
        };
    } catch (error) {
        console.error('[SPOTIFY] Lỗi khi lấy thông tin bài hát từ Spotify:', error.message);
        return null;
    }
}

async function getPlaylistTracks(url) {
    const currentAccessToken = await getAccessToken();
    if (!currentAccessToken) {
        console.error('[SPOTIFY] Không có Spotify Access Token để lấy thông tin playlist.');
        return null;
    }

    try {
        const playlistId = url.split('/').pop().split('?')[0];
        let allTracks = [];
        let offset = 0;
        let limit = 100;

        while (true) {
            const data = await spotifyApi.getPlaylistTracks(playlistId, {
                limit: limit,
                offset: offset
            });

            const tracks = data.body.items.map(item => ({
                title: item.track.name,
                artist: item.track.artists.map(artist => artist.name).join(', '),
                album: item.track.album.name,
                thumbnail: item.track.album.images[0]?.url || null,
                duration_ms: item.track.duration_ms
            }));

            allTracks = allTracks.concat(tracks);

            if (data.body.next) {
                offset += limit;
            } else {
                break;
            }
        }
        return allTracks;
    } catch (error) {
        console.error('[SPOTIFY] Lỗi khi lấy thông tin playlist từ Spotify:', error.message);
        return null;
    }
}

getAccessToken();
setInterval(getAccessToken, (60 * 60 - 300) * 1000);

module.exports = {
    getTrackInfo,
    getPlaylistTracks
};
