import { exec } from 'child_process';

var spek = async (m, bill) => {
    const { Func, loading } = bill;
    try {
        await loading()
        // Mendapatkan informasi sistem dengan neofetch
        let sysInfo = await new Promise((resolve) => {
            exec(`neofetch --stdout`, (error, stdout) => {
                resolve(stdout.toString("utf-8"));
            });
        });

        // Menjalankan Speedtest (dengan pengecekan error 403)
        let speedTestResult = "";
            speedTestResult = await new Promise((resolve, reject) => {
                exec("python3 lib/python/speed.py", (error, stdout, stderr) => {
                    if (stderr && stderr.includes("403") || stdout && stdout.includes("403")) {
                        reject("Speedtest diblokir (403 Forbidden)");
                    } else {
                        resolve(stdout ? stdout.toString().trim() : "");
                    }
                });
            });

        // Format pesan
        let message = `\`\`\`${sysInfo}\`\`\`\n`;

        // Tambahkan Speedtest jika tidak error 403
        if (speedTestResult) {
            message += `\n*Speedtest Result:*\n${speedTestResult}`;
        }

        // Kirim pesan ke chat
        return await m.reply(message);

    } finally {
       await loading(true)
    }
};

spek.command = ['neofetch'];
spek.category = ['info'];

export default spek;
