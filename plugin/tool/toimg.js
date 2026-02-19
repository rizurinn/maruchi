import sharp from "sharp"

let handler = async (m, { conn, usedPrefix, command, loading }) => {
  const q = m.quoted ? m.quoted : m
  const mime = q.mime || ""
  if (!/webp/.test(mime)) return await m.reply(`🍭 *Reply sticker dengan caption ${usedPrefix + command}*`)

  try {
    await loading()
    const buffer = await q.download?.()
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("Failed to download sticker buffer.")

    const output = await sharp(buffer).png().toBuffer()
    if (!output.length) throw new Error("Conversion failed, output is empty.")

    await conn.sendMessage(
      m.chat,
      { image: output },
      { quoted: q }
    )
  } finally {
    await loading(true)
  }
}

handler.command = ["toimg"]
handler.category = ["tool"]

export default handler