// Servidor estático local + proxy de /api/* a producción (nutrovia.es)
// Uso: node _static_server.js  → http://localhost:8123
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8123;
const ROOT = path.join(__dirname, 'public');
const API_HOST = 'nutrovia.es';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ── Proxy /api/* → producción ─────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    const headers = { ...req.headers, host: API_HOST };
    delete headers.origin;   // evitar checks de CORS en Vercel
    delete headers.referer;
    delete headers['accept-encoding']; // dejar que node maneje la codificación
    const proxyReq = https.request(
      {
        hostname: API_HOST,
        port: 443,
        path: url.pathname + url.search,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const outHeaders = { ...proxyRes.headers, 'Access-Control-Allow-Origin': '*' };
        res.writeHead(proxyRes.statusCode, outHeaders);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // ── Estáticos ─────────────────────────────────────────────
  let filePath = path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}  (api/* → https://${API_HOST}/api/*)`);
});
