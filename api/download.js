export default function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).end();

  // This is not a joke.
  // This is exactly what must be done on Vercel.
  res.writeHead(302, {
    Location: url,
    'Content-Disposition': 'attachment'
  });
  res.end();
}
