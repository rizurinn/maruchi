export const pinterest = {
    api: {
        base: "https://www.pinterest.com",
        endpoints: {
            search: "/resource/BaseSearchResource/get/",
            pin: "/resource/PinResource/get/"
        }
    },
    headers: {
        'accept': 'application/json, text/javascript, */*, q=0.01',
        'referer': 'https://www.pinterest.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-app-version': 'a9522f',
        'x-pinterest-appstate': 'active',
        'x-pinterest-pws-handler': 'www/[username]/[slug].js',
        'x-pinterest-source-url': '/search/pins/?rs=typed&q=kucing%20anggora/',
        'x-requested-with': 'XMLHttpRequest'
    },
    getCookies: async () => {
        try {
            const response = await fetch(pinterest.api.base);
            const setHeaders = response.headers.getSetCookie(); 
            if (setHeaders) {
                const cookies = setHeaders.map(cookieString => {
                    const cp = cookieString.split(';');
                    const cv = cp[0].trim();
                    return cv;
                });
                return cookies.join('; ');
            }
            return null;
        } catch (error) {
            throw new Error(error.stack);
        }
    },
    search: async (query, limit = 10) => {
        if (!query) throw new Error('Masukkan kata kunci pencarian')
        try {
            const cookies = await pinterest.getCookies();
            if (!cookies) throw new Error('Cookies failed')
            
            const params = {
                source_url: `/search/pins/?q=${query}`,
                data: JSON.stringify({
                    options: {
                        isPrefetch: false,
                        query: query,
                        scope: "pins",
                        bookmarks: [""],
                        no_fetch_context_on_resource: false,
                        page_size: limit
                    },
                    context: {}
                }),
                _: Date.now()
            };
            const url = new URL(pinterest.api.base + pinterest.api.endpoints.search);
            url.search = new URLSearchParams(params).toString();
            const response = await fetch(url, {
                headers: { ...pinterest.headers, 'cookie': cookies }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const results = data.resource_response.data.results.filter((v) => v.images?.orig || v.images?.["736x"] || v.images?.["474x"]);     
            const container = results.map((pin) => ({
                id: pin.id,
                title: pin.seo_alt_text || pin.grid_title || "",
                image: pin.images?.["orig"]?.url || pin.images?.["736x"]?.url || pin.images?.["474x"]?.url || null,
                board: pin.board?.name || null,
                username: pin.pinner?.username || null,
                link: `https://id.pinterest.com/pin/${pin.id}/`
            }));
            if (container.length === 0) {
                throw new Error('Hasil pencarian tidak ditemukan')
            }
            return {
               query: query,
               total: container.length,
               pins: container
            };
        } catch (error) {
            throw new Error('Terjadi kesalahan saat mencari:', { cause: error })
        }
    },
    download: async (url) => {
        try {
            const response = await fetch(url, {
               headers: {
                  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile Safari/604.1"
               },
               redirect: 'follow'
            });
            if (!response.ok) {
               throw new Error(`Gagal mengambil halaman: ${response.status} ${response.statusText}`);
            }
            const data = await response.text();
            let video = data.match(/"contentUrl":"(https:\/\/v1\.pinimg\.com\/videos\/[^"]+\.mp4)"/);
            let image = data.match(/"images_orig":\{"url":"(https:\/\/i\.pinimg\.com\/originals\/[^"]+\.(?:jpg|jpeg|png|webp))"/) || data.match(/"imageSpec_564x":\{"url":"(https:\/\/i\.pinimg\.com\/564x\/[^"]+\.(?:jpg|jpeg|png|webp))"/);
            let thumb = data.match(/"thumbnail":"(https:\/\/i\.pinimg\.com\/videos\/thumbnails\/originals\/[^"]+\.jpg)"/);
            let title = data.match(/"title":"([^"]+)"/);
            let author = data.match(/"fullName":"([^"]+)".+?"username":"([^"]+)"/);
            let date = data.match(/"uploadDate":"([^"]+)"/);
            return {
               isVideo: video ? true : false,
               title: title ? title[1] : "",
               author: author ? author[1] : "",
               username: author ? author[2] : "",
               media: video ? video[1] : image ? image[1] : "",
               thumbnail: thumb ? thumb[1] : "",
               uploadDate: date ? date[1] : "",
            };
        } catch (error) {
            throw new Error('Terjadi kesalahan:', { cause: error })
        }
    }
};
