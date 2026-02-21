import sharp from 'sharp';
import * as cheerio from 'cheerio';

const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

function pickRandom(list) {
	return list[Math.floor(list.length * Math.random())]
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function toVideo(source) {
  const form = new FormData();
  const isUrl = typeof source === "string" && /https?:\/\//.test(source);
  
  form.append("new-image-url", isUrl ? source : "");
  
  if (!isUrl) {
    const blob = new Blob([source], { type: 'image/webp' });
    form.append("new-image", blob, "image.webp");
  } else {
    form.append("new-image", "");
  }

  const res = await fetch("https://ezgif.com/webp-to-mp4", {
    method: "POST",
    body: form,
  });

  const html = await res.text();
  const $ = cheerio.load(html);
  
  const form2 = new FormData();
  let fileTarget = "";

  $("form input[name]").each((i, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") || "";
    form2.append(name, value);
    if (name === "file") fileTarget = value;
  });

  if (!fileTarget) {
    throw new Error("Gagal mendapatkan ID file dari EZGIF.");
  }

  const res2 = await fetch("https://ezgif.com/webp-to-mp4/" + fileTarget, {
    method: "POST",
    body: form2,
  });

  const html2 = await res2.text();
  const $final = cheerio.load(html2);

  const videoSrc = $final("div#output > p.outfile > video > source").attr("src");
  
  if (!videoSrc) {
    throw new Error("Gagal mendapatkan video hasil konversi.");
  }

  return new URL(videoSrc, res2.url).toString();
}

async function fileTypeFromBuffer(buffer) {
    if (!buffer || !(buffer instanceof Buffer)) return { ext: 'bin', mime: 'application/octet-stream' };
    
    const head = buffer.subarray(0, 12).toString('hex').toUpperCase();
    
    if (head.startsWith('FFD8FF')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (head.startsWith('89504E47')) return { ext: 'png', mime: 'image/png' };
    if (head.startsWith('47494638')) return { ext: 'gif', mime: 'image/gif' };
    if (head.startsWith('25504446')) return { ext: 'pdf', mime: 'application/pdf' };
    if (head.startsWith('504B0304')) return { ext: 'zip', mime: 'application/zip' }; // Juga mencakup docx, xlsx, jar, apk
    if (head.startsWith('494433') || head.startsWith('FFF3') || head.startsWith('FFF2')) return { ext: 'mp3', mime: 'audio/mpeg' };
    if (head.startsWith('1A45DFA3')) return { ext: 'mkv', mime: 'video/x-matroska' };
    if (head.startsWith('4F676753')) return { ext: 'ogg', mime: 'audio/ogg' }; // Sering dipakai untuk VN WhatsApp (Opus)
    
    if (head.startsWith('52494646') && buffer.subarray(8, 12).toString('hex').toUpperCase() === '57454250') {
        return { ext: 'webp', mime: 'image/webp' };
    }

    if (buffer.subarray(4, 8).toString('hex').toUpperCase() === '66747970') {
        return { ext: 'mp4', mime: 'video/mp4' };
    }

    return { ext: 'bin', mime: 'application/octet-stream' };
}

function getExtensionFromMime(mime) {
    const mimeMap = {
        'text/html': 'html',
        'text/plain': 'txt',
        'text/css': 'css',
        'text/javascript': 'js',
        'application/javascript': 'js',
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'video/mp4': 'mp4',
        'video/mpeg': 'mpeg',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'application/x-rar-compressed': 'rar',
        'application/octet-stream': 'bin'
    };

    return mimeMap[mime] || mime.split('/')[1] || 'bin';
}

const getBuffer = async (url) => {
     try {
        const response = await fetch(url);

        if (!response.ok) {
           throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer;
	} catch (err) {
		return err
     }
}

const fetchJson = async (url, options = {}) => {
    try {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                ...options.headers
            }
        };
        const timeout = options.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const fetchOptions = {
            ...defaultOptions,
            ...options,
            signal: controller.signal,
            headers: defaultOptions.headers
        };

        delete fetchOptions.timeout;

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP Error! status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            return {
                error: true,
                message: 'Request timeout',
                type: 'timeout'
            };
        }
        if (err instanceof SyntaxError) {
            return {
                error: true,
                message: 'Invalid JSON response',
                type: 'parse_error',
                details: err.message
            };
        }
        return {
            error: true,
            message: err.message,
            type: 'fetch_error',
            details: err
        };
    }
};

const reSize = async (image, ukur1 = 100, ukur2 = 100) => {
    try {
        const result = await sharp(image)
            .resize(ukur1, ukur2)
            .jpeg()
            .toBuffer();
        return result;
    } catch (e) {
        throw new Error(e);
    }
};

const getSizeMedia = async (path) => {
        try {
            if (typeof path === 'string' && /http/.test(path)) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout
                
                const response = await fetch(path, {
                    method: 'HEAD',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                clearTimeout(timeoutId);
                
                let length = parseInt(response.headers.get('content-length'));

                if (isNaN(length) || length === 0) {
                    const getResponse = await fetch(path, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    length = parseInt(getResponse.headers.get('content-length'));
                    if (isNaN(length) || length === 0) {
                        const buffer = await getResponse.arrayBuffer();
                        length = buffer.byteLength;
                    }
                }
                
                if (!isNaN(length) && length > 0) {
                    return formatSize(length, 3);
                } else {
                    return 'Unknown';
                }
            } else if (Buffer.isBuffer(path)) {
                let length = Buffer.byteLength(path);
                if (!isNaN(length)) {
                    return formatSize(length, 3);
                } else {
                    return '0 B';
                }
            } else {
                return 'Unknown';
            }
        } catch {
            return 'Unknown';
        }
}

const formatSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';
    if (isNaN(bytes)) return 'Unknown';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(2) + 'MB',
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
    external: (mem.external / 1024 / 1024).toFixed(2) + 'MB',
    heapUsage: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1) + '%'
  };
};

export default { isUrl, pickRandom, sleep, toVideo, fileTypeFromBuffer, getExtensionFromMime, getBuffer, fetchJson, reSize, getSizeMedia, formatSize, getMemoryStats }
