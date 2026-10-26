// src/api/piped-client.js
import { Innertube, ClientType } from 'youtubei.js';

const WORKER_URL = 'https://offline-tube-cors-proxy.logan-storrs.workers.dev';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.nosebs.ru',
  'https://pipedapi-libre.kavin.rocks',
  'https://api.piped.private.coffee'
];

async function fetchProxy(path) {
  let lastError;
  for (const instance of PIPED_INSTANCES) {
    try {
      const targetUrl = `${instance}${path}`;
      const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); 
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`All Piped instances failed`);
}

function getYTClient() {
  return Innertube.create({
    client_type: ClientType.TV_EMBEDDED,
    retrieve_player: false,
    generate_session_locally: true,
    fetch: async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
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

function mapPipedVideo(v) {
  const id = v.url ? v.url.replace('/watch?v=', '') : v.videoId;
  return {
    videoId: id,
    title: v.title || 'Untitled',
    author: v.uploaderName || v.uploader || 'Unknown',
    authorId: v.uploaderUrl ? v.uploaderUrl.replace('/channel/', '') : '',
    authorAvatar: v.uploaderAvatar || null,
    lengthSeconds: v.duration || 0,
    videoThumbnails: getThumbnail(id)
  };
}

export const api = {
  popular: async () => {
    try {
      const data = await fetchProxy('/trending?region=US');
      if (Array.isArray(data)) return data.map(mapPipedVideo);
    } catch (e) {}
    
    // Fallback to youtubei.js search
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
      const data = await fetchProxy(`/search?q=${encodeURIComponent(q)}&filter=${type === 'video' ? 'videos' : 'channels'}`);
      return (data.items || []).map(mapPipedVideo);
    } catch (e) {
      try {
        const yt = await getYTClient();
        const results = await yt.search(q, { type });
        return results.videos.map(v => ({
          videoId: v.id, title: v.title?.toString() || '', author: v.author?.name || '',
          authorId: v.author?.id || '', authorAvatar: v.author?.thumbnails?.[0]?.url || null,
          lengthSeconds: v.duration?.seconds || 0, videoThumbnails: getThumbnail(v.id)
        }));
      } catch (e) { return []; }
    }
  },

  channel: async (id) => {
    try {
      const data = await fetchProxy(`/channel/${id}`);
      return {
        author: data.name, authorId: id,
        authorThumbnails: data.avatarUrl ? [{ url: data.avatarUrl }] : [],
        subCount: data.subscriberCount || '0', description: data.description || '',
        latestVideos: (data.relatedStreams || []).map(mapPipedVideo)
      };
    } catch (e) { 
      return { author: 'Unknown', authorId: id, authorThumbnails: [], subCount: '0', description: '', latestVideos: [] }; 
    }
  },

  video: async (id) => {
    // 1. Try Piped (Best for streams)
    try {
      const data = await fetchProxy(`/streams/${id}`);
      const proxyBase = data.proxyUrl || '';
      const formats = (data.videoStreams || [])
        .filter(s => !s.videoOnly && s.url)
        .map(s => {
          const fullUrl = s.url.startsWith('http') ? s.url : `${proxyBase}${s.url}`;
          return { url: fullUrl, qualityLabel: s.quality, contentLength: s.contentLength, container: 'mp4', type: 'video/mp4' };
        });
      const related = (data.relatedStreams || []).map(mapPipedVideo).slice(0, 10);

      return { 
        videoId: id, title: data.title, author: data.uploader, authorId: data.uploaderUrl?.replace('/channel/', ''), 
        authorAvatar: data.uploaderAvatar || null, lengthSeconds: data.duration, description: data.description, 
        videoThumbnails: getThumbnail(id), formatStreams: formats, related
      };
    } catch (e) {}

    // 2. Fallback to youtubei.js (Backup for streams)
    try {
      const yt = await getYTClient();
      const info = await yt.getInfo(id);
      const formats = (info.streaming_data?.formats || [])
        .filter(f => f.url)
        .map(f => ({ url: f.url, qualityLabel: f.quality_label, contentLength: f.content_length, container: f.container, type: 'video/mp4' }));
      
      return { 
        videoId: id, title: info.basic_info.title, author: info.basic_info.author, authorId: info.basic_info.channel_id, 
        authorAvatar: info.basic_info.author?.thumbnails?.[0]?.url || null, lengthSeconds: info.basic_info.duration, 
        description: info.basic_info.short_description, videoThumbnails: getThumbnail(id), formatStreams: formats, related: []
      };
    } catch (e) {}

    // 3. Ultimate Fallback: oEmbed (Guaranteed metadata, no streams)
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (res.ok) {
        const data = await res.json();
        return {
          videoId: id, title: data.title, author: data.author_name, authorId: '',
          authorAvatar: `https://ui-avatars.com/api/?name=${data.author_name?.charAt(0)}&background=282828&color=fff`,
          lengthSeconds: 0, description: 'Metadata loaded via fallback.',
          videoThumbnails: [{ url: data.thumbnail_url }], formatStreams: [], related: []
        };
      }
    } catch (e) {}

    return { videoId: id, title: 'Video', author: 'Unknown', authorId: '', authorAvatar: null, lengthSeconds: 0, description: '', videoThumbnails: getThumbnail(id), formatStreams: [], related: [] };
  },

  comments: async (id) => {
    try {
      const data = await fetchProxy(`/comments/${id}`);
      return (data.comments || []).map(c => ({ commentId: c.id, author: c.author, content: c.commentText }));
    } catch (e) { return []; }
  }
};

export function resolveUrl(u) { return u; }
export function formatBytes(n) { if (!n) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; let i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`; }
export function formatDuration(seconds) { const s = parseInt(seconds, 10) || 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; }
export function bestThumbnail(video) { return video.videoThumbnails?.length ? video.videoThumbnails[0] : null; }
export function pickStream(video, quality = 'highest') { return video.formatStreams?.length ? video.formatStreams[0] : null; }
