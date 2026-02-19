import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fsPromises } from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import util from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIRS_TO_SCAN = [
    path.resolve(__dirname, '../'),
    path.resolve(__dirname, '../../lib'),
    path.resolve(__dirname, './')
];

async function scanDirectoryForJsFiles(dir) {
    let jsFiles = [];
    try {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory() && item.name === 'node_modules') {
                continue; // Skip this directory
            }

            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                jsFiles = jsFiles.concat(await scanDirectoryForJsFiles(itemPath));
            } else if (item.isFile() && item.name.endsWith('.js')) {
                jsFiles.push(itemPath);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dir}: ${error.message}`);
    }
    return jsFiles;
}

async function checkFileSyntax(filePath) {
    try {
        const code = await fsPromises.readFile(filePath, 'utf8');
        acorn.parse(code, {
            ecmaVersion: 2023,
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            allowHashBang: true,
            
        });
        return null; // No error
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                filePath: filePath,
                message: error.message,
                loc: error.loc,
                codeSnippet: null
            };
        } else {
            return {
                filePath: filePath,
                message: `Non-syntax error: ${error.message}`,
                loc: null,
                codeSnippet: null
            };
        }
    }
}

let handler = async (m) => {
    let allJsFiles = [];
    for (const dir of DIRS_TO_SCAN) {
        allJsFiles = allJsFiles.concat(await scanDirectoryForJsFiles(dir));
    }

    const errorsFound = [];
    for (const filePath of allJsFiles) {
        const error = await checkFileSyntax(filePath);
        if (error) {
            errorsFound.push(error);
        }
    }

    if (errorsFound.length === 0) {
        return await m.reply('🌸 *Semua kode aman, tidak ditemukan syntax error.*');
    } else {
        let response = `❌ *Ditemukan ${errorsFound.length} error syntax di file bot Anda:*\n\n`;
        for (const err of errorsFound) {
            const relativePath = path.relative(path.resolve(__dirname, '../../'), err.filePath);
            response += `*📄 File:* \`${relativePath}\`\n`;
            response += `*🚫 Error:* SyntaxError\n`;
            response += `*💬 Pesan:* ${err.message}\n`;
            if (err.loc) {
                response += `*📌 Baris:* ${err.loc.line}, *Kolom:* ${err.loc.column}\n`;
                try {
                    const code = await fsPromises.readFile(err.filePath, 'utf8');
                    const lines = code.split('\n');
                    const errorLineIndex = err.loc.line - 1;
                    const start = Math.max(0, errorLineIndex - 2);
                    const end = Math.min(lines.length, errorLineIndex + 3);
                    const snippet = lines.slice(start, end).map((line, idx) => {
                        const lineNumber = start + idx + 1;
                        const indicator = lineNumber === err.loc.line ? '👉' : '  ';
                        return `${indicator} ${lineNumber.toString().padStart(3, ' ')} | ${line}`;
                    }).join('\n');
                    response += `🔎 *Cuplikan Kode:*\n\`\`\`javascript\n${snippet}\n\`\`\`\n\n`;
                } catch (readErr) {
                    response += `*Gagal membaca cuplikan kode: ${readErr.message}*\n\n`;
                }
            } else {
                response += `\n`; // Add a newline even if no loc info
            }
            response += `---\n\n`; // Separator for multiple errors
        }
        return await m.reply(response);
    }
}

handler.command = ["syntax"];
handler.category = "owner";
handler.restrict = {
  ownerOnly: true
};

export default handler;
