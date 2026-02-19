import { convert } from "#addon/convert.js";

let handler = async (m, { conn, loading }) => {
  try {
    let q = m.quoted ? m.quoted : m;
    let mime = q.mime || "";
    if (!/^(video|audio)\//.test(mime)) {
      return await m.reply("🍙 *Balas video atau voice note yang ingin dikonversi ke MP3!*");
    }
    await loading();
    let data = await q.download()
    if (!data || !(data instanceof Uint8Array) || data.length === 0)
    return await m.reply("🍓 *Gagal mengunduh media!*");

    const audioUint8 = await convert(data, { format: "mp3" });
    if (
      !audioUint8 ||
      !(audioUint8 instanceof Uint8Array) ||
      audioUint8.length === 0
    )
      return await m.reply("🍡 *Konversi gagal!*");

    const audioBuffer = Buffer.from(
      audioUint8.buffer,
      audioUint8.byteOffset,
      audioUint8.byteLength,
    );

    await conn.sendMessage(
      m.chat,
      {
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        fileName: "output.mp3",
      },
      { quoted: q },
    );
  } finally {
    await loading(true);
  }
};

handler.command = ["tomp3"];
handler.category = ["tool"];

export default handler;
