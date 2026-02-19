import * as cheerio from 'cheerio';

async function wikiUrl(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Wikipedia: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const contentTitle = $("#firstHeading").text().trim();
        const content = [];
        $("#mw-content-text .mw-parser-output > p").each((i, el) => {
            const text = $(el).text().replace(/\[\d+\]/g, "").trim();
            if (text) content.push(text);
        });
        const images = [];
        $("#mw-content-text .mw-parser-output img").each((i, el) => {
            if (i >= 3) return false;
            const src = $(el).attr("src");
            if (src) images.push(src.startsWith("http") ? src : "https:" + src);
        });
        const infobox = {};
        $(".infobox tr").each((i, el) => {
            const th = $(el).find("th").first().text().trim();
            const tdEl = $(el).find("td").first();
            let td = "";
            if (tdEl.find("li").length) {
                td = tdEl
                    .find("li")
                    .map((i, li) => $(li).text().trim())
                    .get()
                    .join(", ");
            } else {
                td = tdEl.text().trim();
            }
            td = td.replace(/\[\w+\]/g, "");
            if (th && td) infobox[th] = td;
        });

        return {
            success: true,
            contentTitle,
            content: content.slice(0, 7),
            images,
            infobox,
            url
        };
    } catch (error) {
        throw new Error('Wikipedia scrape error:', { cause: error });
    }
}

async function wikiSearch(query, lang = 'id') {
    try {
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await Bun.readableStreamToJSON(response.body);
        
        // Format: [query, [titles], [descriptions], [urls]]
        const titles = data[1] || [];
        const descriptions = data[2] || [];
        const urls = data[3] || [];

        const results = titles.map((title, index) => ({
            title: title,
            description: descriptions[index] || '',
            url: urls[index] || ''
        }));

        return {
            success: true,
            query: query,
            results: results
        };
    } catch (error) {
        throw new Error('Wikipedia search error:', { cause: error });
    }
}

async function wikiSummary(title, lang = 'id') {
    try {
        const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Summary failed: ${response.status}`);
        }

        const data = await Bun.readableStreamToJSON(response.body);

        return {
            success: true,
            title: data.title,
            description: data.description || '',
            extract: data.extract,
            thumbnail: data.thumbnail?.source || null,
            url: data.content_urls?.desktop?.page || '',
            lang: lang
        };
    } catch (error) {
        throw new Error('Wikipedia summary error:', { cause: error });
    }
}

export { wikiUrl, wikiSearch, wikiSummary };
