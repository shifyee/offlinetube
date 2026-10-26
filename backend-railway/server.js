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

// Path to your cookies file (if you decide to add one later)
const COOKIES_FILE = '/app/cookies.txt';

async function runYtDlp(args) {
  let lastError;
  // Try multiple reliable clients in order
  const clients = ['tv', 'mweb', 'android', 'ios'];
  
  for (const client of clients) {
    // Add the POT provider argument and client-specific arguments
    const potArgs = `--extractor-args "youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416"`;
    let cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
    const fullArgs = `yt-dlp ${potArgs} ${cookieArgs} --extractor-args "youtube:player_client=${client}" ${args}`;

    for (let i = 0; i < 2; i++) { // Retry each client once
      try {
        const { stdout, stderr } = await execPromise(fullArgs, { maxBuffer: 1024 * 1024 * 50 });
        if (stderr && stderr.includes('ERROR')) {
          console.warn(`yt-dlp stderr (${client}):`, stderr);
        }
        return stdout;
      } catch (e) {
        lastError = e;
        console.warn(`yt-dlp attempt with ${client} failed (try ${i + 1}):`, e.message);
        if (e.stderr) console.error(`Full stderr (${client}):`, e.stderr);
        await new Promise(r => setTimeout(r, 2000));
      }
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
    return res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
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
