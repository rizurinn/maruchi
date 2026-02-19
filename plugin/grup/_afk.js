export async function before(m, { store }) {
    if (m.fromMe || !m.isGroup || m.isBaileys) return false;

    const senderMember = store.getMember(m.chat, m.sender);
    
    if (senderMember && senderMember.afk !== -1) {
        const durationText = msToDate(Date.now() - senderMember.afk);

        await this.sendMessage(
            m.chat,
            { 
                text: `*🔥 Selamat datang kembali, @${m.sender.split('@')[0]}!*\n\n` +
                      `*Kamu telah AFK selama ${durationText}.*\n` +
                      `*Alasan:* ${senderMember.afkReason || 'Tanpa Alasan'}`,
                mentions: [m.sender]
            }, 
            { quoted: m }
        );
        
        store.upsertMember(m.chat, m.sender, {
            afk: -1,
            afkReason: ''
        });
    }

    const mentionedJids = [...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])];
    const uniqueJids = [...new Set(mentionedJids)];

    for (let jid of uniqueJids) {
        if (jid === m.sender) continue;

        const mentionedMember = store.getMember(m.chat, jid);
        
        if (mentionedMember && mentionedMember.afk > -1) {
            const afkTimestamp = mentionedMember.afk;
            const durationText = msToDate(Date.now() - afkTimestamp);
            const afkSinceText = new Date(afkTimestamp).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                dateStyle: 'medium',
                timeStyle: 'short'
            });

            await this.sendMessage(
                m.chat, 
                { 
                    text: `*Jangan ganggu dia* 💤\n\n` +
                          `*Pengguna @${jid.split('@')[0]} sedang AFK.*\n` +
                          `*Alasan:* ${mentionedMember.afkReason || 'Tanpa Alasan'}\n` +
                          `*Sejak:* ${afkSinceText} WIB (${durationText} yang lalu)`,
                    mentions: [jid]
                }, 
                { quoted: m }
            );
        }
    }
    
    return false;
};

function msToDate(ms) {
    if (ms < 1000) return 'kurang dari 1 detik';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (days > 0) result += `${days} hari, `;
    if (hours > 0) result += `${hours} jam, `;
    if (minutes > 0) result += `${minutes} menit, `;
    if (seconds > 0) result += `${seconds} detik`;
    
    return result.replace(/, $/, '');
}