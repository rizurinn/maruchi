async function handler(m, { conn }) {
   const start = Date.now()
   const res = await conn.sendMessage(m.chat, { text: "*PONG*" })
   const end = Date.now()
   const result = `*PONG* \`\`\`${end - start}ms\`\`\``
   await conn.sendMessage(m.chat, { text: result, edit: res.key })
   return
}

handler.category = ['info'];
handler.command = ['ping'];

export default handler;
