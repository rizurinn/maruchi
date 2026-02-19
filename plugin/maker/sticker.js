let handler = async (m, { conn, usedPrefix, command, text }) => {
const quoted = m.quoted ? m.quoted : m
const mime = quoted.mime || ''
const qmsg = (quoted.msg || quoted)
if (!/image|video|sticker/.test(mime)) return await m.reply(`*🍭 Kirim/reply gambar/video/gif dengan caption ${usedPrefix + command}*\n*Durasi Image/Video/Gif 1-9 Detik*\n\n_Tambahkan teks setelah perintah untuk watermark custom_`)
let media = await quoted.download()
let teks1 = text.split`|`[0] ? text.split`|`[0] : ''
let teks2 = text.split`|`[1] ? text.split`|`[1] : ''
let packname = teks1 || global.config.packnames;
let author = teks2 || global.config.authors;
if (/image|webp/.test(mime)) {
await conn.sendAsSticker(m.chat, media, m, { 
pack: packname, 
author: author, 
});
} else if (/video/.test(mime)) {
if ((qmsg).seconds > 16) return await m.reply('*🍭 Maksimal 15 detik!*')
return await conn.sendAsSticker(m.chat, media, quoted, { pack: packname, author: author })
} else {
return await m.reply(`*🍭 Kirim/reply gambar/video/gif dengan caption ${usedPrefix + command}\nDurasi Video/Gif 1-9 Detik*`)
}
}

handler.command = ['sticker', 'stiker', 's']
handler.category = ['maker']

export default handler
