let handler = async (m, { conn, usedPrefix }) => {
    conn.family = conn.family ? conn.family : {}
    let id = m.chat
    
    if (id in conn.family) return conn.reply(m.chat, '🍰 *Masih ada sesi kuis yang belum selesai di chat ini!*\nKetik *nyerah* untuk menyudahi, atau *clue* untuk bantuan.', { quoted: conn.family[id].msg })

    let res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/family100.json')
    if (!res.ok) throw await res.text()
    let src = await res.json()
    let json = src[Math.floor(Math.random() * src.length)]
    
    let kotak = json.jawaban.map(v => v.replace(/[a-z0-9]/gi, '⬜')) // Ubah huruf jadi kotak, spasi biarkan
    
    let caption = `
🍭 *FAMILY 100*
🍤 *Soal: ${json.soal}*
🍪 *Waktu: 3 Menit*

${kotak.map((v, i) => `(${i + 1}) ${v}`).join('\n')}

🍬 *Hint:*
Ketik 'clue' untuk bantuan.
Ketik 'nyerah' untuk menyerah.

_Semua perintah bot diblokir selama sesi kuis berlangsung_
`.trim()

    conn.family[id] = {
        id,
        msg: await m.reply(caption),
        ...json,
        terjawab: Array.from(json.jawaban, () => false),
        clueUsed: 0 // Limit penggunaan clue jika mau dibatasi (opsional)
    }

    conn.family[id].timeout = setTimeout(async () => {
        if (conn.family[id]) {
            let room = conn.family[id]
            
            let scoreBoard = {}
            room.terjawab.forEach(user => {
                if (user) {
                    let name = user.split('@')[0]
                    scoreBoard[name] = (scoreBoard[name] || 0) + 1
                }
            })
            let winnerList = Object.entries(scoreBoard).sort((a, b) => b[1] - a[1])
            let leaderboard = winnerList.length > 0 
                ? `\n\n🫧 *List:*\n${winnerList.map((v, i) => `${i + 1}. @${v[0]} (${v[1]})`).join('\n')}` 
                : ''

            let teks = `🍟 *Waktu Habis! Game Berakhir*\n`
            teks += `📖 *Soal: ${room.soal}*\n\n`
            teks += room.jawaban.map((v, i) => {
                return `(${i + 1}) ${v} ${room.terjawab[i] ? '✅' : '❌'}`
            }).join('\n')
            
            teks += leaderboard

            await conn.reply(id, teks, { quoted: room.msg })
            delete conn.family[id]
        }
    }, 180000)
}

handler.command = ['family100']
handler.category = ['fun']

export default handler