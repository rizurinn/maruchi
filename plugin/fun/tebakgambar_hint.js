
let handler = async (m, { conn }) => {
conn.tebakgambar = conn.tebakgambar ? conn.tebakgambar : {}
let id = m.chat
if (!(id in conn.tebakgambar)) throw false
let json = conn.tebakgambar[id][1]
await m.reply('Clue : ' + '```' + json.jawaban.replace(/[AIUEOaiueo]/ig, '_') + '```' + '\n\n_*Jangan Balas Chat Ini Tapi Balas Soalnya*_')
}
handler.command = ['hgamb']
export default handler