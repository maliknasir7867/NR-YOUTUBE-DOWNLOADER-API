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
    if (!player) throw new Error();

    const formats = [];

    for (const f of player.streamingData.adaptiveFormats || []) {
      if (!f.url) continue;

      formats.push({
        quality: f.qualityLabel || (f.mimeType.includes('audio') ? 'audio' : 'unknown'),
        mimeType: f.mimeType,
        audio: f.mimeType.includes('audio'),
        download_url: `/api/download?url=${encodeURIComponent(f.url)}`
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

  } catch {
    res.status(500).json({
      status: 'error',
      message: 'Failed to extract video',
      channel: '@NasirTech765'
    });
  }
}

function extractVideoId(url) {
  const m = url.match(/(v=|\/)([0-9A-Za-z_-]{11})/);
  return m ? m[2] : null;
}

async function getPlayerData(videoId) {
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());

  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
  if (!match) return null;

  return JSON.parse(match[1]);
}
