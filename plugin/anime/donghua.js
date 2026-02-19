import { searchDonghua, detailDonghua, videoUrlDonghua } from '#scraper';

let handler = async (m, { conn, usedPrefix, command, text, loading }) => {
  const args = text.split(' ');
  const isDownload = args[0] === '-d';

  /* ======================
     DOWNLOAD MODE
  ====================== */
  if (isDownload) {
    const episodeUrl = args[1];
    if (!episodeUrl) return m.reply('🍰 *URL episode tidak valid*');

    try {
      await loading();

      const data = await getVideoUrl(episodeUrl);
      if (!data.length) return m.reply('🍰 *URL video tidak ditemukan*');

      let msg = `🔥 *DONGHUA DOWNLOAD* 🔥\n\n`;

      for (let dl of data) {
        msg += `• ${dl.type.toUpperCase()}\n`;
        msg += `${dl.url}\n\n`;
      }

      await conn.sendMessage(m.chat, { text: msg }, { quoted: m });

    } finally {
      await loading(true);
    }
  }

  /* ======================
     DETAIL MODE (URL)
  ====================== */
  else if (text.startsWith('http')) {
    try {
      await loading();

      const data = await getDetail(text);
      if (!data) return m.reply('🍰 *Detail tidak ditemukan*');

      let teks = `🔥 *DONGHUA DETAIL* 🔥
━━━━━━━━━━━━━━━━━━━
✨ *Judul:* ${data.title}
📌 *Status:* ${data.status || '-'}
🌐 *Network:* ${data.network || '-'}
⏱️ *Durasi:* ${data.duration || '-'}
🌎 *Country:* ${data.country || '-'}
🎭 *Type:* ${data.type || '-'}
👥 *Fansub:* ${data.fansub || '-'}
🚫 *Censor:* ${data.censor || '-'}
🎀 *Genre:* ${data.genres.join(', ') || '-'}
━━━━━━━━━━━━━━━━━━━
📖 *Sinopsis:*
${data.description || '-'}
━━━━━━━━━━━━━━━━━━━`;

      const lists = data.episodes.slice(0, 50).map((ep, i) => ({
        title: ep.title,
        description: `Download ${ep.title}`,
        id: `${usedPrefix + command} -d ${ep.url}`,
      }));

      await conn.sendButton(
        m.chat,
        {
          image: { url: data.thumbnail || data.coverImage },
          caption: teks,
          footer: "DonghuaFilm",
          interactiveButtons: [
            {
              name: "single_select",
              buttonParamsJson: {
                title: `List Episode`,
                sections: [
                  {
                    title: data.title,
                    rows: lists,
                  },
                ],
              },
            },
          ],
        },
        { quoted: m }
      );

    } finally {
      await loading(true);
    }
  }

  /* ======================
     SEARCH MODE
  ====================== */
  else {
    if (!text) return m.reply(`🍭 *Donghua Film*

*Penggunaan:*
${usedPrefix + command} apotheosis - Search Donghua
${usedPrefix + command} <url> - Detail Donghua`);

    try {
      await loading();

      const search = await searchDonghua(text);
      if (!search.length) return m.reply('🍓 *Donghua tidak ditemukan*');

      let replyText = '🔥 *DONGHUA SEARCH* 🔥\n\n';

      for (let i = 0; i < Math.min(10, search.length); i++) {
        let anime = search[i];
        replyText += `${i + 1}. *${anime.title}*\n`;
        replyText += `   Status: ${anime.status}\n`;
        replyText += `   Type: ${anime.type}\n`;
        replyText += `   Link: ${anime.url}\n\n`;
      }

      replyText += `💡 Ketik ${usedPrefix + command} [link donghua] untuk melihat detail.\n`;
      replyText += `📝 Contoh: ${usedPrefix + command} ${search[0].url}`;

      await conn.sendMessage(
        m.chat,
        { text: replyText },
        { quoted: m }
      );

    } finally {
      await loading(true);
    }
  }
};

handler.command = ['donghua'];
handler.category = ['anime'];

export default handler;