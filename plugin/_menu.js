import {
    proto,
    generateWAMessageFromContent,
    prepareWAMessageMedia
} from "baileys";
import os from "os";

const arrayMenu = [
    "all", "ai", "anime", "fun", "group",
    "info", "internet", "maker", "media", "owner",
    "random", "tool"
].sort();

const categoryMap = {
    all: {
        ai: "🧠 AI & Chatbot", anime: "🐰 Anime & Manga", fun: "🌈 Permainan & Kesenangan",
        group: "🧃 Group & Administrator", info: "📖 Berita & Informasi", internet: "💌 Internet & Sosmed",
        maker: "🎀 Kreator & Design", media: "🍙 Search & Download Media",
        owner: "🪄 Exec & Debuging", random: "🎲 Random & Hiburan",
        tool: "🧸 Alat & Utilitas"
    },
    ai: { ai: "🧠 AI & Chatbot" },
    anime: { anime: "🐰 Anime & Manga" },
    fun: { fun: "🌈 Permainan & Kesenangan" },
    group: { group: "🧃 Group & Administrator" },
    info: { info: "📖 Berita & Informasi" },
    internet: { internet: "💌 Internet & Sosmed" },
    maker: { maker: "🎀 Kreator & Design" },
    media: { media: "🍙 Search & Download Media" },
    owner: { owner: "🪄 Exec & Debuging" },
    random: { random: "🎲 Random & Hiburan" },
    tool: { tool: "🧸 Alat & Utilitas" }
};

const defaultMenu = {
    before: `
🌸 *I N F O   U S E R* 🌸
────────────────────
🍩 *Nama: %name*
🧁 *Status: %status*

🌸 *I N F O  C O M M A N D* 🌸
────────────────────
*🅐 = Admin*
*🅞 = Owner*
*🅓 = Disabled*
`.trimStart(),
    header: `*%category*
────────────────────`,
    body: `*%cmd* %isAdmin %isOwner %disable`,
    footer: `────────────────────`
};

const ICONS = ["🍓", "🍒", "🧁", "🍩", "🍪", "🍧", "🍡", "🍮", "🍥", "🍫", "🍬", "🍭", "🍰"];

const handler = async (m, { conn, usedPrefix, command, isOwner, args, loading, loader }) => {
    try {
        await loading();
        
        let teks = (args[0] || '').toLowerCase();
        if (!arrayMenu.includes(teks)) teks = "404";
        

        if (teks === "404") {
            const totalf = getTotalCommandsOnly(loader); // Helper function ringan
            const uptime = formatUptime(process.uptime());
            const muptime = formatUptime(os.uptime());
            
            const lists = arrayMenu.filter(v => v !== 'all').map((v, i) => {
                const icon = ICONS[i % ICONS.length] || "⭐";
                return {
                    title: `${icon} Menu ${capitalize(v)}`,
                    description: `${icon} Tampilkan perintah ${v} 🚀`,
                    id: `${usedPrefix + command} ${v}`,
                };
            });

            const listCmd = `
🌸 *I N F O   B O T* 🌸
──────────────────
🧁 *Name: ${conn.user.name}*
🥟 *Runtime: Bun ${Bun.version}*
🍧 *Uptime: ${uptime}*
🍮 *Machine Uptime: ${muptime}*
──────────────────
`.trimStart();

            const productImage = { url: "https://i.ibb.co.com/kZj1h13/IMG-20260113-WA0132.jpg" };
            const preparedMedia = await prepareWAMessageMedia({ image: productImage }, {
                    upload: conn.waUploadToServer
            });
            
            const messageContent = {
                header: {
                    title: "",
                    hasMediaAttachment: true,
                    productMessage: {
                        product: {
                            productImage: preparedMedia.imageMessage,
                            productId: "25625934403768127",
                            title: wish(),
                            description: "Nanairo Maruchi~",
                            currencyCode: "IDR",
                            priceAmount1000: 10000000000000,
                            retailerId: global.config.owner?.[0]?.name || "Owner",
                            url: "https://github.com/rizurinn",
                            productImageCount: 1,
                        },
                        businessOwnerJid: "186402302071021@lid",
                    },
                },
                body: { text: listCmd },
                footer: { text: 'Maruchi' },
                nativeFlowMessage: {
                    buttons: [
                    {
                        name: "single_select",
                        buttonParamsJson: JSON.stringify({
                            title: "Select Menu",
                            icon: "PROMOTION",
                            sections: [
                                {
                                    title: `📑 Fitur Bot Tersedia ${totalf}`,
                                    highlight_label: "なないろ マルチ",
                                    rows: [
                                        {
                                            title: "🍣 Menu All",
                                            description: "🍣 Tampilkan semua daftar perintah 🚀",
                                            id: `${usedPrefix + command} all`,
                                        },
                                    ],
                                },
                                {
                                    title: "Kategori",
                                    rows: lists,
                                }
                            ],
                            has_multiple_buttons: true
                        })
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "Script",
                            url: "https://s.komdigi.go.id/URrrg"
                        })
                    },
                    {
                        name: "galaxy_message",
                        buttonParamsJson: JSON.stringify({
                            flow_message_version: "3",
                            flow_token: "861213990153775",
                            flow_id: "881629137674877",
                            flow_cta: "Nanairo Maruchi",
                            flow_action: "navigate",
                            flow_action_payload: {
                                screen: "SATISFACTION_SCREEN",
                                data: {}
                            },
                            flow_metadata: {
                                flow_json_version: 700,
                                data_api_protocol: 2,
                                data_api_version: 2,
                                flow_name: "In-App CSAT No Agent or TRR v3 - en_US_v1",
                                creation_source: "CSAT",
                                categories: []
                            },
                            icon: "DEFAULT",
                            has_multiple_buttons: false
                        })
                    }],
                    messageParamsJson: JSON.stringify({
                        bottom_sheet: {
                            in_thread_buttons_limit: 1,
                            divider_indices: [1, 2],
                            list_title: "Daftar Menu",
                            button_title: "Daftar Menu",
                        }
                    })
                }
            };
            
            const payload = proto.Message.InteractiveMessage.create(messageContent);
            const msg = generateWAMessageFromContent(m.chat, { interactiveMessage: payload }, { userJid: conn.user.id, quoted: m });
            
            return await conn.relayMessage(m.chat, msg.message, {
               messageId: msg.key.id,
               additionalNodes: [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }]
            });
        }
        
        const category = categoryMap[teks];
        if (!category) return true;

        const name = m.pushName;
        const status = isOwner ? "🪄 Owner" : m.isAdmin ? "🍕 Admin" : "🍬 Member";
        const totalf = getTotalCommandsOnly(loader);

        const commandsByCategory = getCommandsByCategoryFiltered(loader, Object.keys(category));
        const sortedTags = Object.keys(category).sort();

        const _textArray = [defaultMenu.before];

        for (const tag of sortedTags) {
            const plugins = commandsByCategory[tag];
            if (!plugins || plugins.length === 0) continue;

            const allHelp = plugins.flatMap(p => p.help).sort();
            const header = defaultMenu.header.replace('%category', category[tag]);

            const body = plugins
               .sort((a, b) => a.help[0].localeCompare(b.help[0]))
               .map(p => {
                  return p.help.map(cmd => {
                     return defaultMenu.body
                        .replace('%cmd', usedPrefix + cmd)
                        .replace('%isAdmin', p?.restrict?.adminOnly ? "🅐" : "")
                        .replace('%isOwner', p?.restrict?.ownerOnly ? "🅞" : "")
                        .replace('%disable', p?.disabled ? "🅓" : "");
                  }).join("\n");
               })
               .join("\n");


            _textArray.push(`${header}\n${body}\n${defaultMenu.footer}`);
        }
        
        _textArray.push(defaultMenu.after || "");

        const finalText = _textArray.join("\n")
            .replace(/%name/g, name)
            .replace(/%status/g, status)
            .replace(/%p/g, usedPrefix);

        const lists = arrayMenu.filter(v => v !== 'all').map((v, i) => {
            const icon = ICONS[i % ICONS.length] || "⭐";
            return {
                title: `${icon} Menu ${capitalize(v)}`,
                description: `${icon} Tampilkan perintah ${v} 🚀`,
                id: `${usedPrefix + command} ${v}`,
            };
        });

        return await conn.sendButton(m.chat, {
                product: {
                    productImage: "https://i.ibb.co.com/kZj1h13/IMG-20260113-WA0132.jpg",
                    productId: "25625934403768127",
                    title: wish(),
                    description: "Nanairo Maruchi~",
                    currencyCode: "IDR",
                    priceAmount1000: 10000000000000,
                    retailerId: global.config.owner?.[0]?.name || "Owner",
                    url: "https://github.com/rizurinn",
                    productImageCount: 1,
                },
                businessOwnerJid: "186402302071021@lid",
                caption: finalText.trim(),
                footer: 'Maruchi',
                interactiveButtons: [
                    {
                        name: "single_select",
                        buttonParamsJson: {
                            title: "🌥️ 𝗠𝗲𝗻𝘂 𝗟𝗮𝗶𝗻𝘆𝗮 ~",
                            sections: [
                               {
                                  title: `📑 Fitur Bot Tersedia ${totalf}`,
                                  highlight_label: "なないろ マルチ",
                                  rows: [
                                     {
                                       title: "🍣 Menu All",
                                        description: "🍣 Tampilkan semua daftar perintah 🚀",
                                        id: `${usedPrefix + command} all`,
                                     },
                                  ],
                               },
                               {
                                  title: `Kategori`,
                                  rows: lists,
                               }
                            ]
                        },
                    },
                ],
                hasMediaAttachment: true,
        }, { quoted: m });
    } finally {
        await loading(true);
    }
};

handler.command = ['menu', 'help'];
export default handler;

// ============================================================================
// HELPER FUNCTIONS OPTIMIZED
// ============================================================================

// Mengambil hanya command yang sesuai filter tags (Menghemat loop)
function getCommandsByCategoryFiltered(loader, filterTags) {
    const result = {};
    const filterSet = new Set(filterTags); // O(1) lookup
    
    for (const [_, plug] of loader.plugins) {
        if (!plug) continue;
        
        let tags = plug.category || ['uncategorized'];
        if (!Array.isArray(tags)) tags = [tags];
        
        // Cek apakah plugin ini punya tag yang kita cari
        const matchingTags = tags.filter(t => filterSet.has(t));
        if (matchingTags.length === 0) continue;

        let help = plug.command;
        if (!help) continue;
        if (!Array.isArray(help)) help = [help];

        for (const tag of matchingTags) {
            if (!result[tag]) result[tag] = [];
            result[tag].push({
                help: help.filter(h => typeof h === 'string'),
                restrict: plug.restrict || {}, // Cache restrict object
                disabled: plug.disabled || false
            });
        }
    }
    return result;
}

function getTotalCommandsOnly(loader) {
    let total = 0;
    for (const [_, plug] of loader.plugins) {
        if (!plug || plug.disabled) continue;
        const help = plug.help || plug.command;
        if (Array.isArray(help)) total += help.length;
        else if (typeof help === 'string') total += 1;
    }
    return total;
}

function formatUptime(seconds) {
    // Numeric operations are fast enough in JS
    seconds = Number(seconds);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    // Gunakan conditional push array
    const parts = [];
    if (d > 0) parts.push(`${d} hari`);
    if (h > 0) parts.push(`${h} jam`);
    if (m > 0) parts.push(`${m} menit`);
    if (parts.length === 0) parts.push(`${Math.floor(seconds % 60)} detik`);
    
    return parts.join(" ");
}

function wish() {
    const now = new Date();
    const jakartaHours = (now.getUTCHours() + 7) % 24; 
    const minutes = now.getMinutes();
    const quarter = Math.floor(minutes / 15);

    const messages = {
        0: ["🍩 Udah tengah malam, bobo yuk~", "🧁 Jangan begadang, tidur sana~", "🍓 Malem sunyi, enaknya tidur~"],
        1: ["🍡 Udah jam 1, waktunya bobo~", "🍧 Mata udah berat, ayo tidur~", "🍮 Mimpi indah yaa~"],
        2: ["🍫 Jam 2 pagi? Jangan lupa istirahat~", "🍩 Udah larut, bobo yuk~", "🍒 Nyaman tidur jam segini~"],
        3: ["🍓 Jam 3, waktunya bobo cantik~", "🧁 Istirahat biar segar besok~", "🍡 Tidur nyenyak enak banget~"],
        4: ["🌸 Subuh adem, semangat bangun~", "🍵 Waktunya teh hangat~", "🍓 Pagi cerah, ayo olahraga~"],
        5: ["🐓 Ayam berkokok, bangun yuk~", "🍞 Sarapan biar kuat~", "🍯 Selamat pagi manis~"],
        6: ["🍎 Olahraga pagi dulu yuk~", "🍫 Semangat~", "☀️ Pagi cerah bikin happy~"],
        7: ["☕ Ngopi dulu biar melek~", "🍪 Yuk fokus kerjaan~", "🍩 Pagi produktif yaa~"],
        8: ["🍒 Cemilan pagi biar kuat~", "🥤 Jangan lupa minum ya~", "🍱 Siang sebentar lagi~"],
        9: ["🍚 Selamat siang, makan yuk~", "🍛 Lagi makan apa nih~", "🍮 Habis makan santai bentar~"],
        10: ["🍵 Siang panas, minum ya~", "🍫 Jangan lupa fokus lagi~", "🍧 Es teh siang enak bgt~"],
        11: ["🍩 Sore mendekat, cepet selesain kerja~", "🍪 Ngemil sore seru~", "🌸 Langit cantik bgt~"],
        12: ["🍚 Udah jam 12, makan siang yuk~", "🍲 Jangan skip makan siang~", "🍵 Istirahat bentar habis makan~"],
        13: ["🍧 Siang panas, minum yang segar~", "🍹 Jangan lupa hidrasi~", "🍉 Siang terik nih~"],
        14: ["🍫 Siang enaknya ngemil~", "🥤 Waktunya minum segar~", "📖 Santai bentar yuk~"],
        15: ["🍪 Udah sore, stretching dikit~", "🍩 Ngemil cookies enak nih~", "🌇 Langit sore cakep bgt~"],
        16: ["🍵 Teh sore + camilan perfect~", "🍰 Santai sambil nonton~", "📸 Foto langit sore yuk~"],
        17: ["🍽️ Udah sore, siap2 makan malam~", "🍲 Mau makan apa malam ini?~", "🌅 Sore adem banget~"],
        18: ["🍛 Jangan lupa makan malam~", "🍫 Malam tenang banget~", "📺 Nonton santai yuk~"],
        19: ["🎶 Malam asik sambil musik~", "📱 Sosmed-an bentar~", "🎮 Main game santai~"],
        20: ["🍵 Skincare + relax time~", "📖 Baca buku sebelum tidur~", "🛌 Jam 8, siap tidur~"],
        21: ["🍒 Jangan begadang, bobo yuk~", "🧁 Tidur awal biar fresh~", "🌙 Malem nyenyak yaa~"],
        22: ["🍩 Jangan lupa matiin lampu~", "✨ Mimpi indah ya~", "🛌 Tidur cukup itu penting~"],
        23: ["💤 Udah tengah malam, bobo nyenyak~", "🍓 Jangan begadang terus~", "🍮 Selamat malam, mimpi manis~"],
    };
    
    const msgList = messages[jakartaHours] || messages[0];
    const message = msgList[quarter] || msgList[0] || "✨ Waktu berjalan terus~";
    return `*${message}*`;
}

function capitalize(word) {
    return word ? `${word[0].toUpperCase()}${word.slice(1)}` : '';
}