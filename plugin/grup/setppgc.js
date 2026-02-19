let handler = async (m, { conn, usedPrefix, command }) => {
    let q = m.quoted ? m.quoted : m
    if (!q || !/image/.test(q.mime))
        return await m.reply(`🍙 *Balas atau kirim gambar dengan perintah: ${usedPrefix + command}*`);
    let media = await q.download();
    return await conn.updateProfilePicture(m.chat, media);
};

handler.command = ["setppgc"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;
