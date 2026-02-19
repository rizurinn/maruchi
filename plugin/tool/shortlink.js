let handler = async (m, { usedPrefix, command, text, Func, loading }) => {
    const url = global.validUrl(m);
    if (!text && !url) return await m.reply(`🍭 *Shortlink*
    
*Penggunaan:*
${usedPrefix + command} tiny <url> - Web tinyurl
${usedPrefix + command} komdigi <url> - Web Komdigi`);
    try {
        await loading()
        if (text.includes('tiny')) {
           const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
           const data = await res.text();
           return await m.reply(`🌸 *Berhasil membuat shortlink tinyurl*\n${data}`);
        } else if (text.includes('komdigi')) {
           const res = await fetch(`https://neo-api-testing.vercel.app/api/tools/shortlinkkomdigi/?url=${encodeURIComponent(url)}`);
           const data = await res.json();
           return await m.reply(`🌸 *Berhasil membuat shortlink komdigi*\n${data.results.url}`);
        } else {
           return m.reply(`🍭 *Shortlink*
    
*Penggunaan:*
${usedPrefix + command} tiny <url> - Web tinyurl
${usedPrefix + command} komdigi <url> - Web Komdigi`);
        }
    } finally {
        await loading(true)
    }
}

handler.command = ['shortlink']
handler.category = ['tool']

export default handler
