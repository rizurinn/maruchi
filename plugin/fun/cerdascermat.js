const gameTimeout = 60000;
const subjects = [
  'bindo', 'tik', 'pkn', 'bing', 'penjas',
  'pai', 'matematika', 'jawa', 'ips', 'ipa'
];

const motivationalPhrases = {
  0: 'Waduh, kamu perlu belajar lebih giat lagi! Jangan menyerah! 💪',
  1: 'Masih perlu banyak belajar nih!',
  2: 'Lumayan, tapi bisa lebih baik!',
  3: 'Bagus, pertahankan!',
  4: 'Hampir setengah benar, semangat!',
  5: 'Sudah setengah jalan! Tingkatkan lagi!',
  6: 'Lumayan bagus!',
  7: 'Bagus sekali!',
  8: 'Hampir sempurna!',
  9: 'Hampir sempurna! Tinggal sedikit lagi!',
  10: 'Sempurna! Kamu benar-benar menguasai materi ini! 天才 (Tensai)!'
};

// --- Helper Function ---
async function sendQuestion(conn, chatId, userId) {
    const session = conn.cerdasCermat[userId];
    if (!session || session.currentQuestion >= session.questions.length) return;

    const questionData = session.questions[session.currentQuestion];
    
    let questionText = `🍬 *Cerdas Cermat*\n`;
    questionText += `*Mapel:* ${session.mapel.toUpperCase()}\n`;
    questionText += `*Soal ke:* ${session.currentQuestion + 1}/${session.questions.length}\n\n`;
    questionText += `*Pertanyaan:* ${questionData.pertanyaan}\n\n`;
    
    // Loop opsi jawaban
    questionData.semua_jawaban.forEach(option => {
        const [key, value] = Object.entries(option)[0];
        questionText += `${key.toUpperCase()}. ${value}\n`;
    });
    
    questionText += `\n⏳ *Waktu Jawab: ${gameTimeout / 1000} detik*`;
    
    // Kirim pesan
    const sentMsg = await conn.reply(chatId, questionText + '\n\n_Balas pesan ini dengan jawabanmu (A, B, C, atau D)_', { quoted: null });
    
    // Simpan ID pesan soal untuk validasi reply
    session.lastQuestionId = sentMsg.key.id; 
    session.answered = false;

    // Reset Timer
    if (session.timeoutId) clearTimeout(session.timeoutId);
    
    session.timeoutId = setTimeout(() => {
        if (conn.cerdasCermat && conn.cerdasCermat[userId]) {
            conn.reply(chatId, `⏰ *Waktu habis!*\nJawaban yang benar adalah: *${questionData.jawaban_benar}*.\n\n_Permainan Cerdas Cermat dihentikan._`, { quoted: sentMsg });
            delete conn.cerdasCermat[userId];
        }
    }, gameTimeout);
}

// --- Main Handler (Command) ---
let handler = async (m, { conn, args, command, usedPrefix }) => {
    conn.cerdasCermat = conn.cerdasCermat || {};
    
    if (conn.cerdasCermat[m.sender]) {
        return m.reply('🍩 *Kamu sedang dalam sesi Cerdas Cermat. Selesaikan dulu atau tunggu waktu habis!*');
    }
    
    const [matapelajaran, jumlahSoal] = args;
    
    if (!matapelajaran || !subjects.includes(matapelajaran.toLowerCase())) {
        return m.reply(
            `🍭 *Cerdas Cermat*\n\n` +
            `*Penggunaan:*\n${usedPrefix + command} <mapel> [jumlah_soal]\n\n` +
            `*Contoh:* ${usedPrefix + command} ipa 5\n` +
            `*Pilihan Mapel:* ${subjects.map(v =>  v).join(', ')}`
        );
    }
    
    let count = parseInt(jumlahSoal);
    if (!count) count = 5;
    if (count < 1 || count > 10) return m.reply('🍰 *Jumlah soal minimal 1 dan maksimal 10!*');

    const res = await fetch(`https://api.siputzx.my.id/api/games/cc-sd?matapelajaran=${matapelajaran.toLowerCase()}&jumlahsoal=${count}`);
    if (!res.ok) throw new Error('API Error');
    const json = await res.json();
    if (!json.status || !json.data || !json.data.soal || json.data.soal.length === 0) {
        return m.reply('🍓 *Gagal mengambil soal. Coba mata pelajaran lain.*');
    }

    // Inisialisasi Sesi
    conn.cerdasCermat[m.sender] = {
        chatId: m.chat,
        mapel: matapelajaran,
        questions: json.data.soal,
        currentQuestion: 0,
        correctAnswers: 0,
        startTime: Date.now(),
        answered: false,
        lastQuestionId: null,
        timeoutId: null,
        sendQuestion
    };
        
    await sendQuestion(conn, m.chat, m.sender);
}

handler.command = ['cerdascermat'];
handler.category = ['fun'];

export default handler;