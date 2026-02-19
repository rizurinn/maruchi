export async function spotifySearch(query) {
    try {
        const clientId = "4c4fc8c3496243cbba99b39826e2841f";
        const clientSecret = "d598f89aba0946e2b85fb8aefa9ae4c8";
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const getToken = async () => {
            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: { 
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
            });
            const result = await response.json();
            return result.access_token;
        };

        const accessToken = await getToken();
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`;
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: { 
               'Authorization': `Bearer ${accessToken}`,
               'Content-Type': 'application/json'
            },
        });
        const data = await response.json();

        return data.tracks.items.map(track => ({
            title: track.name,
            artist: track.artists.map(artist => artist.name).join(", "),
            album: track.album.name,
            image: track.album.images[0]?.url || "",
            duration: track.duration_ms,
            spotifyUrl: track.external_urls.spotify,
        }));
    } catch (error) {
        throw new Error(error);
    }
}

