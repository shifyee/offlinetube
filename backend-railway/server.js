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

// Universal yt-dlp command builder
function buildYtDlpCmd(args, client = 'default') {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
  const extractorArgs = [
    'youtube:formats=duplicate',
    'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
    `youtube:player_client=${client}`
  ].join(';');

  // --force-ipv4 often fixes Railway networking issues
  return `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --force-ipv4 --extractor-args "${extractorArgs}" ${args}`;
}

async function runYtDlp(args, client = 'default') {
  const cmd = buildYtDlpCmd(args, client);
  try {
    const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
    if (stderr) console.warn(`yt-dlp stderr (${client}):`, stderr);
    return stdout;
  } catch (e) {
    if (e.message.includes('The page needs to be reloaded')) {
      console.warn(`[Retry] page needs to be reloaded with ${client}...`);
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
  const clients = ['default', 'web', 'tv', 'android', 'ios', 'mweb', 'web_safari'];
  
  let metadata = null;
  let lastError = null;

  // 1. Fetch Metadata using --print (avoids --dump-json failures)
  for (const client of clients) {
    try {
      const stdout = await runYtDlp(
        `--print "%(title)s" --print "%(uploader)s" --print "%(duration)s" --print "%(thumbnail)s" --no-playlist "${url}"`,
        client
      );
      const lines = stdout.trim().split('\n');
      if (lines.length >= 4) {
        metadata = {
          title: lines[0],
          author: lines[1],
          lengthSeconds: parseInt(lines[2], 10) || 0,
          thumbnail: lines[3]
        };
        break;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!metadata) {
    return res.status(500).json({ 
      error: 'Failed to fetch metadata. YouTube is blocking all clients.', 
      details: lastError ? lastError.message : 'Unknown',
      stderr: lastError && lastError.stderr ? lastError.stderr : ''
    });
  }

  // 2. Fetch Resolutions using --list-formats
  let formats = [];
  try {
    const listStdout = await runYtDlp(`--list-formats "${url}"`, 'default');
    const heights = new Set();
    listStdout.split('\n').forEach(line => {
      const match = line.match(/^(\d+)\s+(\w+)\s+(\d+x\d+)\s+(\d+)p/);
      if (match) heights.add(parseInt(match[4], 10));
    });

    if (heights.size > 0) {
      formats = Array.from(heights)
        .sort((a, b) => b - a)
        .map(h => ({
          qualityLabel: `${h}p`,
          height: h,
          container: 'mp4',
          type: 'video/mp4',
          url: `/api/stream?id=${id}&height=${h}`
        }));
    }
  } catch (e) {
    console.warn('--list-formats failed, using default resolutions');
  }

  // 3. Fallback resolutions if list-formats fails completely
  if (formats.length === 0) {
    formats = [1080, 720, 480, 360].map(h => ({
      qualityLabel: `${h}p`,
      height: h,
      container: 'mp4',
      type: 'video/mp4',
      url: `/api/stream?id=${id}&height=${h}`
    }));
  }

  return res.json({
    videoId: id,
    title: metadata.title,
    author: metadata.author,
    authorId: '',
    authorAvatar: null,
    lengthSeconds: metadata.lengthSeconds,
    description: 'Downloaded via yt-dlp',
    videoThumbnails: [{ url: metadata.thumbnail }],
    formatStreams: formats
  });
});

app.get('/api/stream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  // The most unbreakable format selector
  const formatStr = 'bestvideo+bestaudio/best';
  const clients = ['default', 'web', 'tv', 'android', 'ios', 'mweb', 'web_safari'];
  
  let success = false;
  let lastError = null;

  for (const client of clients) {
    try {
      console.log(`[stream] Downloading with client: ${client}`);
      const cmd = buildYtDlpCmd(`-f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`, client);
      
      await execPromise(cmd, { maxBuffer: 1024 * 1024 * 100, timeout: 300000 });
      
      if (fs.existsSync(tempFile)) {
        success = true;
        break;
      }
    } catch (e) {
      lastError = e;
      console.warn(`[stream] Client ${client} failed.`);
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }

  if (!success) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'All download clients failed', details: lastError.message });
    }
    return;
  }

  const stat = fs.statSync(tempFile);
  console.log(`[stream] Success! File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const readStream = fs.createReadStream(tempFile);
  readStream.pipe(res);

  readStream.on('end', () => {
    fs.unlink(tempFile, (err) => { if (err) console.error('Failed to delete temp file:', err); });
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Railway yt-dlp backend running on port ${PORT}`);
});
