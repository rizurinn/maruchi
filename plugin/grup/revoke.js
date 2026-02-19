let handler = async (m, { conn }) => {
    try {
        let newCode = await conn.groupRevokeInvite(m.chat);
        let newLink = `https://chat.whatsapp.com/${newCode}`;
        return await conn.sendButton(
            m.chat,
            {
                text: `🍓 *Link undangan grup berhasil di-reset!*`,
                title: "🍡 Grup Invite Link",
                footer: "📋 Klik tombol di bawah untuk menyalin link baru~",
                buttons: [
                    {
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "📋 Salin Link Grup",
                            copy_code: newLink,
                        }),
                    },
                ],
            },
            { quoted: m }
        );
    } catch (e) {
        console.log(e);
        return await m.reply("🍩 *Gagal me-reset link grup. Coba lagi nanti yaa~*");
    }
};

handler.command = ["revoke"];
handler.category = ["group"];
handler.restrict = {
groupOnly: true,
botAdminOnly: true,
adminOnly: true }

export default handler;
