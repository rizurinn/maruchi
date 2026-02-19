import { writeFileSync } from 'node:fs';

class AIChat {
  BASE_URL = "https://app.claila.com/api/v2";
  MODEL = "gpt-5-mini";
  CHAT_MODE = "chat";
  
  sessionId = null;
  csrfToken = null;
  cookies = [];

  wrapResponse(data) {
    return {
      results: data
    };
  }

  async getCsrfToken() {
    try {
      const response = await fetch(`${this.BASE_URL}/getcsrftoken`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://app.claila.com/',
          'Origin': 'https://app.claila.com'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get CSRF token: ${response.statusText}`);
      }
      
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.cookies.push(setCookie);
      }
      
      const token = await response.text();
      return token.trim();
    } catch (error) {
      throw new Error(`Error fetching CSRF token: ${error}`);
    }
  }

  async downloadImage(imageUrl) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://app.claila.com/',
        'Origin': 'https://app.claila.com',
        'X-CSRF-Token': this.csrfToken
      };

      if (this.cookies.length > 0) {
        headers['Cookie'] = this.cookies.join('; ');
      }

      const response = await fetch(imageUrl, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (!contentType.startsWith('image/')) {
        const text = await response.text();
        throw new Error(`Response is not image. Content-Type: ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (buffer.length < 100) {
        throw new Error(`File terlalu kecil (${buffer.length} bytes), File nya korup kali njir`);
      }
      
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

      return { base64, buffer, contentType };
    } catch (error) {
      console.error(`Error downloading image from ${imageUrl}:`, error);
      throw error;
    }
  }

  parseUrls(text) {
    const urls = [];
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = imageRegex.exec(text)) !== null) {
      urls.push({
        type: 'image',
        url: match[2],
        alt: match[1] || undefined
      });
    }
    
    const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
    
    while ((match = linkRegex.exec(text)) !== null) {
      urls.push({
        type: 'link',
        url: match[2],
        alt: match[1] || undefined
      });
    }
    
    const plainUrlRegex = /(?<![\[\(])(https?:\/\/[^\s\)]+)(?![\]\)])/g;
    
    while ((match = plainUrlRegex.exec(text)) !== null) {
      const alreadyFound = urls.some(u => u.url === match[1]);
      if (!alreadyFound) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(match[1]) || 
                        match[1].includes('/image/');
        
        urls.push({
          type: isImage ? 'image' : 'link',
          url: match[1]
        });
      }
    }
    
    return urls;
  }

  async startChat() {
    this.sessionId = Math.floor(Date.now() / 1000);
    this.csrfToken = await this.getCsrfToken();
  }

  async sendMessage(
    message, 
    options = {}
  ) {
    if (!this.sessionId || !this.csrfToken) {
      await this.startChat();
    }

    const {
      websearch = false,
      tmp_enabled = 0,
      downloadImages = true
    } = options;

    try {
      const formData = new FormData();
      formData.append("model", this.MODEL);
      formData.append("message", message);
      formData.append("sessionId", this.sessionId.toString());
      formData.append("chat_mode", this.CHAT_MODE);
      formData.append("websearch", websearch.toString());
      formData.append("tmp_enabled", tmp_enabled.toString());

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://app.claila.com/',
        'Origin': 'https://app.claila.com',
        'X-CSRF-Token': this.csrfToken
      };

      if (this.cookies.length > 0) {
        headers['Cookie'] = this.cookies.join('; ');
      }

      const response = await fetch(`${this.BASE_URL}/aichat`, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.cookies.push(setCookie);
      }

      const responseText = await response.text();
      const parsedUrls = this.parseUrls(responseText);
      
      if (downloadImages) {
        for (const urlObj of parsedUrls) {
          if (urlObj.type === 'image') {
            try {
              const { base64, buffer, contentType } = await this.downloadImage(urlObj.url);
              urlObj.base64 = base64;
              urlObj.buffer = buffer;
              urlObj.contentType = contentType;
            } catch (error) {
              urlObj.error = error instanceof Error ? error.message : String(error);
              console.error(`Failed to download image: ${urlObj.url}`, error);
            }
          }
        }
      }

      const result = {
        sessionId: this.sessionId,
        message: responseText,
        websearch,
        tmp_enabled,
        urls: parsedUrls
      };

      return this.wrapResponse(result);
    } catch (error) {
      throw new Error(`Error sending message: ${error}`);
    }
  }

  resetChat() {
    this.sessionId = null;
    this.csrfToken = null;
    this.cookies = [];
  }

  getCurrentSessionId() {
    return this.sessionId;
  }
}


const handler = async (m, { conn, text, args, usedPrefix, command, loading }) => {

    const id = m.chat;
    conn.cai = conn.cai || {};

    // buat session baru jika belum ada
    if (!conn.cai[id]) conn.cai[id] = new AIChat();

    // opsi default
    let websearch = false;
    let tmp_enabled = 0;

    // command: reset session
    if (command === "cai-reset") {
        conn.cai[id].resetChat();
        return m.reply("✅ Session CAI berhasil direset.");
    }

    // command: toggle search
    if (command === "cai-search") {
        websearch = true;
        if (!text) return m.reply(`Gunakan: ${usedPrefix}${command} <pertanyaan>`);
    }

    // command: mode temp
    if (command === "cai-temp") {
        tmp_enabled = 1;
        if (!text) return m.reply(`Gunakan: ${usedPrefix}${command} <pesan>`);
    }

    if (!text) {
        return m.reply(
            `❗ Contoh penggunaan:\n` +
            `• ${usedPrefix}cai Halo apa kabar?\n` +
            `• ${usedPrefix}cai-search Cari info tentang AI\n` +
            `• ${usedPrefix}cai-temp Buatkan essay`
        );
    }

    try {
        await loading();

        // kirim message via scraper cai
        const resp = await conn.cai[id].sendMessage(text, {
            websearch,
            tmp_enabled,
            downloadImages: true
        });

        let replyText = `${resp.results.message.trim()}`;

        // jika ada gambar
        const images = resp.results.urls.filter(u => u.type === 'image' && u.base64);
        if (images.length > 0) {
            for (let img of images) {
                await conn.sendMessage(
                    id,
                    { image: img.buffer, caption: replyText },
                    { quoted: m }
                );
                replyText = ""; 
            }
        } else {
            await m.reply(replyText);
        }

    } finally {
        await loading(true);
    }
};

handler.command = ['cai', 'cai-search', 'cai-temp', 'cai-reset'];
handler.category = ['ai'];

export default handler;
