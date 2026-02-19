let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0])
        return await m.reply(`🍡 *Contoh penggunaan: ${usedPrefix + command} Ini deskripsi baru~*`);
    try {
        return await conn.groupUpdateDescription(m.chat, args.join(" "));
    } catch (e) {
        console.error(e);
        return await m.reply("🍬 *Gagal mengubah deskripsi grup.*");
    }
};

handler.command = ["setdesc"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;
