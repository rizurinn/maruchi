async function quotedLyo(teks, name, profile, replynya, color = '#FFFFFF') {
		const { url, options, reply } = replynya || {}
		const payload = {
			type: 'quote',
			format: 'png',
			backgroundColor: color,
			width: 512,
			height: 768,
			scale: 2,
			messages: [{
				entities: [],
				...(url ? { media: { url }} : {}),
				avatar: true,
				from: {
					id: 1,
					name,
					photo: {
						url: profile
					}
				},
				...(options ? options : {}),
				text: teks,
				replyMessage: reply ? {
					name: reply.name || '',
					text: reply.text || '',
					chatId: Math.floor(Math.random() * 9999999)
				} : {},
			}]
		};
		try {
			const urls = ['https://bot.lyo.su/quote/generate', 'https://btzqc.betabotz.eu.org/generate', 'https://qc.botcahx.eu.org/generate'];
			for (let url of urls) {
				try {
					const response = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(payload, null, 2)
					});
					const data = await response.json();
					return data;
				} catch {
					//ignore
				}
			}
		} catch (e) {
			throw new Error(e.stack)
	    }
}

export { quotedLyo }
