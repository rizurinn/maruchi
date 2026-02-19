let handler = async (m, { conn, text, store }) => {
    const member = store.getMember(m.chat, m.sender);
    
    if (member && member.afk !== -1) {
        return await conn.sendMessage(
            m.chat,
            { 
                text: `🍡 *Kamu sudah dalam status AFK!*\n\n` +
                      `*Sejak: ${new Date(member.afk).toLocaleString('id-ID')}*\n` +
                      `*Alasan:* ${member.afkReason || 'Tanpa Alasan'}`,
                mentions: [m.sender]
            },
            { quoted: m }
        );
    }
    
    store.upsertMember(m.chat, m.sender, {
        afk: Date.now(),
        afkReason: text || 'Tanpa Alasan'
    });
    
    await conn.sendMessage(
        m.chat,
        { 
           text: `🌸 *@${m.sender.split('@')[0]} sekarang sedang AFK.*\n*Alasan:* ${text || 'Tanpa Alasan'}`, 
           mentions: [m.sender] 
        }, 
        { quoted: m }
    );
};

handler.command = ['afk'];
handler.category = 'group';
handler.restrict = {
    groupOnly: true
};

export default handler;