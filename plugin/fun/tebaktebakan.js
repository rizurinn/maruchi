
let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.tebaktebakan = conn.tebaktebakan || {}
let id = m.chat
if (id in conn.tebaktebakan) return await conn.reply(m.chat, '🍪 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebaktebakan[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebaktebakan.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🍰 *Tebak Tebakan!*
🍡 *Soal: ${json.soal}*
⏱️ *Waktu: ${(timeout / 1000).toFixed(0)} detik*
🍬 *Hint: Ketik ${usedPrefix}hkan untuk bantuan*
`.trim()
conn.tebaktebakan[id] = [
await m.reply(caption),
json,
4,
setTimeout(async() => {
if (conn.tebaktebakan[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis! Jawabannya adalah ${json.jawaban}*`, { quoted: conn.tebaktebakan[id][0] })
delete conn.tebaktebakan[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['tebaktebakan']
handler.category = ['fun']

export default handler
