let handler = async (m, { conn, args, usedPrefix, command }) => {
    let target = m.quoted?.sender || null;

    if (!target && args[0]) {
        const num = args[0].replace(/[^0-9]/g, "");
        if (num.length >= 5) target = num + "@s.whatsapp.net";
    }

    if (!target?.endsWith("@s.whatsapp.net")) {
        return m.reply(`🍭 *Contoh penggunaan:*\n*${usedPrefix + command} 628xxxx*`);
    }

    try {
        const res = await conn.groupParticipantsUpdate(m.chat, [target], "add");
        const user = res?.[0];

        if (user?.status === "200") {
            return await conn.sendMessage(
                m.chat,
                {
                    text: `🌸 *Berhasil menambahkan:* @${target.split("@")[0]}`,
                    mentions: [target],
                },
                { quoted: m }
            );
        }

        return m.reply(`🍓 *Gagal menambahkan. Status: ${user?.status || "unknown"}`);
    } catch (e) {
        return m.reply(`🍓 *Error: ${e.message}*`);
    }
};
handler.disabled = true;
handler.command = ["add"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;
