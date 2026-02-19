async function ssweb(url, { width = 1280, height = 720, full_page = false, device_scale = 1 } = {}) {
  try {
    if (!url.startsWith("http")) throw new Error("Invalid url");
    if (isNaN(width) || isNaN(height) || isNaN(device_scale))
      throw new Error("Width, height, and scale must be a number");
    if (typeof full_page !== "boolean")
      throw new Error("Full page must be a boolean");

    const res = await fetch(
      "https://gcp.imagy.app/screenshot/createscreenshot",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          referer: "https://imagy.app/full-page-screenshot-taker/",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        },
        body: JSON.stringify({
          url: url,
          browserWidth: parseInt(width),
          browserHeight: parseInt(height),
          fullPage: full_page,
          deviceScaleFactor: parseInt(device_scale),
          format: "png",
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.fileUrl;
  } catch (error) {
    throw new Error(error.stack);
  }
}

let handler = async (m, { conn, text, usedPrefix, command, loading }) => {
    if (!text) {
        return m.reply(`🍭 *Screenshot Web*

*Penggunaan:*
${usedPrefix + command} <url> -w [panjang] -h [lebar] -s [skala] -full

*Parameter:*
-w ~ width (default: 1280)
-h ~ height (default: 720)
-s ~ device scale (default: 1)
-full ~ full page

*Note: Input parameter tidak wajib!*`);
    }

    // ===== PARSE PARAMETER =====
    const args = text.split(/\s+/);
    const url = global.validUrl(m);

    if (!url) return m.reply("🍓 *URL tidak valid.*");

    // Default values
    let width = 1280;
    let height = 720;
    let device_scale = 1;
    let full_page = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-w" && args[i + 1]) {
            width = parseInt(args[i + 1]);
        }

        if (args[i] === "-h" && args[i + 1]) {
            height = parseInt(args[i + 1]);
        }

        if (args[i] === "-s" && args[i + 1]) {
            device_scale = parseInt(args[i + 1]);
        }

        if (args[i] === "-full") {
            full_page = true;
        }
    }

    try {
        await loading();

        const result = await ssweb(url, {
            width,
            height,
            full_page,
            device_scale
        });

        await conn.sendMessage(
            m.chat,
            {
                image: { url: result },
                caption: `🌸 *Screenshot Result*

🍣 *URL:* ${url}
📐 *${width}x${height}*
🍩 *Scale:* ${device_scale}
🧁 *Full Page:* ${full_page}`
            },
            { quoted: m }
        );

    } finally {
        await loading(true);
    }
};
