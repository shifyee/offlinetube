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
    
    // Use the android_vr client to bypass datacenter blocks and get high-res streams
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android_vr" --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    const info = JSON.parse(stdout);

    // Extract unique video heights
    const availableHeights = new Set();
    info.formats.forEach(f => {
      if (f.vcodec !== 'none' && f.height) {
        availableHeights.add(f.height);
      }
    });

    const sortedHeights = Array.from(availableHeights).sort((a, b) => b - a);

    // If for some reason no heights are found, fall back to a default
    if (sortedHeights.length === 0) sortedHeights.push(360);

    const formats = sortedHeights.map(h => ({
      qualityLabel: `${h}p`,
      height: h,
      container: 'mp4', // We will merge into mp4
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
    return res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
  }
});

app.get('/api/stream', async (req, res) => {
  const { id, height } = req.query;
  if (!id || !height) return res.status(400).send('Missing parameters');

  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // Download the best video up to the requested height, plus best audio, and merge them
    const formatStr = `bv*[height<=${height}]+ba/b[height<=${height}]/b`;
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android_vr" -f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`;
    
    console.log(`Downloading true ${height}p for ${id}...`);
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
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream video', details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Railway yt-dlp backend running on port ${PORT}`);
});
