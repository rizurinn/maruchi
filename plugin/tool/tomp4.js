let handler = async (m, { conn, usedPrefix, command, loading, Func }) => {
  const q = m.quoted ? m.quoted : m
  const mime = q.mime || ""
  if (!/webp/.test(mime)) return await m.reply(`🍭 *Reply sticker dengan caption ${usedPrefix + command}*`)

  try {
    await loading()

    const media = await m.quoted.download();
    const url = await Func.toVideo(media);
    await conn.sendMessage(m.chat, {
      video: {
        url: url
      },
    }, { quoted: m });
  } finally {
    await loading(true)
  }
}

handler.command = ["togif"]
handler.category = ["tool"]

export default handler