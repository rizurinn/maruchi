const motivationalPhrases = {
  0: 'Kamu perlu belajar lebih giat lagi! Jangan menyerah! 💪',
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

const RESPON_BENAR = [
  "*Benar! Kamu hebat!* 🎉",
  "*Tepat sekali!* 💯",
  "*Mantap! Lanjutkan!* 🔥",
  "*Jenius! Jawabanmu benar.* 🧠",
  "*Widih, pinter banget!* 🔥",
  "*Sempurna! Gak salah lagi.* 🤩",
  "*Anjay mabar! Benar bro.* 😎",
  "*Keren! Pertahankan prestasimu.* 🏆",
  "*Yoi, jawabannya bener!* 👍",
  "*Ez banget ya? Benar!* 🤣"
];

// --- Variasi Respon Salah ---
const RESPON_SALAH = [
  "*Kurang tepat...* 😅",
  "*Waduh, meleset!* 😂",
  "*Bukan itu jawabannya. Tetap semangat!* 💪",
  "*Yah, salah. Jangan menyerah ya!* 🥲",
  "*Hampir bener, tapi masih salah.* 🤔",
  "*Sayang sekali, jawabanmu keliru.* 🥀",
  "*Tetot! Salah gaes.* 📢",
  "*Belum beruntung, belajar lagi ya.* 🧃",
  "*Aduh, jawabannya bukan itu.* 🙈"
];

export async function before(m) {
    if (m.isBaileys || m.fromMe) return false;
    
    this.cerdasCermat = this.cerdasCermat || {};
    const session = this.cerdasCermat[m.sender];
    
    if (!session || !m.quoted || m.quoted.key.id !== session.lastQuestionId) return false;

    const userAnswer = m.body.trim().toUpperCase();
    const currentQuestion = session.questions[session.currentQuestion];
    const validOptions = ['A', 'B', 'C', 'D'];
    
    if (!validOptions.includes(userAnswer)) {
        await m.reply('🍬 *Jawab dengan opsi A, B, C, atau D saja.*');
        return false; 
    }

    clearTimeout(session.timeoutId);

    const correctAnswer = currentQuestion.jawaban_benar.toUpperCase();
    
    if (userAnswer === correctAnswer) {
        session.correctAnswers++;
        await m.reply(RESPON_BENAR[Math.floor(Math.random() * RESPON_BENAR.length)]);
    } else {
        await m.reply(`${RESPON_SALAH[Math.floor(Math.random() * RESPON_SALAH.length)]}\nJawaban yang benar: *${correctAnswer}*`);
    }
    
    session.currentQuestion++;
    
    if (session.currentQuestion < session.questions.length) {
        await session.sendQuestion(this, session.chatId, m.sender);
    } else {
        const totalQuestions = session.questions.length;
        const score = session.correctAnswers;
        const percentage = Math.round((score / totalQuestions) * 100);
        
        const normalizedScore = Math.floor((score / totalQuestions) * 10);
        const phrase = motivationalPhrases[normalizedScore] || motivationalPhrases[10];

        await this.reply(session.chatId, `
🍭 *Hasil Cerdas Cermat*

🧁 *Pemain:* @${m.sender.split('@')[0]}
📘 *Mapel: ${session.mapel.toUpperCase()}*
🍃 *Benar: ${score} / ${totalQuestions}*
🧃 *Nilai: ${percentage}*

"${phrase}"
        `.trim(), { quoted: m });
        
        delete this.cerdasCermat[m.sender];
    }
    
    return true;
}