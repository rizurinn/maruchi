let handler = async (m, { conn, loading }) => {
 try {
 await loading()
 const res = await fetch('https://apizell.web.id/random/dongeng');
 const json = await res.json();
 let caption = `*${json.title}*\n_By ${json.author}_\n\n${json.storyContent.replace(/<[^>]*>/g, '').trim()}\n\n*Nasihat:* ${json.storyContent.split('Nasihat :')[1]?.trim() || '-'}`;
 return await conn.sendMessage(m.chat, {
 image: { url: json.image },
 caption: caption
 }, { quoted: m });
 } finally {
 await loading(true)
 }
}

handler.command = ['dongeng']
handler.category = ['random']

export default handler
