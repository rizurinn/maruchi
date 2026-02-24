import { sidompul } from '#scraper';

let handler = async (m, { conn, args, usedPrefix, command, loading }) => {
  let number = args[0];

  if (!number) {
    return m.reply(`🍭 *Cek Nomor XL/Axis*

*Penggunaan:*
${usedPrefix + command} <nomor>
*Contoh:* ${usedPrefix + command} 0878xxxxxx`);
  }

  number = number.replace(/[^0-9]/g, '');

  try {
    await loading();
    let res = await sidompul(number);

    if (!res.success) {
      return m.reply(`❌ *Gagal:* ${res.message}`);
    }

    let { subs_info, package_info } = res.results;
    
    let teks = `📱 *Informasi Nomor XL/Axis*\n\n`
    teks += `*MSISDN:* ${subs_info.msisdn}\n`
    teks += `*Operator:* ${subs_info.operator}\n`
    teks += `*Status ID:* ${subs_info.id_verified}\n`
    teks += `*Jaringan:* ${subs_info.net_type}\n`
    teks += `*Umur Kartu:* ${subs_info.tenure}\n`
    teks += `*Masa Aktif:* ${subs_info.exp_date}\n`
    teks += `*Masa tenggang:* ${subs_info.grace_until}\n`
    teks += `*VoLTE:* ${subs_info.volte.device ? '✅' : '❌'}\n\n`

    teks += `📦 *Informasi Paket:* \n`
    if (package_info.packages.length === 0) {
      teks += `> ${package_info.error_message || 'Tidak ada paket aktif.'}`;
    } else {
      package_info.packages.forEach((pkg) => {
        teks += `📦 *Nama paket:* ${pkg.name}\n`;
        teks += `📅 *Expired:* ${pkg.expiry}\n`;
        teks += `===========================\n`;
        pkg.quotas.forEach((kuota) => {
          teks += `${kuota.name}\n`;
          teks += `Total: ${kuota.total}\n`;
          teks += `Sisa: ${kuota.remaining}\n\n`;
        });
      });
    }

    return m.reply(teks.trim());

  } finally {
    await loading(true);
  }
};

handler.command = ['cekid'];
handler.category = ['info'];

export default handler;
