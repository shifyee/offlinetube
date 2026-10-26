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
    // Just get basic metadata, no need for the full format dump here
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android" --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
    const info = JSON.parse(stdout);

    // We present these standard options to the user. 
    // The backend will figure out how to merge them on the fly.
    const formats = [
      { qualityLabel: '1080p (HD)', format_id: '1080', container: 'mp4', type: 'video/mp4' },
      { qualityLabel: '720p (HD)', format_id: '720', container: 'mp4', type: 'video/mp4' },
      { qualityLabel: '480p', format_id: '480', container: 'mp4', type: 'video/mp4' },
      { qualityLabel: '360p', format_id: '360', container: 'mp4', type: 'video/mp4' }
    ].map(f => ({
      ...f,
      url: `/api/stream?id=${id}&quality=${f.format_id}`
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
  const { id, quality } = req.query;
  if (!id || !quality) return res.status(400).send('Missing parameters');

  // Create a unique temp filename
  const tempFile = path.join('/tmp', `ytdl-${crypto.randomBytes(4).toString('hex')}.mp4`);

  try {
    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // The magic command: download best video up to requested quality, best audio, and merge them
    const formatStr = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`;
    const cmd = `yt-dlp --extractor-args "youtube:player_client=android" -f "${formatStr}" --merge-output-format mp4 -o "${tempFile}" "${url}"`;
    
    console.log(`Downloading ${quality}p for ${id}...`);
    await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 }); // Increase buffer for large merges

    // Check if file exists
    if (!fs.existsSync(tempFile)) {
      throw new Error('Download failed, file not found');
    }

    const stat = fs.statSync(tempFile);
    
    // Stream the file to the client
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    const readStream = fs.createReadStream(tempFile);
    readStream.pipe(res);

    // Clean up the file after sending
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
