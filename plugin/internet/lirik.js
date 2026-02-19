let handler = async (m, { conn, usedPrefix, command, args, loading }) => {
  let query = args.join(' ')
  if (!query) return await m.reply(`🍭 *Penggunaan:*\n*${usedPrefix}${command} Tokihanate*`);
  
  try {
    await loading()
    const api = await fetch(`https://api.paxsenix.org/lyrics/genius?q=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.config.apikey.paxsenix}` }
    });
    const result = await api.json();
    if (!result || !result.lyrics) return await m.reply('🍓 *Lirik tidak ada*');
    let hasil = `🎵 *${result.title || 'Lirik Lagu'}*`;
    hasil += `\n\n${result.lyrics}`;

    await conn.sendMessage(m.chat,
      {
        text: hasil,
        footer: "Genius Lyrics",
        contextInfo: {
          externalAdReply: {
          title: result.title,
          thumbnailUrl: result.cover,
          sourceUrl: null
          }
        },
      },
    { quoted: m })
    return
  } finally {
    await loading(true)
  }
}

handler.command = ['lirik'];
handler.category = ['internet'];

export default handler
