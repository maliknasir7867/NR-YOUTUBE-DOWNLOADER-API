// api/download.js
export default async function handler(req, res) {
  const fileUrl = req.query.url;
  if (!fileUrl) return res.status(400).end();

  try {
    const response = await fetch(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="video.mp4"'
    );
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') || 'application/octet-stream'
    );

    response.body.pipe(res);

  } catch (e) {
    res.status(500).end('Download failed');
  }
}
