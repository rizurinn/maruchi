let handler = async (m, { text, conn, usedPrefix, command }) => {
    const q = m.quoted || m;
    const mime = q.mime || "";
    const txt = text || "";

    let msg = '@all';
    if (!txt) {
        msg = null;
    } else if (txt) {
        msg += ' ' + txt.trim();
    }

    const opt = {
        contextInfo: {
            nonJidMentions: 1
        }
    };

    if (mime) {
        const media = await q.download();
        const content = {};

        if (/image/.test(mime)) content.image = media;
        else if (/video/.test(mime)) content.video = media;
        else if (/audio/.test(mime)) {
            content.audio = media;
            content.ptt = true;
        } else if (/document/.test(mime)) {
            content.document = media;
            content.mimetype = mime;
            content.fileName = "file";
        } else return await m.reply("🍓 *Media tidak valid*");

        content.caption = msg;
        content.contextInfo = {
            nonJidMentions: 1
        };
        
        await conn.sendMessage(m.chat, content, opt);
    } else if (msg) {
        const content = {
            text: msg,
            contextInfo: {
                nonJidMentions: 1
            }
        };
        return await conn.sendMessage(m.chat, content, opt);
    } else {
        return await m.reply(`🍭 *Kirim atau reply media/teks dengan perintah: ${usedPrefix + command}*`);
    }
};

handler.command = ['hidetag', 'h']
handler.category = ['group']
handler.restrict = {
groupOnly: true,
adminOnly: true }

export default handler;
