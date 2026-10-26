const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(cors());

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // THE FIX: Use the Android client to bypass YouTube blocks
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android" --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    const info = JSON.parse(stdout);

    // Filter for MP4 video with audio (best quality available)
    let formats = info.formats
      .filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none')
      .map(f => ({
        qualityLabel: f.format_note || f.resolution || 'Video',
        contentLength: f.filesize || f.filesize_approx,
        container: 'mp4',
        type: 'video/mp4',
        format_id: f.format_id,
        url: `/api/stream?id=${id}&format_id=${f.format_id}`
      }));

    // If no muxed formats are found, fallback to the best video format
    if (formats.length === 0) {
       formats = info.formats
        .filter(f => f.ext === 'mp4')
        .map(f => ({
          qualityLabel: f.format_note || f.resolution || 'Video',
          contentLength: f.filesize || f.filesize_approx,
          container: 'mp4',
          type: 'video/mp4',
          format_id: f.format_id,
          url: `/api/stream?id=${id}&format_id=${f.format_id}`
        }));
    }

    // Sort highest quality first
    formats.sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel));

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
    return res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, format_id } = req.query;
  if (!id || !format_id) return res.status(400).send('Missing parameters');

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    // Force the android client here as well
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android" -f ${format_id} -g "${url}"`;
    const { stdout } = await execPromise(cmd);
    const directUrl = stdout.trim();

    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(directUrl, { headers });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
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
