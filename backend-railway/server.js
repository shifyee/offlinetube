// src/api/piped-client.js

const RAILWAY_BACKEND = 'https://offlinetube-production.up.railway.app';

function getThumbnail(videoId) {
  return [{ url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` }];
}

export const api = {
  video: async (id) => {
    try {
      const res = await fetch(`${RAILWAY_BACKEND}/api/info?id=${id}`);
      
      if (!res.ok) {
        // Try to parse the detailed error from the backend
        let errorDetail = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.details || errorData.stderr) {
            errorDetail = errorData.stderr || errorData.details;
          }
        } catch (e) {
          // If parsing fails, use the raw text
          errorDetail = await res.text();
        }
        throw new Error(errorDetail);
      }

      const data = await res.json();
      
      if (data.formatStreams) {
        data.formatStreams = data.formatStreams.map(f => ({
          ...f,
          url: `${RAILWAY_BACKEND}${f.url}`
        }));
      }
      
      return data;
    } catch (e) {
      console.error('Video fetch failed:', e);
      throw e; // Re-throw so DownloaderView.vue can catch it and display the message
    }
  },
  
  popular: async () => { return []; },
  search: async () => { return []; },
  channel: async () => { return { author: 'Unknown', latestVideos: [] }; },
  comments: async () => { return []; }
};

export function resolveUrl(u) { return u; }
export function formatBytes(n) { if (!n) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; let i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`; }
export function formatDuration(seconds) { const s = parseInt(seconds, 10) || 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; }
export function bestThumbnail(video) { return video.videoThumbnails?.length ? video.videoThumbnails[0] : null; }
export function pickStream(video, quality = 'highest') { return video.formatStreams?.length ? video.formatStreams[0] : null; }
