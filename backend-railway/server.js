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

// Safe timeout execution using spawn (20 seconds to allow for comments)
function runCommand(cmd, args, timeoutMs = 20000) {
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

function buildYtDlpArgs(args, fetchComments) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
  
  // THE FIX: No forced player clients (restores 4K).
  // Correct comment syntax: 20 comments, 20 parents, 0 replies.
  let extractorArgs = 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416';
  if (fetchComments) {
    extractorArgs += ';youtube:max_comments=20,20,0,0';
  }

  return [
    ...cookieArgs,
    '--no-warnings',
    '--no-check-certificates',
    '--newline',
    '--extractor-args', extractorArgs,
    ...args
  ];
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;
  let stdout = null;
  let lastError = null;

  // Try with comments. Give it 20 seconds.
  try {
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--write-comments', '--dump-json', '--no-playlist', url], true), 20000);
  } catch (e) {
    lastError = e;
    console.warn('Attempt with comments failed, retrying without comments...');
  }

  // If comments fail (or timeout), try without comments to at least get the video.
  if (!stdout) {
    try {
      stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--dump-json', '--no-playlist', url], false), 15000);
    } catch (e) {
      lastError = e;
      console.error('Both attempts failed:', e.message.substring(0, 200));
    }
  }

  if (!stdout) {
    const errMsg = lastError ? lastError.message : 'Unknown error';
    // Ensure CORS headers are sent even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch metadata.', details: errMsg });
  }

  try {
    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);

    const info = JSON.parse(jsonString);
    const formats = [];
    const heights = new Map();

    // Extract ALL formats (including 4K)
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
      comments: (info.comments || []).slice(0, 20).map(c => ({ commentId: c.id, author: c.author, content: c.text || c.content || '' })),
      videoThumbnails: [{ url: info.thumbnail }], formatStreams: formats
    });
  } catch (error) {
    console.error('JSON parse error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to parse metadata.', details: error.message });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  const formatStr = `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/bv*[height<=${height}]+ba/b[height<=${height}]/bv*+ba/b`;

  try {
    const args = buildYtDlpArgs(['-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile, url], false);

    await new Promise((resolve, reject) => {
      const child = spawn('yt-dlp', args);
      // 15 minute timeout for downloading 4K video
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
    if (!res.headersSent) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: 'Download failed', details: e.message });
    }
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Railway running on ${PORT}`));
