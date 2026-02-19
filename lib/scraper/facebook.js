import * as cheerio from 'cheerio';

async function fbDownload(url) {
    if (!/facebook\.\w+\/(reel|watch|share)/gi.test(url)) {
        throw new Error("Invalid URL, Enter A Valid Facebook Video URL")
    }
    try {
        const response = await fetch("https://fdownloader.net/id", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0 Win64 x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            },
        });
        const html = await response.text();
        const exMatch = html.match(/k_exp ?= ?"(\d+)"/i);
        const toMatch = html.match(/k_token ?= ?"([a-f0-9]+)"/i);
        const ex = exMatch ? exMatch[1] : null;
        const to = toMatch ? toMatch[1] : null;
        if (!ex || !to) {
            throw new Error("Error Extracting Exp And Token")
        }
        const searchResponse = await fetch(
            "https://v3.fdownloader.net/api/ajaxSearch?lang=id",
            {
                method: 'POST',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0 Win64 x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                    origin: "https://fdownloader.net",
                },
                body: new URLSearchParams({
                    k_exp: ex,
                    k_token: to,
                    q: url,
                    lang: "id",
                    web: "fdownloader.net",
                    v: "v2",
                    w: "",
                }).toString()
            }
        );
        const data = await searchResponse.json();
        if (data.status !== "ok") {
            throw new Error("Failed Doing Ajax Search")
        }
        const $ = cheerio.load(data.data);
        const videos = $("#fbdownloader").find(".tab__content").eq(0).find("tr").map((i, el) => {
            const quality = $(el).find(".video-quality").text().trim();
            const url = $(el).find("a").attr("href") || $(el).find("button").attr("data-videourl") || null;
            
            if (url && url !== "#note_convert") {
                const qualityMatch = quality.match(/(\d+)p?/);
                const qualityValue = qualityMatch ? parseInt(qualityMatch[1]) : 0;
                return { quality, url, qualityValue };
            }
            return null;
        }).get().filter(Boolean);
        
        videos.sort((a, b) => b.qualityValue - a.qualityValue);
        const highestQuality = videos[0];
        const details = {
            title: $(".thumbnail > .content > .clearfix > h3").text().trim(),
            duration: $(".thumbnail > .content > .clearfix > p").text().trim(),
            media: $("#popup_play > .popup-body > .popup-content > #vid").attr("src") || "",
            url: highestQuality?.url || null,
            quality: highestQuality?.quality || null,
            music: $("#fbdownloader").find("#audioUrl").attr("value") || "",
        }; 
        return details;
    } catch (error) {
        throw new Error(error.stack);
    }
}

export { fbDownload };
