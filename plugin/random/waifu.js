let handler = async (m, { conn, usedPrefix, loading }) => {
  try {
    await loading()
    const res = await fetch('https://api.waifu.im/images')
    .then(response => {
       if (response.ok) {
          return response.json();
       } else {
          throw new Error('Request failed with status code: ' + response.status);
       }
    })
    
  await conn.sendButton(m.chat, {
    image: { url: res.items[0].url },
    caption: `${res.items[0].tags[0].description}`,
    buttons: [{
         buttonId: `${usedPrefix}waifu`,
         buttonText: {
             displayText: 'Lanjut'
         },
         type: 1,
         },
    ]
  }, { quoted: m });
} finally {
await loading(true)
}
};

handler.command = ['waifu'];
handler.category = ['random'];

export default handler;

