import { pinterest } from '#scraper';

const handler = async (m, { conn, usedPrefix, command, args, loading }) => {
   const valid = global.validUrl(m, 'pinterest');
   if (valid) {
      try {
          await loading();
          const result = await pinterest.download(valid);
          if (!result || !result.media) return m.reply('*🍓 Gagal mengunduh konten. Silakan periksa URL atau coba lagi.*');

          const caption = `🧁 *${result.title || 'Pinterest Media'}*\n*Oleh: ${result.username || 'Unknown'}*`;
          
          if (result.isVideo) {
              await conn.sendMessage(m.chat, {
                 video: { url: result.media },
                 caption: caption
              }, { quoted: m });
          } else {
              await conn.sendMessage(m.chat, {
                  image: { url: result.media },
                  caption: caption
              }, { quoted: m });
          }
      } finally {
          await loading(true);
      }
      return;
   }

   if (!args.length) {
      return m.reply(`🍭 *Pinterest Media*

*Penggunaan:*
${usedPrefix + command} <query>
${usedPrefix + command} <url>

*Contoh:* ${usedPrefix + command} https://id.pinterest.com/pin/10273905395520875/`);
   }

   try {
       await loading();
       const query = args.join(' ');

       const limit = 15;
       const results = await pinterest.search(query, limit);
       
       if (!results || !results.pins || results.pins.length === 0) {
           return m.reply('🍰 *Tidak ada gambar ditemukan. Silakan coba kata kunci lain.*');
       }

       const pins = results.pins.slice(0, limit);

       const album = pins.map(pin => ({
           image: { url: pin.image },
           caption: `🧁 *Uploaded By: ${pin.username || 'Unknown'}*\n${pin.title || query}\n\n${pin.link}`
       }));

       await conn.sendAlbum(m.chat, album, { quoted: m });

   } finally {
       await loading(true);
   }
};

handler.category = ['media'];
handler.command = ['pinterest', 'pint'];

export default handler;