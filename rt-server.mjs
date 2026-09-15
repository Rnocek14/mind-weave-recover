/**
 * Local HTTP shim so a browser with no working root store can still drive the
 * real production bundle against the real backend.
 *
 * Chromium in this sandbox cannot validate ANY certificate — example.com fails
 * exactly like neurospark.co does, with or without the agent proxy. Rather
 * than switch off TLS verification in the browser, Node does the TLS: it
 * serves dist/ (proven byte-identical to what neurospark.co is serving) over
 * plain HTTP on localhost, and forwards every Supabase call over real HTTPS.
 * Same origin throughout, so no CORS to arrange either.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dist');
const SUPABASE = 'https://wjedbpjaiqdxhmjzkcxo.supabase.co';
const PORT = Number(process.env.RT_PORT || 8899);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);

  // ── Supabase passthrough. Node has working TLS; the browser does not. ──
  if (url.pathname.startsWith('/__sb/')) {
    const target = SUPABASE + url.pathname.slice('/__sb'.length) + url.search;
    const headers = { ...req.headers };
    delete headers.host; delete headers.connection; delete headers['accept-encoding'];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
        redirect: 'manual',
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      const out = {};
      upstream.headers.forEach((v, k) => {
        if (['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) return;
        out[k] = v;
      });
      out['access-control-allow-origin'] = '*';
      res.writeHead(upstream.status, out);
      res.end(body);
    } catch (e) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('shim upstream error: ' + e.message);
    }
    return;
  }

  // ── Static dist, with the Supabase origin rewritten to the shim ──
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(ROOT, 'index.html'); // SPA fallback
  }
  try {
    let buf = await readFile(file);
    const ext = path.extname(file);
    if (ext === '.js' || ext === '.html') {
      buf = Buffer.from(buf.toString('utf8').split(SUPABASE).join(`${ORIGIN}/__sb`));
    }
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`rt-server on ${ORIGIN} serving ${ROOT}`));
