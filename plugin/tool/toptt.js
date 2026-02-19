import { convert } from "#addon/convert.js";

let handler = async (m, { conn, usedPrefix, command, loading }) => {
  const q = m.quoted ? m.quoted : m;
  const mime = q.mime || "";

  if (!mime || !/^(video|audio)\//.test(mime))
    return await m.reply(
      `🍭 *Reply video atau audio dengan command:*\n› ${usedPrefix + command}`,
    );

  const data = await q.download?.();
  if (!data || !(data instanceof Uint8Array) || data.length === 0)
    return m.reply("🍓 *Gagal mengunduh media!*");
  try {
    await loading();
    
    const audioUint8 = await convert(data, {
      format: "opus",
      sampleRate: 48000,
      channels: 1,
      bitrate: "64k",
      ptt: true,
    });

    const audioBuffer = Buffer.from(
      audioUint8.buffer,
      audioUint8.byteOffset,
      audioUint8.byteLength,
    );

    await conn.sendMessage(
      m.chat,
      {
        audio: audioBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
      },
      { quoted: q },
    );
  } finally {
    await loading(true);
  }
};

handler.category = ["tool"];
handler.command = ["tovn"];

export default handler;
