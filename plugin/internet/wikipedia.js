import  { wikiUrl, wikiSearch, wikiSummary } from '#scraper';

const handler = async (m, { conn, args, usedPrefix, command, loading }) => {
    if (!args[0]) return await m.reply(`🍭 *Gunakan:*\n*${usedPrefix + command} <query> untuk mencari*`)
    const firstArg = args[0].toLowerCase();
    const valid = global.validUrl(m, 'wikipedia');
    if (firstArg === '-s') {
        if (!args[1]) {
            return await m.reply(`🍭 *Masukkan kata kunci pencarian.*\n*Contoh: ${usedPrefix}${command} -s <query>*`);
        }
        try {
            await loading()
            const query = args.join(' ').split('-s')[1]
            const result = await wikiSummary(query);
            if (!result.success) {
                return await m.reply(`🍓 *Artikel dengan query "${query}" tidak ditemukan.*`);
            }
            const { title, description, extract, thumbnail, url } = result;
            let replyText = `*${title}*\n`;
            if (description) replyText += `_${description}_\n\n`;
            replyText += `${extract}\n\n`;
            replyText += `*Link:* ${url}\n\n`;
            replyText += `💡 *Gunakan ${usedPrefix + command} <url> untuk detail lengkap*`;

            if (thumbnail) {
                await conn.sendMessage(m.chat, {
                   image: { url: thumbnail },
                   caption: replyText
                }, { quoted: m });
            } else {
                await m.reply(replyText);
            }
        } finally {
            await loading(true)
        }
    } else if (valid) {
        try {
            await loading()
            const data = await wikiUrl(valid);
            if (!data.success) {
                return await m.reply(`🍓 *Gagal mendapatkan detail dari URL tersebut.*`);
            }
            let replyText = `*${data.contentTitle}*\n\n`;
            replyText += data.content.join('\n\n');
        
            const infoboxEntries = Object.entries(data.infobox);
            if (infoboxEntries.length > 0) {
                replyText += '\n\n--- *InfoBox* ---\n';
                for (const [key, value] of infoboxEntries) {
                   if (value) replyText += `*${key}:* ${value}\n`;
                }
            }
            replyText += `\n*Link:* ${data.url}`;

            const thumbnail = data.images?.[0];
            if (thumbnail) {
                await conn.sendMessage(m.chat, {
                   image: { url: thumbnail },
                   caption: replyText,
                }, { quoted: m });
            } else {
                await m.reply(replyText);
            }
        } finally {
            await loading(true)
        }
    } else {
        try {
            await loading()
            const query = args.join(' ');
            const search = await wikiSearch(query);
            if (!search.success || search.results.length === 0) {
                return await m.reply(`🍓 *Artikel dengan query "${query}" tidak ditemukan.*`);
            }
            
            let message = '📰 *Wikipedia Search*\n\n';
            search.results.forEach((res, index) => {
                message += `${index + 1}. *${res.title}*\n`;
                message += `   - ${res.description}\n`;
                message += `   - URL: ${res.url}\n\n`;
            });
            message += `Gunakan *${usedPrefix}${command} -s <query>* untuk mencari summary atau *${usedPrefix}${command} <url>* untuk melihat detail.`;
            await m.reply(message);
        } finally {
            await loading(true)
        }
    }
};

handler.command = ['wikipedia', 'wiki'];
handler.category = ['internet'];

export default handler;
