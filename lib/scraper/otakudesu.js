import * as cheerio from 'cheerio';

const otakudesu = {
	ongoing: async () => {
		try {
			const response = await fetch('https://otakudesu.best/');
			const html = await response.text();
			const $ = cheerio.load(html);
			const results = [];
			$('.venz ul li').each((index, element) => {
				const episode = $(element).find('.epz').text().trim();
				const type = $(element).find('.epztipe').text().trim();
				const date = $(element).find('.newnime').text().trim();
				const title = $(element).find('.jdlflm').text().trim();
				const link = $(element).find('a').attr('href');
				const image = $(element).find('img').attr('src');
				results.push({
					episode,
					type,
					date,
					title,
					link,
					image
				});
			});
			return results;
		} catch (error) {
			throw new Error('Error fetching data:', { cause: error });
		}
	},
	search: async (query) => {
		const url = `https://otakudesu.best/?s=${query}&post_type=anime`;
		try {
			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);
			const animeList = [];
			$('.chivsrc li').each((index, element) => {
				const title = $(element).find('h2 a').text().trim();
				const link = $(element).find('h2 a').attr('href');
				const imageUrl = $(element).find('img').attr('src');
				const genres = $(element).find('.set').first().text().replace('Genres : ', '').trim();
				const status = $(element).find('.set').eq(1).text().replace('Status : ', '').trim();
				const rating = $(element).find('.set').eq(2).text().replace('Rating : ', '').trim() || 'N/A';
				animeList.push({
					title,
					link,
					imageUrl,
					genres,
					status,
					rating
				});
			});
			return animeList;
		} catch (error) {
			throw new Error('Error fetching data:', { cause: error });
		}
	},
	detail: async (url) => {
		try {
			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);
			const animeInfo = {
				title: $('.fotoanime .infozingle p span b:contains("Judul")').parent().text().replace('Judul: ', '').trim(),
				japaneseTitle: $('.fotoanime .infozingle p span b:contains("Japanese")').parent().text().replace('Japanese: ', '').trim(),
				score: $('.fotoanime .infozingle p span b:contains("Skor")').parent().text().replace('Skor: ', '').trim(),
				producer: $('.fotoanime .infozingle p span b:contains("Produser")').parent().text().replace('Produser: ', '').trim(),
				type: $('.fotoanime .infozingle p span b:contains("Tipe")').parent().text().replace('Tipe: ', '').trim(),
				status: $('.fotoanime .infozingle p span b:contains("Status")').parent().text().replace('Status: ', '').trim(),
				totalEpisodes: $('.fotoanime .infozingle p span b:contains("Total Episode")').parent().text().replace('Total Episode: ', '').trim(),
				duration: $('.fotoanime .infozingle p span b:contains("Durasi")').parent().text().replace('Durasi: ', '').trim(),
				releaseDate: $('.fotoanime .infozingle p span b:contains("Tanggal Rilis")').parent().text().replace('Tanggal Rilis: ', '').trim(),
				studio: $('.fotoanime .infozingle p span b:contains("Studio")').parent().text().replace('Studio: ', '').trim(),
				genres: $('.fotoanime .infozingle p span b:contains("Genre")').parent().text().replace('Genre: ', '').trim(),
				imageUrl: $('.fotoanime img').attr('src'),
				synopsis: $('.fotoanime .sinopc p').map((i, el) => $(el).text()).get().join('\n')
			};
			const episodes = [];
			$('.episodelist ul li').each((index, element) => {
				const episodeTitle = $(element).find('span a').text();
				const episodeLink = $(element).find('span a').attr('href');
				const episodeDate = $(element).find('.zeebr').text();
				episodes.push({ title: episodeTitle, link: episodeLink, date: episodeDate });
			});
			return {
				animeInfo,
				episodes
			};
		} catch (error) {
			throw new Error('Error fetching data:', { cause: error });
		}
	},
	download: async (url) => {
		try {
			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);
			const episodeInfo = {
				title: $('.download h4').text().trim(),
				downloads: []
			};
			$('.download ul li').each((index, element) => {
				const quality = $(element).find('strong').text().trim();
				const links = $(element).find('a').map((i, el) => ({
					quality,
					link: $(el).attr('href'),
					host: $(el).text().trim()
				})).get();
				episodeInfo.downloads.push(...links);
			});
			return episodeInfo;
		} catch (error) {
			throw new Error('Error fetching data:', { cause: error });
		}
	}
};

export { otakudesu };
