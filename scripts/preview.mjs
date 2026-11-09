import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname, join } from 'node:path';
const root = resolve('u-t-on');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.zip': 'application/zip', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const isFile = async path => { try { return (await stat(path)).isFile(); } catch { return false; } };
// Mirrors the production host: /about.html -> 307 /about, /about serves about.html,
// /articles/ serves articles/index.html.
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('.html')) {
      const clean = pathname.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
      res.writeHead(307, { Location: (clean || '/') + url.search }).end(); return;
    }
    const base = resolve(root, '.' + pathname);
    if (base !== root && !base.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    let path = pathname.endsWith('/') ? join(base, 'index.html') : base;
    if (!pathname.endsWith('/') && !await isFile(path)) {
      if (await isFile(base + '.html')) path = base + '.html';
      else if (await isFile(join(base, 'index.html'))) { res.writeHead(307, { Location: pathname + '/' + url.search }).end(); return; }
    }
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
