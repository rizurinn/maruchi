import { readdirSync, rmSync } from "fs";

let handler = async (m) => {
    const dir = "./tmp";
    readdirSync(dir).forEach((f) => rmSync(`${dir}/${f}`));
    return await m.reply(`🍩 *Folder tmp sudah berhasil dibersihkan~* 🍰\n🍓 *Sekarang jadi lebih rapi*`);
};

handler.command = ["cleartmp"];
handler.category = ["owner"];
handler.restrict = {
ownerOnly: true }

export default handler;
