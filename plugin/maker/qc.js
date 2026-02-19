import { quotedLyo } from '#scraper';

let handler = async (m, { conn, text, loading }) => {
  let teks, orang;

  if (m.quoted) {
    teks = m.quoted.body || '';
    if (!teks?.trim()) {
      return await m.reply('*🍭 Pesan yang di-reply harus mengandung text!*');
    }
    teks = teks?.trim();
    orang = m.quoted.sender || m.quoted.key.participant;
  } else {
    if (!text) {
      return await m.reply(`🍭 *Quotly*

*Penggunaan:*
${usedPrefix + command} --[warna] [teks]

*Warna kustom tersedia:*
- merah
- biru
- hijau
- kuning
- pink
- ungu
- orange
- coklat
- abu
- putih

_Bisa juga mereply pesan teks untuk membuat sticker_`);
    }
    teks = text.trim();
    orang = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.sender;
  }

  const colorMap = {
    '--merah': '#FF0000',
    '--biru': '#0000FF',
    '--hijau': '#00FF00',
    '--kuning': '#FFFF00',
    '--pink': '#FFC0CB',
    '--ungu': '#800080',
    '--orange': '#FFA500',
    '--coklat': '#A52A2A',
    '--abu': '#808080',
    '--putih': '#FFFFFF'
  };

  let backgroundColor = '#2E4053';
  for (const [flag, color] of Object.entries(colorMap)) {
    if (text.includes(flag)) {
      backgroundColor = color;
      teks = teks.replace(flag, '').trim();
      break;
    }
  }

  try {
    await loading();

    const avatar = await conn.profilePictureUrl(orang, 'image').catch(() => 'https://i.ibb.co/2WzLyGk/profile.jpg');
    const number = m.quoted?.pushName || m.pushName || 'Pengguna';

    let res = await quotedLyo(teks, number, avatar, null, backgroundColor);

    const q = m.quoted || m;
    await conn.sendAsSticker(m.chat, Buffer.from(res.result.image, 'base64'), q, {
      pack: global.config.packnames,
      author: global.config.authors
    });
    return;
  } finally {
    await loading(true);
  }
};

handler.command = ['qc'];
handler.category = ['maker'];

export default handler;
