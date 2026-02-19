
let timeout = 60000

let handler = async (m, { conn, usedPrefix }) => {
conn.asahotak = conn.asahotak ? conn.asahotak : {}
let id = m.chat
if (id in conn.asahotak)
return await conn.reply(m.chat, '🍮 *Masih ada pertanyaan yang belum dijawab di chat ini!*', { quoted: conn.asahotak[id][0] })

try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/asahotak.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]

let caption = `
🍩 *Asah Otak!*
💭 *Soal: ${json.soal}*
⏱️ *Waktu: ${(timeout / 1000).toFixed(2)} detik*
🍬 *Hint: Ketik ${usedPrefix}hotak untuk bantuan*
`.trim()

conn.asahotak[id] = [
await m.reply(caption),
json,
4,
setTimeout(async() => {
if (conn.asahotak[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis!*\n🧠 *Jawabannya: ${json.jawaban}*`, { quoted: conn.asahotak[id][0] })
delete conn.asahotak[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['asahotak']
handler.category = ['fun']

export default handler
