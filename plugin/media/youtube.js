import { unlink, stat } from "fs/promises";
import { ytApi, ytAudio, ytVideo } from '#scraper';

const TMP_DIR = './tmp';

const handler = async (m, { conn, text, usedPrefix, command, args, Func, loading }) => {
    const type = args[0]?.toLowerCase();
    
    if (['mp3', 'a', 'mp4', 'v'].includes(type)) {
        const url = global.validUrl(m, 'youtube');
        if (!url) return m.reply(`🍭 *Url tidak valid!*`);

        try {
            await loading();

            // --- DOWNLOAD AUDIO (MP3) ---
            if (['mp3', 'a'].includes(type)) {
                // List resolusi audio yang diizinkan
                const qualityList = ['96', '128', '192', '256', '320'];
                
                // Deteksi input resolusi dari args[2], default ke '128' jika tidak valid/kosong
                let q = '128';
                if (args[2] && qualityList.includes(args[2])) {
                    q = args[2];
                }

                const info = await ytAudio(url, q, TMP_DIR);
                const filePath = info?.file_path;
                
                if (!filePath) throw new Error(`Gagal mendapatkan file audio (${q}kbps).`);

                // Get Thumbnail
                let thumb;
                try {
                    const res = await fetch(info.thumbnail);
                    thumb = await Func.reSize(Buffer.from(await res.arrayBuffer()), 256, 256);
                } catch {}

                await conn.sendMessage(m.chat, {
                    document: { url: filePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${info.title}.mp3`,
                    ...(thumb ? { jpegThumbnail: thumb } : {}),
                }, { quoted: m });

                // Cleanup
                if (filePath) await unlink(filePath).catch(() => {});
                return;
            }

            // --- DOWNLOAD VIDEO (MP4) ---
            if (['mp4', 'v'].includes(type)) {
                // List resolusi video yang diizinkan
                const qualityList = ['320', '480', '720', '1080'];

                // Deteksi input resolusi dari args[2], default ke '480' jika tidak valid/kosong
                let q = '480';
                if (args[2] && qualityList.includes(args[2])) {
                    q = args[2];
                }

                const info = await ytVideo(url, q, TMP_DIR);
                const filePath = info?.file_path;

                if (!filePath) throw new Error(`Gagal mendapatkan file video (${q}p).`);

                let size = (await stat(filePath)).size;
                const isBig = size > 100 * 1024 * 1024; // Limit 100MB

                if (isBig) {
                    await conn.sendMessage(m.chat, {
                        document: { url: filePath },
                        mimetype: 'video/mp4',
                        fileName: `${info.title}.mp4`,
                        contextInfo: {
                            externalAdReply: {
                                title: info.title,
                                body: `YouTube Video (${info.quality || q})`,
                                thumbnailUrl: info.thumbnail,
                                mediaUrl: url,
                                mediaType: 2,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted: m });
                } else {
                    await conn.sendMessage(m.chat, {
                        video: { url: filePath },
                        mimetype: 'video/mp4',
                        fileName: `${info.title}.mp4`,
                        caption: `*${info.title}*\nQuality: ${info.quality || q}p`
                    }, { quoted: m });
                }

                // Cleanup
                if (filePath) await unlink(filePath).catch(() => {});
                return;
            }

        } finally {
            await loading(true);
        }
    }

    const url = global.validUrl(m, 'youtube');
    if (!text && !url) {
        return await m.reply(`🍭 *YouTube Search & Download*

*Info: Mendukung pencarian query dan download url.*
*Penggunaan:*
${usedPrefix + command} <query>
${usedPrefix + command} <url>

*Downloader:*
${usedPrefix + command} mp3 <url> [quality]
${usedPrefix + command} mp4 <url> [quality]

*Quality List:*
Audio: 96, 128, 192, 256, 320 (default: 128)
Video: 320, 480, 720, 1080 (default: 480)

*Contoh: ${usedPrefix + command} mp4 https://youtu.be/68IrG8pAAhw 1080*
_Catatan: Video YouTube dengan batasan wilayah mungkin tidak tersedia._`);
    }

    // --- MODE: URL INFO ---
    if (url) {
        try {
            await loading();
            const videoInfo = await ytApi.getVideoInfo(url);
            if (!videoInfo || !videoInfo.title) {
               return await m.reply("*🍓 Tidak ada data atau video dibatasi.*");
            }

            const caption = `*YouTube Result*✨
━━━━━━━━━━━━━━━━━━━
🍨 *Judul: ${videoInfo.title}*
🧁 *Channel: ${videoInfo.channel.title}*
🍩 *Durasi: ${videoInfo.duration}*
🍙 *URL: ${videoInfo.videoUrl}*
━━━━━━━━━━━━━━━━━━━`.trim();

            await conn.sendButton(m.chat, {
               image: {url: videoInfo.thumbnail},
               caption: caption,
               footer: '',
               interactiveButtons: [
                   {
                       name: 'quick_reply',
                       buttonParamsJson: {
                           display_text: '🌈 Video',
                           id: `${usedPrefix + command} mp4 ${videoInfo.videoUrl}`
                       }
                   },
                   {
                       name: 'quick_reply',
                       buttonParamsJson: {
                           display_text: '🫧 Audio',
                           id: `${usedPrefix + command} mp3 ${videoInfo.videoUrl}`
                       }
                   },
               ],
               hasMediaAttachment: true,
            }, { quoted: m });
        } finally {
            await loading(true);
        }

    // --- MODE: SEARCH QUERY ---
    } else {
        try {
            await loading();
            const ytsSearch = await ytApi.search({ query: text, maxResults: 10 });
            if (!ytsSearch || !ytsSearch.items.length) {
                return await m.reply("*🍓 Video tidak ditemukan!*");
            }
            const results = ytsSearch.items.slice(0, 10);
            const cards = results.map((res) => ({
                image: res.thumbnail,
                body: `🧁 *${res.title}*\n${res.channel}`,
                footer: `🍡 ${res.publishedAt}`,
                buttons: [
                   {
                       name: 'quick_reply',
                       buttonParamsJson: {
                           display_text: '🌈 Video',
                           id: `${usedPrefix + command} mp4 ${res.videoUrl}`
                       }
                   },
                   {
                       name: 'quick_reply',
                       buttonParamsJson: {
                           display_text: '🫧 Audio',
                           id: `${usedPrefix + command} mp3 ${res.videoUrl}`
                       }
                   },
                   {
                       name: 'cta_url',
                       buttonParamsJson: {
                            display_text: '🍄 Tautan',
                            id: res.videoUrl,
                            copy_code: res.videoUrl
                       }
                   }
                ]
            }));
            await conn.sendCard(m.chat, {
                title: `🍩 Hasil pencarian YouTube untuk: *${text}*`,
                footer: "",
                cards
            }, { quoted: m });
        } finally {
            await loading(true);
        }
    }
};

handler.command = ["youtube", "yt"];
handler.category = ["media"];

export default handler;