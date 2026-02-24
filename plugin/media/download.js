import { unlink, stat } from "fs/promises";
import { fbDownload, igDownload, mfDownload, ttDownload, bilibiliDl, douyinDl, twitterDl, sfileDl, capcutDl, pinterest, ytVideo } from '#scraper';

const PATTERNS = {
  bilibili: /^(https?:\/\/)?(www\.)?bilibili\.(tv|com)\/(video|play)\/\d+/i,
  capcut: /^(https?:\/\/)?(www\.)?capcut\.com\/(tv2|template|video)\/[\w\-_]+/i,
  facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/.+/i,
  tiktok: /^(https?:\/\/)?(www\.)?(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)\/.+/i,
  twitter: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/i,
  mediafire: /^(https?:\/\/)?(www\.)?mediafire\.com\/(file|view|download)\/.+/i,
  sfile: /^(https?:\/\/)?(www\.)?sfile\.co\/(download\/)?[A-Za-z0-9]+(?:[?#].*)?$/i,
  douyin: /^(https?:\/\/)?(www\.)?(v.douyin\.com|iesdouyin\.com)\/.+/i,
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/|youtu\.be\/|music\.youtube\.com\/|youtube\.com\/live\/)[\w\-_]+/i,
  pinterest: /^(https?:\/\/)?([\w]+\.)?pinterest\.(com|co\.uk|ca|fr|de|it|es|id|ph|au|nz|jp|kr|mx|br|cl|ar)\/pin\/[\w\-]+\/?|^(https?:\/\/)?(www\.)?pin\.it\/[\w\-]+\/?/i,
};

const identifyPlatform = (url) => {
  for (const [platform, regex] of Object.entries(PATTERNS)) {
    if (regex.test(url)) return platform;
  }
  return null;
};

const extractAllUrls = (text) => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
};

let handler = async (m, { conn, usedPrefix, command, args, Func, loading }) => {
  const textSource = m.body + (m.quoted ? (' ' + (m.quoted.body || m.quoted[m.quoted.type]?.caption)) : '');
  let urls = extractAllUrls(textSource);

  urls = urls.filter(url => identifyPlatform(url));

  if (urls.length === 0) {
    return m.reply(`🍭 *Universal Downloader*

*Platform yang didukung:*
Facebook, Instagram, TikTok, YouTube, Bilibili, Twitter/X, Capcut, Douyin, Sfile, MediaFire, Pinterest

*Penggunaan:*
${usedPrefix + command} <url>
Atau reply pesan yang berisi link.

_Catatan: Mendukung download bulk maksimal 5_`);
  }

  // 2. Batasi Maksimal 5 URL
  if (urls.length > 5) {
    await m.reply(`🍃 *Terlalu banyak link!*\nHanya 5 link pertama yang akan diproses.`);
    urls = urls.slice(0, 5);
  }

  await loading();

  for (const url of urls) {
    const platform = identifyPlatform(url);
    
    try {
      if (urls.length > 1) await new Promise(r => setTimeout(r, 1500));

      switch (platform) {
      case 'bilibili': {
        let { title, buffer } = await bilibiliDl(url);
        if (!buffer) throw new Error('Media tidak ada.');
        await conn.sendMessage(m.chat, { video: buffer, caption: `🍣 *Bilibili Downloader*\n\n${title || ''}` }, { quoted: m });
        break;
      }

      case 'facebook': {
        let { media, title } = await fbDownload(url);
        if (!media) throw new Error('Media tidak ada.');
        await conn.sendFile(m.chat, media, false, `🍣 *Facebook Downloader*\n\n${title || ''}`, m);
        break;
      }

      case 'instagram': {
        const result = await igDownload(url);
        if (!result.url) throw new Error('Tidak ada media yang ditemukan');
        
        let cap = `🍣 *Instagram Downloader*\n\n🍙 *Uploaded by: ${result.metadata.username ? result.metadata.username : 'Unknown User'}*\n`;
        if (result.metadata.caption) cap += `${result.metadata.caption}`;

        if (result.metadata.isVideo) {
           await conn.sendMessage(m.chat, { video: { url: result.url[0] }, caption: cap, mimetype: "video/mp4" }, { quoted: m });
        } else {
           if (result.url.length === 1) {
             await conn.sendMessage(m.chat, { image: { url: result.url[0] }, caption: cap }, { quoted: m });
           } else {
             const album = result.url.map((img, i) => ({ image: { url: img }, caption: i === 0 ? cap.trim() : '' }));
             await conn.sendAlbum(m.chat, album, { quoted: m });
           }
        }
        break;
      }

      case 'tiktok': {
        let anu = await ttDownload(url);
        const teks = `🍣 *Tiktok Downloader*\n\n🍙 *Uploaded By: ${anu.author.fullname}*\n${anu.title || 'No Caption'}`;
        
        const videos = anu.data.filter(v => v.type === "nowatermark");
        const photos = anu.data.filter(v => v.type === "photo");

        if (videos.length > 0) {
            await conn.sendMessage(m.chat, { video: { url: videos[0].url }, caption: teks }, { quoted: m });
        } else if (photos.length > 0) {
            let album = photos.map((img, i) => ({
                image: { url: img.url },
                caption: i === 0 ? teks : ''
            }));
            await conn.sendAlbum(m.chat, album, { quoted: m });
        }
        break;
      }
      
      case 'douyin': {
        const result = await douyinDl(url);
        if (!result) throw new Error('Media tidak ada.');
        
        const capt = `🍣 *Douyin Downloader*\n\n🍙 *Uploaded By: ${result.author.fullname}*\n${result.title || ''}`.trim();
        await conn.sendMessage(m.chat, { video: { url: result.media.video }, caption: capt }, { quoted: m });
      break;
      }
      
      case 'twitter': {
        const result = await twitterDl(url);
        if (!result) throw new Error('Media tidak ada.');
        
        const { title, isVideo, video, image } = result;
        const capt = `🍣 *Twitter Downloader*\n\n${title || ''}`.trim();
        if (isVideo) {
           await conn.sendMessage(m.chat, { video: { url: video }, caption: capt }, { quoted: m });
        } else {
           await conn.sendMessage(m.chat, { image: { url: image }, caption: capt }, { quoted: m });
        }
        break;
      }
      
      case 'capcut': {
        const res = await capcutDl(url);
        if (!res) throw new Error('Gagal mengunduh');
        
        const { title, author, videoUrl } = res;
        const caption = `🍣 *Capcut Downloader*\n\n🍙 *Uploaded By: ${author}*\n${title}`.trim();
        await conn.sendMessage(m.chat, { video: { url: videoUrl }, caption }, { quoted: m });
        break;
      }

      case 'mediafire': {
        try {
            const data = await mfDownload(url);
            let { url: dlUrl, fileName, fileSize, uploaded } = data;
            await m.reply(`🍣 *MediaFire Downloader*\n\n${fileName} (${fileSize})\n${dlUrl}`);
            await conn.sendMessage(m.chat, { document: { url: dlUrl }, fileName: fileName, mimetype: 'application/zip' }, { quoted: m });
            buffer = null;
        } catch {
            const data = await fetch(`https://fgsi.koyeb.app/api/downloader/mediafire?apikey=${global.config.apikey.fgsi}&url=${encodeURIComponent(url)}`);
            if (!data.ok) throw new Error('Gagal mengunduh media');
            const json = await data.json();
            let { downloadUrl, filename, size, mimetype } = json.data;
            await m.reply(`🍣 *MediaFire Downloader*\n\n${filename} (${Func.formatSize(size)})\n${downloadUrl}`);
            await conn.sendMessage(m.chat, { document: { url: downloadUrl }, fileName: filename, mimetype: mimetype }, { quoted: m });
            buffer = null;
        }
        break;
      }
      
      case 'sfile': {
        const result = await sfileDl(url);
        if (!result.success) return m.reply('🍓 *Gagal mendapatkan url download*');
        const data = result.results;
        await conn.sendMessage(m.chat, { document: { url: data.download_url }, fileName: data.filename, mimetype: data.mime_type }, { quoted: m });
        break;
      }
      
      case 'pinterest': {
        const result = await pinterest.download(url);
        if (!result || !result.media) return m.reply('🍓 *Gagal mengunduh konten. Silakan periksa URL atau coba lagi.*');
        const caption = `🍣 *Pinterest Downloader*\n\n🍙 *Uploaded By: ${result.username || 'Unknown'}*\n${result.title || 'Pinterest Media'}`;
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
        break;
      }
      
      case 'youtube': {
        const video = await ytVideo(url, '480', './tmp');
        const filePath = video?.file_path;
        if (!filePath) return await m.reply("*🍓 Tidak ada data atau video dibatasi.*");
        const caption = `*${video.title}*`.trim();
         let size = (await stat(filePath)).size;
         const isBig = size > 100 * 1024 * 1024; // Limit 100MB

         if (isBig) {
           await conn.sendMessage(m.chat, {
             document: { url: filePath },
             mimetype: 'video/mp4',
             fileName: `${video.title}.mp4`,
               contextInfo: {
                 externalAdReply: {
                   title: video.title,
                   body: `YouTube Video (${video.quality || '480p'})`,
                   thumbnailUrl: video.thumbnail,
                   mediaUrl: url,
                   mediaType: 2,
                   renderLargerThumbnail: true
                 }
               }
           }, { quoted: m });
         } else {
           await conn.sendMessage(m.chat, {
             video: { url: filePath },
             mimetype: 'video/mp4',
             fileName: `${video.title}.mp4`,
             caption,
           }, { quoted: m });
         }

         // Cleanup
         if (filePath) await unlink(filePath).catch(() => {});
        break;
      }
    }
    } catch (e) {
      // Error Handling per Item: Kirim pesan error tapi Lanjutkan loop ke link berikutnya
      m.reply(`🍓 *Gagal memproses:* ${url}\n*Error:* ${e.message}`);
    }
  }

  await loading(true);
};

handler.command = ['dl'];
handler.category = ['media'];

export default handler;
