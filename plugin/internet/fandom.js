import * as cheerio from "cheerio";

let handler = async (m, { conn, text, usedPrefix, command, loading }) => {
    try {
        if (!text) return m.reply(`🍭 *Contoh: ${usedPrefix + command} [teks]*`);
        await loading();

        const wiki = "honkai-impact-3rd-archives";
        const searchUrl = `https://${wiki}.fandom.com/wiki/Special:Search?query=${encodeURIComponent(text)}`;

        const searchRes = await fetch(searchUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!searchRes.ok) throw new Error("Gagal mengambil halaman pencarian");

        const searchHtml = await searchRes.text();
        const $search = cheerio.load(searchHtml);
        const pageUrl = $search(".unified-search__result__title").first().attr("href");

        if (!pageUrl) throw new Error("Data tidak ditemukan");

        const pageRes = await fetch(pageUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!pageRes.ok) throw new Error("Gagal mengambil halaman detail");

        const pageHtml = await pageRes.text();
        const $page = cheerio.load(pageHtml);

        $page("iframe, script, style").remove();

        const title =
            $page("h1").first().text().trim() ||
            $page("title").text().trim() ||
            "Unknown";

        let description =
    $page("#mw-content-text > p").first().text().replace(/\s+/g, " ").trim() ||
    $page('meta[property="og:description"]').attr("content")?.replace(/\s+/g, " ").trim() ||
    $page('meta[name="description"]').attr("content")?.replace(/\s+/g, " ").trim() ||
    "-";

        const infobox = {};
        $page(".portable-infobox .pi-data").each((_, el) => {
            const label = $page(el).find(".pi-data-label").text().trim();
            const value = $page(el).find(".pi-data-value").text().replace(/\s+/g, " ").trim();
            if (label && value) infobox[label] = value;
        });

        let image;
        const rawImg = $page(".portable-infobox img").first().attr("src");
        if (rawImg) {
            image = rawImg.startsWith("//") ? "https:" + rawImg : rawImg;
            image = image
                .replace(/\/scale-to-width-down\/\d+/, "")
                .replace(/\/revision\/latest.*/, "/revision/latest");
        }

        let details = Object.entries(infobox)
            .map(([k, v]) => `• *${k}:* ${v}`)
            .join("\n");

        let caption = `
✨ *Fandom Honkai Impact*

🧬 *Nama:* ${title}

📚 *Detail Karakter:*
${details}

📖 *Deskripsi Singkat:*
${description}
`.trim();

        if (image) {
            await conn.sendMessage(
                m.chat,
                {
                    image: { url: image },
                    caption
                },
                { quoted: m }
            );
        } else {
            m.reply(caption);
        }

    } finally {
        await loading(true);
    }
};

handler.command = ["fandom"];
handler.category = ["internet"];

export default handler;