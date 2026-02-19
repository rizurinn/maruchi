let timeout = 120000
let handler = async (m, { conn, usedPrefix }) => {
conn.tebakbendera = conn.tebakbendera || {}
let id = m.chat
if (id in conn.tebakbendera)
return await conn.reply(m.chat, '🍩 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebakbendera[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebakbendera.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🍰 *Tebak Bendera!*
🚩 *Coba tebak bendera di atas yaa!*
⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Hint: Ketik ${usedPrefix}teben untuk bantuan*
`.trim()
conn.tebakbendera[id] = [
await conn.sendMessage(m.chat, {
image: { url: json.img },
fileName: 'tebakbendera.jpg',
mimetype: 'image/jpeg',
caption: caption
}, {
quoted: m
}),
json,
4,
setTimeout(async() => {
if (conn.tebakbendera[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis!*\n🏳️ *Jawabannya: ${json.name}*`, { quoted: conn.tebakbendera[id][0] })
delete conn.tebakbendera[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['tebakbendera']
handler.category = ['fun']

export default handler
