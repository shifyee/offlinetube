const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());

const COOKIES_FILE = '/tmp/cookies.txt';

if (process.env.YOUTUBE_COOKIES) {
  try {
    let cookiesContent = process.env.YOUTUBE_COOKIES
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.startsWith('#') || line.trim() === '' ? line : line.replace(/ {2,}/g, '\t'))
      .join('\n');
    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('Successfully loaded cookies.');
  } catch (e) { console.error('Failed to write cookies:', e); }
}

// Safe timeout execution using spawn
function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Command timed out'));
    }, timeoutMs);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exited with code ${code}`));
    });
  });
}

function buildYtDlpArgs(args) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
  
  // THE FIX: Only use the POT provider. No forced clients, no comment limits.
  // This lets yt-dlp fetch 4K and all comments naturally.
  const extractorArgs = 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416';

  return [
    ...cookieArgs,
    '--no-warnings',
    '--no-check-certificates',
    '--newline',
    '--extractor-args', extractorArgs,
    ...args
  ];
}

async function runYtDlp(args, timeoutMs = 120000) { // 2 minute timeout
  const finalArgs = buildYtDlpArgs(args);
  try {
    return await runCommand('yt-dlp', finalArgs, timeoutMs);
  } catch (e) {
    if (e.message.includes('The page needs to be reloaded')) {
      await new Promise(r => setTimeout(r, 2000));
      return await runCommand('yt-dlp', finalArgs, timeoutMs);
    }
    throw e;
  }
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;

  try {
    // Fetch comments and metadata. We wait up to 2 minutes for slow videos.
    const stdout = await runYtDlp(['--write-comments', '--dump-json', '--no-playlist', url]);

    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);

    const info = JSON.parse(jsonString);
    const formats = [];
    const heights = new Map();

    // Parse ALL available formats (up to 4K)
    info.formats.forEach(f => {
      if (f.height && f.vcodec !== 'none') {
        const size = f.filesize || f.filesize_approx || 0;
        if (!heights.has(f.height) || heights.get(f.height) < size) heights.set(f.height, size);
      }
    });

    if (heights.size > 0) {
      Array.from(heights.entries()).sort((a, b) => b[0] - a[0]).forEach(([h, size]) => {
        formats.push({
          qualityLabel: `${h}p`, height: h, contentLength: size, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
        });
      });
    } else {
      formats.push(
        { qualityLabel: '2160p', height: 2160, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=2160` },
        { qualityLabel: '1080p', height: 1080, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=1080` },
        { qualityLabel: '720p', height: 720, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=720` }
      );
    }

    return res.json({
      videoId: id, title: info.title, author: info.uploader, authorId: '',
      authorAvatar: null, lengthSeconds: info.duration || 0, description: info.description || '',
      // Return the first 20 comments
      comments: (info.comments || []).slice(0, 20).map(c => ({ commentId: c.id, author: c.author, content: c.text || c.content || '' })),
      videoThumbnails: [{ url: info.thumbnail }], formatStreams: formats
    });
  } catch (error) {
    console.error('Metadata error:', error);
    return res.status(500).json({ error: 'Failed to fetch metadata.', details: error.message });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  // The exact format string that supports everything up to 4K
  const formatStr = `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/bv*[height<=${height}]+ba/b[height<=${height}]/bv*+ba/b`;

  try {
    const args = buildYtDlpArgs(['-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile, url]);

    await new Promise((resolve, reject) => {
      const child = spawn('yt-dlp', args);
      // 15 minute timeout for the actual download (4K files are huge)
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Download timed out'));
      }, 900000);

      child.stderr.on('data', (data) => {
        const match = /\[download\]\s+([\d.]+)%/.exec(data.toString());
        if (match) console.log(`Progress: ${match[1]}%`);
      });

      child.on('error', (err) => { clearTimeout(timeout); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`Exited ${code}`));
      });
    });

    if (!fs.existsSync(tempFile)) throw new Error('File missing');

    const stat = fs.statSync(tempFile);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const readStream = fs.createReadStream(tempFile);
    readStream.pipe(res);
    readStream.on('end', () => fs.unlink(tempFile, () => {}));

  } catch (e) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed', details: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Railway running on ${PORT}`));
