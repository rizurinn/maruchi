async function getTelegramStickerSet(setName) {
  const botToken = '7935827856:AAGdbLXArulCigWyi6gqR07gi--ZPm7ewhc'; 
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${setName}`);
  if (!res.ok) {
    throw new Error('Gagal mendapatkan sticker set. Pastikan nama paket stiker benar.');
  }
  const data = await res.json();
  return data.result;
}

async function getTelegramFileUrl(fileId) {
  const botToken = '7935827856:AAGdbLXArulCigWyi6gqR07gi--ZPm7ewhc'; // Token yang sama
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  if (!res.ok) {
    throw new Error(`Gagal mendapatkan file_path untuk file_id: ${fileId}`);
  }
  const data = await res.json();
  return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}


let handler = async (m, { conn, args, usedPrefix, command, Func, loading }) => {
  if (!args[0] || !args[0].match(/https:\/\/t\.me\/addstickers\/([^\/\?#]+)/)) {
    return m.reply(`🍭 *Masukkan url sticker pack Telegram*\n\nContoh:\n${usedPrefix + command} https://t.me/addstickers/ShitpostsStickers`);
  }

  try {
    await loading()
    const url = args[0]
    const setName = url.match(/https:\/\/t\.me\/addstickers\/([^\/\?#]+)/)

   if (!setName) throw 'Invalid url'
    await m.reply(`🍭 *Mengambil informasi paket stiker *${setName[1]}*... Mohon tunggu sebentar.*`);

    const stickerSet = await getTelegramStickerSet(setName[1]);
    
    if (!stickerSet || !stickerSet.stickers || stickerSet.stickers.length === 0) {
        return m.reply('🍓 *Paket stiker tidak ditemukan atau tidak berisi stiker.*');
    }

    m.reply(`🌸 *Berhasil menemukan ${stickerSet.stickers.length} stiker dari paket "${stickerSet.title}". Memulai pengiriman...*`);

    let isFirstSticker = true;

    for (const stickerInfo of stickerSet.stickers) {
      let targetJid;
      if (isFirstSticker) {
        targetJid = m.chat;
      } else {
        targetJid = m.sender;
      }

      const fileUrl = await getTelegramFileUrl(stickerInfo.file_id);
      
      const res = await fetch(fileUrl);
      const arrayB = await res.arrayBuffer();
      const stickerBuffer = Buffer.from(arrayB);
      await conn.sendAsSticker(targetJid, stickerBuffer, isFirstSticker ? m : null, { pack: stickerSet.title, author: null });

      if (isFirstSticker && stickerSet.stickers.length > 1) {
        if (m.isGroup) {
             await conn.reply(m.chat, `🌸 *Stiker pertama telah dikirim. Sisa ${stickerSet.stickers.length - 1} stiker lainnya akan dikirim ke chat pribadi Anda.*`, { quoted: m });
        }
        isFirstSticker = false;
      }
      
      await Func.sleep(1500);
    }

    await conn.reply(`🌸 *Selesai! Semua ${stickerSet.stickers.length} stiker telah dikirim.*`, { quoted: isFirstSticker ? m.chat : m.sender });

  } finally {
    await loading(true)
  }
};
handler.disabled = true;
handler.command = ['telestick'];
handler.category = ['internet'];

export default handler;