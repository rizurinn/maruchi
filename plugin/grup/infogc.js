let handler = async (m, { conn }) => {
let pp = await conn.profilePictureUrl(m.chat, 'image').catch(() => 'https://i.ibb.co.com/qYk6W2Zk/1221bc0bdd2354b42b293317ff2adbcf-icon.png')
const groupMetadata = m.isGroup ? (await conn.groupMetadata(m.chat).catch(() => null)) || {} : {};
const participants = m.isGroup ? groupMetadata.participants || [] : []
let groupAdmins = participants.filter(p => p.admin)
let listAdmin = groupAdmins.map((v, i) => `*${i + 1}.* @${v.id.split('@')[0]}`).join('\n')
let owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || m.chat.split`-`[0] + '@s.whatsapp.net'
const change = new Date(groupMetadata.subjectTime * 1000);
const dibuat = new Date(groupMetadata.creation * 1000);
let text = `🎀 *Info Grup Saat Ini* 🎀

🍡 *ID Grup: ${groupMetadata.id}*

🍰 *Nama Grup: ${groupMetadata.subject}*
🍜 *Dibuat pada: ${dibuat.toLocaleString('id-ID', setDate)} WIB*
🍣 *Terakhir diubah: ${change.toLocaleString('id-ID', setDate)} WIB*
🍓 *Jumlah Member: ${participants.length} orang*\n`

if (m.isBotAdmin) {
text += `
🍟 *Tautan grup: https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}*\n`
}
text += `
🍬 *Deskripsi:*
${groupMetadata.desc?.toString() || 'Belum ada deskripsi~'}

🍮 *Pemilik Grup:* @${owner.split('@')[0]}
🧁 *Admin Grup:*
${listAdmin}

`
return await conn.sendFile(m.chat, pp, null, text.trim(), m, null, { mentions: [...groupAdmins.map(v => v.id), owner] })
}

handler.command = ['infogc']
handler.category = ['group']
handler.restrict = {
groupOnly: true }

export default handler

const setDate = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta'
};
