import { unlink } from "fs/promises";
import { spotifySearch, spotifyDownload } from '#scraper';

const handler = async (m, { conn, args, usedPrefix, command, loading }) => {
   const valid = global.validUrl(m, 'spotify');
   if (!args.length && !valid) return m.reply(`🍭 *Spotify Search and Download*

*Penggunaan:*
${usedPrefix + command} <url>
${usedPrefix + command} <query>`);

   const q = m.quoted ? m.quoted : m;
   if (valid) {
    try {
        await loading()
        const data = await spotifyDownload(valid, '256')
        if (data && data.file_path) {

        let caption = `*Spotify Download ✨*
━━━━━━━━━━━━━━━━━━━
🎵 *Judul: ${data.metadata.title}*
✍️ *Artis: ${data.metadata.artist}*
🔗 *URL: ${data.metadata.url}*
━━━━━━━━━━━━━━━━━━━
💡 *Audio sedang dikirimkan*`
        await conn.sendMessage(m.chat, {
             text: caption,
             contextInfo: {
                 externalAdReply: {
                    title: data.metadata.title,
                    body: `https://open.spotify.com`,
                    thumbnailUrl: data.thumbnail,
                    sourceUrl: data.metadata.url,
                    mediaType: 1,
                    renderLargerThumbnail: true
                 },
             },
        }, { quoted: q })

        await conn.sendMessage(m.chat, {
            audio: { url: data.file_path },
            fileName: `${data.metadata.title}.mp3`,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: m });
        }
        await unlink(data.file_path)
    } finally {
        await loading(true)
    }
    
    } else {
      try {
        await loading();
        const query = q.body || args.join(' ');
        const searchRes = await spotifySearch(query);

        if (!searchRes || !searchRes.length) {
        throw new Error('Lagu tidak ditemukan');
        }

        const tracks = searchRes.slice(0, 15);

        let rows = tracks.map((track, index) => {
          return {
             title: `${index + 1}. ${track.title}`,
             description: `${track.artist}`,
             id: `${usedPrefix}spotify ${track.spotifyUrl}`
           }
        });
        let listMessage = {
           title: 'Pilih Lagu🎵',
           sections: [{
              title: "Pilih Lagu🎵",
              rows
           }]
        };

        const caption = `🌵 *Hasil Pencarian Spotify* 🌵\n\n*💡 Silahkan pilih lagu yang ingin didownload:*`;
        const thumbnailUrl = tracks[0].image || "https://i.ibb.co/vxLRS6J/spotify-logo.png";

        await conn.sendButton(m.chat, {
           image: {url: thumbnailUrl},
           caption: caption,
           footer: '',
           interactiveButtons: [
           {
              name: 'single_select',
              buttonParamsJson: listMessage
           }
           ],
           hasMediaAttachment: true,
           }, { quoted: m });
      } finally {
        await loading(true)
      }
    }
};

handler.category = ['media']
handler.command = ['spotify'];

export default handler;
