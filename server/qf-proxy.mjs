import { createServer } from 'node:http';
import { qfRequest } from './qf-core.mjs';

const port = Number(process.env.QF_PROXY_PORT || 8787);

createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json', allow: 'GET' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!req.url?.startsWith('/api/qf/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    const target = req.url.replace(/^\/api\/qf/, '');
    const upstream = await qfRequest(target);
    const headers = {
      'content-type': upstream.contentType,
      // Keep ordinary Content API responses out of browser and intermediary
      // caches. Content Sync is the only permitted offline-copy path for
      // resources that support it.
      'cache-control': 'no-store',
    };
    res.writeHead(upstream.status, headers);
    res.end(upstream.body);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}).listen(port, () => {
  console.log(`QF proxy listening on http://localhost:${port}/api/qf`);
});
