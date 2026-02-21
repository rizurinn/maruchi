import { langList, translate } from '#scraper';

const handler = async (m, { args, text, usedPrefix, command, loading }) => {
    if (args[0]?.toLowerCase() === 'list') {
        try {
            const lang = await langList();
            let list = '';
            for (const [code, name] of Object.entries(lang)) {
                list += `› *${code}:* ${name}\n`;
            }
            
            return m.reply(`🫧 *List bahasa yang tersedia:*\n\n${list.trim()}`);
        } catch (e) {
            throw new Error(e.stack);
        }
        return;
    }

    const langCode = args.shift();
    const teks = (text || m.quoted?.body || '').trim();

    if (!langCode || !teks) {
        return m.reply(`🍭 *Penerjemah Teks*

*Penggunaan:*
${usedPrefix + command} <kode_bahasa> <teks>

*Contoh:* ${usedPrefix + command} en halo apa kabar

*Untuk melihat daftar bahasa:*
${usedPrefix + command} list`);
    }

    try {
        await loading();
        const lang = await langList();
        if (!lang[langCode]) {
            const similarity = (a, b) => {
                let same = 0;
                for (let i = 0; i < Math.min(a.length, b.length); i++) {
                    if (a[i] === b[i]) same++;
                }
                return same / Math.max(a.length, b.length);
            };

            let bestMatch = '';
            let bestScore = 0;

            for (const code of Object.keys(lang)) {
                const score = similarity(langCode, code);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = code;
                }
            }

            return await m.reply(
                `🍣 *Kode bahasa tidak ditemukan:* \`${langCode}\`\n` +
                (bestScore >= 0.4
                    ? `Mungkin maksud kamu: *${bestMatch}* (${lang[bestMatch]})`
                    : 'Cek daftar bahasa menggunakan perintah: `' +
                      usedPrefix + command + ' list`')
            );
        }

        const tl = await translate(teks, langCode);

        if (!tl || !tl[0]) {
            throw new Error('🍓 *Hasil terjemahan kosong atau tidak valid.*');
        }

        const replyText = 
            `🌈 *Hasil Terjemahan*\n\n` +
            `*Dari Bahasa:* ${tl[1]}\n` +
            `*Ke Bahasa:* ${langCode} (${lang[langCode]})\n\n` +
            `🍡 *Teks Asli:*\n${text}\n\n` +
            `🍡 *Terjemahan:*\n${tl[0]}`.trim();
            
        await m.reply(replyText);
    } finally {
        await loading(true);
    }
};

handler.category = ['tool'];
handler.command = ['translate', 'tr'];

export default handler;
