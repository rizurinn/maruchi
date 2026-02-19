import { laheluRandom } from '#scraper'

let handler = async (m, { conn, command, usedPrefix, Func, loading }) => {
  try {
    await loading()
    const data = await laheluRandom()

    if (!data || !data.length === 0) {
      return m.reply("🍓 *Tidak ada meme untuk saat ini*")
    }

    const post = Func.pickRandom(data)

    let formattedDate = "Tidak diketahui"
    if (post.createTime) {
      const d = new Date(post.createTime)
      formattedDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    }

    let username = post.userUsername?.replace("https://lahelu.com/user/", "") || "Tidak diketahui"

    let postId = post.postId || post.postID || ""
    if (typeof postId === "string") postId = postId.replace("https://lahelu.com/post/", "")

    const caption =
`*${post.title || 'Lahelu Random'}*

🍡 *User:* ${username}
🍬 *Tags:* ${post.hashtags?.join(', ') || 'None'}
🍨 *Upvotes:* ${post.totalUpvotes || 0}
🍪 *Comments:* ${post.totalComments || 0}
🎂 *Tanggal:* ${formattedDate}

🍢 *Link:* https://lahelu.com/post/${postId}`

    const mediaUrl =
      post.media ||
      post.content?.[0]?.value ||
      post.mediaUrl ||
      null

    if (!mediaUrl) return m.reply(caption + "\n\n[Media tidak ditemukan]")

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl)
    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl)

    const buttons = [{
      buttonId: `${usedPrefix + command}`,
      buttonText: { displayText: "Lanjut" },
      type: 1
    }]

    if (isImage) {
      await conn.sendButton(m.chat, {
        image: { url: mediaUrl },
        caption,
        footer: "",
        buttons
      }, { quoted: m })
    } else if (isVideo) {
      await conn.sendButton(m.chat, {
        video: { url: mediaUrl },
        caption,
        mimetype: "video/mp4",
        footer: "",
        buttons,
        gifPlayback: false
      }, { quoted: m })
    }

  } finally {
    await loading(true)
  }
}

handler.category = ['random']
handler.command = ['lahelu']

export default handler
