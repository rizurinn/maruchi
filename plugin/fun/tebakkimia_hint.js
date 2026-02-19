
let handler = async (m, { conn }) => {
conn.tebakkimia = conn.tebakkimia ? conn.tebakkimia : {}
let id = m.chat
if (!(id in conn.tebakkimia)) return
let json = conn.tebakkimia[id][1]
await m.reply('Clue : ' + '```' + json.unsur.replace(/[AIUEOaiueo]/ig, '_') + '```' + '\n\n_*Jangan Balas Chat Ini Tapi Balas Soalnya*_')
}
handler.command = ['hmia']
export default handler