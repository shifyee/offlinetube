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

function buildYtDlpCmd(args, client = 'default') {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
  
  const extractorArgs = [
    'youtube:formats=sabr',
    'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
    `youtube:player_client=${client}`
  ].join(';');

  return `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --force-ipv4 --newline --extractor-args "${extractorArgs}" ${args}`;
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
      error: 'Failed to fetch metadata.', 
      details: lastError ? lastError.message : 'Unknown'
    });
  }

  // THE FIX: Use --dump-json to get exact file sizes
  let formats = [];
  try {
    const jsonStdout = await runYtDlp(`--dump-json --no-playlist "${url}"`, 'default');
    let jsonString = jsonStdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);
    
    const info = JSON.parse(jsonString);
    const heights = new Map();

    info.formats.forEach(f => {
      if (f.height && f.vcodec !== 'none') {
        const size = f.filesize || f.filesize_approx || 0;
        // Store the largest size for this height
        if (!heights.has(f.height) || heights.get(f.height) < size) {
          heights.set(f.height, size);
        }
      }
    });

    if (heights.size > 0) {
      formats = Array.from(heights.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([h, size]) => ({
          qualityLabel: `${h}p`,
          height: h,
          contentLength: size,
          container: 'mp4',
          type: 'video/mp4',
          url: `/api/stream?id=${id}&height=${h}`
        }));
    }
  } catch (e) {
    console.warn('--dump-json failed for sizes, falling back to --list-formats');
    // Fallback to parsing --list-formats if dump-json fails
    try {
      const listStdout = await runYtDlp(`--list-formats "${url}"`, 'default');
      const heights = new Set();
      listStdout.split('\n').forEach(line => {
        const match = line.match(/^(\d+)\s+(\w+)\s+(\d+x\d+)\s+(\d+)p/);
        if (match) heights.add(parseInt(match[4], 10));
      });
      formats = Array.from(heights).sort((a, b) => b - a).map(h => ({
        qualityLabel: `${h}p`, height: h, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
      }));
    } catch (err) {}
  }

  if (formats.length === 0) {
    formats = [1080, 720, 480, 360].map(h => ({
      qualityLabel: `${h}p`, height: h, contentLength: 0, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
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
  const { id, height } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  const formatStr = `bv*[height<=${height}]+ba/b[height<=${height}]/b`;
  const clients = ['default', 'web', 'tv', 'android', 'ios', 'mweb', 'web_safari'];
  
  let success = false;
  let lastError = null;

  for (const client of clients) {
    try {
      console.log(`[stream] Downloading ${height}p with client: ${client}`);
      const cmd = buildYtDlpCmd(`-f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`, client);
      
      await new Promise((resolve, reject) => {
        const child = spawn(cmd, { shell: true });
        
        child.stderr.on('data', (data) => {
          const text = data.toString();
          const match = /\[download\]\s+([\d.]+)%/.exec(text);
          if (match) console.log(`[stream] Progress: ${match[1]}%`);
        });

        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });
      });
      
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
  console.log(`[stream] Success! Sending ${(stat.size / 1024 / 1024).toFixed(2)} MB to client.`);

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
