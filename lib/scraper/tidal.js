import { unlink, rename } from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import Func from "../funcc.js";

// --- KONFIGURASI DOMAIN ---
const API_DOMAINS = [
    "https://triton.squid.wtf",
    "https://wolf.qqdl.site",
    "https://maus.qqdl.site",
    "https://vogel.qqdl.site",
    "https://katze.qqdl.site",
    "https://hund.qqdl.site",
    "https://tidal.kinoplus.online",
    "https://tidal-api.binimum.org"
];

const LYRICS_DOMAINS = [
    "https://lyricsplus.prjktla.workers.dev",
    "https://lyrics-plus-backend.vercel.app"
];

const HEADERS = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7",
    "sec-ch-ua": "\"Chromium\";v=\"139\", \"Not;A=Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "x-client": "BiniLossless/v3.4",
    "Referer": "https://tidal.squid.wtf/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
};

// --- HELPER FUNCTIONS ---

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9\-_]/gi, '_').trim();
}

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function msToLrcTimestamp(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((totalSeconds % 1) * 100);
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

function buildThumbnail(coverId) {
    if (!coverId) return null;
    const clean = coverId.replace(/-/g, "/");
    return `https://resources.tidal.com/images/${clean}/1280x1280.jpg`;
}

async function downloadChunk(url, chunkName) {
    try {
        const response = await fetch(url, { headers: HEADERS });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.arrayBuffer();
    } catch (error) {
        throw new Error(`Gagal mengunduh ${chunkName}: ${error.message}`);
    }
}

async function fetchWithFailover(endpointPath) {
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
        const domain = getRandomItem(API_DOMAINS);
        const url = `${domain}${endpointPath}`;

        try {
            const response = await fetch(url, { headers: HEADERS });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            attempts++;
            if (attempts >= maxAttempts) throw new Error(e.stack);
        }
    }
}

async function fetchLyrics(meta) {
    const params = new URLSearchParams({
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        duration: meta.duration || 0,
        source: "apple,lyricsplus,musixmatch,spotify,musixmatch-word"
    });

    for (const domain of LYRICS_DOMAINS) {
        try {
            const url = `${domain}/v2/lyrics/get?${params.toString()}`;
            const res = await fetch(url, { headers: HEADERS });
            if (!res.ok) continue;

            const json = await res.json();
            if (!json.lyrics || !Array.isArray(json.lyrics)) continue;

            const originalLyrics = json.lyrics;
            let combinedLrcContent = [];

            for (const line of originalLyrics) {
                if (!line || !line.text) continue;

                const timestamp = msToLrcTimestamp(line.time);
                const original = line.text.trim();
                const translit = line.transliteration?.text?.trim() || null;

                combinedLrcContent.push(`${timestamp}${original}`);

                if (translit && translit.toLowerCase() !== original.toLowerCase()) {
                    combinedLrcContent.push(`${timestamp}(${translit})`);
                }
            }

            if (combinedLrcContent.length > 0) {
                return combinedLrcContent.join("\n");
            }

        } catch {
            continue;
        }
    }
    return null;
}

// --- MAIN FUNCTIONS ---

export async function downloadTrack(trackId, outputDir = './tmp') {
    // 1. Fetch Metadata
    const infoJson = await fetchWithFailover(`/info/?id=${trackId}`);
    if (!infoJson.data) throw new Error("Format Metadata API tidak valid.");

    const data = infoJson.data;
    const title = data.title;
    const artist = data.artists?.map(a => a.name).join(", ").replace(/, ([^,]+)$/, " & $1") || "Unknown Artist";
    const album = data.album ? data.album.title : "Unknown Album";
    const albumArtist = data.artist?.name || artist.split("; ")[0];
    const releaseDate = data.streamStartDate ? data.streamStartDate.split('T')[0] : (new Date().getFullYear().toString());
    const duration = data.duration;
    const songUrl = data.url;
    const coverUrl = buildThumbnail(data.album?.cover);

    const safeFilename = sanitizeFilename(`${artist} - ${title}`);
    const tempAudioPath = path.resolve(outputDir, `temp_${trackId}_${Date.now()}.tmp`);
    const tempCoverPath = path.resolve(outputDir, `cover_${trackId}_${Date.now()}.jpg`);
    const finalOutputPath = path.resolve(outputDir, `${safeFilename}.flac`);

    // 2. Download Cover
    if (coverUrl) {
        const coverBuf = await downloadChunk(coverUrl, "Cover Art");
        if (coverBuf) await Bun.write(tempCoverPath, coverBuf);
    }

    // 3. Fetch Lirik (Parallel with manifest fetch to save time? No, sequential is safer for logging)
    const lyricsLrc = await fetchLyrics({ title, artist, album, duration });

    // 4. Fetch Manifest Audio
    const manifestJson = await fetchWithFailover(`/track/?id=${trackId}&quality=HI_RES_LOSSLESS`);
    if (!manifestJson.data || !manifestJson.data.manifest) throw new Error("Manifest kosong/kadaluarsa.");

    const manifestMime = manifestJson.data.manifestMimeType;
    const manifestBase64 = manifestJson.data.manifest;
    const decodedManifest = Buffer.from(manifestBase64, 'base64').toString('utf-8');

    const audioFile = Bun.file(tempAudioPath);
    const writer = audioFile.writer();

    try {
        if (manifestMime === 'application/vnd.tidal.bts') {
            const btsData = JSON.parse(decodedManifest);
            if (btsData.encryptionType !== 'NONE') throw new Error("Encrypted stream not supported.");

            const urls = btsData.urls || [];
            for (let i = 0; i < urls.length; i++) {
                const chunk = await downloadChunk(urls[i], `Part ${i}`);
                if (chunk) writer.write(chunk);
            }

        } else if (manifestMime === 'application/dash+xml') {
            const initMatch = decodedManifest.match(/initialization="([^"]+)"/);
            const mediaMatch = decodedManifest.match(/media="([^"]+)"/);

            if (!initMatch || !mediaMatch) throw new Error("XML Parsing Failed.");

            const initUrl = initMatch[1].replace(/&amp;/g, '&');
            const mediaUrlTemplate = mediaMatch[1].replace(/&amp;/g, '&');

            const initBuf = await downloadChunk(initUrl, "Init");
            if (initBuf) writer.write(initBuf);

            let segmentIndex = 1;
            let keepDownloading = true;
            
            while (keepDownloading) {
                const segmentUrl = mediaUrlTemplate.replace('$Number$', segmentIndex);

                try {
                    const chunk = await downloadChunk(segmentUrl, `Seg ${segmentIndex}`);
                    if (chunk && chunk.byteLength > 0) {
                        writer.write(chunk);
                        segmentIndex++;
                        if (segmentIndex % 10 === 0) await writer.flush(); 
                    } else {
                        keepDownloading = false;
                    }
                } catch {
                    keepDownloading = false;
                }
                if (segmentIndex > 600) keepDownloading = false;
            }
        } else {
            throw new Error(`Unknown Manifest: ${manifestMime}`);
        }
    } finally {
        await writer.end();
    }

    // 5. FFmpeg Merge (Inject Metadata & Lyrics)
    // Bun.spawn handle escaping arguments automatically, aman untuk lirik panjang.
    const ffmpegArgs = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-i", tempAudioPath,
        "-i", tempCoverPath,
        "-map", "0:a",
        "-map", "1:0",
        "-c:a", "copy",
        "-disposition:v:0", "attached_pic",
        "-metadata", `title=${title}`,
        "-metadata", `artist=${artist}`,
        "-metadata", `album=${album}`,
        "-metadata", `album_artist=${albumArtist}`,
        "-metadata", `date=${releaseDate}`,
        ...(lyricsLrc ? ["-metadata", `LYRICS=${lyricsLrc}`] : []), 
        ...(lyricsLrc ? ["-metadata", `UNSYNCEDLYRICS=${lyricsLrc}`] : []),
        finalOutputPath
    ];

    try {
        const proc = Bun.spawn(ffmpegArgs, {
            stdout: "ignore",
            stderr: "inherit",
            timeout: 60000
        });

        const exitCode = await proc.exited;

        if (exitCode !== 0) {
            throw new Error(`FFmpeg exited with code ${exitCode}`);
        }

        await Promise.all([
            unlink(tempAudioPath).catch(() => {}),
            unlink(tempCoverPath).catch(() => {})
        ]);

        return {
            status: true,
            title,
            artist,
            album,
            albumArtist,
            releaseDate,
            songUrl,
            coverUrl,
            file_path: finalOutputPath
        };

    } catch (err) {
        const rawFallback = finalOutputPath.replace('.flac', '_raw.flac');
        await rename(tempAudioPath, rawFallback);
        throw new Error(err.stack);
    }
}

export async function searchTrack(input) {
    try {
       if (Func.isUrl(input)) {
          const data = await fetch(`https://tidal.squid.wtf/api/songlink?url=${encodeURIComponent(input)}&userCountry=US&songIfSingle=true&preferBackup=true`, {
             headers: {
                "sec-ch-ua": "\"Chromium\";v=\"139\", \"Not;A=Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": "\"Android\"",
                "Referer": "https://tidal.squid.wtf/",
                "Referrer-Policy": "strict-origin-when-cross-origin"
             }
          });
          const result = await data.json();
          const entities = result.entitiesByUniqueId || {};

          let tidalId = null;
          for (const key in entities) {
              const e = entities[key];
              if (e.apiProvider === "tidal") {
                  tidalId = e.id;
                  break;
              }
          }

          if (!tidalId) throw new Error("Tidal ID tidak ditemukan dari URL.");

          return {
              id: tidalId,
              source: "url"
          };

       } else {
          const data = await fetchWithFailover(`/search/?s=${encodeURIComponent(input)}`);

          return data.data.items.map(t => ({
              id: t.id,
              title: t.title,
              artist: t.artists?.map(a => a.name).join(", ").replace(/, ([^,]+)$/, " & $1") || "Unknown Artist",
              album: t.album.title,
              duration: formatDuration(t.duration),
              copyright: t.copyright,
              track_url: `https://music.binimum.org/track/${t.id}`,
              thumbnail: buildThumbnail(t.album.cover),
              quality: t.mediaMetadata.tags && t.mediaMetadata.tags[1]
                  ? 'Hi-Res • up to 24-bit/192 kHz FLAC'
                  : 'CD • 16-bit/44.1 kHz FLAC',
          }));
       }
    } catch (e) {
       throw new Error(e.stack);
    }
}

class MusicLinkConverter {
    constructor() {
        this.baseUrl = 'https://musiclinkconverter.com/convert';
    }

    generateHeaders() {
        return {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'referer': 'https://musiclinkconverter.com/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'
        };
    }

    extractDataFromHTML(html) {
        const $ = cheerio.load(html);
        
        const title = $('title').text().split('|')[0].trim();
        const tidalUrl = $('a.card.tidal').attr('href');
        const spotifyUrl = $('a.card.spotify').attr('href');
        const tidalImage = $('a.card.tidal img').attr('src');
        const spotifyImage = $('a.card.spotify img').attr('src');
        
        const artists = [];
        $('p.meta-text').each((i, el) => {
            const text = $(el).text().trim();
            if (text && !text.includes('song') && !text.includes(':')) {
                artists.push(text);
            }
        });

        const durations = [];
        $('time').each((i, el) => {
            durations.push($(el).text().trim());
        });

        return {
            title,
            artists: [...new Set(artists)],
            tidalUrl,
            spotifyUrl,
            tidalImage,
            spotifyImage,
            durations: [...new Set(durations)]
        };
    }

    async convert(spotifyUrl) {
        const headers = this.generateHeaders();

        const params = new URLSearchParams({
            url: spotifyUrl
        });

        const url = `${this.baseUrl}?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }

        const html = await response.text();
        const extractedData = this.extractDataFromHTML(html);

        return {
            success: true,
            originalUrl: spotifyUrl,
            ...extractedData
        };
    }
}
export const searchUrl = new MusicLinkConverter();
