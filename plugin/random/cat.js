let handler = async (m, { conn, usedPrefix, loading }) => {
  try {
  await loading()
  let neko
  try {
    let s = await sefinek()
    neko = s.message
  } catch {
    let u = await catapi()
    neko = u[0].url
  }
  
  return await conn.sendButton(m.chat, {
    image: { url: neko },
    caption: '*Miaw* 😺',
    buttons: [{
         buttonId: `${usedPrefix}cat`,
         buttonText: {
             displayText: 'Lanjut'
         },
         type: 1,
         },
    ]
  }, { quoted: m });
} finally {
  await loading(true)
}
};

handler.command = ['cat'];
handler.category = ['random'];

export default handler;

/**
 * Ambil foto kucing acak
 * @returns {Promise<string>}
 */
async function catapi() {
  try {
    const data = await fetch('https://api.thecatapi.com/v1/images/search');
    const res = data.json()
    return res;
  } catch (e) {
    console.log('Gagal mengambil data kucing', e)
    return false
  }
}

async function sefinek() {
  try {
    const data = await fetch('https://api.sefinek.net/api/v2/random/animal/cat');
    const res = data.json()
    return res;
  } catch (e) {
    console.log('Gagal mengambil data kucing', e)
    return false
  }
}
