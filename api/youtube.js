// api/youtube.js - COMPLETE VERSION with WORKING STREAMING
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

  if (!youtubeUrl && !videoId) {
    return res.status(400).json({
      status: 'error',
      message: 'YouTube URL or videoId parameter is required',
      examples: {
        with_url: '?url=https://www.youtube.com/watch?v=VIDEO_ID',
        with_id: '?videoId=VIDEO_ID'
      },
      channel: '@NasirTech765'
    });
  }

  // Get videoId from either parameter
  const finalVideoId = videoId || extractVideoId(youtubeUrl);
  
  if (!finalVideoId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid YouTube URL or videoId',
      channel: '@NasirTech765'
    });
  }

  try {
    // Try all methods to get video info
    let videoData = null;
    let usedMethod = '';

    // Method 1: Direct YouTube streaming data extraction
    console.log('Trying method 1: Direct extraction...');
    videoData = await extractYouTubeStreamingData(finalVideoId);
    if (videoData?.formats?.length > 0) {
      usedMethod = 'youtube-direct';
    }

    // Method 2: Invidious (if method 1 fails)
    if (!videoData?.formats?.length) {
      console.log('Trying method 2: Invidious...');
      videoData = await tryInvidious(finalVideoId);
      if (videoData?.formats?.length > 0) {
        usedMethod = 'invidious';
      }
    }

    // Method 3: YouTube-DL proxy (fallback)
    if (!videoData?.formats?.length) {
      console.log('Trying method 3: YouTube-DL proxy...');
      videoData = await tryYoutubeDlProxy(finalVideoId);
      if (videoData?.formats?.length > 0) {
        usedMethod = 'youtube-dl-proxy';
      }
    }

    // If we have video data with formats
    if (videoData?.formats?.length > 0) {
      // Add streaming URLs for each format
      videoData.formats = videoData.formats.map(format => ({
        ...format,
        // This URL will stream through YOUR server
        stream_url: `/api/youtube?download=true&videoId=${finalVideoId}&quality=${format.quality || 'best'}`,
        // Direct URL (might not work due to CORS)
        direct_url: format.url,
        // Alternative working URLs
        working_urls: [
          `/api/youtube?download=true&videoId=${finalVideoId}&quality=${format.quality || 'best'}`,
          `https://cobalt.tools/api/json?url=https://youtu.be/${finalVideoId}`,
          `https://ssyoutube.com/watch?v=${finalVideoId}`
        ]
      }));

      return res.json({
        status: 'success',
        videoId: finalVideoId,
        title: videoData.title || 'YouTube Video',
        duration: videoData.duration || '',
        author: videoData.author || '',
        thumbnail: videoData.thumbnail || `https://i.ytimg.com/vi/${finalVideoId}/maxresdefault.jpg`,
        formats: videoData.formats,
        source: usedMethod,
        channel: '@NasirTech765',
        message: 'Use stream_url for guaranteed playback',
        quick_download: `/api/youtube?download=true&videoId=${finalVideoId}`
      });
    }

    // If all methods fail, provide working alternatives
    return res.json({
      status: 'success',
      videoId: finalVideoId,
      title: 'Video found - Use alternative downloaders',
      message: 'Direct extraction failed, but these tools WILL work:',
      working_alternatives: [
        {
          name: 'Cobalt Tools (Best Quality)',
          url: `https://cobalt.tools/`,
          instructions: 'Paste this URL: https://youtu.be/' + finalVideoId
        },
        {
          name: 'SSYouTube',
          url: `https://ssyoutube.com/watch?v=${finalVideoId}`,
          instructions: 'Click download'
        },
        {
          name: 'Y2Mate',
          url: `https://www.y2mate.com/youtube/${finalVideoId}`,
          instructions: 'Select quality and download'
        },
        {
          name: 'Our Stream Proxy',
          url: `/api/youtube?download=true&videoId=${finalVideoId}`,
          instructions: 'Try this direct stream (may work)'
        }
      ],
      channel: '@NasirTech765'
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: err.message,
      alternatives: [
        `https://cobalt.tools/ (paste: https://youtu.be/${finalVideoId})`,
        `https://ssyoutube.com/watch?v=${finalVideoId}`,
        `https://www.y2mate.com/youtube/${finalVideoId}`
      ],
      channel: '@NasirTech765'
    });
  }
}

// =========== ENHANCED VIDEO STREAMING FUNCTION ===========
async function streamVideo(videoId, requestedQuality, res) {
  try {
    console.log(`🎥 Streaming video: ${videoId} at quality: ${requestedQuality}`);
    
    // TRY MULTIPLE SOURCES TO GET VIDEO URL
    let videoUrl = null;
    let videoTitle = 'video';
    let contentType = 'video/mp4';

    // SOURCE 1: Try direct YouTube extraction
    console.log('Source 1: Direct YouTube extraction...');
    let videoData = await extractYouTubeStreamingData(videoId);
    
    // SOURCE 2: Try Invidious
    if (!videoData?.formats?.length) {
      console.log('Source 2: Invidious...');
      videoData = await tryInvidious(videoId);
    }

    // SOURCE 3: Try YouTube-DL proxy
    if (!videoData?.formats?.length) {
      console.log('Source 3: YouTube-DL proxy...');
      videoData = await tryYoutubeDlProxy(videoId);
    }

    // If we found formats, select the best one
    if (videoData?.formats?.length > 0) {
      videoTitle = videoData.title || videoId;
      
      // Select format based on quality preference
      let selectedFormat = null;
      
      if (requestedQuality !== 'best') {
        selectedFormat = videoData.formats.find(f => 
          f.quality?.includes(requestedQuality) && !f.audio
        );
      }
      
      if (!selectedFormat) {
        // Get best quality video (non-audio)
        selectedFormat = videoData.formats
          .filter(f => !f.audio)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      }
      
      if (!selectedFormat) {
        selectedFormat = videoData.formats[0]; // Fallback to any format
      }
      
      if (selectedFormat?.url) {
        videoUrl = selectedFormat.url;
        contentType = selectedFormat.type || 'video/mp4';
      }
    }

    // SOURCE 4: Try Cobalt API as fallback
    if (!videoUrl) {
      console.log('Source 4: Cobalt API fallback...');
      try {
        const cobaltRes = await fetch(`https://api.cobalt.tools/api/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `https://youtu.be/${videoId}`,
            videoQuality: '720p',
            audioFormat: 'mp3'
          })
        });
        
        if (cobaltRes.ok) {
          const cobaltData = await cobaltRes.json();
          if (cobaltData.url) {
            videoUrl = cobaltData.url;
            videoTitle = cobaltData.title || videoId;
          }
        }
      } catch (cobaltErr) {
        console.log('Cobalt API failed:', cobaltErr.message);
      }
    }

    // SOURCE 5: Try direct Google Video proxy
    if (!videoUrl) {
      console.log('Source 5: Google Video proxy...');
      try {
        const googleRes = await fetch(`https://www.youtube.com/get_video_info?video_id=${videoId}`);
        if (googleRes.ok) {
          const text = await googleRes.text();
          const params = new URLSearchParams(text);
          const playerResponse = params.get('player_response');
          if (playerResponse) {
            const data = JSON.parse(playerResponse);
            if (data.streamingData?.formats?.length > 0) {
              videoUrl = data.streamingData.formats[0].url;
            }
          }
        }
      } catch (googleErr) {
        console.log('Google proxy failed:', googleErr.message);
      }
    }

    // FINAL FALLBACK: Redirect to known working service
    if (!videoUrl) {
      console.log('All sources failed, redirecting to Cobalt...');
      return res.redirect(`https://cobalt.tools/?url=https://youtu.be/${videoId}`);
    }

    // Stream the video through our server
    console.log('✅ Video URL obtained, streaming...');
    
    // Fetch with proper headers
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com'
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch: ${videoResponse.status}`);
    }

    // Get video buffer
    const videoBuffer = await videoResponse.arrayBuffer();
    
    // Set headers for download
    const filename = `${videoTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${requestedQuality}.mp4`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', videoBuffer.byteLength);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    return res.send(Buffer.from(videoBuffer));

  } catch (error) {
    console.error('❌ Streaming error:', error);
    
    // Last resort: redirect to working site
    return res.redirect(`https://ssyoutube.com/watch?v=${videoId}`);
  }
}

// =========== NEW: YouTube-DL Proxy ===========
async function tryYoutubeDlProxy(videoId) {
  try {
    const proxies = [
      `https://api.cobalt.tools/api/json?url=https://youtu.be/${videoId}`,
      `https://pipedapi.kavin.rocks/streams/${videoId}`,
      `https://inv.riverside.rocks/api/v1/videos/${videoId}`
    ];

    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Handle different response formats
          const formats = [];
          
          if (data.url) {
            // Cobalt format
            return {
              title: data.title || 'Video',
              formats: [{
                quality: '720p',
                url: data.url,
                type: 'video/mp4',
                audio: false
              }]
            };
          } else if (data.videoStreams) {
            // Piped format
            data.videoStreams.forEach(stream => {
              formats.push({
                quality: stream.quality,
                url: stream.url,
                type: 'video/mp4',
                width: stream.width,
                height: stream.height,
                audio: false
              });
            });
            return { title: data.title, formats };
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (err) {
    console.log('YouTube-DL proxy failed:', err.message);
  }
  return null;
}

// =========== EXTRACTION FUNCTIONS ===========

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

async function extractYouTubeStreamingData(videoId) {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (playerMatch) {
        const playerData = JSON.parse(playerMatch[1]);
        return processPlayerData(playerData, videoId);
      }
    }
  } catch (err) {
    console.log('Direct extraction failed:', err.message);
  }
  return null;
}

function processPlayerData(playerData, videoId) {
  const formats = [];
  const videoDetails = playerData.videoDetails || {};
  
  if (playerData.streamingData?.formats) {
    playerData.streamingData.formats.forEach(f => {
      if (f.url) {
        formats.push({
          quality: f.qualityLabel || 'unknown',
          url: f.url,
          type: f.mimeType,
          width: f.width,
          height: f.height,
          fps: f.fps,
          audio: false
        });
      }
    });
  }
  
  if (playerData.streamingData?.adaptiveFormats) {
    playerData.streamingData.adaptiveFormats.forEach(f => {
      if (f.url) {
        const isAudio = f.mimeType?.includes('audio');
        formats.push({
          quality: f.qualityLabel || (isAudio ? 'audio' : 'unknown'),
          url: f.url,
          type: f.mimeType,
          width: f.width,
          height: f.height,
          fps: f.fps,
          audio: isAudio,
          bitrate: f.bitrate
        });
      }
    });
  }
  
  return {
    title: videoDetails.title || 'YouTube Video',
    duration: formatDuration(videoDetails.lengthSeconds),
    author: videoDetails.author || '',
    formats: formats
  };
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function tryInvidious(videoId) {
  const instances = [
    'https://inv.riverside.rocks',
    'https://yewtu.be',
    'https://invidious.snopyta.org'
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        const formats = [];
        
        if (data.formatStreams) {
          data.formatStreams.forEach(s => {
            formats.push({
              quality: s.quality,
              url: s.url,
              type: s.type,
              audio: false
            });
          });
        }
        
        return {
          title: data.title,
          duration: data.duration ? formatDuration(data.duration) : '',
          author: data.author,
          formats: formats
        };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}
