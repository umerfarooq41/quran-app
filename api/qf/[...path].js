import { qfRequest } from '../../server/qf-core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue;
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    }

    const target = `/${rawPath}${query.toString() ? `?${query}` : ''}`;
    const upstream = await qfRequest(target, process.env);

    res.status(upstream.status);
    res.setHeader('content-type', upstream.contentType || 'application/json');
    if (upstream.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    }
    return res.send(upstream.body);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
