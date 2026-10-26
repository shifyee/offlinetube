const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
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
      .replace(/\r\n/g, '\n');

    cookiesContent = cookiesContent.split('\n').map(line => {
      if (line.startsWith('#') || line.trim() === '') return line;
      return line.replace(/ {2,}/g, '\t');
    }).join('\n');

    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('Successfully loaded and formatted cookies from environment variable.');
  } catch (e) {
    console.error('Failed to write cookies file:', e);
  }
} else {
  console.warn('No YOUTUBE_COOKIES environment variable found.');
}

async function runYtDlp(args) {
  let lastError;
  const clients = ['tv', 'mweb', 'web_creator', 'android'];
  
  for (const client of clients) {
    let cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
    const fullArgs = `yt-dlp ${cookieArgs} --no-warnings --extractor-args "youtube:player_client=${client}" ${args}`;

    try {
      const { stdout, stderr } = await execPromise(fullArgs, { maxBuffer: 1024 * 1024 * 50 });
      if (stderr) console.warn(`yt-dlp stderr (${client}):`, stderr);
      return stdout;
    } catch (e) {
      lastError = e;
      console.warn(`yt-dlp attempt with ${client} failed:`, e.message);
      if (e.stderr) console.error(`Full stderr (${client}):`, e.stderr);
    }
  }
  throw lastError;
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const stdout = await runYtDlp(`--dump-json --no-playlist "${url}"`);
    
    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
      jsonString = jsonString.substring(startIdx, endIdx + 1);
    } else {
      throw new Error(`Failed to parse JSON. Raw output: ${stdout.substring(0, 100)}...`);
    }

    const info = JSON.parse(jsonString);

    const availableHeights = new Set();
    info.formats.forEach(f => {
      if (f.vcodec !== 'none' && f.height) {
        availableHeights.add(f.height);
      }
    });

    const sortedHeights = Array.from(availableHeights).sort((a, b) => b - a);
    if (sortedHeights.length === 0) throw new Error('No video formats found.');

    const formats = sortedHeights.map(h => ({
      qualityLabel: `${h}p`,
      height: h,
      container: 'mp4',
      type: 'video/mp4',
      url: `/api/stream?id=${id}&height=${h}`
    }));

    return res.json({
      videoId: id,
      title: info.title,
      author: info.uploader,
      authorId: info.channel_id,
      authorAvatar: null,
      lengthSeconds: info.duration,
      description: info.description,
      videoThumbnails: [{ url: info.thumbnail }],
      formatStreams: formats
    });
  } catch (error) {
    console.error('yt-dlp metadata error:', error);
    return res.status(500).json({ 
      error: 'Backend failed to fetch video', 
      details: error.message,
      stderr: error.stderr || 'No stderr available'
    });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id || !height) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const formatStr = `bv*[height<=${height}]+ba/b[height<=${height}]/b`;
    
    await runYtDlp(`-f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`);

    if (!fs.existsSync(tempFile)) throw new Error('Download failed, file not found');

    const stat = fs.statSync(tempFile);
    console.log(`Success! File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const readStream = fs.createReadStream(tempFile);
    readStream.pipe(res);

    readStream.on('end', () => {
      fs.unlink(tempFile, (err) => { if (err) console.error('Failed to delete temp file:', err); });
    });

  } catch (error) {
    console.error('yt-dlp stream error:', error);
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream video', details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Railway yt-dlp backend running on port ${PORT}`);
});
