let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.caklontong = conn.caklontong ? conn.caklontong : {}
let id = m.chat
if (id in conn.caklontong)
return await conn.reply(m.chat, '❗ *Masih ada soal belum terjawab di chat ini!*', { quoted: conn.caklontong[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/caklontong.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🧠 *Cak Lontong Quiz!*
❓ *Soal: ${json.soal}*

⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
💡 *Hint: Ketik ${usedPrefix}calo untuk bantuan*
`.trim()
conn.caklontong[id] = [
await conn.reply(m.chat, caption, { quoted: m }),
json,
4,
setTimeout(async() => {
if (conn.caklontong[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis!*\n✅ *Jawaban:* ${json.jawaban}\n📖 *Penjelasan:* ${json.deskripsi}`, { quoted: conn.caklontong[id][0] })
delete conn.caklontong[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['caklontong']
handler.category = ['fun']

export default handler
