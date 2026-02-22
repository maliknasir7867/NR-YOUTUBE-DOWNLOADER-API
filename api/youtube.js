export default async function handler(req, res) {
  const videoId = extractId(req.query.url);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text());

  const json = html.split('ytInitialPlayerResponse = ')[1]?.split(';</script>')[0];
  if (!json) {
    return res.status(500).json({ error: 'Extraction failed' });
  }

  const data = JSON.parse(json);
  const formats = [];

  for (const f of [
    ...(data.streamingData?.formats || []),
    ...(data.streamingData?.adaptiveFormats || [])
  ]) {
    if (!f.url) continue;

    formats.push({
      quality: f.qualityLabel || 'audio',
      download: `/api/download?url=${encodeURIComponent(f.url)}`
    });
  }

  if (!formats.length) {
    return res.json({
      status: 'limited',
      message: 'Streams are encrypted (normal for YouTube)'
    });
  }

  res.json({
    status: 'success',
    title: data.videoDetails.title,
    formats
  });
}

function extractId(url = '') {
  const m = url.match(/([a-zA-Z0-9_-]{11})/);
  return m?.[1];
}
