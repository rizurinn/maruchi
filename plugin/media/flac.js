import { unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { searchTrack, downloadTrack, searchUrl } from '#scraper';


const handler = async (m, { conn, text, usedPrefix, command, loading, Func }) => {
  const input = global.validUrl(m) || text;
  if (!input) return await m.reply(`🍭 *Search and Download Hires Music*
  
*Penggunaan:*
${usedPrefix}${command} <query>
${usedPrefix}${command} <url>

*Catatan:*
Url yang didukung: Tidal, Spotify
Jika hasil tidak sesuai artinya lagu dalam format hires tidak tersedia`);

  let downloadResult = null;
  let coverBuffer = null;
  let jpegThumbnail = null;
  let fileBuffer = null;
  
  try {
    await loading();
    if (Func.isUrl(input)) {
      const convert = await searchUrl.convert(input);
      if (convert.tidalUrl === 'undefined') return m.reply(`🍓 *Tidak ditemukan lagu hires dengan url ${getUrl}*`);
      await m.reply(`🍬 *Ditemukan lagu dengan judul ${convert.title} - ${convert.artists.join(', ')}*`);

      const tidalUrl = await searchTrack(convert.tidalUrl);
      if (!tidalUrl.id) return m.reply(`🍓 *Tidak ditemukan lagu hires dengan url ${convert.tidalUrl}*`);

      downloadResult = await downloadTrack(tidalUrl.id);
      
      const caption = `*Hi-Res lossless FLACs✨*
━━━━━━━━━━━━━━━━━━━
🎵 *Judul: ${downloadResult.title}*
✍️ *Artis: ${downloadResult.artist}*
💿 *Album: ${downloadResult.album}*
━━━━━━━━━━━━━━━━━━━
💡 *File sedang dikirimkan*`;

      await conn.sendMessage(m.chat, {
        text: caption,
        contextInfo: {
          externalAdReply: {
            title: downloadResult.title,
            body: downloadResult.artist,
            thumbnailUrl: downloadResult.coverUrl,
            mediaUrl: downloadResult.songUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
          },
        },
      }, { quoted: m });

      try {
        const resImg = await fetch(downloadResult.coverUrl);
        const reader = resImg.body.getReader();
        const chunks = [];
        let totalSize = 0;
        const MAX_COVER_SIZE = 5 * 1024 * 1024;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          if (totalSize > MAX_COVER_SIZE) {
            throw new Error('Cover too large');
          }
          
          chunks.push(value);
        }
        
        coverBuffer = Buffer.concat(chunks);
        chunks.length = 0;
        
        jpegThumbnail = await Func.reSize(coverBuffer, 256, 256);
        
        coverBuffer = null;
        
      } catch {
        jpegThumbnail = null;
      }

      const file = Bun.file(downloadResult.file_path);
      const fileName = downloadResult.file_path.split('/').pop();
      const mimetype = file.type || 'audio/flac';
      
      fileBuffer = Buffer.from(await file.arrayBuffer());
      
      await conn.sendMessage(m.chat, {
        document: fileBuffer,
        fileName,
        mimetype,
        jpegThumbnail
      }, { quoted: m });
      
      fileBuffer = null;
      jpegThumbnail = null;
      
      await unlink(downloadResult.file_path).catch(() => {});
    } else if (text.includes('-d ')) {
      const id = text.split('-d ')[1].trim();
      downloadResult = await downloadTrack(id);

      const caption = `*Hi-Res lossless FLACs✨*
━━━━━━━━━━━━━━━━━━━
🎵 *Judul: ${downloadResult.title}*
✍️ *Artis: ${downloadResult.artist}*
💿 *Album: ${downloadResult.album}*
━━━━━━━━━━━━━━━━━━━
💡 *File sedang dikirimkan*`;

      await conn.sendMessage(m.chat, {
        text: caption,
        contextInfo: {
          externalAdReply: {
            title: downloadResult.title,
            body: downloadResult.artist,
            thumbnailUrl: downloadResult.coverUrl,
            mediaUrl: downloadResult.songUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
          },
        },
      }, { quoted: m });

      try {
        const resImg = await fetch(downloadResult.coverUrl);
        const reader = resImg.body.getReader();
        const chunks = [];
        let totalSize = 0;
        const MAX_COVER_SIZE = 5 * 1024 * 1024;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          if (totalSize > MAX_COVER_SIZE) {
            throw new Error('Cover too large');
          }
          
          chunks.push(value);
        }
        
        coverBuffer = Buffer.concat(chunks);
        chunks.length = 0;
        
        jpegThumbnail = await Func.reSize(coverBuffer, 256, 256);
        
        coverBuffer = null;
        
      } catch {
        jpegThumbnail = null;
      }

      const file = Bun.file(downloadResult.file_path);
      const fileName = downloadResult.file_path.split('/').pop();
      const mimetype = file.type || 'audio/flac';
      
      fileBuffer = Buffer.from(await file.arrayBuffer());
      
      await conn.sendMessage(m.chat, {
        document: fileBuffer,
        fileName,
        mimetype,
        jpegThumbnail
      }, { quoted: m });
      
      fileBuffer = null;
      jpegThumbnail = null;
      
      await unlink(downloadResult.file_path).catch(() => {});
      
    } else {
      // Search mode
      const search = await searchTrack(text.replace(/-d .+/, '').trim());
      if (!search.length) return await m.reply('🍓 *Pencarian tidak ditemukan, coba gunakan kata kunci lain.*');
      
      const tracks = search.slice(0, 10);

      const rows = tracks.map((track) => {
        return {
          header: track.title,
          title: Array.isArray(track.artist) ? track.artist.join(', ') : track.artist,
          description: `${track.album} • ${track.quality}`,
          id: `${usedPrefix}hires -d ${track.id}`
        }
      });

      const listMessage = {
        title: 'Pilih Lagu🎵',
        sections: [
          {
            title: "Pilih Lagu🎵",
            rows
          }
        ]
      };

      const caption = `🍂 *Hasil Pencarian Lagu* 🍂\n\n*💡 Silahkan pilih lagu yang ingin diunduh*`;
      const thumbnailUrl = tracks[0].thumbnail;

      await conn.sendButton(m.chat, {
        image: { url: thumbnailUrl },
        caption,
        footer: '',
        interactiveButtons: [
          {
            name: 'single_select',
            buttonParamsJson: listMessage
          }
        ],
        hasMediaAttachment: true,
      }, { quoted: m });
    }

  } catch (error) {
    await m.reply(`🍓 *Terjadi kesalahan:*\n${error.message}`);
    
    if (downloadResult?.file_path) {
      await unlink(downloadResult.file_path).catch(() => {});
    }
    
  } finally {
    downloadResult = null;
    coverBuffer = null;
    jpegThumbnail = null;
    fileBuffer = null;
    
    await loading(true);
  }
}

handler.command = ['flac', 'hires'];
handler.category = ['media'];

export default handler;