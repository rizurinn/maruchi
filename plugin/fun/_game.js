import similarity from 'similarity'
const threshold = 0.72

// Format: 'kunci_di_this': 'nama_property_jawaban_di_json'
const gameConfigs = {
    asahotak: 'jawaban',
    caklontong: 'jawaban',
    lengkapikalimat: 'jawaban',
    siapakahaku: 'jawaban',
    susunkata: 'jawaban',
    tebakgambar: 'jawaban',
    tebakbendera: 'name',
    tebakkata: 'jawaban',
    tebakkimia: 'unsur',
    tebaktebakan: 'jawaban',
    tebaklogo: 'jawaban',
}

export async function before(m) {
    let id = m.chat

    if (m.isBaileys || m.fromMe || !m.body) return false
    let room = null
    let gameKey = null
    let answerKey = null

    for (let key in gameConfigs) {
        if (this[key] && this[key][id]) {
            if (m.quoted && m.quoted.key.id === this[key][id][0].key.id) {
                room = this[key][id]
                gameKey = key
                answerKey = gameConfigs[key]
                break
            }
        }
    }

    if (!room) return false

    const json = room[1]
    const answer = (json[answerKey] || '').toLowerCase().trim()
    const text = m.body.toLowerCase().trim()
    const timeout = room[3]
    
    if (/^((me)?nyerah|surr?ender)$/i.test(text)) {
        clearTimeout(timeout)
        delete this[gameKey][id]
        await this.reply(m.chat, RESPON_MENYERAH[Math.floor(Math.random()*RESPON_MENYERAH.length)], { quoted: m })
        return true
    }

    if (text === answer) {
        await this.reply(m.chat, RESPON_BENAR[Math.floor(Math.random() * RESPON_BENAR.length)], { quoted: m })
        
        clearTimeout(timeout)
        delete this[gameKey][id]
        return true
    }

    if (similarity(text, answer) >= threshold) {
        await this.reply(m.chat, RESPON_MIRIP[Math.floor(Math.random() * RESPON_MIRIP.length)], { quoted: m })
        return true
    }

    room[2] -= 1
    const remainingChances = room[2]
    if (remainingChances <= 0) {
        clearTimeout(timeout)
        delete this[gameKey][id]
        await this.reply(m.chat, `${RESPON_HABIS[Math.floor(Math.random()*RESPON_HABIS.length)]}\n\n🍃 *Jawaban yang benar: ${json[answerKey]}*`, { quoted: m })
        return true
    }

    await this.reply(m.chat, `${RESPON_SALAH[Math.floor(Math.random()*RESPON_SALAH.length)]}\n*Sisa kesempatan: ${remainingChances}*`, { quoted: m })
    return true
}


const RESPON_BENAR = [
  "✨ *Mantap! Kamu benar banget!*",
  "🔥 *Jawabanmu tepat! GG!*",
  "🌈 *Perfect! Kamu jago banget!*",
  "👏 *Betul! Teruskan ritmenya!*",
  "💯 *Akurasi 100%! Salut!*",
  "🍄 *Nice! Kamu nangkep maksudnya!*",
  "🌟 *Keren! Jawabanmu on point!*",
  "🥳 *Yess! Kamu benar!*"
]

const RESPON_SALAH = [
  "😇 *Masih salah nih, coba lagi!*",
  "😵 *Belum tepat, pikirkan lagi!*",
  "🤔 *Hmm… kayaknya bukan itu.*",
  "🙈 *Yah, masih belum benar!*",
  "😽 *Belok dikit lagi, ayo!*",
  "😬 *Belum pas, coba sekali lagi!*",
  "😸 *Masih melenceng! Fokus, bro!*",
  "💭 *Mungkin kamu kelewat sesuatu?*"
]

const RESPON_MIRIP = [
  "🤏 *Hampir! Tinggal ejaan dikit!*",
  "🧸 *Mirip banget, tapi masih kurang tepat!*",
  "🍬 *Dikit lagi! Coba cek hurufnya.*",
  "😫 *Udah dekat! Rapiin dikit lagi!*",
  "💫 *Hampir kena! Periksa lagi ejaannya.*",
  "🪆 *Keliatan mirip, tapi bukan itu!*",
  "🙀 *Nyaris! Cuma beda sedikit banget!*"
]

const RESPON_MENYERAH = [
  "🏳️ *Yah menyerah… semangat lagi lain kali!*",
  "😢 *Kok nyerah? Padahal tinggal sedikit lagi!*",
  "🫡 *Oke, menyerah diterima. Good try!*",
  "😔 *Nyerah ya? Gapapa, next time pasti bisa!*",
  "🔥 *Belajar dari yang ini ya! Kamu pasti bisa lain kali!*"
]

const RESPON_HABIS = [
  "💥 *Kesempatan habis!*",
  "⏳ *Waktu dan kesempatanmu sudah habis!*",
  "👾 *Game over!*",
  "🕹️ *Kamu sudah tidak punya kesempatan lagi!*",
  "☠️ *Tamat! Tidak ada sisa chance!*",
  "🧨 *Boom! Kesempatanmu meledak!*"
]