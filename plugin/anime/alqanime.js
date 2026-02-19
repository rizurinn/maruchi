import { alqanime } from '#scraper';

const handler = async (m, { conn, text, args, usedPrefix, command, loading }) => {
    if (!args[0]) {
        // --- Fitur 1: Menampilkan Anime Terbaru ---
        try {
            await loading()
            const latest = await alqanime.getLatestAnime();
            
            if (!latest.success || latest.data.length === 0) {
                return m.reply('🍓 *Gagal mendapatkan daftar anime terbaru atau tidak ada hasil.*');
            }
            
            let message = '✨ *Anime Terbaru di AlqAnime*\n\n';
            latest.data.forEach((anime, index) => {
                message += `${index + 1}. *${anime.title}*\n`;
                message += `   - Episode Terbaru: ${anime.latestEp}\n`;
                message += `   - Tipe: ${anime.type}\n`;
                message += `   - URL: ${anime.link}\n\n`;
            });
            message += `Gunakan *${usedPrefix}${command} <query>* untuk mencari anime atau *${usedPrefix}${command} <url>* untuk melihat detail.`;
            await conn.sendMessage(m.chat, { text: message }, { quoted: m });
        } finally {
            await loading(true)
        }
        return;
    }

    const firstArg = args[0].toLowerCase();

    if (firstArg === '-d') {
        // --- Fitur 4: Download Anime dengan Filter ---
        const url = args[1];
        if (!url || !url.startsWith(alqanime.baseUrl)) {
            return m.reply(`🍭 *Format salah. Gunakan:*\n*${usedPrefix}${command} -d <URL_ALQANIME> [episode] [provider]*`);
        }
        
        const episode = args[2] || null;
        const provider = args[3] ? [capitalize(args[3])] : ['MediaFire']; // Default providers
        const qualities = ['480p', '720p', '1080p']; // Kualitas yang dicari

        try {
            await loading()
            const result = await alqanime.getDownloadLinksFiltered(url, episode, provider, qualities);

            if (!result.success || result.data.episodes.length === 0) {
                return m.reply(`🍓 *Gagal mendapatkan link unduhan. Pastikan URL, episode, dan provider benar.*\n\n*Provider yang tersedia: AceFile, MediaFire, PixelDrain, Mirror, Google Drive (tidak semua ada).*`);
            }

            let dlMessage = `*📥 Link Unduhan untuk ${result.data.title}*\n\n`;
            result.data.episodes.forEach(ep => {
                dlMessage += `*${ep.episode}*\n`;
                ep.downloadLinks.forEach(quality => {
                    dlMessage += `  ◦ *${quality.quality}*:\n`;
                    quality.links.forEach(link => {
                        dlMessage += `    - ${link.provider}: ${link.url}\n`;
                    });
                });
                dlMessage += `\n`;
            });
            
            m.reply(dlMessage);

        } finally {
            await loading(true)
        }

    } else if (firstArg.startsWith(alqanime.baseUrl)) {
        // --- Fitur 3: Detail Anime ---
        try {
            await loading()
            const detail = await alqanime.getAnimeDetail(firstArg);

            if (!detail.success) {
                return m.reply(`🍓 *Gagal mendapatkan detail anime dari URL tersebut.*`);
            }
            
            const { title, image, synopsis, rating, info } = detail.data;
            let detailMessage = `🔥 *ALQANIME INFO* 🔥\n━━━━━━━━━━━━━━━━━━━\n`;
            detailMessage += `✨ *Judul: ${title}*\n`;
            detailMessage += `📌 *Status: ${info.Status || 'N/A'}*\n`;
            detailMessage += `🌥️ *Musim: ${info.Musim || 'N/A'}*\n`;
            detailMessage += `📺 *Type: ${info.Tipe || 'N/A'}*\n`;
            detailMessage += `🎬 *Total Episode: ${info.Episode || 'N/A'}*\n`;
            detailMessage += `⭐ *Rating: ${rating || 'N/A'}*\n`;
            detailMessage += `🏢 *Studio: ${info.Studio}*\n`;
            detailMessage += `🧸 *Casts: ${info.Casts}*\n`;
            detailMessage += `🎀 *Genre: ${info.Genre}*\n━━━━━━━━━━━━━━━━━━━\n`;

            detailMessage += `*Sinopsis:*\n${synopsis || 'Tidak tersedia.'}\n\n`;
            detailMessage += `Gunakan *${usedPrefix}${command} -d <url>* untuk mendapatkan link unduhan.`;

            if (image) {
                await conn.sendMessage(m.chat, { image: { url: image }, caption: detailMessage }, { quoted: m });
            } else {
                await m.reply(detailMessage);
            }

        } finally {
            await loading(true)
        }

    } else {
        // --- Fitur 2: Mencari Anime ---
        const query = text;
        try {
            await loading()
            const search = await alqanime.searchAnime(query);

            if (!search.success || search.data.length === 0) {
                return m.reply(`🍓 *Tidak ada hasil untuk pencarian "${query}".*`);
            }
            
            let searchMessage = `*Alqanime Search 🔍*\n\n`;
            search.data.slice(0, 10).forEach((anime, index) => { // Batasi 10 hasil
                searchMessage += `${index + 1}. *${anime.title}*\n`;
                searchMessage += `   - Tipe: ${anime.type}\n`;
                searchMessage += `   - Status: ${anime.status}\n`;
                searchMessage += `   - URL: ${anime.link}\n\n`;
            });
            searchMessage += `Gunakan *${usedPrefix}${command} <url>* dari hasil di atas untuk melihat detail.`;

            await conn.sendMessage(m.chat, { text: searchMessage }, { quoted: m });

        } finally {
            await loading(true)
        }
    }
};

handler.command = ['alqanime', 'alq'];
handler.category = ['anime'];

export default handler;

// Helper untuk membuat huruf pertama kapital
const capitalize = (s) => s && s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
