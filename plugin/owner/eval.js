import { format } from "util";

let handler = async (m, { conn, isOwner, command, text, loader, store }) => {
    if (!isOwner) return;
    const quoted = m.quoted ? m.quoted : m;
    let evaled;
    if (command === 'q') {
        evaled = await eval(`(async () => { return ${text} })()`);
        if (typeof evaled !== 'string') evaled = Bun.inspect(evaled, { depth: null, maxArrayLength: null });
    } else if (command === 'c') {
        const oldLog = console.log;
        let capturedLogs = [];
        console.log = (...args) => {
            oldLog.apply(console, args);
            capturedLogs.push(format(...args));
        };
        let eva = '';
        try {
            eva = await eval(`(async () => { ${text} })()`);
            if (typeof evaled !== 'string') {
                eva = Bun.inspect(eva, { depth: 7 });
            }
            const logsOutput = capturedLogs.join('\n');
            evaled = logsOutput ? `📝 *Console Logs:*\n\`\`\`\n${logsOutput}\n\`\`\`\n\n` : '';
            evaled += `✅ *Return Value:*\n\`\`\`\n${eva}\n\`\`\``;
        } catch (err) {
            const logsOutput = capturedLogs.join('\n');
            evaled = logsOutput ? `📝 *Console Logs:*\n\`\`\`\n${logsOutput}\n\`\`\`\n\n` : '';
            evaled += `🍓 *Error:*\n\`\`\`\n${format(err)}\n\`\`\``;
        } finally {
            console.log = oldLog;
        }
    } else {
        return;
    }
    return await conn.sendMessage(m.chat, { text: evaled }, { quoted })
};

handler.command = ['q', 'c'];

export default handler;
