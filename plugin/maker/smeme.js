let handler = async (m, { conn, args, usedPrefix, command, Uploader, loading }) => {
if (!args[0]) return await m.reply(`🍭 *Masukkan teks!*\n*Contoh: ${usedPrefix + command} teks atas|teks bawah*`)

const q = m.quoted ? m.quoted : m
const mime = q.mime || ''
if (!mime || !/image\/(jpeg|png|webp)/.test(mime)) return await m.reply(`🍭 *Kirim atau balas gambar dengan caption ${usedPrefix + command} teks atas|teks bawah untuk membuat sticker meme!*`);

try {
await loading()
const text = args.join(" ").trim()
const media = await q.download()
const up = await Uploader.tmpfiles(media)

let [top, bottom] = text.split('|')

top = top?.trim() || ''
bottom = bottom?.trim() || ''

const payload = {
  background: up, // URL background
  text: [
    top || "",     // teks atas
    bottom || ""   // teks bawah
  ],
  extension: "png",
  redirect: false
}

const res = await fetch("https://api.memegen.link/images/custom", {
  method: "POST",
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  },
  body: JSON.stringify(payload)
})

if (!res.ok) {
  const err = await res.text()
  throw new Error(err)
}

const json = await res.json()

const img = await fetch(json.url)
let buffer = Buffer.from(await img.arrayBuffer())

await conn.sendAsSticker(m.chat, buffer, q, {
  pack: global.config.packnames,
  author: global.config.authors
})
buffer = null;
return;
} finally {
await loading(true)
}

}

handler.category = ['maker']
handler.command = ['smeme']

export default handler
