async function handler(m, { args, text, usedPrefix, command, loading }) {
  if (!args[0]) {
      return await m.reply(`*🍭 Silakan masukkan nama kota/kabupaten.*\n*Contoh: ${usedPrefix + command} Jakarta*`);
  }
  try {
    await loading()
    const namaDaerah = text || args.join(' ');
    const jadwal = await getJadwalSholat(namaDaerah);
    
    const jadwalText = `*🌸 JADWAL SHOLAT 🌸*
*${jadwal.tanggalHijriah}* | *${jadwal.tanggalMasehi}*
*📌 Daerah: ${jadwal.kota}*

*Imsak:* ${jadwal.imsak}
*Subuh:* ${jadwal.subuh}
*Terbit:* ${jadwal.terbit}
*Dhuha:* ${jadwal.dhuha}
*Dzuhur:* ${jadwal.dzuhur}
*Ashar:* ${jadwal.ashar}
*Maghrib:* ${jadwal.maghrib}
*Isya:* ${jadwal.isya}

*_Sumber: https://bimasislam.kemenag.go.id/jadwalshalat_*`;
    
    return await m.reply(jadwalText);
    
  } finally {
    await loading(true)
  }
}

async function getJadwalSholat(namaDaerah) {
  try {
    let isKota = false;
    let isKab = false;
    let searchQuery = namaDaerah;
    
    if (namaDaerah.toLowerCase().startsWith('kota ')) {
      isKota = true;
      searchQuery = namaDaerah.substring(5).trim();
    } else if (namaDaerah.toLowerCase().startsWith('kab ')) {
      isKab = true;
      searchQuery = namaDaerah.substring(4).trim();
    }
    
    const response = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${searchQuery}`);
    if (!response.ok) {
      throw new Error('Gagal mengambil data kota');
    }
    
    const data = await response.json();
    if (!data.status || data.status !== true || data.data.length === 0) {
      throw new Error('Kota/Kabupaten tidak ditemukan');
    }
    
    const hasilPencarian = data.data;
    let idDaerah = null;
    let namaDaerahLengkap = '';
    
    if (isKota) {
      const hasilKota = hasilPencarian.find(item => item.lokasi.toLowerCase().includes('kota'));
      if (hasilKota) {
        idDaerah = hasilKota.id;
        namaDaerahLengkap = hasilKota.lokasi;
      } else {
        throw new Error(`Kota ${searchQuery} tidak ditemukan`);
      }
    } else if (isKab) {
      const hasilKab = hasilPencarian.find(item => item.lokasi.toLowerCase().includes('kab'));
      if (hasilKab) {
        idDaerah = hasilKab.id;
        namaDaerahLengkap = hasilKab.lokasi;
      } else {
        throw new Error(`Kabupaten ${searchQuery} tidak ditemukan`);
      }
    } else {
      idDaerah = hasilPencarian[0].id;
      namaDaerahLengkap = hasilPencarian[0].lokasi;
    }
    
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const dd = ("0" + date.getDate()).slice(-2);
    const mm = ("0" + (date.getMonth() + 1)).slice(-2);
    const yyyy = date.getFullYear();
    const today = `${yyyy}/${mm}/${dd}`;

    const hijrResponse = await fetch(`https://api.myquran.com/v2/cal/hijr`);
    const jadwalResponse = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${idDaerah}/${today}`);
    
    if (!hijrResponse.ok || !jadwalResponse.ok) {
      throw new Error('Gagal mengambil data jadwal');
    }
    
    const hijrData = await hijrResponse.json();
    const jadwalData = await jadwalResponse.json();
    
    if (!jadwalData.status || jadwalData.status !== true) {
      throw new Error('Gagal mendapatkan jadwal sholat');
    }

    const tanggalHijriah = hijrData.data.date[0] + ', ' + hijrData.data.date[1];
    const tanggalMasehi = hijrData.data.date[2];
    
    return {
      kota: namaDaerahLengkap,
      tanggalHijriah: tanggalHijriah,
      tanggalMasehi: tanggalMasehi,
      imsak: jadwalData.data.jadwal.imsak,
      subuh: jadwalData.data.jadwal.subuh,
      terbit: jadwalData.data.jadwal.terbit,
      dzuhur: jadwalData.data.jadwal.dzuhur,
      ashar: jadwalData.data.jadwal.ashar,
      maghrib: jadwalData.data.jadwal.maghrib,
      isya: jadwalData.data.jadwal.isya,
      dhuha: jadwalData.data.jadwal.dhuha
    };
  } catch (error) {
    throw new Error(error.message || 'Terjadi kesalahan saat mengambil data jadwal sholat');
  }
}


handler.command = ['jadwalsholat'];
handler.category = ['info']

export default handler;
