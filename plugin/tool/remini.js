import { Remini } from '#scraper'

let handler = async (m, { conn, usedPrefix, command, Func, loading }) => {
    const quoted = m.quoted ? m.quoted : m
    const mime = quoted.mime || ''
    if (!/image|sticker/.test(mime)) return await m.reply(`*🍭 Reply/Kirim photo yang mau di jernihkan dengan caption:*\n*${usedPrefix + command}*`)
    try {
         await loading()
         const media = await quoted.download()
         const SETTINGS = {
             face_enhance: {
                model: "remini"
             },
             background_enhance: {
                model: "rhino-tensorrt"
             },
             bokeh: {
                aperture_radius: "0",
                highlights: "0.20",
                vivid: "0.75",
                group_picture: "true",
                rescale_kernel_for_small_images: "true",
                apply_front_bokeh: "false"
             },
             jpeg_quality: 90
         }
         const result = await Remini(media, SETTINGS); // Buffer atau Foto
         const Ukuran = await Func.getSizeMedia(result.no_wm)
         await conn.sendMessage(m.chat, {
             image: {
                url: result.no_wm
             },
             caption: `*HD Image* ✨\n*Size: ${Ukuran}*`
         }, { quoted: m })
         return;
    } finally {
       await loading(true)
    }
}

handler.category = ["tool"]
handler.command = ["remini", "hd"]

export default handler
