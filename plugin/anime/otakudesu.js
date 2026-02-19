import { otakudesu } from '#scraper';

let handler = async (m, { conn, usedPrefix, command, text, loading }) => {
    const args = text.split(' ');
    const isDownload = args[0] === '-d'
    if (!args) {
        try {
            await loading()
            const ongoingAnimeList = await otakudesu.ongoing();
            if (!ongoingAnimeList || ongoingAnimeList.length === 0) {
                return await m.reply('*🍓 Gagal mengambil data anime ongoing. API mungkin sedang tidak stabil atau tidak ada data.*');
            }

            let replyText = '🔥 *OTAKUDESU ONGOING* 🔥\n\n';
            for (let i = 0; i < Math.min(10, ongoingAnimeList.length); i++) {
                let anime = ongoingAnimeList[i];
                replyText += `${i + 1}. *${anime.title}*\n`;
                replyText += `   Episode: ${anime.episode}\n`;
                replyText += `   Update: ${anime.type || 'N/A'}, ${anime.date || 'N/A'}\n`;
                replyText += `   Link: ${anime.link}\n\n`;
            }
            replyText += `💡 *Ketik ${usedPrefix}otakudesu [link anime otakudesu] untuk melihat detail.*\n`;
            replyText += `📝 *Contoh: ${usedPrefix}otakudesu ${ongoingAnimeList[0]?.link || 'https://otakudesu.cloud/anime/nama-anime-sub-indo'}*`;
            
            await conn.sendMessage(m.chat, {
                text: replyText 
            }, { quoted: m });

        } finally {
            await loading(true)
        }
    } else if (isDownload) {
        const episodeUrl = args[1];
        if (!episodeUrl) return m.reply('URL episode tidak valid');

        try {
            await loading();
            const data = await otakudesu.download(episodeUrl);

            let msg = `🔥 *OTAKUDESU DOWNLOAD* 🔥\n\n`;
            msg += `*${data.title}*\n\n`;

            for (let dl of data.downloads) {
                msg += `• ${dl.quality} - ${dl.host}\n${dl.link}\n\n`;
            }

            return conn.sendMessage(m.chat, { text: msg }, { quoted: m });

        } finally {
            await loading(true);
        }
    } else if (text.startsWith('http')) {
        try {
            await loading()
            const data = await otakudesu.detail(text); 
            const eps = await otakudesu.episodes(text);
            if (!eps.length && !data) return await m.reply('*🍓 Anime tidak ditemukan atau gagal mengambil detail. Periksa kembali URL atau API sedang bermasalah.*');
            
            let animeDetails = data.animeInfo
            let teks = `🔥 *OTAKUDESU DETAIL* 🔥
━━━━━━━━━━━━━━━━━━━
✨ *Judul: ${animeDetails.title}*
📌 *Status: ${animeDetails.status}*
🎬 *Total Episode: ${animeDetails.totalEpisodes || 'Unknown'}*
⏱️ *Durasi: ${animeDetails.duration || 'N/A'}*
⭐ *Score: ${animeDetails.score || 'N/A'}*
🧸 *Producer: ${animeDetails.producer || 'N/A'}*
🏢 *Studio: ${animeDetails.studio || 'N/A'}*
🎀 *Genre: ${animeDetails.genres || 'N/A'}*
━━━━━━━━━━━━━━━━━━━
📖 *Sinopsis:*
${animeDetails.synopsis || 'undefined'}
━━━━━━━━━━━━━━━━━━━`;

            const lists = eps.slice(0, 50).map((ep, i) => ({
                title: ep.title,
                description: `Download ${ep.title}`,
                id: `${usedPrefix + command} -d ${ep.link}`,
            }));
            
            return await conn.sendButton(m.chat, {
                image: { url: animeDetails.imageUrl },
                caption: teks,
                footer: "",
                interactiveButtons: [
                    {
                        name: "single_select",
                        buttonParamsJson: {
                            title: `List Episode`,
                            sections: [
                                {
                                     title: animeDetails.title,
                                     rows: lists,
                                },
                            ],
                        },
                    },
                ],
            }, { quoted: m });

        } finally {
            await loading(true)
        }
    } else {
        try {
            await loading()
            const searchAnime = await otakudesu.search(args);
            if (!searchAnime || searchAnime.length === 0) {
                return await m.reply(`*🍓 Gagal mencari anime ${text}. API mungkin sedang tidak stabil atau tidak ada data.*`);
            }

            let replyText = '🔥 *OTAKUDESU SEARCH* 🔥\n\n';
            for (let i = 0; i < Math.min(10, searchAnime.length); i++) {
                let anime = searchAnime[i];
                replyText += `${i + 1}. *${anime.title}*\n`;
                replyText += `   Status: ${anime.status}\n`;
                replyText += `   Rating: ${anime.rating}\n`;
                replyText += `   Link: ${anime.link}\n\n`;
            }
            replyText += `💡 *Ketik ${usedPrefix}otakudesu [link anime otakudesu] untuk melihat detail.*\n`;
            replyText += `📝 *Contoh: ${usedPrefix}otakudesu ${searchAnime[0]?.link || 'https://otakudesu.cloud/anime/nama-anime-sub-indo'}*`;
            
            await conn.sendMessage(m.chat, {
                text: replyText 
            }, { quoted: m });

        } finally {
            await loading(true)
        }
    }
};

handler.command = ['otakudesu'];
handler.category = ['anime'];

export default handler;
