const handler = async (m, { conn, text, usedPrefix, command, loading }) => {
    if (!text) return m.reply(`🍭 *Brat Sticker*

*Penggunaan:*
${usedPrefix + command} -v <teks> - Membuat sticker animasi
${usedPrefix + command} <teks> - Membuat sticker statis`);
    try {
        await loading()
        let buff;
        if (text.includes('-v')) {
           const res = await fetch(`https://brat.siputzx.my.id/mp4?text=${encodeURIComponent(text.replace('-v', ''))}`);
           buff = Buffer.from(await res.arrayBuffer());
        } else {
           const res = await fetch(`https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}`);
           buff = Buffer.from(await res.arrayBuffer());
        }
        return await conn.sendAsSticker(m.chat, buff, m, { pack: global.config.packnames, author: global.config.authors });
    } finally {
        await loading(true)
    }
};

handler.command = ['brat'];
handler.category = ['maker'];

export default handler;
