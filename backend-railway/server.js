const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const COOKIES_FILE = '/tmp/cookies.txt';
const jobs = new Map();

// Force CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// --- COOKIE HANDLING ---
if (process.env.YOUTUBE_COOKIES) {
  try {
    let cookiesContent = process.env.YOUTUBE_COOKIES.trim();
    if (cookiesContent.startsWith('[')) {
      const jsonCookies = JSON.parse(cookiesContent);
      let netscape = '# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file! Do not edit.\n\n';
      for (const cookie of jsonCookies) {
        const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
        const secure = cookie.secure ? 'TRUE' : 'FALSE';
        const expiry = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;
        netscape += `${domain}\tTRUE\t${cookie.path || '/'}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}\n`;
      }
      cookiesContent = netscape;
    } else {
      cookiesContent = cookiesContent.replace(/\r\n/g, '\n');
      if (!cookiesContent.includes('# Netscape HTTP Cookie File')) {
        cookiesContent = '# Netscape HTTP Cookie File\n' + cookiesContent;
      }
    }
    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('[Server] ✅ Wrote YOUTUBE_COOKIES to /tmp/cookies.txt');
  } catch (e) {
    console.error('[Server] Failed to write YOUTUBE_COOKIES:', e);
  }
}

// --- JOB CLEANUP ---
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 3600000) {
      if (job.file && fs.existsSync(job.file)) fs.unlinkSync(job.file);
      jobs.delete(id);
    }
  }
}, 1800000);

// --- YT-DLP ARGS ---
function buildYtDlpArgs(args, fetchComments = false) {
  const finalArgs = [];
  if (fs.existsSync(COOKIES_FILE)) {
    finalArgs.push('--cookies', COOKIES_FILE);
  }

  let extractorArgs = 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416';
  if (fetchComments) extractorArgs += ';youtube:max_comments=20,20,0,0';

  finalArgs.push(
    '--js-runtimes', 'deno',
    '--socket-timeout', '30',
    '--no-playlist',
    '--newline',
    '--no-warnings',
    '--extractor-args', extractorArgs,
    ...args
  );
  return finalArgs;
}

function runCommand(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true });
    let stdout = '';
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { 
      console.log(`[yt-dlp log] ${data.toString().trim()}`); 
    });

    const timeout = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) {}
      reject(new Error('Command timed out'));
    }, timeoutMs);

    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(`Exited with code ${code}`));
    });
  });
}

// --- API INFO ---
app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });
  const url = `https://www.youtube.com/watch?v=${id}`;
  let stdout = null;

  console.log(`[Server] Fetching info for ${id}...`);

  try {
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--write-comments', '--dump-json', url], true), 25000);
  } catch (e) {
    try {
      stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--dump-json', url], false), 20000);
    } catch (err2) {
      console.error('Info fetch failed completely:', err2.message);
      return res.status(500).json({ error: 'YouTube blocked the request.', details: err2.message });
    }
  }

  try {
    let info = null;
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          info = JSON.parse(line.trim());
          break; 
        } catch (e) {}
      }
    }
    
    if (!info) {
      throw new Error('Could not find valid JSON in yt-dlp output');
    }

    const formats = [];
    const heights = new Map();
    
    if (info.formats) {
      info.formats.forEach(f => {
        if (f.height && f.vcodec !== 'none') {
          const size = f.filesize || f.filesize_approx || 0;
          if (!heights.has(f.height) || heights.get(f.height) < size) heights.set(f.height, size);
        }
      });
    }
    
    if (heights.size > 0) {
      Array.from(heights.entries()).sort((a, b) => b[0] - a[0]).forEach(([h, size]) => {
        formats.push({
          qualityLabel: `${h}p`, height: h, contentLength: size, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
        });
      });
    }
    
    console.log(`[Server] Success! Found ${formats.length} formats for ${id}. (Heights: ${Array.from(heights.keys()).join(', ')})`);
    
    return res.json({
      videoId: id, title: info.title, author: info.uploader, authorId: '',
      authorAvatar: null, lengthSeconds: info.duration || 0, description: info.description || '',
      comments: (info.comments || []).slice(0, 20).map(c => ({ commentId: c.id, author: c.author, content: c.text || c.content || '' })),
      videoThumbnails: [{ url: info.thumbnail }], formatStreams: formats
    });
  } catch (error) {
    console.error('[Server] Parse failed:', error.message);
    return res.status(500).json({ error: 'Failed to parse metadata.', details: error.message });
  }
});

// --- DOWNLOAD ENDPOINT ---
app.post('/api/download', async (req, res) => {
  const { id, height, format } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const jobId = crypto.randomBytes(8).toString('hex');
  const isMp3 = format === 'mp3';
  const ext = isMp3 ? 'mp3' : 'mp4';
  const tempFile = path.join('/tmp', `ytdl-${jobId}.${ext}`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  let h = parseInt(height, 10);
  if (isNaN(h) || h <= 0) h = 1080;

  jobs.set(jobId, { status: 'downloading', progress: 0, file: tempFile, createdAt: Date.now(), format: ext });
  console.log(`[Job ${jobId}] Starting download: ${id} @ ${isMp3 ? 'MP3' : h + 'p'}`);

  let args = [];
  if (isMp3) {
    args = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', tempFile, url];
  } else {
    // THE FIX: Height constraint [height<=${h}] is back. 
    // This forces it to get the best video UP TO the selected height, not the absolute best.
    const formatStr = `bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`;
    args = ['-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile, url];
  }
  
  const child = spawn('yt-dlp', buildYtDlpArgs(args), { detached: true });

  let lastProgressTime = Date.now();
  const stallChecker = setInterval(() => {
    if (Date.now() - lastProgressTime > 60000) {
      console.error(`[Job ${jobId}] Stalled for 60s, killing process.`);
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { child.kill('SIGKILL'); }
      const job = jobs.get(jobId);
      if (job) { job.status = 'error'; job.error = 'Download stalled or timed out.'; }
      clearInterval(stallChecker);
    }
  }, 5000);

  const handleOutput = (data) => {
    const text = data.toString();
    const match = /\[download\]\s+([\d.]+)%/.exec(text);
    if (match) {
      lastProgressTime = Date.now();
      const job = jobs.get(jobId);
      if (job) job.progress = parseFloat(match[1]) / 100;
    }
    if (text.includes('ERROR:')) {
      console.error(`[Job ${jobId}] ${text.trim()}`);
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('error', (err) => {
    clearInterval(stallChecker);
    console.error(`[Job ${jobId}] Spawn error:`, err);
    const job = jobs.get(jobId);
    if (job) { job.status = 'error'; job.error = err.message; }
  });

  child.on('close', (code) => {
    clearInterval(stallChecker);
    const job = jobs.get(jobId);
    if (!job) return;
    if (code === 0 && fs.existsSync(tempFile)) {
      job.status = 'done';
      job.progress = 1;
      console.log(`[Job ${jobId}] Complete! Size: ${(fs.statSync(tempFile).size / 1024 / 1024).toFixed(2)}MB`);
    } else {
      job.status = 'error';
      job.error = `yt-dlp exited with code ${code}.`;
    }
  });
  
  res.json({ jobId });
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, progress: job.progress, error: job.error });
});

app.get('/api/file/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done' || !fs.existsSync(job.file)) {
    return res.status(404).send('File not ready');
  }
  
  const isMp3 = job.format === 'mp3';
  res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'video/mp4');
  
  const stream = fs.createReadStream(job.file);
  stream.pipe(res);
  stream.on('end', () => {
    fs.unlink(job.file, () => {});
    jobs.delete(req.params.jobId);
  });
});

// --- COOKIE SYNC ENDPOINT ---
app.post('/api/update-cookies', express.text({ type: 'text/plain' }), (req, res) => {
  try {
    if (!req.body) return res.status(400).send('No cookies provided');
    let cookiesContent = req.body.trim().replace(/\r\n/g, '\n');
    if (!cookiesContent.includes('# Netscape HTTP Cookie File') && !cookiesContent.includes('# HTTP Cookie File')) {
      cookiesContent = '# Netscape HTTP Cookie File\n' + cookiesContent;
    }
    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('[Server] ✅ Cookies updated via API!');
    res.status(200).send('Cookies updated successfully');
  } catch (err) {
    console.error('[Server] Failed to update cookies:', err);
    res.status(500).send('Failed to update cookies');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Railway running on ${PORT}`));
