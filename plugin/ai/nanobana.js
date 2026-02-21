import * as cheerio from 'cheerio';
import crypto from 'crypto';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function genxfpid() {
  const p1 = crypto.randomBytes(16).toString('hex');
  const p2 = crypto.randomBytes(32).toString('hex');
  return Buffer.from(`${p1}.${p2}`).toString('base64');
}

const akunlama = {
  inbox: async (recipient) => {
    const url = `https://akunlama.com/api/v1/mail/list?recipient=${recipient}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    const messages = await response.json();
    if (!Array.isArray(messages) || messages.length === 0) return [];
    return messages.map(item => ({
      region: item.storage.region,
      key: item.storage.key,
      timestamp: item.timestamp,
      sender: item.sender,
      subject: item.message.headers.subject,
      from: item.message.headers.from
    }));
  },
  getInbox: async (region, key) => {
    const url = `https://akunlama.com/api/v1/mail/getHtml?region=${region}&key=${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    const html = await response.text();
    if (!html || typeof html !== 'string') return { plainText: '', links: [] };
    const $ = cheerio.load(html);
    $('script, style').remove();
    const plainText = $('body').text().replace(/\s+/g, ' ').trim();
    const links = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) links.push({ href: href, text: $(el).text().trim() });
    });
    return { plainText, links };
  }
};

const baseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
  'origin': 'https://nanana.app',
  'referer': 'https://nanana.app/en'
};

async function getauth() {
  const username = crypto.randomBytes(6).toString('hex');
  const email = `${username}@akunlama.com`;
  
  await fetch('https://nanana.app/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, type: 'sign-in' })
  });

  let mailKey, mailRegion;
  while (true) {
    const mails = await akunlama.inbox(username);
    if (mails.length > 0) {
      mailKey = mails[0].key;
      mailRegion = mails[0].region;
      break;
    }
    await delay(3000);
  }

  const mailContent = await akunlama.getInbox(mailRegion, mailKey);
  const otpMatch = mailContent.plainText.match(/\b\d{6}\b/);
  const otp = otpMatch[0];

  const signinRes = await fetch('https://nanana.app/api/auth/sign-in/email-otp', {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, otp: otp })
  });
  if (!signinRes.ok) throw new Error(signinRes.status);

  const setCookie = signinRes.headers.getSetCookie(); // Method native untuk ambil multi-cookie
  const cookieString = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

  return {
    ...baseHeaders,
    'Cookie': cookieString,
    'x-fp-id': genxfpid()
  };
}

async function upimage(imgBuffer, authheaders) {
  const form = new FormData();
  // Mengirim buffer langsung sebagai Blob
  const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
  form.append('image', blob, 'input.jpg');

  const res = await fetch('https://nanana.app/api/upload-img', {
    method: 'POST',
    headers: authheaders, // Native fetch otomatis handle Content-Type FormData & Boundary
    body: form
  });
  if (!res.ok) throw new Error(res.status);

  const data = await res.json();
  return data.url;
}

async function createJob(imgurl, prompt, authheaders) {
  const res = await fetch('https://nanana.app/api/image-to-image', {
    method: 'POST',
    headers: { ...authheaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, image_urls: [imgurl] })
  });
  if (!res.ok) throw new Error(res.status);

  const data = await res.json();
  return data.request_id;
}

async function cekjob(jobId, authheaders) {
  const res = await fetch('https://nanana.app/api/get-result', {
    method: 'POST',
    headers: { ...authheaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: jobId, type: 'image-to-image' })
  });
  if (!res.ok) throw new Error(res.status);

  return await res.json();
}

async function nanana(imgBuffer, prompt) {
  const authheaders = await getauth();
  let uploadurl = null;
  if (imgBuffer) {
     uploadurl = await upimage(imgBuffer, authheaders);
  }
  const jobId = await createJob(uploadurl, prompt, authheaders);

  let result;
  do {
    await delay(5000);
    result = await cekjob(jobId, authheaders);
  } while (!result.completed);

  return {
    job_id: jobId,
    image: result.data.images[0].url
  };
}

async function handler(m, { conn, text, usedPrefix, command, loading }) {
    if (!text) return m.reply(`🍭 *NanoBanana*

*Penggunaan:*
${usedPrefix + command} <prompt>

_Kamu juga bisa kirim/reply gambar untuk fitur image-to-image_`);

    try {
        await loading();

        let imageBuffer = null;
        const q = m.quoted || m;
        const mime = q.mime || '';
        
        // Jika user me-reply gambar
        if (/image/.test(mime)) {
            imageBuffer = await q.download();
        }

        const generate = await nanana(imageBuffer, text);
        if (!generate.image) throw new Error('Tidak ada hasil.');

        await conn.sendMessage(m.chat, { 
            image: { url: generate.image },
            caption: `🌸 *Berhasil generate gambar*`
        }, { quoted: m });

    } finally {
        await loading(true);
    }
}

handler.command = ['nana'];
handler.category = ['ai']
export default handler;
