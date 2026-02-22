// api/youtube.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const youtubeUrl = req.query.url;
  if (!youtubeUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'YouTube URL is required',
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
    if (!player?.streamingData) throw new Error('No streaming data');

    const formats = [];

    const allFormats = [
      ...(player.streamingData.formats || []),
      ...(player.streamingData.adaptiveFormats || [])
    ];

    for (const f of allFormats) {
      if (!f.url) continue;

      formats.push({
        quality: f.qualityLabel || (f.mimeType.includes('audio') ? 'audio' : 'unknown'),
        mimeType: f.mimeType,
        audio: f.mimeType.includes('audio'),
        download_url: `/api/download?url=${encodeURIComponent(f.url)}`
      });
    }

    if (!formats.length) throw new Error('No formats');

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
  const match = url.match(
    /(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|$)/
  );
  return match ? match[1] : null;
}

async function getPlayerData(videoId) {
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  }).then(r => r.text());

  // 🔥 Robust extraction (works with new layouts)
  const split = html.split('ytInitialPlayerResponse = ');
  if (split.length < 2) return null;

  const jsonText = split[1].split(';</script>')[0];
  return JSON.parse(jsonText);
}
