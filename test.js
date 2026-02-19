import { promises as fsPromises } from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the root directory to scan (where this script is located)
const ROOT_DIR = __dirname;

// Function to recursively scan directories for .js files, excluding node_modules
async function scanDirectoryForJsFiles(dir) {
    let jsFiles = [];
    try {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            // Exclude node_modules directory
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

// Function to check syntax of a JavaScript file using Acorn
async function checkFileSyntax(filePath) {
    try {
        const code = await fsPromises.readFile(filePath, 'utf8');
        acorn.parse(code, {
            ecmaVersion: 2020, // Adjust as needed for modern JS features
            sourceType: 'module', // 'script' or 'module' depending on your project
            locations: true, // Crucial for getting line/column numbers
            allowHashBang: true, // Allow shebangs (e.g., #!/usr/bin/env node)
            allowAwaitOutsideFunction: true, // Allow top-level await outside async functions
        });
        return null; // No error
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                filePath: filePath,
                message: error.message,
                loc: error.loc,
                codeSnippet: null // Will be populated later
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

// Main function to execute the syntax scan
async function main() {
    console.log(`Starting syntax scan from: ${ROOT_DIR}`);
    console.log('Scanning for JavaScript files (excluding node_modules)...');

    const allJsFiles = await scanDirectoryForJsFiles(ROOT_DIR);
    console.log(`Found ${allJsFiles.length} JavaScript files.`);

    const errorsFound = [];
    for (const filePath of allJsFiles) {
        const error = await checkFileSyntax(filePath);
        if (error) {
            errorsFound.push(error);
        }
    }

    if (errorsFound.length === 0) {
        console.log('\n✅ Congratulations! No syntax errors found in your bot\'s code.');
    } else {
        console.log(`\n❌ Found ${errorsFound.length} syntax errors in your bot's files:`);
        for (const err of errorsFound) {
            const relativePath = path.relative(ROOT_DIR, err.filePath);
            console.log(`\n---`);
            console.log(`📄 File: ${relativePath}`);
            console.log(`🚫 Error Type: SyntaxError`);
            console.log(`💬 Message: ${err.message}`);
            if (err.loc) {
                console.log(`📌 Line: ${err.loc.line}, Column: ${err.loc.column}`);
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
                    console.log(`🔎 Code Snippet:\n\`\`\`javascript\n${snippet}\n\`\`\``);
                } catch (readErr) {
                    console.error(`Failed to read code snippet for ${relativePath}: ${readErr.message}`);
                }
            }
        }
        console.log(`\n--- End of Syntax Scan ---`);
        process.exit(1); // Exit with a non-zero code to indicate errors
    }
}

// Run the main function
main().catch(console.error);
