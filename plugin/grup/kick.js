let handler = async (m, { conn, args, participants, usedPrefix, command }) => {
    let t = m.mentionedJid?.[0] || m.quoted?.sender || null;
    if (!t && args[0]) {
        const num = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const lid = await conn.signalRepository.lidMapping.getLIDForPN(num);
        if (lid) t = lid;
    }
    if (!t && args[0]) {
        const raw = args[0].replace(/[^0-9]/g, "") + "@lid";
        if (participants.some((p) => p.id === raw)) t = raw;
    }

    if (!t || !participants.some(p => p.id === t || p.lid === t)) return await m.reply(`🍭 *Tag atau reply anggota yang ingin dikeluarkan!*\n*Contoh: ${usedPrefix + command} 628xx*`)

    await conn.groupParticipantsUpdate(m.chat, [t], "remove");
    return await conn.sendMessage(m.chat, {
            text: `🌸 *Selamat tinggal* @${t.split("@")[0]}`,
            mentions: [t],
    },{ quoted: m });
};

handler.disabled = true;
handler.command = ["kick", "dor"];
handler.category = ['group'];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true };

export default handler;
