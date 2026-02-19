
let timeout = 120000

let handler = async (m, { conn, usedPrefix }) => {
conn.tebakkimia = conn.tebakkimia || {}
let id = m.chat
if (id in conn.tebakkimia)
return await conn.reply(m.chat, '🍩 *Masih ada soal yang belum dijawab di chat ini!*', { quoted: conn.tebakkimia[id][0] })
try {
let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/tebakkimia.json')
if (!res.ok) throw await res.text()
let src = await res.json()
let json = src[Math.floor(Math.random() * src.length)]
let caption = `
🧪 *Tebak Kimia!*
*Silahkan Tebak Kepanjangan Dari Unsur "${json.lambang}"*

⏱️ *Timeout ${(timeout / 1000).toFixed(2)} detik*
💡 *Hint: Ketik ${usedPrefix}hmia untuk bantuan*
`.trim()
conn.tebakkimia[id] = [
await m.reply(caption),
json,
4,
setTimeout(async() => {
if (conn.tebakkimia[id]) {
await conn.reply(m.chat, `⏰ *Waktu habis!*\n🔬 *Jawabannya adalah ${json.unsur}*`, { quoted: conn.tebakkimia[id][0] })
delete conn.tebakkimia[id]
}
}, timeout)
]
} catch {
await m.reply('🍓 *Gagal mendapatkan soal.*')
}
}

handler.command = ['tebakkimia']
handler.category = ['fun']
export default handler
