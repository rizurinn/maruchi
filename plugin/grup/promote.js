let handler = async (m, { conn, args, usedPrefix, command }) => {
    let targets = [];
    
    if (m.quoted) targets.push(m.quoted.sender);
    
    if (m.mentionedJid && m.mentionedJid.length) {
        targets.push(...m.mentionedJid);
    }
    
    for (let arg of args) {
        if (/^\d{5,}$/.test(arg)) {
            let jid = arg.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            targets.push(jid);
        }
    }

    targets = [...new Set(targets)];
    if (!targets.length)
        return await m.reply(`🍭 *Reply/tag pengguna yang akan di promosikan.*\n*${usedPrefix + command} @user*`);

    let msg = `🍓 *Promote selesai!*\n`;
    for (let target of targets) {
        try {
            let res = await conn.groupParticipantsUpdate(m.chat, [target], "promote");
            if (res[0]?.status === "200") {
                msg += `🧁 *Berhasil dinaikkan admin:* @${target.split("@")[0]}\n`;
            } else {
                msg += `🍩 *Gagal promote:* @${target.split("@")[0]}\n`;
            }
        } catch (e) {
            console.error(e);
            msg += `🍩 *Error promote:* @${target.split("@")[0]}\n`;
        }
        await delay(1500);
    }
    return await m.reply(msg.trim());
};

handler.command = ["promote"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));