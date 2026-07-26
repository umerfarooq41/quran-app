import { qfRequest } from '../server/qf-core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawPath = req.query.path;

    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({
        error: 'Missing Quran Foundation API path',
      });
    }

    const normalizedPath = rawPath.replace(/^\/+/, '');
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;

      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, String(item)));
      } else if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }

    const queryString = query.toString();
    const upstream = await qfRequest(
      `/${normalizedPath}${queryString ? `?${queryString}` : ''}`,
      process.env,
    );

    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.contentType || 'application/json',
    );

    if (upstream.ok) {
      res.setHeader(
        'Cache-Control',
        'public, s-maxage=86400, stale-while-revalidate=604800',
      );
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.send(upstream.body);
  } catch (error) {
    console.error('Quran Foundation proxy error:', error);

    return res.status(500).json({
      error: 'Quran Foundation request failed',
      message: error?.message || 'Unknown error',
    });
  }
}
