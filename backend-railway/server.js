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
    console.log('Successfully loaded cookies.');
  } catch (e) { console.error('Failed to write cookies:', e); }
}

function buildYtDlpCmd(args, client = 'tv,mweb') {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? `--cookies "${COOKIES_FILE}"` : '';
  
  // THE FIX: Force SABR formats and use tv,mweb clients
  const extractorArgs = [
    'youtube:formats=duplicate', // Force duplicate formats to include SABR
    'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
    `youtube:player_client=${client}`
  ].join(';');

  return `yt-dlp ${cookieArgs} --no-warnings --no-check-certificates --force-ipv4 --newline --extractor-args "${extractorArgs}" ${args}`;
}

async function runYtDlp(args, client = 'tv,mweb') {
  const cmd = buildYtDlpCmd(args, client);
  try {
    const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
    return stdout;
  } catch (e) {
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
  const clients = ['tv,mweb', 'tv', 'mweb', 'web_safari'];
  
  let metadata = null;
  let lastError = null;

  for (const client of clients) {
    try {
      const stdout = await runYtDlp(
        `--write-comments --extractor-args "youtube:max_comments=20,all,0,0" --dump-json --no-playlist "${url}"`,
        client
      );
      
      let jsonString = stdout.trim();
      const startIdx = jsonString.indexOf('{');
      const endIdx = jsonString.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);
      
      const info = JSON.parse(jsonString);
      
      metadata = {
        title: info.title,
        author: info.uploader,
        lengthSeconds: info.duration || 0,
        thumbnail: info.thumbnail,
        description: info.description || '',
        comments: (info.comments || []).slice(0, 20).map(c => ({
          commentId: c.id,
          author: c.author,
          text: c.text
        }))
      };
      metadata.formats = info.formats || [];
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!metadata) {
    return res.status(500).json({ error: 'Failed to fetch metadata.', details: lastError ? lastError.message : 'Unknown' });
  }

  let formats = [];
  try {
    const heights = new Map();
    metadata.formats.forEach(f => {
      // Include formats that have a height (both muxed and SABR)
      if (f.height && f.vcodec !== 'none') {
        const size = f.filesize || f.filesize_approx || 0;
        if (!heights.has(f.height) || heights.get(f.height) < size) {
          heights.set(f.height, size);
        }
      }
    });

    if (heights.size > 0) {
      formats = Array.from(heights.entries()).sort((a, b) => b[0] - a[0]).map(([h, size]) => ({
        qualityLabel: `${h}p`, height: h, contentLength: size, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
      }));
    }
  } catch (e) { console.warn('Failed to parse sizes'); }

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
    description: metadata.description,
    comments: metadata.comments,
    videoThumbnails: [{ url: metadata.thumbnail }],
    formatStreams: formats
  });
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  // THE FIX: Use the SABR protocol selector
  const formatStr = `ba[protocol=sabr]+bv[protocol=sabr]/bv*[height<=${height}]+ba/b[height<=${height}]/b`;
  const clients = ['tv,mweb', 'tv', 'mweb', 'web_safari'];
  
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
