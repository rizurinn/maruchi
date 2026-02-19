
let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.tebakgambar = conn.tebakgambar || {}
let id = m.chat
if (id in conn.tebakgambar)
return await conn.reply(m.chat, '🍩 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebakgambar[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebakgambar.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🍰 *Tebak Gambar!*
🍡 *Petunjuk: ${json.deskripsi}*
⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Hint: Ketik ${usedPrefix}hgamb untuk bantuan*
`.trim()
conn.tebakgambar[id] = [
await conn.sendMessage(m.chat, {
image: { url: json.img },
fileName: 'tebakgambar.jpg',
mimetype: 'image/jpeg',
caption: caption
}, {
quoted: m
}),
json,
4,
setTimeout(async() => {
if (conn.tebakgambar[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis! Jawabannya adalah ${json.jawaban}*`, { quoted: conn.tebakgambar[id][0] })
delete conn.tebakgambar[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.category = ['fun']
handler.command = ['tebakgambar']

export default handler
