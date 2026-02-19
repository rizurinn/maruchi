let handler = async (m, { conn }) => {
let q = m.quoted ? m.quoted : m
if (!q.isMedia) return await m.reply('*Reply ke pesan sekali lihat!*')
let text = q.body
let media = await q.download?.()
await conn.sendFile(m.chat, media, null, text, m)
return
}

handler.category = ['tool']
handler.command = ['rvo']

export default handler