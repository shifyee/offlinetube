// src/api/piped-client.js
import { Innertube, ClientType } from 'youtubei.js';

const WORKER_URL = 'https://offline-tube-cors-proxy.logan-storrs.workers.dev';

// Setup the youtubei.js client to route through your Worker
function getYTClient() {
  return Innertube.create({
    client_type: ClientType.IOS, // IOS client gives the best muxed streams (up to 720p/1080p)
    retrieve_player: false,
    generate_session_locally: true,
    fetch: async (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input?.url || input?.href);
      if (!url || url === 'undefined') return new Response('{}', { status: 200 });
      
      const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
      const options = { ...init };
      if (options.method === 'GET' || options.method === 'HEAD' || !options.method) {
        delete options.body;
      }
      options.credentials = 'omit';
      return fetch(proxyUrl, options);
    }
  });
}

function getThumbnail(videoId) {
  return [{ url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` }];
}

export const api = {
  popular: async () => {
    try {
      const yt = await getYTClient();
      const results = await yt.search('trending videos', { type: 'video' });
      return results.videos.map(v => ({
        videoId: v.id, title: v.title?.toString() || '', author: v.author?.name || '',
        authorId: v.author?.id || '', authorAvatar: v.author?.thumbnails?.[0]?.url || null,
        lengthSeconds: v.duration?.seconds || 0, videoThumbnails: getThumbnail(v.id)
      }));
    } catch (e) { return []; }
  },

  search: async (q, type = 'video') => {
    try {
      const yt = await getYTClient();
      const results = await yt.search(q, { type });
      return (results.videos || []).map(v => ({
        videoId: v.id, title: v.title?.toString() || '', author: v.author?.name || '',
        authorId: v.author?.id || '', authorAvatar: v.author?.thumbnails?.[0]?.url || null,
        lengthSeconds: v.duration?.seconds || 0, videoThumbnails: getThumbnail(v.id)
      }));
    } catch (e) { return []; }
  },

  channel: async (id) => {
    try {
      const yt = await getYTClient();
      const channel = await yt.getChannel(id);
      const videos = await channel.videos.next();
      return {
        author: channel.header.author.name, authorId: id,
        authorThumbnails: channel.header.author.thumbnails || [],
        subCount: channel.header.subscriber_count?.text || 'Unknown',
        description: channel.metadata.description || '',
        latestVideos: videos.videos.map(v => ({
          videoId: v.id, title: v.title?.toString() || '', author: v.author?.name || '',
          authorId: v.author?.id || '', authorAvatar: v.author?.thumbnails?.[0]?.url || null,
          lengthSeconds: v.duration?.seconds || 0, videoThumbnails: getThumbnail(v.id)
        }))
      };
    } catch (e) { return { author: 'Unknown', authorId: id, authorThumbnails: [], subCount: '0', description: '', latestVideos: [] }; }
  },

  video: async (id) => {
    try {
      // Directly use youtubei.js to get metadata and streams
      const yt = await getYTClient();
      const info = await yt.getInfo(id);
      
      const formats = (info.streaming_data?.formats || [])
        .filter(f => f.url)
        .map(f => ({ 
          url: f.url, 
          qualityLabel: f.quality_label, 
          contentLength: f.content_length, 
          container: f.container, 
          type: 'video/mp4' 
        }));

      const related = (info.watch_next_feed || [])
        .filter(v => v.type === 'CompactVideo')
        .map(v => ({
          videoId: v.id, title: v.title?.toString() || '', author: v.author?.name || '',
          authorId: v.author?.id || '', authorAvatar: v.author?.thumbnails?.[0]?.url || null,
          lengthSeconds: v.duration?.seconds || 0, videoThumbnails: getThumbnail(v.id)
        })).slice(0, 10);

      return { 
        videoId: id, 
        title: info.basic_info.title, 
        author: info.basic_info.author, 
        authorId: info.basic_info.channel_id, 
        authorAvatar: info.basic_info.author?.thumbnails?.[0]?.url || null,
        lengthSeconds: info.basic_info.duration, 
        description: info.basic_info.short_description, 
        videoThumbnails: getThumbnail(id), 
        formatStreams: formats,
        related
      };
    } catch (e) {
      console.error('Video fetch failed:', e);
      // Only fall back to oEmbed if the YouTube API completely fails
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (res.ok) {
          const data = await res.json();
          return {
            videoId: id, title: data.title, author: data.author_name, authorId: '',
            authorAvatar: null, lengthSeconds: 0, description: 'Metadata loaded via fallback.',
            videoThumbnails: [{ url: data.thumbnail_url }], formatStreams: [], related: []
          };
        }
      } catch (err) {}
      
      return { videoId: id, title: 'Video', author: 'Unknown', authorId: '', authorAvatar: null, lengthSeconds: 0, description: '', videoThumbnails: getThumbnail(id), formatStreams: [], related: [] };
    }
  },

  comments: async (id) => {
    try {
      const yt = await getYTClient();
      const comments = await yt.getComments(id);
      return comments.contents.map(c => ({ commentId: c.comment_id, author: c.author.name, content: c.content.toString() }));
    } catch (e) { return []; }
  }
};

export function resolveUrl(u) { return u; }
export function formatBytes(n) { if (!n) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; let i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`; }
export function formatDuration(seconds) { const s = parseInt(seconds, 10) || 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; }
export function bestThumbnail(video) { return video.videoThumbnails?.length ? video.videoThumbnails[0] : null; }
export function pickStream(video, quality = 'highest') { return video.formatStreams?.length ? video.formatStreams[0] : null; }
