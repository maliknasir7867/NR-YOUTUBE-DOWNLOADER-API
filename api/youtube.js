// api/youtube.js - COMPLETE VERSION with all extraction methods + your own proxy
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const youtubeUrl = req.query.url;
  const videoId = req.query.videoId;
  const download = req.query.download === 'true';
  const quality = req.query.quality || 'best';

  // =========== DIRECT VIDEO STREAMING ENDPOINT ===========
  if (download && videoId) {
    return await streamVideo(videoId, quality, res);
  }

  if (!youtubeUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'YouTube URL parameter is required',
      example: '?url=https://www.youtube.com/watch?v=VIDEO_ID',
      channel: '@NasirTech765'
    });
  }

  const extractedVideoId = extractVideoId(youtubeUrl);
  if (!extractedVideoId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid YouTube URL',
      channel: '@NasirTech765'
    });
  }

  try {
    // Method 1: Direct YouTube streaming data extraction
    console.log('Trying method 1: Direct extraction...');
    const result1 = await extractYouTubeStreamingData(extractedVideoId);
    if (result1 && result1.formats && result1.formats.length > 0) {
      // Add streaming URLs
      result1.formats = result1.formats.map(format => ({
        ...format,
        stream_url: `/api/youtube?download=true&videoId=${extractedVideoId}&quality=${format.quality}`,
        original_url: format.url
      }));
      
      return res.json({
        ...result1,
        channel: '@NasirTech765',
        proxy_type: 'self-hosted',
        message: 'Use stream_url for guaranteed playback'
      });
    }

    // Method 2: YouTube player API
    console.log('Trying method 2: Player API...');
    const result2 = await getYouTubePlayerData(extractedVideoId);
    if (result2) {
      return res.json({
        ...result2,
        channel: '@NasirTech765',
        proxy_type: 'self-hosted',
        stream_url: `/api/youtube?download=true&videoId=${extractedVideoId}`
      });
    }

    // Method 3: YouTube embed data
    console.log('Trying method 3: Embed data...');
    const result3 = await getYouTubeEmbedData(extractedVideoId);
    if (result3) {
      return res.json({
        ...result3,
        channel: '@NasirTech765',
        proxy_type: 'self-hosted',
        stream_url: `/api/youtube?download=true&videoId=${extractedVideoId}`
      });
    }

    // Method 4: Using invidious instance
    console.log('Trying method 4: Invidious...');
    const result4 = await tryInvidious(extractedVideoId);
    if (result4 && result4.formats && result4.formats.length > 0) {
      result4.formats = result4.formats.map(format => ({
        ...format,
        stream_url: `/api/youtube?download=true&videoId=${extractedVideoId}&quality=${format.quality}`,
        original_url: format.url
      }));
      
      return res.json({
        ...result4,
        channel: '@NasirTech765',
        proxy_type: 'self-hosted'
      });
    }

  } catch (err) {
    console.log('All methods failed:', err.message);
  }

  // Final fallback - provide direct tools
  const directTools = [
    `https://ssyoutube.com/watch?v=${extractedVideoId}`,
    `https://y2mate.com/youtube/${extractedVideoId}`,
    `https://en.y2mate.net/youtube/${extractedVideoId}`,
    `https://yt5s.com/en?q=https://youtube.com/watch?v=${extractedVideoId}`
  ];

  return res.json({
    status: 'info',
    message: 'Direct extraction failed. Use these tools or try our proxy:',
    videoId: extractedVideoId,
    direct_tools: directTools,
    our_proxy: `/api/youtube?download=true&videoId=${extractedVideoId}`,
    quick_method: 'Add "ss" before youtube in URL',
    example: `https://ssyoutube.com/watch?v=${extractedVideoId}`,
    channel: '@NasirTech765'
  });
}

// =========== VIDEO STREAMING FUNCTION (YOUR OWN PROXY) ===========
async function streamVideo(videoId, requestedQuality, res) {
  try {
    console.log(`Streaming video: ${videoId} at quality: ${requestedQuality}`);
    
    // First, get fresh video URLs using all methods
    let videoData = null;
    
    // Try method 1
    videoData = await extractYouTubeStreamingData(videoId);
    
    // Try method 4 if method 1 fails
    if (!videoData || !videoData.formats || videoData.formats.length === 0) {
      videoData = await tryInvidious(videoId);
    }

    if (!videoData || !videoData.formats || videoData.formats.length === 0) {
      return res.status(404).json({ error: 'No video formats found' });
    }

    // Select video format (prefer video-only, then highest quality)
    let selectedFormat = null;
    
    if (requestedQuality !== 'best') {
      // Try to find requested quality
      selectedFormat = videoData.formats.find(f => 
        f.quality === requestedQuality && !f.audio
      );
    }
    
    if (!selectedFormat) {
      // Get best quality video (non-audio)
      selectedFormat = videoData.formats
        .filter(f => !f.audio)
        .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    }
    
    if (!selectedFormat) {
      // Fallback to any format
      selectedFormat = videoData.formats[0];
    }

    if (!selectedFormat || !selectedFormat.url) {
      return res.status(404).json({ error: 'No video URL found' });
    }

    console.log('Selected format:', selectedFormat.quality);
    console.log('Fetching from:', selectedFormat.url);

    // Fetch the video through YOUR server
    const videoResponse = await fetch(selectedFormat.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/mp4,video/*;q=0.9,application/octet-stream;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'Connection': 'keep-alive',
        'Range': 'bytes=0-'
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    // Get video as buffer
    const videoBuffer = await videoResponse.arrayBuffer();
    
    // Set proper headers for video download/streaming
    const filename = `${videoData.title || 'video'}_${selectedFormat.quality || '720p'}.mp4`
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    
    res.setHeader('Content-Type', selectedFormat.type || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', videoBuffer.byteLength);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the video
    return res.send(Buffer.from(videoBuffer));

  } catch (error) {
    console.error('Streaming error:', error);
    return res.status(500).json({ 
      error: 'Failed to stream video',
      details: error.message 
    });
  }
}

// =========== EXTRACTION FUNCTIONS ===========

// Extract video ID from URL
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/,
    /youtube\.com\/embed\/([^&?#]+)/,
    /youtube\.com\/v\/([^&?#]+)/,
    /youtube\.com\/shorts\/([^&?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Method 1: Extract streaming data directly from YouTube
async function extractYouTubeStreamingData(videoId) {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extract video title
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube Video';
      
      // Try to find ytInitialPlayerResponse
      const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});\s*var/);
      if (playerResponseMatch) {
        const playerData = JSON.parse(playerResponseMatch[1]);
        return processYouTubePlayerData(playerData, videoId, title);
      }

      // Try alternative pattern
      const altMatch = html.match(/var ytInitialPlayerResponse = ({.+?});<\/script>/);
      if (altMatch) {
        const playerData = JSON.parse(altMatch[1]);
        return processYouTubePlayerData(playerData, videoId, title);
      }

      // Try window.ytInitialPlayerResponse pattern
      const windowMatch = html.match(/window\["ytInitialPlayerResponse"\] = ({.+?});<\/script>/);
      if (windowMatch) {
        const playerData = JSON.parse(windowMatch[1]);
        return processYouTubePlayerData(playerData, videoId, title);
      }
    }
  } catch (err) {
    console.log('YouTube streaming extraction failed:', err.message);
  }
  return null;
}

function processYouTubePlayerData(playerData, videoId, title) {
  const formats = [];
  
  // Extract streaming formats
  if (playerData.streamingData && playerData.streamingData.formats) {
    playerData.streamingData.formats.forEach(format => {
      if (format.url || format.signatureCipher) {
        const quality = format.qualityLabel || `${format.height}p` || 'unknown';
        let url = format.url;
        
        // Handle signatureCipher if present
        if (format.signatureCipher) {
          const cipherParams = new URLSearchParams(format.signatureCipher);
          url = cipherParams.get('url');
        }
        
        if (url) {
          formats.push({
            quality: quality,
            url: url,
            type: format.mimeType || 'video/mp4',
            width: format.width || null,
            height: format.height || null,
            fps: format.fps || null,
            audio: false
          });
        }
      }
    });
  }

  // Extract adaptive formats (higher quality)
  if (playerData.streamingData && playerData.streamingData.adaptiveFormats) {
    playerData.streamingData.adaptiveFormats.forEach(format => {
      if (format.url || format.signatureCipher) {
        const quality = format.qualityLabel || 
                       (format.audioQuality ? 'audio' : 'unknown') ||
                       `${format.height}p` || 'unknown';
        
        let url = format.url;
        
        if (format.signatureCipher) {
          const cipherParams = new URLSearchParams(format.signatureCipher);
          url = cipherParams.get('url');
        }
        
        if (url) {
          const isAudio = format.mimeType && format.mimeType.includes('audio');
          
          formats.push({
            quality: quality,
            url: url,
            type: format.mimeType || (isAudio ? 'audio/mp4' : 'video/mp4'),
            width: format.width || null,
            height: format.height || null,
            fps: format.fps || null,
            audio: isAudio,
            bitrate: format.bitrate || null
          });
        }
      }
    });
  }

  if (formats.length > 0) {
    // Get video details
    const videoDetails = playerData.videoDetails || {};
    
    // Sort formats by quality (best first)
    formats.sort((a, b) => {
      if (a.audio && !b.audio) return 1;
      if (!a.audio && b.audio) return -1;
      return (b.height || 0) - (a.height || 0);
    });
    
    return {
      status: 'success',
      videoId: videoId,
      title: videoDetails.title || title,
      duration: formatDuration(videoDetails.lengthSeconds),
      author: videoDetails.author || '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      formats: formats,
      source: 'youtube-direct'
    };
  }

  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Method 2: YouTube player API
async function getYouTubePlayerData(videoId) {
  try {
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extract player config
      const configMatch = html.match(/yt\.setConfig\(({.+?})\);/);
      if (configMatch) {
        const config = JSON.parse(configMatch[1]);
        if (config.VIDEO_INFO) {
          const videoInfo = new URLSearchParams(config.VIDEO_INFO);
          const title = videoInfo.get('title') || 'YouTube Video';
          
          return {
            status: 'success',
            videoId: videoId,
            title: title,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            message: 'Video information extracted',
            source: 'youtube-embed'
          };
        }
      }
    }
  } catch (err) {
    console.log('YouTube player API failed:', err.message);
  }
  return null;
}

// Method 3: YouTube embed data
async function getYouTubeEmbedData(videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      return {
        status: 'success',
        videoId: videoId,
        title: data.title || 'YouTube Video',
        author: data.author_name || '',
        thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        source: 'youtube-oembed'
      };
    }
  } catch (err) {
    console.log('YouTube oembed failed:', err.message);
  }
  return null;
}

// Method 4: Invidious (open source YouTube frontend)
async function tryInvidious(videoId) {
  try {
    // Try different invidious instances
    const instances = [
      'https://invidious.snopyta.org',
      'https://yewtu.be',
      'https://invidiou.site',
      'https://invidious.nerdvpn.de',
      'https://inv.riverside.rocks'
    ];

    for (const instance of instances) {
      try {
        const apiUrl = `${instance}/api/v1/videos/${videoId}`;
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          const formats = [];
          
          // Extract video formats
          if (data.formatStreams) {
            data.formatStreams.forEach(stream => {
              if (stream.url) {
                formats.push({
                  quality: stream.quality || 'unknown',
                  url: stream.url,
                  type: stream.type || 'video/mp4',
                  container: stream.container || 'mp4',
                  audio: false
                });
              }
            });
          }
          
          // Extract audio formats
          if (data.adaptiveFormats) {
            data.adaptiveFormats.forEach(stream => {
              if (stream.url && stream.type?.includes('audio')) {
                formats.push({
                  quality: stream.quality || 'audio',
                  url: stream.url,
                  type: stream.type || 'audio/mp4',
                  audio: true,
                  bitrate: stream.bitrate || null
                });
              }
            });
          }

          // Get best thumbnail
          let thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
          if (data.videoThumbnails && data.videoThumbnails.length > 0) {
            const bestThumb = data.videoThumbnails.find(t => t.quality === 'maxres') || 
                            data.videoThumbnails[0];
            thumbnail = bestThumb.url;
          }

          return {
            status: 'success',
            videoId: videoId,
            title: data.title || 'YouTube Video',
            duration: data.duration ? formatDuration(data.duration) : '',
            author: data.author || '',
            thumbnail: thumbnail,
            formats: formats,
            source: 'invidious'
          };
        }
      } catch (err) {
        console.log(`Invidious instance ${instance} failed:`, err.message);
        continue; // Try next instance
      }
    }
  } catch (err) {
    console.log('Invidious all instances failed:', err.message);
  }
  return null;
}
