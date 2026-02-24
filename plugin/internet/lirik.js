function parseLyricsDom(node) {
  if (typeof node === 'string') return node;
  if (!node || !node.children) return '';

  return node.children.map(child => {
    if (typeof child === 'string') return child;
    if (child.tag === 'br') return '\n';
    return parseLyricsDom(child); // Rekursif untuk tag i, a, span, dll
  }).join('');
}

let handler = async (m, { conn, usedPrefix, command, args, loading }) => {
  let query = args.join(' ')
  if (!query) return await m.reply(`🍭 *Penggunaan:*\n${usedPrefix}${command} <query>`);
  
  try {
    await loading()
    const searchApi = await fetch(`https://fgsi.dpdns.org/api/information/genius/search?apikey=${global.config.apikey.fgsi}&query=${encodeURIComponent(query)}`);
    const searchResult = await searchApi.json();

    const topHit = searchResult.data?.[0]?.hits?.[0]?.result;
    if (!topHit) return await m.reply('🍓 *Lagu tidak ditemukan*');

    const infoApi = await fetch(`https://fgsi.dpdns.org/api/information/genius/info?apikey=${global.config.apikey.fgsi}&id=${topHit.id}`);
    const infoResult = await infoApi.json();
    
    const data = infoResult.data;
    if (!data || !data.lyrics) return await m.reply('🍓 *Gagal memproses lirik*');

    let lirikTeks = parseLyricsDom(data.lyrics.dom);
    
    let hasil = `🎵 *${data.full_title || data.title}*`;
    hasil += `\n\n${lirikTeks}`;

    await conn.sendMessage(m.chat,
      {
        text: hasil,
        contextInfo: {
          externalAdReply: {
            title: `${data.artist_names} - ${data.title}`,
            body: '',
            thumbnailUrl: data.song_art_image_url || topHit.song_art_image_url,
            sourceUrl: data.apple_music_player_url,
            mediaType: 1,
            renderLargerThumbnail: false
          }
        },
      },
    { quoted: m })

  } finally {
    await loading(true)
  }
}

handler.command = ['lirik', 'genius'];
handler.category = ['internet'];

export default handler