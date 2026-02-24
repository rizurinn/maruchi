export async function sfileDl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const setCookieHeader = res.headers.get('set-cookie') || '';
    const setCookies = setCookieHeader
      ? setCookieHeader.split(/,(?=[^;]+?=)/)
      : [];

    const cookies = setCookies
      .filter(c => c.includes('path=/download/'))
      .map(c => c.split(';')[0])
      .join('; ');

    const html = await res.text();

    const setFilename =
      html.match(/Download\s+(.+?)\s+uploaded/i)?.[1] || html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1];
    const filename = setFilename ? setFilename.replace(/\s+\.\s+/g, ".").trim() : null;

    const mime = html.match(/MIME Type[\s\S]*?<span[^>]*>([^<]+)<\/span>/)?.[1];

    const authorMatch = html.match(/href="(https:\/\/sfile\.co\/user\/[^"]+)"[^>]*>([^<]+)<\/a>/);
    const catMatch = html.match(/href="(https:\/\/sfile\.co\/category\/[^"]+)"[^>]*>([^<]+)<\/a>/);

    const date = html.match(/Uploaded:[\s\S]*?<span[^>]*>([^<]+)<\/span>/)?.[1];
    const download_count = parseInt(html.match(/Downloads:[\s\S]*?<span[^>]*>(\d+)<\/span>/)?.[1] || 0);

    const dwUrl = html.match(/data-dw-url="([^"]+)"/)?.[1];
    if (!dwUrl) throw new Error('Download URL not found');

    const dwRes = await fetch(dwUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': cookies
      }
    });

    const dwHtml = await dwRes.text();

    const size = dwHtml.match(/text-white\/90">\s*([\d.]+\s*\w+)/)?.[1]?.trim();
    const dlUrl = dwHtml
      .match(/adblockDetected\s*\?\s*"([^"]+)"/)?.[1]
      ?.replace(/\\\//g, '/');

    return {
      success: true,
      results: {
        filename,
        mime_type: mime,
        author: authorMatch?.[2],
        author_url: authorMatch?.[1],
        category: catMatch?.[2],
        category_url: catMatch?.[1],
        upload_date: date,
        download_count,
        size,
        download_url: dlUrl
      }
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}