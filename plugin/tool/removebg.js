import { removeBg } from '../../lib/scraper/removeBg.js'
let handler = async (m, { conn, usedPrefix, command, loading }) => {
    const quoted = m.quoted ? m.quoted : m
    const mime = quoted.mime || ''
    if (!/image/.test(mime)) return await m.reply(`🍭 *Kirim/kutip gambar dengan caption ${usedPrefix + command}*`)

    try {
        await loading()
        const media = await quoted.download()
        const result = await removeBg(media)
        await conn.sendMessage(m.chat, { image: { url: result }, caption: '' }, { quoted: m })
        return;
    } finally {
        await loading()
    }
}

handler.command = ["removebg", "rmbg"]
handler.category = ["tool"]

export default handler