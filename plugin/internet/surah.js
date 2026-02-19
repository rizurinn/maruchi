const handler = async (m, { args, usedPrefix, command, loading }) => {
    if (command === 'listsurah') {
        try {
            await loading();
            const list = await getListSurah();
            if (!list || list.length === 0) return m.reply('🍓 *Gagal mendapatkan daftar surah.*');

            let message = '📖 *DAFTAR SURAH DALAM AL-QUR\'AN*\n\n';
            list.forEach(surah => {
                message += `${surah.nomor}. *${surah.latin}* (${surah.arti}) - ${surah.jumlah_ayat} ayat\n`;
            });

            await m.reply(message);
        } finally {
            await loading(true);
        }
        return;
    }

    if (command === 'surah') {
        if (!args[0]) {
            return m.reply(
`🍭 *Penggunaan Fitur Surah:*\n
1. *Melihat Daftar Surah:*
   ${usedPrefix}listsurah

2. *Membaca Seluruh Surah:*
   ${usedPrefix}surah Al-Fatihah
   ${usedPrefix}surah 1

3. *Membaca Ayat Tertentu:*
   ${usedPrefix}surah Al-Baqarah 7
   ${usedPrefix}surah 2 7

4. *Membaca Rentang Ayat:*
   ${usedPrefix}surah Ali 'Imran 10-15
   ${usedPrefix}surah 3 10-15`
            );
        }

        try {
            await loading();
            const surahQuery = args[0];
            const verseQuery = args[1];

            const result = await getAllAyat(surahQuery);
            if (result.error) {
                return m.reply(`🍓 *Error: ${result.error}.*\nGunakan *${usedPrefix}listsurah* untuk melihat daftar yang benar.`);
            }

            let versesToDisplay = result.ayat;
            let title = `*${result.surah}* (${result.arti_surah})`;

            // Filter ayat jika ada permintaan spesifik
            if (verseQuery) {
                if (verseQuery.includes('-')) {
                    // Rentang ayat (contoh: 10-15)
                    const [start, end] = verseQuery.split('-').map(Number);
                    if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > result.ayat.length) {
                        return m.reply(`🍓 *Rentang ayat tidak valid. Surah ${result.surah} hanya memiliki ${result.ayat.length} ayat.*`);
                    }
                    versesToDisplay = result.ayat.slice(start - 1, end);
                    title += ` - Ayat ${start} sampai ${end}`;
                } else {
                    // Ayat tunggal
                    const verseNum = Number(verseQuery);
                    if (isNaN(verseNum) || verseNum < 1 || verseNum > result.ayat.length) {
                        return m.reply(`🍓 *Ayat tidak valid. Surah ${result.surah} hanya memiliki ${result.ayat.length} ayat.*`);
                    }
                    versesToDisplay = [result.ayat[verseNum - 1]];
                    title += ` - Ayat ${verseNum}`;
                }
            }
            
            if (versesToDisplay.length === 0) {
                 return m.reply('🍓 *Tidak ada ayat untuk ditampilkan dengan kriteria tersebut.*');
            }

            let formattedText = `${title}\n\n`;
            versesToDisplay.forEach(ayat => {
                formattedText += `*[${ayat.ayat}]* ${ayat.arab}\n`;
                formattedText += `_${ayat.latin}_\n\n`;
                formattedText += `Artinya: "${ayat.terjemahan}"\n\n`;
            });

            await m.reply(formattedText.trim());

        } finally {
            await loading(true);
        }
        return;
    }
};

handler.command = ['surah', 'listsurah'];
handler.category = ['internet'];

export default handler;


const headers = {
  "Accept": "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
  "Referer": "https://quran.kemenag.go.id/",
  "Origin": "https://quran.kemenag.go.id"
};

async function getListSurah() {
  const res = await fetch("https://web-api.qurankemenag.net/quran-surah", { headers });
  const data = await Bun.readableStreamToJSON(res.body);
  return data.data.map(surah => ({
    nomor: surah.id,
    latin: surah.latin.trim(),
    arti: surah.translation,
    jumlah_ayat: surah.num_ayah
  }));
}

async function getAllAyat(surahInput) {
  const list = await getListSurah();
  const found = list.find(s =>
    s.latin.toLowerCase() === surahInput.toLowerCase() ||
    s.nomor === Number(surahInput)
  );
  if (!found) return { error: "Surah tidak ditemukan" };

  const res = await fetch(
    `https://web-api.qurankemenag.net/quran-ayah?start=0&limit=${found.jumlah_ayat}&surah=${found.nomor}`,
    { headers }
  );
  const data = await Bun.readableStreamToJSON(res.body);

  return {
    surah: found.latin,
    arti_surah: found.arti,
    ayat: data.data.map(a => ({
      ayat: a.ayah,
      arab: a.arabic,
      latin: a.latin.trim(),
      terjemahan: a.translation
    }))
  };
}
