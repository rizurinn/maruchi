let groupCache = new Map();

let handler = async (m, { conn, text, usedPrefix, command }) => {
    try {
        const allGroups = await conn.groupFetchAllParticipating();
        const groupList = Object.values(allGroups);
        const sender = m.sender;

        if (!text) {
            let txt = `🍭 *Broadcast Status Group:*

*Penggunaan: Kirim/Reply media*
${usedPrefix + command} all | [pesan]
${usedPrefix + command} 1,2,3 | [pesan]

🍡 *Daftar Grup WhatsApp:*\n` + 
groupList.map((g, i) => `${i + 1}. *${g.subject}* (${g.id})`).join('\n');

            groupCache.set(sender, groupList.map(g => g.id));
            return m.reply(txt);
        }

        if (!text.includes('|')) {
            return m.reply(`🍰 *Format salah!*\nContoh:\n\`${usedPrefix + command} all | Pesan\`\n\`${usedPrefix + command} 1,2 | Pesan\``);
        }

        const [indexPart, ...contentPart] = text.split('|');
        const broadcastText = contentPart.join('|').trim();

        const cachedIds = groupCache.get(sender);
        if (!cachedIds) {
            return m.reply(`🍓 *Cache group belum ada.*\nKetik \`${usedPrefix + command}\` dulu.`);
        }

        let targetGroups = [];

        if (indexPart.trim().toLowerCase() === 'all') {
            targetGroups = cachedIds;
        } else {
            const selectedIndices = indexPart.split(',')
                .map(v => parseInt(v.trim()) - 1)
                .filter(v => !isNaN(v));

            targetGroups = selectedIndices
                .filter(i => cachedIds[i])
                .map(i => cachedIds[i]);
        }

        if (targetGroups.length === 0)
            return m.reply('🍰 *Nomor group tidak valid!*');

        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mime || '';
        let content = {};
        const contextInfo = { isGroupStatus: true };
        const caption = broadcastText || quoted.body || "";

        if (/image/.test(mime)) {
            const buf = await quoted.download();
            content = { image: buf, caption, contextInfo };
        } else if (/video/.test(mime)) {
            const buf = await quoted.download();
            content = { video: buf, caption, contextInfo };
        } else if (/audio/.test(mime)) {
            const buf = await quoted.download();
            content = { audio: buf, mimetype: "audio/mp4", contextInfo };
        } else {
            content = { text: broadcastText, contextInfo };
        }

        await m.reply(`🍣 *Mengirim broadcast ke ${targetGroups.length} grup...*`);

        let successCount = 0;
        for (const jid of targetGroups) {
            try {
                await conn.sendMessage(jid, content);
                successCount++;
                await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
                m.reply(`🍓 *Gagal mengirim ke ${jid}*\n${err.message}`);
            }
        }

        return m.reply(`🌸 *Selesai!* Berhasil mengirim ke ${successCount} grup.`);
    } catch (e) {
        return m.reply('🍓 *Error:* ' + e.message);
    }
};

handler.command = ['bswgc'];
handler.category = ['owner'];
handler.restrict = { ownerOnly: true };

export default handler;
