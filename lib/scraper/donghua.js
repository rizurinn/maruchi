import * as cheerio from "cheerio";

const BASE = "https://donghuafilm.com";

/* ========================
   HELPER FETCH
======================== */
async function getHTML(url, params = {}) {
  const u = new URL(url);

  Object.entries(params).forEach(([k, v]) =>
    u.searchParams.append(k, v)
  );

  const res = await fetch(u, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}

/* ========================
   SEARCH DONGHUA
======================== */
export async function searchDonghua(search) {
  const html = await getHTML(BASE, { s: search });
  const $ = cheerio.load(html);

  const result = [];

  $("article.bs").each((i, v) => {
    const $article = $(v);
    const $link = $article.find('a[itemprop="url"]');

    const sigma = {
      title: $link.attr("title") || "",
      url: $link.attr("href") || "",
      image:
        $article.find("img").attr("data-src") ||
        $article.find("img").attr("data-lazy-src") ||
        $article.find("img").attr("src") ||
        "",
      type: $article.find(".typez").text().trim(),
      status: $article.find(".status, .epx").first().text().trim(),
      isHot: $article.find(".hotbadge").length > 0,
      subDub: $article.find(".sb").text().trim(),
      displayTitle:
        $article.find(".tt").contents().first().text().trim() ||
        $article.find('h2[itemprop="headline"]').text().trim(),
    };

    result.push(sigma);
  });

  return result;
}

/* ========================
   DETAIL SERIES
======================== */
export async function detailDonghua(url) {
  const html = await getHTML(url);
  const $ = cheerio.load(html);

  const getImageSrc = (selector) => {
    const $img = $(selector);
    return $img.attr("data-src") || $img.attr("src") || "";
  };

  const details = {
    title: $(".entry-title").text().trim(),
    description: $(".desc").text().trim(),
    coverImage: getImageSrc(".bigcover img"),
    thumbnail: getImageSrc(".thumb img"),
    status: $('span:contains("Status")').text().replace("Status:", "").trim(),
    network: $('span:contains("Network") a').text().trim(),
    duration: $('span:contains("Duration")')
      .text()
      .replace("Duration:", "")
      .trim(),
    country: $('span:contains("Country") a').text().trim(),
    type: $('span:contains("Type")').text().replace("Type:", "").trim(),
    fansub: $('span:contains("Fansub")').text().replace("Fansub:", "").trim(),
    censor: $('span:contains("Censor")').text().replace("Censor:", "").trim(),
    genres: [],
    episodes: [],
  };

  $(".genxed a").each((i, v) => {
    details.genres.push($(v).text().trim());
  });

  // episode list sidebar
  $("#singlepisode .episodelist li").each((i, v) => {
    const $li = $(v);
    const a = $li.find("a");

    details.episodes.push({
      title: $li.find("h3").text().trim(),
      date: $li.find("span").text().trim(),
      url: a.attr("href"),
      thumbnail:
        $li.find("img").attr("data-src") ||
        $li.find("img").attr("src"),
    });
  });

  return details;
}

/* ========================
   GET STREAM / DOWNLOAD URL
======================== */
export async function videoUrlDonghua(episodeUrl) {
  const html = await getHTML(episodeUrl);
  const $ = cheerio.load(html);

  const results = [];

  // direct <video><source>
  $("#embed_holder source").each((i, v) => {
    const src = $(v).attr("src");
    if (src) {
      results.push({
        type: "direct",
        url: src
      });
    }
  });
  
  // fallback
  $("#embed_holder iframe").each((i, v) => {
    const src = $(v).attr("src");
    if (src) {
      results.push({
        type: "direct",
        url: src
      });
    }
  });

  // mirror base64
  $("select.mirror option").each((i, v) => {
    const val = $(v).attr("value");
    if (!val) return;

    try {
      const decoded = Buffer.from(val, "base64").toString("utf-8");
      const $$ = cheerio.load(decoded);
      const src = $$("source").attr("src");

      if (src) {
        results.push({
          type: "mirror",
          url: src
        });
      }
    } catch {}
  });

  return results;
}
