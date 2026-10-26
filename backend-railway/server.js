// language: JavaScript, file: server.js, runtime: Node 18+
// adapted from the "rip" project: works with Railway, reads cookies from env
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;
const YTDLP = process.env.YTDLP || 'yt-dlp';
const COOKIES_FILE = '/tmp/cookies.txt';

// ── COOKIE HANDLING ──────────────────────────────────────────────
// Railway env vars convert tabs to spaces and \n to literal "\n".
// yt-dlp requires Netscape format (tabs + real newlines). Fix it here.
if (process.env.YOUTUBE_COOKIES) {
  try {
    let c = process.env.YOUTUBE_COOKIES
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    c = c.split('\n').map(line => {
      if (line.startsWith('#') || line.trim() === '') return line;
      return line.replace(/ {2,}/g, '\t');
    }).join('\n');
    fs.writeFileSync(COOKIES_FILE, c);
    console.log(`[cookies] loaded from env (${c.split('\n').filter(l => !l.startsWith('#') && l.trim()).length} entries)`);
  } catch (e) {
    console.error('[cookies] failed to write:', e);
  }
} else {
  console.warn('[cookies] YOUTUBE_COOKIES not set — running without auth');
}
// ─────────────────────────────────────────────────────────────────

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const allArgs = [...args];
    if (fs.existsSync(COOKIES_FILE)) {
      allArgs.unshift('--cookies', COOKIES_FILE);
    }
    // The exact client that worked locally for you
    allArgs.unshift(
      '--extractor-args', 'youtube:player_client=web_safari,tv,ios',
      '--no-warnings',
      '--no-check-certificates'
    );

    console.log(`[yt-dlp] spawn: ${YTDLP} ${allArgs.join(' ')}`);
    const child = spawn(YTDLP, allArgs);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => reject(err));
    child.on('close', code => {
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr.trim() || `yt-dlp exit ${code}`));
    });
  });
}

// ── GET /api/info?id=VIDEOID ─────────────────────────────────────
// Returns metadata + available quality options for the picker.
app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const stdout = await runYtDlp(['--dump-json', '--no-playlist', url]);

    // Extract just the JSON object (yt-dlp sometimes prints warnings first)
    const start = stdout.indexOf('{');
    const end = stdout.lastIndexOf('}');
    const info = JSON.parse(stdout.substring(start, end + 1));

    // Unique heights from available muxed or video-only streams
    const heights = new Set();
    (info.formats || []).forEach(f => {
      if (f.vcodec && f.vcodec !== 'none' && f.height) heights.add(f.height);
    });
    const sorted = Array.from(heights).sort((a, b) => b - a);
    if (!sorted.length) throw new Error('no video formats available');

    return res.json({
      videoId: id,
      title: info.title,
      author: info.uploader,
      authorId: info.channel_id,
      authorAvatar: null,
      lengthSeconds: info.duration,
      description: info.description,
      videoThumbnails: [{ url: info.thumbnail }],
      formatStreams: sorted.map(h => ({
        qualityLabel: `${h}p`,
        height: h,
        container: 'mp4',
        type: 'video/mp4',
        url: `/api/stream?id=${id}&height=${h}`
      }))
    });
  } catch (e) {
    console.error('[info] failed:', e.message);
    return res.status(500).json({ error: 'Backend failed', details: e.message });
  }
});

// ── GET /api/stream?id=VIDEOID&height=HEIGHT ─────────────────────
// Spawns yt-dlp with your proven format selector and pipes the result
// straight to the client. No temp file, no polling — just a direct pipe.
app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id) return res.status(400).send('missing id');

  const url = `https://www.youtube.com/watch?v=${id}`;
  const h = parseInt(height, 10) || 1080;

  // Your exact selector from the "rip" project — proven to work
  const format = `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`;

  const args = [
    '-f', format,
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '-o', '-', // output to stdout
    url
  ];

  if (fs.existsSync(COOKIES_FILE)) args.unshift('--cookies', COOKIES_FILE);
  args.unshift(
    '--extractor-args', 'youtube:player_client=web_safari,tv,ios',
    '--no-warnings',
    '--no-check-certificates'
  );

  console.log(`[stream] ${id} @ ${h}p`);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const child = spawn(YTDLP, args);
  child.stdout.pipe(res);

  child.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log('[yt-dlp stderr]', line.substring(0, 200));
  });

  child.on('error', err => {
    console.error('[stream] spawn error:', err);
    if (!res.headersSent) res.status(500).end('spawn failed');
  });

  child.on('close', code => {
    if (code !== 0) console.error(`[stream] yt-dlp exited ${code}`);
  });

  // If the client disconnects, kill yt-dlp
  req.on('close', () => {
    if (!child.killed) child.kill();
  });
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'offlinetube-ytdlp' }));

app.listen(PORT, () => {
  console.log(`[boot] listening on ${PORT}`);
  console.log(`[boot] yt-dlp: ${YTDLP}`);
  console.log(`[boot] cookies: ${fs.existsSync(COOKIES_FILE) ? 'loaded' : 'none'}`);
});
