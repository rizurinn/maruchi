import { getContentType, normalizeMessageContent } from 'baileys'

async function handler(m, { conn }) {
    if (!m.quoted) {
        return m.reply('🍡 Reply pesan untuk mengambil relay.*')
    }

    const message = m.quoted.message

    if (!message) {
        return m.reply('🍓 Pesan tidak valid atau tidak ada.*')
    }

    const normalized = normalizeMessageContent(message)
    const ct = getContentType(normalized)

    let relayOption = {}

    if (ct === 'interactiveMessage' || ct === 'buttonsMessage') {
        relayOption = {
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1'
                            },
                            content: [
                                {
                                    tag: 'native_flow',
                                    attrs: {
                                        v: '9',
                                        name: 'mixed'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    } else if (ct === 'eventMessage') {
        relayOption = {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: { event_type: 'creation' }
                }
            ]
        }
    }

    const template = `
const content = ${JSON.stringify(normalized, null, 2)}

const relayOption = ${JSON.stringify(relayOption, null, 2)}

await conn.relayMessage(m.chat, content, relayOption)
`

    return await conn.sendMessage(
        m.chat,
        {
            document: Buffer.from(template),
            mimetype: 'application/javascript',
            fileName: ct.replace('Message', '') + '-' + Date.now().toString(36) + '.js',
            caption:
                '✨ RelayMessage generated\n' +
                `type: *${ct}*`
        },
        { quoted: m.quoted }
    )
}

handler.command = ['crm']
handler.category = ['owner']

export default handler