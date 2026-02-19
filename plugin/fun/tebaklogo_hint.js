
let handler = async (m, { conn }) => {
conn.tebaklogo = conn.tebaklogo ? conn.tebaklogo : {}
let id = m.chat
if (!(id in conn.tebaklogo)) return
let json = conn.tebaklogo[id][1]
await m.reply('Clue : ' + '```' + json.jawaban.replace(/[AIUEOaiueo]/ig, '_') + '```' + '\n\n_*Jangan Balas Chat Ini Tapi Balas Soalnya*_')
}
handler.command = ['hlogo']
export default handler