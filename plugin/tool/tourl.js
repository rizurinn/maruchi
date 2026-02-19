let handler = async (m, { conn, usedPrefix, command, text, Func, Uploader, loading }) => {
const UPLOAD_SERVICES = {
"quax": { service: Uploader.quax, description: "Any (Exp: 30hari)" },
"pomf": { service: Uploader.pomf2, description: "Any (Exp: 1jam)" },
"uguu": { service: Uploader.uguu, description: "Any (Exp: 3jam)" },
"videy": { service: Uploader.videy, description: "Video (Exp: 24jam)" },
"picu": { service: Uploader.picu, description: "Any (Exp: never)" },
"random": { service: Uploader.uploadFile, description: "Mengambil layanan upload secara acak" }
};
                
let q = m.quoted ? m.quoted : m;
let mime = q.mime || '';
                
let args = text.trim().split(" ");
let selectedServiceName = 'random';
let contentToUpload = text;          
if (args[0] && UPLOAD_SERVICES[args[0].toLowerCase()]) {
selectedServiceName = args[0].toLowerCase();
contentToUpload = args.slice(1).join(' ');
}
const selectedService = UPLOAD_SERVICES[selectedServiceName].service;
let uploadDataBuffer;
let finalFileName;

if (mime) {
const ext = Func.getExtensionFromMime(mime);
uploadDataBuffer = await q.download();
finalFileName = q.message[q.type]?.fileName || 'upload.' + ext;
} else { 
const textToUpload = m.quoted?.text || contentToUpload;

if (!textToUpload) {
const availableServices = Object.entries(UPLOAD_SERVICES)
.map(([name, { description }]) => `- *${name}*: ${description}`)
.join("\n");
return m.reply(`🍭 *Uploader Media*

*Penggunaan: Kirim/Reply media*
${usedPrefix + command} [nama layanan] (Default: random)

*Layanan Tersedia:*\n${availableServices}`);
}
uploadDataBuffer = Buffer.from(textToUpload, 'utf-8');
finalFileName = 'upload.txt';
}

if (!uploadDataBuffer || uploadDataBuffer.length === 0) {
return m.reply("🍓 *Gagal mendapatkan konten untuk diunggah.*");
}

try {
let resultUrl = await selectedService(uploadDataBuffer, finalFileName);
if (!resultUrl || typeof resultUrl !== 'string') {
throw new Error('Layanan uploader tidak memberikan URL balasan.');
}
await loading()
const size = Func.formatSize(uploadDataBuffer.length);
await conn.sendButton(m.chat, { text: `🧁 *Upload Berhasil* 🧁\n\n🍩 *Platform: ${selectedServiceName.toUpperCase()}*\n 🍰 *Ukuran: ${size}*\n🍭 *URL: ${resultUrl}*`,
interactiveButtons: [
{
name: "cta_copy",
buttonParamsJson: JSON.stringify({
display_text: "Salin",
copy_code: resultUrl,
}),
},
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "Tautan",
url: resultUrl,
landing_page_url: resultUrl,
webview_interaction: true
}),
},
],
hasMediaAttachment: true,
}, { quoted: q });
} finally {
await loading(true)
}
}

handler.command = ['up']
handler.category = ['tool']

export default handler
