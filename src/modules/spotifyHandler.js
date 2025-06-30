const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    // Note: No redirectUri needed for client credentials flow
});

async function getAccessToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('Đã lấy Spotify Access Token thành công.');
    } catch (error) {
        console.error('Không thể lấy Spotify Access Token:', error);
    }
}

async function getTrackInfo(url) {
    try {
        await getAccessToken(); // Ensure token is fresh
        const trackId = url.split('/').pop().split('?')[0];
        const data = await spotifyApi.getTrack(trackId);
        return {
            title: data.body.name,
            artist: data.body.artists.map(artist => artist.name).join(', '),
            album: data.body.album.name,
        };
    } catch (error) {
        console.error('Lỗi khi lấy thông tin bài hát từ Spotify:', error);
        return null;
    }
}

// Call this once to get the token when the bot starts
getAccessToken();
setInterval(getAccessToken, 3600 * 1000); // Refresh token every hour

module.exports = {
    getTrackInfo,
};
