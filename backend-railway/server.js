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

// Helper: run yt-dlp with a specific client, retrying once on "page needs to be reloaded"
async function runYtDlp(args, client) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
  const extractorArgs = [
    'youtube:formats=duplicate',
    'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
    `youtube:player_client=${client}`
  ].join(';');

  const fullArgs = `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --extractor-args "${extractorArgs}" ${args}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { stdout, stderr } = await execPromise(fullArgs, { maxBuffer: 1024 * 1024 * 50 });
      if (stderr) console.warn(`yt-dlp stderr (${client}):`, stderr);
      return stdout;
    } catch (e) {
      if (attempt === 1 && e.message.includes('The page needs to be reloaded')) {
        console.warn(`[Retry] page needs to be reloaded with ${client}. Waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;
  const clients = ['default', 'web', 'tv', 'android', 'ios', 'mweb', 'web_safari'];

  let metadata = null;
  let lastError = null;

  // 1. Get metadata using --print (works even when formats are broken)
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
    // Fallback: try to get metadata from a generic search
    try {
      const searchStdout = await runYtDlp(
        `--print "%(title)s" --print "%(uploader)s" --print "%(duration)s" --print "%(thumbnail)s" --no-playlist "https://www.youtube.com/watch?v=${id}"`,
        'default'
      );
      const lines = searchStdout.trim().split('\n');
      if (lines.length >= 4) {
        metadata = {
          title: lines[0],
          author: lines[1],
          lengthSeconds: parseInt(lines[2], 10) || 0,
          thumbnail: lines[3]
        };
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!metadata) {
    return res.status(500).json({
      error: 'Backend failed to fetch video metadata',
      details: lastError ? lastError.message : 'Unknown error',
      stderr: lastError && lastError.stderr ? lastError.stderr : 'No stderr available'
    });
  }

  // 2. Get available resolutions using --list-formats
  let formats = [];
  try {
    const listStdout = await runYtDlp(`--list-formats "${url}"`, 'default');
    const lines = listStdout.split('\n');
    const heights = new Set();

    for (const line of lines) {
      // Match lines like: "137 mp4 1920x1080 1080p ..."
      const match = line.match(/^(\d+)\s+(\w+)\s+(\d+x\d+)\s+(\d+)p/);
      if (match) {
        const height = parseInt(match[4], 10);
        if (height > 0) heights.add(height);
      }
    }

    if (heights.size > 0) {
      const sorted = Array.from(heights).sort((a, b) => b - a);
      formats = sorted.map(h => ({
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

  // Fallback: if no resolutions were found, provide common ones
  if (formats.length === 0) {
    formats = [
      { qualityLabel: '1080p', height: 1080, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=1080` },
      { qualityLabel: '720p', height: 720, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=720` },
      { qualityLabel: '480p', height: 480, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=480` },
      { qualityLabel: '360p', height: 360, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=360` }
    ];
  }

  return res.json({
    videoId: id,
    title: metadata.title,
    author: metadata.author,
    authorId: '', // Not available without --dump-json
    authorAvatar: null,
    lengthSeconds: metadata.lengthSeconds,
    description: '', // Not available without --dump-json
    videoThumbnails: [{ url: metadata.thumbnail }],
    formatStreams: formats
  });
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;

  // Use a generic selector that doesn't depend on specific format IDs
  // This will grab the best available video and audio and merge them
  const formatStr = `bestvideo+bestaudio/best`;

  const clients = ['default', 'web', 'tv', 'android', 'ios', 'mweb', 'web_safari'];
  let success = false;
  let lastError = null;

  for (const client of clients) {
    try {
      console.log(`[stream] trying client ${client} for ${id} @ ${height}p`);
      const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
      const extractorArgs = [
        'youtube:formats=duplicate',
        'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
        `youtube:player_client=${client}`
      ].join(';');

      const cmd = `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --extractor-args "${extractorArgs}" -f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`;
      await execPromise(cmd, { maxBuffer: 1024 * 1024 * 100, timeout: 300000 });

      if (fs.existsSync(tempFile)) {
        success = true;
        break;
      }
    } catch (e) {
      lastError = e;
      console.warn(`[stream] client ${client} failed:`, e.message);
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }

  if (!success) {
    console.error('[stream] all clients failed');
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to stream video',
        details: lastError ? lastError.message : 'Unknown error'
      });
    }
    return;
  }

  const stat = fs.statSync(tempFile);
  console.log(`[stream] success! file size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

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
