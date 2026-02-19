import fetch from 'node-fetch';

let handler = async (m, { conn, text, Func, usedPrefix, command }) => {
    let url = (text ? Func.isUrl(text)?.[0] : null) || (m.quoted ? Func.isUrl(m.quoted.body)?.[0] : null);
    if (!url) {
        return m.reply(`🍭 *Fetch URL*

*Penggunaan:*
${usedPrefix + command} <url> - Ambil source kode atau file dari URL`);
    }

    const originalUrl = url;
    if (/pastebin\.com\/(?!raw\/)/i.test(url)) {
        url = url.replace(/pastebin\.com\//i, 'pastebin.com/raw/');
    } else if (/github\.com\/.*\/blob\//i.test(url)) {
        url = url.replace('github.com', 'raw.githubusercontent.com').replace(/\/blob\//, '/');
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Timeout
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return m.reply(`🍓 *HTTP Error ${response.status}*: ${response.statusText}\n*URL:* ${url}`);
        }

        const contentType = response.headers.get("content-type");
        const mime = contentType ? contentType.split(";")[0].trim() : "application/octet-stream";
        const length = response.headers.get("content-length");
        const size = length ? Func.formatSize(parseInt(length)) : "Unknown";
        
        const protector = await checkCloudflare(url);

        let filename = "result";
        const disposition = response.headers.get("content-disposition");
        const ext = Func.getExtensionFromMime(mime);
        
        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/['"]/g, "").trim();
        } else {
            const pathName = new URL(url).pathname;
            const baseName = pathName.split('/').pop();
            if (baseName && baseName.includes('.')) {
                filename = baseName;
            } else {
                filename = `result.${ext}`;
            }
        }

        const caption = `🍥 *Fetch Result* 🍥

🍟 *Type: ${mime}*
🥟 *Size: ${size}*
🍪 *Cloudflare: ${protector.isCloudflare ? '✅' : '❌'}*
🍬 *Url: ${originalUrl}*
${url !== originalUrl ? `🔗 *Raw:* ${url}` : ''}`.trim();

        await m.reply(caption);

        const buffer = Buffer.from(await response.arrayBuffer());

        if (/image\/(jpe?g|png|webp)/i.test(mime)) {
            await conn.sendMessage(m.chat, { image: buffer, caption: '' }, { quoted: m });
        } else if (/video/i.test(mime)) {
            await conn.sendMessage(m.chat, { video: buffer, caption: '' }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { 
                document: buffer, 
                mimetype: mime, 
                fileName: filename 
            }, { quoted: m });
        }

    } catch (error) {
        const errorMsg = error.name === 'AbortError' 
            ? `🍰 *Request Timeout (30s)*\n*URL:* ${url}` 
            : `🍓 *Gagal Fetching*\n*Error:* ${error.message}`;
        return m.reply(errorMsg);
    }
}

handler.command = ["get"];
handler.category = ["tool"];

export default handler;

// Function Check Cloudflare
async function checkCloudflare(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s check timeout
        
        const response = await fetch(url, {
            method: 'HEAD', // Cukup HEAD untuk cek header
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        clearTimeout(timeoutId);
        
        const headers = response.headers;
        const cfRay = headers.get('cf-ray');
        const server = headers.get('server');
        
        const isCloudflare = !!cfRay || server === 'cloudflare';

        return { isCloudflare };
    } catch {
        return { isCloudflare: false };
    }
}