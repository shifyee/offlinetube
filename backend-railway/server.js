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

app.get('/api/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video ID' });

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // 1. Get metadata and all available formats using the ios client
    const cmd = `yt-dlp --extractor-args "youtube:player_client=ios" --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    const info = JSON.parse(stdout);

    // 2. Extract unique video heights (resolutions) from the available formats
    const availableHeights = new Set();
    info.formats.forEach(f => {
      if (f.vcodec !== 'none' && f.height) {
        availableHeights.add(f.height);
      }
    });

    // 3. Sort them from highest to lowest
    const sortedHeights = Array.from(availableHeights).sort((a, b) => b - a);

    // 4. Build the UI options dynamically based on what actually exists
    const formats = sortedHeights.map(h => ({
      qualityLabel: `${h}p`,
      height: h,
      container: 'mp4', // We will force merge to MP4
      type: 'video/mp4',
      url: `/api/stream?id=${id}&height=${h}`
    }));

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
  const { id, height } = req.query;
  if (!id || !height) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // THE FIX: 
    // bv* means "best video regardless of codec"
    // ba means "best audio"
    // The slash / means "or fallback to best muxed if above fails"
    // We use the ios client to get high-quality streams
    const formatStr = `bv*[height<=${height}]+ba/b[height<=${height}]/b`;
    
    // Download, merge into an MP4 container, and save to temp file
    const cmd = `yt-dlp --extractor-args "youtube:player_client=ios" -f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`;
    
    console.log(`Downloading true ${height}p for ${id}...`);
    
    // Allow up to 5 minutes for large downloads/merges
    await execPromise(cmd, { maxBuffer: 1024 * 1024 * 100, timeout: 300000 });

    if (!fs.existsSync(tempFile)) {
      throw new Error('Download failed, file not found');
    }

    const stat = fs.statSync(tempFile);
    console.log(`Success! File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const readStream = fs.createReadStream(tempFile);
    readStream.pipe(res);

    readStream.on('end', () => {
      fs.unlink(tempFile, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    });

  } catch (error) {
    console.error('yt-dlp stream error:', error);
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (!res.headersSent) res.status(500).send('Failed to stream video');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Railway yt-dlp backend running on port ${PORT}`);
});
