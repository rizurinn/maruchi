let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) return await m.reply(`🧁 *Contoh penggunaan: ${usedPrefix + command} Nama Grup Baru*`);
    try {
        await conn.groupUpdateSubject(m.chat, args.join(" "));
    } catch (e) {
        console.error(e);
        return await m.reply(
            "🍩 *Gagal mengganti nama grup, mungkin karena keterbatasan waktu atau bot bukan admin~*"
        );
    }
};

handler.command = ["setnamegc"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;
