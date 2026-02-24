import fs from "fs";
import path from "path";

let handler = async (m, { conn }) => {
    try {
        const tempDir = "./tmp";
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Bersihkan tmp
        for (let file of fs.readdirSync(tempDir)) {
            fs.unlinkSync(path.join(tempDir, file));
        }

        await m.reply("*📦 Memproses backup script bot...*");

        const backupName = "maruchi";
        const backupPath = path.join(tempDir, `${backupName}.zip`);

        // Ambil semua file termasuk hidden
        const filesToBackup = fs
            .readdirSync(".", { withFileTypes: true })
            .map((dirent) => dirent.name)
            .filter(
                (name) =>
                    name !== "node_modules" &&
                    name !== "build" &&
                    name !== "package-lock.json" &&
                    name !== "bun.lock" &&
                    name !== "conf" &&
                    name !== ".venv"
            );

        // Gunakan Bun.spawnSync
        const proc = Bun.spawnSync({
            cmd: ["zip", "-r", backupPath, ...filesToBackup],
            stdout: "pipe",
            stderr: "pipe",
        });

        if (proc.exitCode !== 0) {
            console.error(new TextDecoder().decode(proc.stderr));
            throw new Error("Zip gagal");
        }

        await conn.sendMessage(
            m.sender,
            {
                document: fs.readFileSync(backupPath),
                fileName: `${backupName}.zip`,
                mimetype: "application/zip",
            },
            { quoted: m }
        );

        fs.unlinkSync(backupPath);

        if (m.chat !== m.sender)
            return await m.reply("*Script bot berhasil dikirim ke private chat!*");

    } catch (e) {
        console.error(e);
        return await m.reply("🍓 *Gagal membuat backup script!*");
    }
};

handler.command = ["backup"];
handler.category = ["owner"];
handler.restrict = { ownerOnly: true };

export default handler;
