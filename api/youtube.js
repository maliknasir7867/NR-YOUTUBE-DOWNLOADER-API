// api/youtube.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const youtubeUrl = req.query.url;
  if (!youtubeUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'YouTube URL required',
      channel: '@NasirTech765'
    });
  }

  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid YouTube URL',
      channel: '@NasirTech765'
    });
  }

  try {
    const player = await getPlayerData(videoId);
    const streaming = player?.streamingData;

    if (!streaming) throw new Error('No streaming data');

    const formats = [];

    const allFormats = [
      ...(streaming.formats || []),
      ...(streaming.adaptiveFormats || [])
    ];

    for (const f of allFormats) {
      // ✅ Direct URL available (rare but works)
      if (f.url) {
        formats.push(buildFormat(f));
        continue;
      }

      // ⚠️ Ciphered format (cannot decrypt without yt-dlp logic)
      if (f.signatureCipher) {
        const params = new URLSearchParams(f.signatureCipher);
        const url = params.get('url');

        if (url) {
          formats.push({
            quality: f.qualityLabel || 'ciphered',
            mimeType: f.mimeType,
            audio: f.mimeType.includes('audio'),
            note: 'Ciphered stream – may not play',
            download_url: `/api/download?url=${encodeURIComponent(url)}`
          });
        }
      }
    }

    if (!formats.length) {
      return res.json({
        status: 'limited',
        message: 'This video uses encrypted streams',
        solution: 'High quality downloads require signature decryption',
        recommend: 'Use yt-dlp or external tools',
        videoId,
        channel: '@NasirTech765'
      });
    }

    res.json({
      status: 'success',
      videoId,
      title: player.videoDetails.title,
      duration: player.videoDetails.lengthSeconds,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      formats,
      channel: '@NasirTech765'
    });

  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to extract video',
      reason: err.message,
      channel: '@NasirTech765'
    });
  }
}

// ================= HELPERS =================

function extractVideoId(url) {
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}

async function getPlayerData(videoId) {
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  }).then(r => r.text());

  const split = html.split('ytInitialPlayerResponse = ');
  if (split.length < 2) return null;

  return JSON.parse(split[1].split(';</script>')[0]);
}

function buildFormat(f) {
  return {
    quality: f.qualityLabel || (f.mimeType.includes('audio') ? 'audio' : 'unknown'),
    mimeType: f.mimeType,
    audio: f.mimeType.includes('audio'),
    download_url: `/api/download?url=${encodeURIComponent(f.url)}`
  };
}
