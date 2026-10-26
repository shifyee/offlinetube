const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(cors());

// Cache direct URLs to prevent running yt-dlp for every single chunk
const streamCache = new Map();

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    // --dump-json fetches metadata without downloading
    const { stdout } = await execPromise(`yt-dlp --dump-json --no-playlist "${url}"`, { maxBuffer: 1024 * 1024 * 10 });
    const info = JSON.parse(stdout);

    // Filter for MP4 video with audio (best quality available)
    const formats = info.formats
      .filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none')
      .map(f => ({
        qualityLabel: f.format_note || f.resolution || 'Video',
        contentLength: f.filesize || f.filesize_approx,
        container: 'mp4',
        type: 'video/mp4',
        format_id: f.format_id,
        // We point the URL back to our own proxy endpoint!
        url: `/api/stream?id=${id}&format_id=${f.format_id}`
      }));

    // Sort highest quality first
    formats.sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel));

    return res.json({
      videoId: id,
      title: info.title,
      author: info.uploader,
      authorId: info.channel_id,
      authorAvatar: null, // yt-dlp doesn't always provide this easily
      lengthSeconds: info.duration,
      description: info.description,
      videoThumbnails: [{ url: info.thumbnail }],
      formatStreams: formats
    });
  } catch (error) {
    console.error('yt-dlp metadata error:', error);
    return res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, format_id } = req.query;
  if (!id || !format_id) return res.status(400).send('Missing parameters');

  const cacheKey = `${id}_${format_id}`;
  let directUrl = streamCache.get(cacheKey);

  try {
    // 1. Get the direct URL using yt-dlp if not cached
    if (!directUrl || directUrl.expires < Date.now()) {
      const url = `https://www.youtube.com/watch?v=${id}`;
      const { stdout } = await execPromise(`yt-dlp -f ${format_id} -g "${url}"`);
      directUrl = { url: stdout.trim(), expires: Date.now() + 1000 * 60 * 60 }; // Cache for 1 hour
      streamCache.set(cacheKey, directUrl);
    }

    // 2. Fetch the video from YouTube's servers
    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range; // Forward the Range header for chunking
    }

    const response = await fetch(directUrl.url, { headers });

    // 3. Pipe the response back to the browser
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    // Expose headers needed for the downloader
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error('yt-dlp stream error:', error);
    if (!res.headersSent) res.status(500).send('Failed to stream video');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Railway yt-dlp backend running on port ${PORT}`);
});
