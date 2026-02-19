
let handler = async (m, { conn }) => {
conn.tebaktebakan = conn.tebaktebakan ? conn.tebaktebakan : {}
let id = m.chat
if (!(id in conn.tebaktebakan)) return
let json = conn.tebaktebakan[id][1]
await m.reply('Clue : ' + '```' + json.jawaban.replace(/[AIUEOaiueo]/ig, '_') + '```' + '\n\n_*Jangan Balas Chat Ini Tapi Balas Soalnya*_')
}
handler.command = ['hkan']
export default handler