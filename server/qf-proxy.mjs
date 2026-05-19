import { createServer } from 'node:http';
import { qfRequest } from './qf-core.mjs';

const port = Number(process.env.QF_PROXY_PORT || 8787);

createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/qf/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    const target = req.url.replace(/^\/api\/qf/, '');
    const upstream = await qfRequest(target);
    res.writeHead(upstream.status, { 'content-type': upstream.contentType });
    res.end(upstream.body);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}).listen(port, () => {
  console.log(`QF proxy listening on http://localhost:${port}/api/qf`);
});
