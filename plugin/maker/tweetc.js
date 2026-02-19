let handler = async (m, { conn, args, usedPrefix, command, loading }) => {
    let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender;
    let name = await conn.getName(who);
    let text;

    if (args.length >= 1) {
        text = args.join(" ");
    } else if (m.quoted && m.quoted.text) {
        text = m.quoted.text;
    } else {
        return await m.reply(`🍭 *Contoh: ${usedPrefix + command} sayang maruchi*`)
    }

    try {
        await loading()
        const avatar = await conn.profilePictureUrl(who, 'image').catch(() => 'https://telegra.ph/file/37051e5042a5dd0e25e2a.jpg');
        let part1 = Math.floor(Math.random() * 1000);
        let part2 = Math.floor(Math.random() * 1000);
        const username = who.split("@")[0];
        const replies = part1;
        const retweets = part2;
        const theme = "light";

        const url = `https://some-random-api.com/canvas/misc/tweet?displayname=${encodeURIComponent(name)}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}&comment=${encodeURIComponent(text)}&replies=${encodeURIComponent(replies)}&retweets=${encodeURIComponent(retweets)}&theme=${encodeURIComponent(theme)}`;

        return await conn.sendFile(m.chat, url, "tweet.png", "", m);
    } finally {
      await loading(true)
    }
};

handler.category = ["maker"];
handler.command = ["tweetc"];

export default handler;
