import * as cheerio from 'cheerio'

class AlqAnimeScraper {
    constructor() {
        this.baseUrl = 'https://alqanime.net';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        };
    }

    async searchAnime(query, page = 1) {
        try {
            const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
            const response = await fetch(url, { 
                headers: this.headers,
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const searchResults = [];
            
            $('.postbody .bs, .listupd .bs').each((index, element) => {
                const $elem = $(element);
                const title = $elem.find('.bsx .tt .ntitle').text().trim() || 
                             $elem.find('.bsx .tt h2').text().trim() ||
                             $elem.find('.tt .ntitle').text().trim();
                const link = $elem.find('.bsx a').attr('href') || $elem.find('a').attr('href');
                const image =  $elem.find('.bsx .limit img').attr('data-src') ||
                             $elem.find('.limit img').attr('src');
                const type = $elem.find('.bsx .limit .typez').text().trim() ||
                            $elem.find('.limit .typez').text().trim();
                const status = $elem.find('.bsx .limit .bt .epx').text().trim() ||
                              $elem.find('.limit .bt .epx').text().trim();
                
                if (title && link) {
                    searchResults.push({
                        title,
                        link,
                        image: image || '',
                        type,
                        status
                    });
                }
            });
            
            return {
                success: true,
                data: searchResults,
                query: query,
                page: page
            };
        } catch (error) {
            throw new Error(error.stack);
        }
    }

    async getAnimeDetail(animeUrl) {
        try {
            const response = await fetch(animeUrl, { 
                headers: this.headers,
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const title = $('.bigcontent .infox h1').text().trim() || 
                         $('.releases h1').text().trim() ||
                         $('.entry-title').text().trim();
            
            const image = $('.spctrail .thumbook .thumb img').attr('src') || 
                         $('.animefull .bigcover .ime img').attr('src');
            
            const synopsis = $('.bixbox.synp .entry-content').map((p, el) => $(el).text()).get().join('\n')
            
            const rating = $('.bigcontent .rt .rating strong').text().trim() ||
                          $('.rating strong').text().trim();
            
            // Mengambil informasi detail dari .spe span
            const info = {};
            $('.bigcontent .infox .spe span').each((index, element) => {
                const text = $(element).text().trim();
                if (text.includes(':')) {
                    const [key, ...valueParts] = text.split(':');
                    const value = valueParts.join(':').trim();
                    info[key.trim()] = value;
                }
            });
            
            // Mengambil genre
            const genres = [];
            $('.bigcontent .infox .genxed a').each((index, element) => {
                genres.push($(element).text().trim());
            });
            if (genres.length > 0) {
                info['Genre'] = genres.join(', ');
            }
            
            return {
                success: true,
                data: {
                    title,
                    image: image || '',
                    synopsis,
                    rating,
                    info
                }
            };
        } catch (error) {
            throw new Error(error.stack);
        }
    }

    async getDownloadLinks(url, targetEpisode = null, qualities = ['720p', '1080p']) {
        try {
            const response = await fetch(url, { 
                headers: this.headers,
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const episodeTitle = $('.entry-title').text().trim() ||
                               $('.post-title h1').text().trim() ||
                               $('h1').first().text().trim();
            
            const allEpisodes = [];
            
            $('.soraddl.dlone').each((index, episodeElement) => {
                const $episode = $(episodeElement);
                const episodeNumber = $episode.find('.sorattl h3').text().trim();
                
                if (targetEpisode && !episodeNumber.toLowerCase().includes(targetEpisode.toString().toLowerCase())) {
                    return;
                }
                
                const downloadQualities = [];
                
                $episode.find('.content .soraurl').each((qualityIndex, qualityElement) => {
                    const $quality = $(qualityElement);
                    const resolution = $quality.find('.res').text().trim();
                    
                    if (!qualities.includes(resolution)) {
                        return;
                    }
                    
                    const links = [];
                    
                    $quality.find('.slink a').each((linkIndex, linkElement) => {
                        const $link = $(linkElement);
                        const provider = $link.text().trim();
                        const url = $link.attr('href');
                        
                        if (provider && url) {
                            links.push({
                                provider,
                                url
                            });
                        }
                    });
                    
                    if (resolution && links.length > 0) {
                        downloadQualities.push({
                            quality: resolution,
                            links
                        });
                    }
                });
                
                if (episodeNumber && downloadQualities.length > 0) {
                    allEpisodes.push({
                        episode: episodeNumber,
                        downloadLinks: downloadQualities
                    });
                }
            });
            
            return {
                success: true,
                data: {
                    title: episodeTitle,
                    totalEpisodes: allEpisodes.length,
                    requestedEpisode: targetEpisode,
                    requestedQualities: qualities,
                    episodes: allEpisodes
                }
            };
        } catch (error) {
            throw new Error(error.stack);
        }
    }

    async getDownloadLinksFiltered(url, targetEpisode = null, providers = ['MediaFire'], qualities = ['480p', '720p', '1080p']) {
        try {
            const response = await fetch(url, { 
                headers: this.headers,
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const episodeTitle = $('.entry-title').text().trim() ||
                               $('.post-title h1').text().trim() ||
                               $('h1').first().text().trim();
            
            const allEpisodes = [];
            
            $('.soraddl.dlone').each((index, episodeElement) => {
                const $episode = $(episodeElement);
                const episodeNumber = $episode.find('.sorattl.collapsible h3').text().trim();
                if (targetEpisode && !episodeNumber.toLowerCase().includes(targetEpisode.toString().toLowerCase())) {
                    return;
                }
                
                const downloadQualities = [];
                
                $episode.find('table tr').each((qualityIndex, qualityElement) => {
                    const $quality = $(qualityElement);
                    const resolution = $quality.find('.res').text().trim();
                    if (!qualities.includes(resolution)) {
                        return;
                    }

                    const links = [];
                    $quality.find('.slink a').each((linkIndex, linkElement) => {
                        const $link = $(linkElement);
                        const provider = $link.text().trim();
                        const url = $link.attr('href');

                        if (provider && url && providers.includes(provider)) {
                            links.push({
                                provider,
                                url
                            });
                        }
                    });
                    
                    if (resolution && links.length > 0) {
                        downloadQualities.push({
                            quality: resolution,
                            links
                        });
                    }
                });
                
                if (episodeNumber && downloadQualities.length > 0) {
                    allEpisodes.push({
                        episode: episodeNumber,
                        downloadLinks: downloadQualities
                    });
                }
            });
            
            return {
                success: true,
                data: {
                    title: episodeTitle,
                    totalEpisodes: allEpisodes.length,
                    requestedEpisode: targetEpisode,
                    requestedProviders: providers,
                    requestedQualities: qualities,
                    episodes: allEpisodes
                }
            };
        } catch (error) {
            throw new Error(error.stack);
        }
    }

    async getLatestAnime(page = 1) {
        try {
            const url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}`;
            const response = await fetch(url, { 
                headers: this.headers,
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const animeList = [];
            
            $('.bixbox .bs').each((index, element) => {
                const $elem = $(element);
                const title = $elem.find('.bsx .limit .egghead .eggtitle').text().trim()
                const link = $elem.find('.bsx a').attr('href');
                const image = $elem.find('.bsx .limit img').attr('data-src');
                const type = $elem.find('.bsx .limit .egghead .eggmeta .eggtype').text().trim();
                const latestEp = $elem.find('.bsx .limit .egghead .eggmeta .eggepisode').text().trim();
                
                if (title && link) {
                    animeList.push({
                        title,
                        link,
                        image: image || '',
                        type,
                        latestEp
                    });
                }
            });
            
            return {
                success: true,
                data: animeList,
                page: page
            };
        } catch (error) {
            throw new Error(error.stack);
        }
    }
    
    formatDownloadLinks(downloadResult) {
        if (!downloadResult.success) {
            return `Error: ${downloadResult.error}`;
        }

        const { title, totalEpisodes, episodes } = downloadResult.data;
        
        let result = `*${title}*\n`;
        result += `*Total Episode:: ${totalEpisodes}*\n\n`;
        
        episodes.forEach((episode) => {
            result += `*${episode.episode}:*\n`;
            episode.downloadLinks.forEach(quality => {
                result += `  *${quality.quality}:*\n`;
                quality.links.forEach(link => {
                    result += `    ${link.provider}: ${link.url}\n`;
                });
            });
            result += '\n';
        });
        
        return result;
    }
}

export const alqanime = new AlqAnimeScraper();
