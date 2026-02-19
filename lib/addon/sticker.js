import path from 'path';

const __dirname = import.meta.dir;

async function executeSticker(request) {
    const pythonScript = path.join(__dirname, '../python/sticker.py');
    
    const proc = Bun.spawn(['python3', pythonScript], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
    });

    const requestJson = JSON.stringify(request);
    proc.stdin.write(requestJson);
    proc.stdin.flush();
    proc.stdin.end();

    const stdoutPromise = new Response(proc.stdout).text();
    const stderrPromise = new Response(proc.stderr).text();

    const exitCode = await proc.exited;
    const stdoutData = await stdoutPromise;
    const stderrData = await stderrPromise;

    if (exitCode !== 0) {
        throw new Error(`Python process exited with code ${exitCode}: ${stderrData}`);
    }

    try {
        const response = JSON.parse(stdoutData);
        
        if (response.success) {
            return Buffer.from(response.data, 'base64');
        } else {
            throw new Error(response.error || 'Unknown error');
        }
    } catch (error) {
        if (error.message.includes('JSON')) {
             throw new Error(`Failed to parse Python output: ${error.message}\nRaw Output: ${stdoutData}`);
        }
        throw error;
    }
}

export async function sticker(media, options = {}) {
    if (!Buffer.isBuffer(media)) {
        throw new Error('Input must be a Buffer');
    }

    const {
        crop = false,
        quality = 80,
        fps = 15,
        maxDuration = 15,
        packName = '',
        authorName = '',
        emojis = []
    } = options;
    
    if (isWebP(media)) {
        return addExif(media, options);
    }

    const request = {
        command: 'create',
        input: media.toString('base64'),
        options: {
            crop,
            quality,
            fps,
            maxDuration,
            packName,
            authorName,
            emojis: Array.isArray(emojis) ? emojis : []
        }
    };

    return await executeSticker(request);
}

async function addExif(webp, metadata = {}) {
    if (!Buffer.isBuffer(webp)) {
        throw new Error('Input must be a Buffer');
    }

    const {
        packName = '',
        authorName = '',
        emojis = []
    } = metadata;

    const request = {
        command: 'addExif',
        input: webp.toString('base64'),
        metadata: {
            packName,
            authorName,
            emojis: Array.isArray(emojis) ? emojis : []
        }
    };

    return await executeSticker(request);
}

function isWebP(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 12 &&
        buffer.slice(0, 4).toString() === 'RIFF' &&
        buffer.slice(8, 12).toString() === 'WEBP'
    );
}
