let timeout = 180000

let handler = async (m, { conn, usedPrefix }) => {
conn.susunkata = conn.susunkata || {}
let id = m.chat
if (id in conn.susunkata)
return await conn.reply(m.chat, '🍪 *Masih ada soal yang belum dijawab di sini, ya!*', { quoted: conn.susunkata[id][0] })

try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/susunkata.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]

let caption = `
🍰 *Susun Kata!*
🍡 *Soal: ${json.soal}*
📮 *Tipe: ${json.tipe}*
⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Hint: Ketik ${usedPrefix}suska untuk bantuan*
`.trim()

conn.susunkata[id] = [
await conn.reply(m.chat, caption, { quoted: m }),
json,
4,
setTimeout(async() => {
if (conn.susunkata[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis! Jawabannya adalah ${json.jawaban}*`, { quoted: conn.susunkata[id][0] })
delete conn.susunkata[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.category = ['fun']
handler.command = ['susunkata', 'sskata']

export default handler
