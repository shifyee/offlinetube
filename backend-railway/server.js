const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const execPromise = util.promisify(exec);

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

function buildYtDlpCmd(args) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
  
  // THE FIX: Limit comments to 20 so it doesn't hang forever, and use POT provider
  const extractorArgs = [
    'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
    'youtube:max_comments=20,all,0,0'
  ].join(';');

  return `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --newline --extractor-args "${extractorArgs}" ${args}`;
}

async function runYtDlp(args) {
  const cmd = buildYtDlpCmd(args);
  try {
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
    return stdout;
  } catch (e) {
    // Auto-retry the "page needs to be reloaded" transient error
    if (e.message.includes('The page needs to be reloaded')) {
      await new Promise(r => setTimeout(r, 2000));
      const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
      return stdout;
    }
    throw e;
  }
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;
  
  try {
    const stdout = await runYtDlp(`--write-comments --dump-json --no-playlist "${url}"`);
    
    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);
    
    const info = JSON.parse(jsonString);
    
    const formats = [];
    const heights = new Map();
    
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
      // Fallback
      formats.push(
        { qualityLabel: '1080p', height: 1080, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=1080` },
        { qualityLabel: '720p', height: 720, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=720` },
        { qualityLabel: '360p', height: 360, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=360` }
      );
    }

    return res.json({
      videoId: id, title: info.title, author: info.uploader, authorId: '',
      authorAvatar: null, lengthSeconds: info.duration || 0, description: info.description || '',
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
  
  // The exact format string from your 'rip' project
  const formatStr = `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/bv*[height<=${height}]+ba/b[height<=${height}]/bv*+ba/b`;
  
  try {
    const cmd = buildYtDlpCmd(`-f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`);
    
    await new Promise((resolve, reject) => {
      const child = spawn(cmd, { shell: true });
      child.stderr.on('data', (data) => {
        const match = /\[download\]\s+([\d.]+)%/.exec(data.toString());
        if (match) console.log(`Progress: ${match[1]}%`);
      });
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exited ${code}`)));
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
