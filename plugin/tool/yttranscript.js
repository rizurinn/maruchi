let handler = async (m, { usedPrefix, command }) => {
    const url = global.validUrl(m, 'youtube');
    if (!url) return await m.reply(`🍭 *Masukkan url YouTube yang ingin di transcribe*\n*Contoh: ${usedPrefix + command} https://youtu.be/GuksIGlsSG8*`)

    let res = await fetch('https://kome.ai/api/transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://kome.ai',
        'Referer': 'https://kome.ai/tools/youtube-transcript-generator',
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        video_id: url,
        format: true
      })
    })

    let data = await res.json()
    return await m.reply(`${data.transcript}`)
}

handler.command = ['yttranscript']
handler.category = ['tool']

export default handler
