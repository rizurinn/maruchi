
let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.tebaklogo = conn.tebaklogo || {}
let id = m.chat
if (id in conn.tebaklogo)
return await conn.reply(m.chat, '🍩 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebaklogo[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebaklogo.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🍰 *Tebak Logo!*
🧁 *Deskripsi: ${json.deskripsi}*
⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Hint: Ketik ${usedPrefix}hlogo untuk bantuan*
`.trim()
conn.tebaklogo[id] = [
await conn.sendMessage(m.chat, {
image: { url: json.img },
fileName: 'tebaklogo.jpg',
mimetype: 'image/jpeg',
caption: caption
}, {
quoted: m
}),
json,
4,
setTimeout(async() => {
if (conn.tebaklogo[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis! Jawabannya adalah ${json.jawaban}*`, { quoted: conn.tebaklogo[id][0] })
delete conn.tebaklogo[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['tebaklogo']
handler.category = ['game']

export default handler
