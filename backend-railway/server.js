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
  // Prioritize clients known to work with cookies and SABR
  const clients = ['default', 'web', 'tv'];
  
  for (const client of clients) {
    let cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
    
    // THE FIX: Include SABR formats and use the POT provider
    const extractorArgs = [
      'youtube:formats=duplicate', // Include SABR formats
      'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416', // POT provider
      `youtube:player_client=${client}`
    ].join(';');

    const fullArgs = `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --extractor-args "${extractorArgs}" ${args}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { stdout, stderr } = await execPromise(fullArgs, { maxBuffer: 1024 * 1024 * 50 });
        if (stderr) console.warn(`yt-dlp stderr (${client}):`, stderr);
        return stdout;
      } catch (e) {
        lastError = e;
        const errorMsg = e.message || '';
        
        if (errorMsg.includes('The page needs to be reloaded')) {
          console.warn(`[Retry ${attempt}/2] "page needs to be reloaded" with ${client}. Waiting 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        console.warn(`yt-dlp attempt with ${client} failed:`, errorMsg);
        if (e.stderr) console.error(`Full stderr (${client}):`, e.stderr);
        break; 
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
    // THE FIX: Use --list-formats instead of --dump-json to get formats reliably
    // then parse the output. This avoids the "Requested format is not available" error
    // during metadata extraction.
    const stdout = await runYtDlp(`--list-formats "${url}"`);
    
    // Parse the table output from --list-formats
    const lines = stdout.split('\n');
    const formats = [];
    const heights = new Set();
    
    for (const line of lines) {
      // Match lines like: "137 mp4 1920x1080 1080p  ..."
      const match = line.match(/^(\d+)\s+(\w+)\s+(\d+x\d+)\s+(\d+)p/);
      if (match) {
        const height = parseInt(match[4], 10);
        if (!heights.has(height)) {
          heights.add(height);
          formats.push({
            qualityLabel: `${height}p`,
            height: height,
            container: 'mp4',
            type: 'video/mp4',
            url: `/api/stream?id=${id}&height=${height}`
          });
        }
      }
    }

    // If parsing fails, fall back to a default list
    if (formats.length === 0) {
      formats.push(
        { qualityLabel: '1080p', height: 1080, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=1080` },
        { qualityLabel: '720p', height: 720, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=720` },
        { qualityLabel: '360p', height: 360, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=360` }
      );
    }

    // Sort highest first
    formats.sort((a, b) => b.height - a.height);

    // We still need the title and uploader. Let's fetch that separately.
    const infoStdout = await runYtDlp(`--dump-json --no-playlist "${url}"`);
    let jsonString = infoStdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonString = jsonString.substring(startIdx, endIdx + 1);
    }
    const info = JSON.parse(jsonString);

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
    
    // THE FIX: Use a format selector that includes SABR
    // bv*+ba/b is the most generic and unbreakable selector
    const formatStr = `bv*+ba/b`;
    
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
