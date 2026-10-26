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

// The path where we will save the cookies from the environment variable
const COOKIES_FILE = '/tmp/cookies.txt';

// At startup, check if the cookies variable exists and write it to a file
if (process.env.YOUTUBE_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_FILE, process.env.YOUTUBE_COOKIES);
    console.log('Successfully loaded cookies from environment variable.');
  } catch (e) {
    console.error('Failed to write cookies file:', e);
  }
} else {
  console.warn('No YOUTUBE_COOKIES environment variable found. Downloads may be restricted.');
}

async function runYtDlp(args) {
  let lastError;
  const clients = ['tv', 'mweb', 'android', 'ios'];
  
  for (const client of clients) {
    // If the cookies file exists, use it
    let cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
    const fullArgs = `yt-dlp ${cookieArgs} --extractor-args "youtube:player_client=${client}" ${args}`;

    try {
      const { stdout, stderr } = await execPromise(fullArgs, { maxBuffer: 1024 * 1024 * 50 });
      return stdout;
    } catch (e) {
      lastError = e;
      console.warn(`yt-dlp attempt with ${client} failed:`, e.message);
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
    const info = JSON.parse(stdout);

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
    return res.status(500).json({ error: 'Backend failed', details: error.message });
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
