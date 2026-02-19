import { generateWAMessageContent, generateWAMessageFromContent } from 'baileys';
import crypto from 'node:crypto';

async function groupStatus(conn, jid, content) {
    const { backgroundColor } = content;
    delete content.backgroundColor;
    const inside = await generateWAMessageContent(content, {
        upload: conn.waUploadToServer,
        backgroundColor
    });
    const messageSecret = crypto.randomBytes(32);
    const m = generateWAMessageFromContent(jid, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: {
                message: {
                    ...inside,
                    messageContextInfo: { messageSecret }
                }
            }
        },
        {}
    );
    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

let handler = async (m, { conn, usedPrefix, command, text, loading }) => {
   const quoted = m.quoted ?? m
   const mime = quoted.mime || ''
   const teks = text || ''
   if (!mime && !teks) return await m.reply(`🍭 *Penggunaan:*\n*Kirim atau reply pesan dengan command ${usedPrefix + command} [teks]*`)

   try {
      await loading();
      let message
      if (/image|webp/.test(mime)) {
         const media = await quoted.download()
         message = {
            image: media,
            caption: teks || null
         }
      } else if (/video/.test(mime)) {
         const media = await quoted.download()
         message = {
            video: media,
            caption: teks || null
         }
      } else if (/audio/.test(mime)) {
         const media = await quoted.download()
         message = { 
            audio: media,
            caption: teks || null
         }
      } else if (!mime) {
         return m.reply('🍰 *Media yang didukung: Gambar, video, dan audio*');
      }
      await groupStatus(conn, m.chat, message)
      return await m.reply('🌸 *Berhasil*')
   } finally {
      await loading(true);
   }
};

handler.command = ['upswgc'];
handler.category = ['gruop'];
handler.restrict = {
  adminOnly: true
};
export default handler
