import * as cheerio from "cheerio"

export async function twitterDl(urlInput) {
  const body = new URLSearchParams({
    q: urlInput,
    lang: "id",
    cftoken: ""
  })

  const res = await fetch("https://savetwitter.net/api/ajaxSearch", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://savetwitter.net/id3"
    },
    body
  })

  const json = await res.json()
  const $ = cheerio.load(json.data)

  // TITLE
  const title = $("h3").first().text().trim()

  let bestVideo = null
  let bestQuality = 0
  let bestImage = null

  $(".tw-button-dl").each((i, el) => {
    const text = $(el).text().trim()
    const href = $(el).attr("href")

    if (!href || !href.startsWith("http")) return

    // VIDEO
    if (text.includes("MP4")) {
      const match = text.match(/\((\d+)p\)/)
      const quality = match ? parseInt(match[1]) : 0

      if (quality > bestQuality) {
        bestQuality = quality
        bestVideo = href
      }
    }

    // GAMBAR
    else if (text.toLowerCase().includes("gambar")) {
      if (!bestImage) bestImage = href
    }
  })

  const isVideo = !!bestVideo

  return {
    title,
    isVideo,
    video: bestVideo,
    image: bestImage
  }
}
