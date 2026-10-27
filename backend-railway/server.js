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

// Clean up old jobs every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 3600000) {
      if (job.file && fs.existsSync(job.file)) fs.unlinkSync(job.file);
      jobs.delete(id);
    }
  }
}, 1800000);

if (process.env.YOUTUBE_COOKIES) {
  try {
    let cookiesContent = process.env.YOUTUBE_COOKIES
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.startsWith('#') || line.trim() === '' ? line : line.replace(/ {2,}/g, '\t'))
      .join('\n');
    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('Successfully loaded cookies.');
  } catch (e) { console.error('Failed to write cookies:', e); }
}

function buildYtDlpArgs(args, fetchComments) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
  
  // THE FIX: Force Deno for EJS, limit comments, and add socket timeout
  let extractorArgs = 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416';
  if (fetchComments) extractorArgs += ';youtube:max_comments=20,20,0,0';

  return [
    ...cookieArgs,
    '--js-runtimes', 'deno', // Explicitly tell yt-dlp to use Deno
    '--socket-timeout', '30', // Abort stalled connections
    '--no-warnings',
    '--no-check-certificates',
    '--newline',
    '--extractor-args', extractorArgs,
    ...args
  ];
}

function runCommand(cmd, args, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Command timed out'));
    }, timeoutMs);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exited with code ${code}`));
    });
  });
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;
  let stdout = null;

  try {
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--write-comments', '--dump-json', '--no-playlist', url], true), 25000);
  } catch (e) {
    console.warn('Comments timed out, fetching without comments...');
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--dump-json', '--no-playlist', url], false), 15000);
  }

  try {
    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);

    const info = JSON.parse(jsonString);
    const formats = [];
    const heights = new Map();

    info.formats.forEach(f => {
      if (f.height && f.vcodec !== 'none') {
        const size = f.filesize || f.filesize_approx || 0;
        if (!heights.has(f.height) || heights.get(f.height) < size) heights.set(f.height, size);
      }
    });

    if (heights.size > 0) {
      Array.from(heights.entries()).sort((a, b) => b[0] - a[0]).forEach(([h, size]) => {
        formats.push({
          qualityLabel: `${h}p`, height: h, contentLength: size, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
        });
      });
    }

    return res.json({
      videoId: id, title: info.title, author: info.uploader, authorId: '',
      authorAvatar: null, lengthSeconds: info.duration || 0, description: info.description || '',
      comments: (info.comments || []).slice(0, 20).map(c => ({ commentId: c.id, author: c.author, content: c.text || c.content || '' })),
      videoThumbnails: [{ url: info.thumbnail }], formatStreams: formats
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to parse metadata.', details: error.message });
  }
});

// The Job Queue Endpoint
app.post('/api/download', async (req, res) => {
  const { id, height } = req.body;
  if (!id || !height) return res.status(400).json({ error: 'Missing parameters' });

  const jobId = crypto.randomBytes(8).toString('hex');
  const tempFile = path.join('/tmp', `ytdl-${jobId}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  // THE FIX: Use a simpler format selector
  const formatStr = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
  
  jobs.set(jobId, { status: 'downloading', progress: 0, file: tempFile, createdAt: Date.now() });

  const args = buildYtDlpArgs(['-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile, url], false);
  const child = spawn('yt-dlp', args);

  child.stderr.on('data', (data) => {
    const text = data.toString();
    const match = /\[download\]\s+([\d.]+)%/.exec(text);
    if (match) {
      const job = jobs.get(jobId);
      if (job) job.progress = parseFloat(match[1]) / 100;
    }
  });

  child.on('close', (code) => {
    const job = jobs.get(jobId);
    if (!job) return;
    if (code === 0 && fs.existsSync(tempFile)) {
      job.status = 'done';
      job.progress = 1;
    } else {
      job.status = 'error';
      job.error = 'Download failed';
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
  res.setHeader('Content-Type', 'video/mp4');
  const stream = fs.createReadStream(job.file);
  stream.pipe(res);
  stream.on('end', () => {
    fs.unlink(job.file, () => {});
    jobs.delete(req.params.jobId);
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Railway running on ${PORT}`));const express = require('express');
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

// Clean up old jobs every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 3600000) {
      if (job.file && fs.existsSync(job.file)) fs.unlinkSync(job.file);
      jobs.delete(id);
    }
  }
}, 1800000);

if (process.env.YOUTUBE_COOKIES) {
  try {
    let cookiesContent = process.env.YOUTUBE_COOKIES
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.startsWith('#') || line.trim() === '' ? line : line.replace(/ {2,}/g, '\t'))
      .join('\n');
    fs.writeFileSync(COOKIES_FILE, cookiesContent);
    console.log('Successfully loaded cookies.');
  } catch (e) { console.error('Failed to write cookies:', e); }
}

function buildYtDlpArgs(args, fetchComments) {
  const cookieArgs = fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
  
  // THE FIX: Force Deno for EJS, limit comments, and add socket timeout
  let extractorArgs = 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416';
  if (fetchComments) extractorArgs += ';youtube:max_comments=20,20,0,0';

  return [
    ...cookieArgs,
    '--js-runtimes', 'deno', // Explicitly tell yt-dlp to use Deno
    '--socket-timeout', '30', // Abort stalled connections
    '--no-warnings',
    '--no-check-certificates',
    '--newline',
    '--extractor-args', extractorArgs,
    ...args
  ];
}

function runCommand(cmd, args, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Command timed out'));
    }, timeoutMs);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exited with code ${code}`));
    });
  });
}

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  const url = `https://www.youtube.com/watch?v=${id}`;
  let stdout = null;

  try {
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--write-comments', '--dump-json', '--no-playlist', url], true), 25000);
  } catch (e) {
    console.warn('Comments timed out, fetching without comments...');
    stdout = await runCommand('yt-dlp', buildYtDlpArgs(['--dump-json', '--no-playlist', url], false), 15000);
  }

  try {
    let jsonString = stdout.trim();
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) jsonString = jsonString.substring(startIdx, endIdx + 1);

    const info = JSON.parse(jsonString);
    const formats = [];
    const heights = new Map();

    info.formats.forEach(f => {
      if (f.height && f.vcodec !== 'none') {
        const size = f.filesize || f.filesize_approx || 0;
        if (!heights.has(f.height) || heights.get(f.height) < size) heights.set(f.height, size);
      }
    });

    if (heights.size > 0) {
      Array.from(heights.entries()).sort((a, b) => b[0] - a[0]).forEach(([h, size]) => {
        formats.push({
          qualityLabel: `${h}p`, height: h, contentLength: size, container: 'mp4', type: 'video/mp4', url: `/api/stream?id=${id}&height=${h}`
        });
      });
    }

    return res.json({
      videoId: id, title: info.title, author: info.uploader, authorId: '',
      authorAvatar: null, lengthSeconds: info.duration || 0, description: info.description || '',
      comments: (info.comments || []).slice(0, 20).map(c => ({ commentId: c.id, author: c.author, content: c.text || c.content || '' })),
      videoThumbnails: [{ url: info.thumbnail }], formatStreams: formats
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to parse metadata.', details: error.message });
  }
});

// The Job Queue Endpoint
app.post('/api/download', async (req, res) => {
  const { id, height } = req.body;
  if (!id || !height) return res.status(400).json({ error: 'Missing parameters' });

  const jobId = crypto.randomBytes(8).toString('hex');
  const tempFile = path.join('/tmp', `ytdl-${jobId}.mp4`);
  const url = `https://www.youtube.com/watch?v=${id}`;
  
  // THE FIX: Use a simpler format selector
  const formatStr = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
  
  jobs.set(jobId, { status: 'downloading', progress: 0, file: tempFile, createdAt: Date.now() });

  const args = buildYtDlpArgs(['-f', formatStr, '--merge-output-format', 'mp4', '-o', tempFile, url], false);
  const child = spawn('yt-dlp', args);

  child.stderr.on('data', (data) => {
    const text = data.toString();
    const match = /\[download\]\s+([\d.]+)%/.exec(text);
    if (match) {
      const job = jobs.get(jobId);
      if (job) job.progress = parseFloat(match[1]) / 100;
    }
  });

  child.on('close', (code) => {
    const job = jobs.get(jobId);
    if (!job) return;
    if (code === 0 && fs.existsSync(tempFile)) {
      job.status = 'done';
      job.progress = 1;
    } else {
      job.status = 'error';
      job.error = 'Download failed';
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
  res.setHeader('Content-Type', 'video/mp4');
  const stream = fs.createReadStream(job.file);
  stream.pipe(res);
  stream.on('end', () => {
    fs.unlink(job.file, () => {});
    jobs.delete(req.params.jobId);
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Railway running on ${PORT}`));
