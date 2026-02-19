import fs from "fs";
import { readFile } from "fs/promises";
import path from "path";

function safePath(...segments) {
  if (!segments.length) return path.join(".");
  const target = path.join(...segments);
  const resolved = path.resolve(target);
  return resolved;
}

let handler = async (m, { conn, usedPrefix, command, args, loader }) => {
  if (!args.length) {
    return m.reply(`🍭 *File Manager & Hot Reload*

*Penggunaan:*
${usedPrefix + command} gf <path> (Ambil File)
${usedPrefix + command} df <path> (Hapus File)
${usedPrefix + command} sf <path> (Simpan File)
${usedPrefix + command} r <path/cmd> (Reload Plugin)

Contoh: ${usedPrefix + command} gf plugins/file.js`);
  }

  const mode = args[0].toLowerCase();
  const targetArgs = args.slice(1);
  let target;

  try {
    switch (mode) {
      // ================= GF (Get File) =================
      case "gf": {
        if (!targetArgs.length) return m.reply(`🍭 *Ambil File*\nContoh: ${usedPrefix + command} gf plugins/a.js`);

        target = safePath(...targetArgs);
        if (!path.extname(target)) target += ".js";

        const buffer = await readFile(target);
        const fileName = path.basename(target);

        return await conn.sendMessage(
          m.chat,
          {
            document: buffer,
            fileName,
            mimetype: "application/octet-stream",
          },
          { quoted: m }
        );
      }

      // ================= SF (Save File) =================
      case "sf": {
        target = safePath(...targetArgs);

        // MODE 1: LIST FOLDER (Jika tidak me-reply file)
        if (!m.quoted) {
          if (!fs.existsSync(target)) return m.reply(`🍩 *Folder ${target} tidak ada!*`);
          
          // Cek apakah target adalah file, jika ya tampilkan parent directory
          const stats = fs.statSync(target);
          if (!stats.isDirectory()) {
             return m.reply(`📁 *Info File:*\n${target}\nSize: ${stats.size} bytes`);
          }

          const list = fs.readdirSync(target)
            .map(name => {
              try {
                  const stat = fs.statSync(path.join(target, name));
                  return { name, dir: stat.isDirectory() };
              } catch {
                  return { name, dir: false };
              }
            })
            .sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name))
            .map(x => x.dir ? `📁 ${x.name}/` : `📄 ${x.name}`)
            .join("\n");

          return m.reply(`🌸 *Isi Folder:* ${target}\n\n${list || "(Kosong)"}`);
        }

        // MODE 2: SAVE FILE (Jika me-reply file/kode)
        // Menentukan nama file
        let filename = m.quoted.message[m.quoted.type]?.fileName;
        if (!filename) {
             // Jika targetArgs berakhir dengan ekstensi, gunakan itu sebagai nama file
             const lastArg = targetArgs[targetArgs.length - 1];
             if (lastArg && path.extname(lastArg)) {
                 filename = path.basename(target);
                 target = path.dirname(target); // Target jadi folder parent
             } else {
                 filename = `file-${Date.now()}.js`;
             }
        }

        const buffer = await m.quoted.download();
        const fullpath = path.join(target, filename);

        fs.mkdirSync(path.dirname(fullpath), { recursive: true });
        fs.writeFileSync(fullpath, buffer);

        return m.reply(`🌸 *Berhasil disimpan sebagai:*\n📁 *${fullpath}*`);
      }

      // ================= DF (Delete File) =================
      case "df": {
        if (!targetArgs.length) return m.reply(`🍭 *Hapus File*\nContoh: ${usedPrefix + command} df plugins/a.js`);

        target = safePath(...targetArgs);
        if (!path.extname(target)) target += ".js";

        if (!fs.existsSync(target)) return m.reply(`🍩 *File/Folder ${target} tidak ada!*`);

        const stat = fs.statSync(target);

        if (stat.isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
          return m.reply(`📁 *Folder berhasil dihapus: ${target}*`);
        } else {
          fs.unlinkSync(target);
          return m.reply(`📄 *File berhasil dihapus: ${target}*`);
        }
      }

      // ================= RELOAD (Reload Plugin) =================
      case "r": {
        const pluginName = targetArgs.join(" ");
        if (!pluginName) return m.reply(`🍭 *Reload Plugin*\nContoh: ${usedPrefix + command} r menu`);

        const res = await loader.reloadPlugin(pluginName);
        
        if (res.success) {
             return m.reply(`🌸 *Sukses Reload Plugin*\n📂 *File:* \`${res.file}\``);
        } else {
             return m.reply(`🍓 *Gagal Reload*\n*Reason:* ${res.error}`);
        }
      }

      default:
        return m.reply("🍰 *Mode tidak dikenal.*\n*Gunakan: gf, sf, df, atau reload*");
    }

  } catch (e) {
    if (e.code === "ENOENT") return m.reply(`🍓 *File ${path.join(process.cwd(), target)} tidak ditemukan.*`);
    return m.reply(`🍓 *Error: ${e.message}*`);
  }
};

handler.command = ["file", "f"];
handler.category = ["owner"];
handler.restrict = { ownerOnly: true };

export default handler;