import similarity from 'similarity'
const threshold = 0.6

export async function before(m) {
    this.family = this.family || {}
    let id = m.chat
    if (m.isBaileys || m.fromMe) return false
    if (!(id in this.family)) return false

    let room = this.family[id]
    let text = m.body.toLowerCase().replace(/[^\w\s\-]+/g, '')
    let isSurrender = /^((me)?nyerah|surr?ender)$/i.test(m.body)
    let isClue = /^(clue|bantuan|klue)$/i.test(m.body)

    if (isClue) {
        let unAnsweredIndices = room.terjawab.map((v, i) => v ? null : i).filter(v => v !== null)
        
        if (unAnsweredIndices.length === 0) return m.reply("🍬 *Semua sudah terjawab!*")
        
        let randomIdx = unAnsweredIndices[Math.floor(Math.random() * unAnsweredIndices.length)]
        let answer = room.jawaban[randomIdx]
        
        m.reply(`🔍 *Petunjuk untuk no ${randomIdx + 1}:*\nMemiliki huruf depan *" ${answer.charAt(0).toUpperCase()} "*`)
        return true
    }

    if (!isSurrender) {
        let index = room.jawaban.indexOf(text)
        
        if (index < 0) {
            if (
                Math.max(...room.jawaban
                    .filter((_, idx) => !room.terjawab[idx])
                    .map(j => similarity(j, text))
                ) >= threshold
            ) {
                m.reply('🤏 *Dikit lagi!*')
            }
            return true
        }
        if (room.terjawab[index]) return false
        room.terjawab[index] = m.sender
    }

    let isWin = room.terjawab.length === room.terjawab.filter(v => v).length
    
    // --- CAPTION UPDATE ---
    let caption = `
🍭 *FAMILY 100*
📖 *Soal: ${room.soal}*

${room.jawaban.map((j, i) => {
    if (room.terjawab[i]) {
        // Jika sudah terjawab: Tampilkan Jawaban + Penjawab
        return `*(${i + 1}) ${j} (@${room.terjawab[i].split('@')[0]})*`
    } else if (isSurrender) {
        // Jika menyerah: Tampilkan Kunci Jawaban
        return `*(${i + 1}) ${j}*`
    } else {
        // Jika belum: Tampilkan KOTAK KOSONG sesuai panjang huruf
        let visual = j.replace(/[a-z0-9]/gi, '⬜') // Ganti huruf jadi kotak
        return `*(${i + 1})* ${visual}`
    }
}).join('\n')}

${isWin ? `\n🌈 *SELESAI! Semua jawaban ditemukan.*` : isSurrender ? `\n🏳️ *Menyerah! Permainan dihentikan.*` : ''}
`.trim()

    let msg = await this.reply(m.chat, caption, { quoted: null })
    room.msg = msg // Update referensi pesan agar bisa direply bot jika perlu

    if (isWin || isSurrender) {
        clearTimeout(room.timeout) // Hapus timer agar tidak double execute
        delete this.family[id]
    }
    return true
}