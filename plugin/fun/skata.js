import { sKata } from '../../lib/sambung-kata.js'

const game = `
*❖ 𝐖𝐎𝐑𝐃 𝐂𝐇𝐀𝐈𝐍*
───────────────
*Permainan ini menguji ketangkasan dalam menyambung kata dari huruf terakhir kata sebelumnya. Fokus, cepat, dan jangan sampai kehabisan ide, ya!*`.trim()

const rules = `
*❖ 𝐆𝐀𝐌𝐄 𝐑𝐔𝐋𝐄𝐒*
───────────────
*• Gunakan kata dasar (tanpa imbuhan)*
*• Tidak boleh pakai spasi atau simbol*
*• Pemain terakhir akan jadi pemenang*
*• Mulai game: .skata start*`.trim()

let handler = async (m, { conn, text, usedPrefix, command, store }) => {
    conn.skata = conn.skata ? conn.skata : {}
    let id = m.chat

    let contact = store.getContact(m.sender);
    if (!contact.skata) {
        contact.skata = {
            win: 0,
            used: [],
            eliminated: false
        }
    }
    store.upsertContact(m.sender, contact)

    let kata = await genKata()

    // 2. Cek Multi-room
    let other = Object.values(conn.skata).find(room => 
        room.id !== id && room.player.includes(m.sender)
    )
    if (other) return m.reply(`🍄 *Kamu sedang bermain sambung kata di chat lain.*`)

    // 3. Logic Room
    if (id in conn.skata) {
        let room = conn.skata[id]

        if (room.status === 'play') {
            return conn.reply(m.chat, 
                `🍓 *Masih ada game yang berjalan.*\n*Reply pesan soal untuk menjawab!*`, 
                { quoted: room.chat }
            )
        }

        if (text.toLowerCase() === 'start' && room.status === 'wait') {
            if (!room.player.includes(m.sender)) return m.reply(`🍒 *Kamu belum daftar! Ketik ${usedPrefix + command} untuk daftar.*`)
            if (room.player.length < 2) return m.reply(`🍕 *Pemain kurang, minimal 2 orang untuk memulai.*`)

            room.status = 'play'
            room.curr = room.player[0]
            room.kata = room.kata ?? kata

            room.chat = await conn.reply(m.chat,
    `🍰 *Game Dimulai!*\n\n*Giliran* @${room.curr.split`@`[0]}\n` +
    `*Kata awal:* *_${room.kata.toUpperCase()}_*\n` +
    `*Lanjutkan:* *_${filter(room.kata).toUpperCase()}..._*\n\n` +
    `*Reply pesan ini untuk menjawab.*\nKetik *nyerah* untuk menyerah.`,
    { quoted: m })

            room.waktu = setTimeout(() => {
                eliminate(conn, room, m.chat, store)
            }, 45000)

            return
        }

        if (room.status === 'wait') {
            if (room.player.includes(m.sender)) return m.reply(`Kamu sudah terdaftar.`)

            room.player.push(m.sender)
            
            clearTimeout(room.waktu_list)
            room.waktu_list = setTimeout(async() => {
                if (conn.skata[id] && conn.skata[id].status === 'wait') {
                    await conn.reply(m.chat, `🍣 *Waktu tunggu habis! Game dibatalkan.*`, { quoted: room.chat })
                    delete conn.skata[id]
                }
            }, 120000)

            let caption = `🍰 *Daftar Pemain*\n` + 
                          room.player.map((v, i) => `• ${i + 1}. @${v.split`@`[0]}`).join('\n')

            room.chat = await conn.reply(m.chat,
                `${caption}\n\nKetik *${usedPrefix + command}* untuk ikut\n` +
                `Ketik *${usedPrefix + command} start* untuk mulai.`,
                { quoted: m })
            return
        }
    } else {
        conn.skata[id] = {
            id,
            status: 'wait',
            player: [],
            eliminated: [],
            kata,
            curr: '',
            basi: [],
            new: false,
            diam: false,
            waktu: null,
            waktu_list: null,
            chat: await conn.reply(m.chat, `${game}\n\n${rules}\n\nKetik *${usedPrefix + command}* untuk bergabung!`, { quoted: m }),
            filter
        }
    }
}

handler.command = ['skata', 'sambungkata']
handler.category = ['fun']
export default handler

// --- Helper Functions ---

async function genKata() {
    let json = await sKata()
    let result = json.kata
    while (result.length < 3) {
        json = await sKata()
        result = json.kata
    }
    return result
}

function filter(text) {
    if (!text) return ''
    const match = text.match(/([bcdfghjklmnpqrstvwxyz]?[aeiou][^aeiou]*)$/i)
    return match ? match[0] : text.slice(-1)
}

async function eliminate(conn, room, chatId, store) {
    if (!conn.skata[chatId]) return
    let target = room.curr
    let players = room.player

    room.eliminated.push(target)
    let index = players.indexOf(target)
    if (index > -1) players.splice(index, 1)

    await conn.reply(chatId, `🍣 *Waktu habis! @${target.split`@`[0]} tereliminasi.*`)

    if (players.length === 1) {
        let winner = players[0]
        
        let winp = store.getContact(winner)
        if (!winp.skata) winp.skata = { win: 0, used: [], eliminated: false }
        
        winp.skata.win += 1
        
        await conn.reply(chatId,
            `🍻 @${winner.split`@`[0]} *adalah pemenang!*\n` +
            `🏆 *Total kemenangan: ${winp.skata.win}*`)
        store.upsertContact(winner, winp)
        
        delete conn.skata[chatId]
        return
    }
    
    room.curr = players[index >= players.length ? 0 : index]
    room.new = true 
    
    let newKata = await genKata()
    room.kata = newKata
    room.chat = await conn.reply(chatId, 
        `🍥 *Giliran* @${room.curr.split`@`[0]}\n*Kata baru: ${newKata.toUpperCase()}*\n${filter(newKata).toUpperCase()}... ?`)
    
    room.waktu = setTimeout(() => eliminate(conn, room, chatId, store), 30000)
}