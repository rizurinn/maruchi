import NanobanaClient from '../../lib/scraper/nanobanana.js';

async function handler(m, { conn, text, usedPrefix, command, loading }) {
    if (!text) return m.reply(`🍭 *NanoBanana*

*Penggunaan:*
${usedPrefix + command} <prompt>

_Kamu juga bisa kirim/reply gambar untuk fitur image-to-image_`);

    try {
        await loading();
        
        const nanobana = new NanobanaClient({ verbose: false });
        const auth = await nanobana.login();
        if (auth.code !== 0) throw new Error("Gagal login ke server AI");
        m.reply('🍣 *Memproses gambar, mungkin membutuhkan waktu yang lama...*');

        let imageBuffer = null;
        const q = m.quoted || m;
        const mime = q.mime || '';
        
        // Jika user me-reply gambar
        if (/image/.test(mime)) {
            imageBuffer = await q.download();
        }

        const task = await nanobana.generateImage({
            prompt: text, 
            model: "nano-banana-pro",
            image: imageBuffer,
            aspectRatio: "1:1",
            resolution: "1K",
            outputFormat: "png"
        });

        if (task.code > 0) throw new Error(task.message);

        const result = await nanobana.waitTask(task);
        if (result.code > 0) throw new Error(result.message);

        const imageUrl = Array.isArray(result.data.payload) ? result.data.payload[0].url : result.data.payload.url;

        await conn.sendMessage(m.chat, { 
            image: { url: imageUrl },
            caption: `🌸 *Berhasil generate gambar*`
        }, { quoted: m });

    } finally {
        await loading(true);
    }
}

handler.command = ['bana'];
handler.category = ['ai']
export default handler;