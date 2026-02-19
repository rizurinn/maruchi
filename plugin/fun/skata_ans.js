import { cKata, sKata } from '../../lib/sambung-kata.js'

export async function before(m, { store }) {
    if (m.isBaileys || m.fromMe || !m.body) return false
    
    let id = m.chat
    this.skata = this.skata ? this.skata : {}
    if (!(id in this.skata)) return false

    let room = this.skata[id]

    if (!m.quoted || !room.chat || !room.chat.key) return false
    const quotedId = (m.quoted.key && m.quoted.key.id)
    const roomId = room.chat.key.id
    
    if (quotedId !== roomId) return false

    let players = room.player
    
    let contact = store.getContact(m.sender);
    if (!contact.skata) {
        contact.skata = {
            win: 0,
            used: [],
            eliminated: false
        }
    }
    store.upsertContact(m.sender, contact)

    const senderNum = m.sender.split('@')[0]
    const currentTurnNum = room.curr.split('@')[0]
    const isPlayer = players.some(p => p.split('@')[0] === senderNum)

    if (senderNum !== currentTurnNum) {
        return await m.reply(
            isPlayer
            ? `🍂 *Bukan giliranmu! Tunggu giliran* @${currentTurnNum}`
            : `🍄 *Kamu tidak ikut bermain. Ketik .skata untuk ikut sesi berikutnya.*`
        )
    }

    if (/^((me)?nyerah|surr?ender)$/i.test(m.body)) {
        clearTimeout(room.waktu)
        await eliminate(this, room, m.chat, store, true)
        return true
    }

    let answer = m.body.toLowerCase().trim()
    let clean = answer.replace(/[^a-z]/gi, '')

    let requiredStart = getSyllable(room.kata)
    
    if (!clean.startsWith(requiredStart.toLowerCase())) {
        return await m.reply(`🍓 *Jawaban harus diawali suku kata* *_${requiredStart.toUpperCase()}_*`)
    }

    let check = await cKata(clean)
    if (!check || !check.status) {
        return await m.reply(`🍒 *Kata _${answer.toUpperCase()}_ tidak valid / tidak ada di KBBI!*`)
    }

    if (clean === room.kata) {
        return await m.reply(`🍎 *Tidak boleh mengulang kata soal.*`)
    }

    if (room.basi.includes(clean)) {
        return await m.reply(`🍑 *Kata _${clean.toUpperCase()}_ sudah dipakai sebelumnya.*`)
    }

    clearTimeout(room.waktu)
    room.basi.push(clean)

    let currentIndex = players.indexOf(room.curr)
    let nextIndex = (currentIndex + 1) % players.length
    room.curr = players[nextIndex]
    
    room.kata = clean
    room.new = false
    room.diam = false

    await nextTurn(this, room, id)

    return true
}

async function nextTurn(conn, room, chatId) {
    let key = getSyllable(room.kata)

    room.chat = await conn.reply(chatId,
        `🍔 *Benar!*\nGiliran @${room.curr.split`@`[0]}\n` +
        `*Kata:* *_${room.kata.toUpperCase()}_*\n` +
        `*Lanjutkan:* *_${key.toUpperCase()}..._* ?`)

    room.waktu = setTimeout(() => {
        eliminate(conn, room, chatId)
    }, 30000)
}

async function eliminate(conn, room, chatId, store, manual = false) {
    if (!conn.skata[chatId]) return
    
    let target = room.curr
    let players = room.player

    room.eliminated.push(target)
    
    let index = players.indexOf(target)
    if (index > -1) players.splice(index, 1)

    await conn.reply(chatId,
        manual
        ? `🏳️ @${target.split`@`[0]} *menyerah dan tereliminasi.*`
        : `🍣 *Waktu habis! @${target.split`@`[0]} tereliminasi.*`)

    if (players.length === 1) {
        let winner = players[0]
        
        let winp = store.getContact(winner)
        if (!winp.skata) winp.skata = { win: 0, used: [], eliminated: false }
        
        winp.skata.win += 1

        await conn.reply(chatId,
            `🍻 *Selamat @${win.split`@`[0]} kamu menang!*\n` +
            `🏆 *Total kemenangan: ${winp.skata.win}*`)
        store.upsertContact(winner, winp)

        delete conn.skata[chatId]
        return
    }

    let nextPlayerIndex = index >= players.length ? 0 : index
    room.curr = players[nextPlayerIndex]
    
    let newKata = await genKata()
    room.kata = newKata
    room.new = true
    
    let key = getSyllable(newKata)
    
    room.chat = await conn.reply(chatId, 
        `🍰 *Game berlanjut!*\nGiliran @${room.curr.split`@`[0]}\n` +
        `*Kata baru:* *_${newKata.toUpperCase()}_*\n` +
        `*Lanjutkan:* *_${key.toUpperCase()}..._*`)

    room.waktu = setTimeout(() => {
        eliminate(conn, room, chatId)
    }, 30000)
}

async function genKata() {
    let json = await sKata()
    let result = json.kata
    while (result.length < 3) {
        json = await sKata()
        result = json.kata
    }
    return result
}

function getSyllable(kata) {
    if (!kata) return ''
    const match = kata.match(/([bcdfghjklmnpqrstvwxyz]?[aeiou][^aeiou]*)$/i)
    return match ? match[0] : kata.slice(-1)
}
