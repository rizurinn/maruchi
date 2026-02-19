import * as cheerio from 'cheerio';

const handler = async (m, { text, usedPrefix, command, loading }) => {
  if (!text) return await m.reply(`🍭 *Masukkan nama saluran TV Indonesia!*\n*Contoh: ${usedPrefix + command} rcti*`)

  try {
    await loading()
    const channel = text.toLowerCase()
    const url = `https://www.jadwaltv.net/channel/${channel}`
    const res = await fetch(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    const regexJamValid = /^\d{2}:\d{2}WIB$/i;
    let hasil = ''
    $("table.table.table-bordered").each((i, table) => {
      $(table).find("tr").each((j, row) => {
        const kolom = $(row).find("td");
        if (kolom.length === 2) {
          const jam = $(kolom[0]).text().trim();
          const acara = $(kolom[1]).text().trim();
          if (jam === "Jam" || acara === "Acara") return;
          if (!regexJamValid.test(jam)) return;
          if (/jadwal tv selengkapnya/i.test(acara)) return;

          hasil += `🕒 ${jam} - ${acara}\n`
        }
      })
    })

    if (!hasil) return await m.reply('🍰 *Channel tidak ditemukan atau tidak ada jadwalnya.*')

    return await m.reply(`🌸 *Jadwal ${channel.toUpperCase()} Hari Ini:*\n\n${hasil}`)
  } finally {
    await loading(true)
  }
}

handler.category = ['info']
handler.command = ['jadwaltv']

export default handler
