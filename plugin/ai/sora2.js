import NanobanaClient from '../../lib/scraper/nanobanana.js';

async function handler(m, { conn, text, usedPrefix, command, loading }) {
    const q = m.quoted || m;
    const mime = q.mime || '';
    
    if (!text || !/image/.test(mime)) {
        return m.reply(`🍭 *Sora Video Generator*

*Penggunaan:* Reply/kirim gambar
${usedPrefix + command} <prompt>`);
    }

    try {
        await loading();

        const nanobana = new NanobanaClient({ verbose: false });
        const auth = await nanobana.login();
        if (auth.code !== 0) throw new Error("Gagal login ke server.");
        m.reply('🍣 *Memproses video, mungkin membutuhkan waktu yang lama...*');

        let imageBuffer = null;
        
        if (/image/.test(mime)) {
            imageBuffer = await q.download();
        }

        const task = await nanobana.generateVideo({
            prompt: text,
            model: "sora2-pro", 
            image: imageBuffer,
            aspectRatio: "16:9",
            duration: "10s"
        });

        if (task.code > 0) throw new Error(task.message);

        const result = await nanobana.waitTask(task);
        if (result.code > 0) throw new Error(result.message);

        const videoUrl = Array.isArray(result.data.payload) ? result.data.payload[0].url : result.data.payload.url;

        await conn.sendMessage(m.chat, { 
            video: { url: videoUrl },
            caption: `✅ *Video berhasil dibuat!*\n\n📝 *Prompt:* ${text}`,
            gifPlayback: false
        }, { quoted: m });
    } finally {
        await loading(true);
    }
}

handler.command = ['sora'];
handler.category = ['ai'];
export default handler;