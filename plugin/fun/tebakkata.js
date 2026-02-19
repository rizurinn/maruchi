let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.tebakkata = conn.tebakkata || {}
let id = m.chat
if (id in conn.tebakkata)
return await conn.reply(m.chat, '🍩 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebakkata[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebakkata.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🍡 *Tebak Kata!*
🍰 *Soal: ${json.soal}*
⏱️ *Timeout: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Bantuan: Ketik ${usedPrefix}teka*
`.trim()
conn.tebakkata[id] = [
await m.reply(caption),
json,
4,
setTimeout(async() => {
if (conn.tebakkata[id]) {
await conn.reply(m.chat, `🍭 *Waktu habis!* Jawabannya adalah *${json.jawaban}*`, { quoted: conn.tebakkata[id][0] })
delete conn.tebakkata[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['tebakkata']
handler.category = ['fun']

export default handler
