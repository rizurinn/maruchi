let handler = async (m, { text, usedPrefix, command }) => {
    if (!text) return m.reply(`🍭 *Contoh: ${usedPrefix + command} Canvas*`)
    let res = await fetch('https://registry.npmjs.org/-/v1/search?text=' + text)
    let json = await res.json()
    let txt = json.objects.slice(0, 20).map(({ package: pkg }) => {
     return `*${pkg.name} (v${pkg.version})*\n*_${pkg.links.npm}_*`
    }).join('\n\n')
    return await m.reply(txt)
}

handler.command = ['npmjs']
handler.category = ['internet']

export default handler
