import { join } from 'path';

const __dirname = import.meta.dir;

function runPython(args = [], { timeoutMs = 180000 } = {}) {
  return new Promise(async (resolve, reject) => {
    const pythonScript = join(__dirname, '../python/yt-dl.py');
    let proc;
    let timeoutTimer;

    try {
      proc = Bun.spawn(['python3', pythonScript, ...args], {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });
    } catch (e) {
      return reject(new Error(`Failed to spawn Python process: ${e.message}`));
    }

    const timeoutPromise = new Promise((_, rej) => {
      timeoutTimer = setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill();
          rej(new Error(`Python timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });

    const executionPromise = (async () => {
      const stdoutPromise = new Response(proc.stdout).text();
      const stderrPromise = new Response(proc.stderr).text();

      const exitCode = await proc.exited;
      
      clearTimeout(timeoutTimer);

      const output = await stdoutPromise;
      const errorOutput = await stderrPromise;

      if (exitCode !== 0) {
        throw new Error(`Python exited ${exitCode}: ${errorOutput || '(no stderr)'}`);
      }

      try {
        if (!output.trim()) return {};
        
        const result = JSON.parse(output);
        if (result?.error) throw new Error(result.error);
        return result;
      } catch (e) {
        throw new Error(`Failed to parse JSON: ${e.message}`);
      }
    })();

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      resolve(result);
    } catch (err) {
      if (proc && !proc.killed) proc.kill();
      clearTimeout(timeoutTimer);
      reject(err);
    }
  });
}

async function getInfo(url) { return runPython(['info', url]); }
async function ytVideo(url, quality = '720') { return runPython(['video', url, quality]); }
async function ytAudio(url, q = '128', p) { return runPython(['audio', url, q, p]); }
async function ytSearch(query, maxResults = 10) { return runPython(['search', query, String(maxResults)]); }
async function spotifyDownload(url, quality = '256') { return runPython(['spotify', url, quality]); }

export { getInfo, ytVideo, ytAudio, ytSearch, spotifyDownload };
