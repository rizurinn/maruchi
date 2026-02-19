
let handler = async (m, { conn }) => {
conn.asahotak = conn.asahotak ? conn.asahotak : {}
let id = m.chat
if (!(id in conn.asahotak)) throw false
let json = conn.asahotak[id][1]
await m.reply('Clue : ' + '```' + json.jawaban.replace(/[AIUEOaiueo]/ig, '_') + '```' + '\n\n_*Jangan Balas Chat Ini Tapi Balas Soalnya*_')
}
handler.command = ['hotak']
export default handler