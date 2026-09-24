// Static server for dist/, fonts/, data/ plus a binary frame sink used by the renderer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

export function serve({ port = 0, onFrame, onLog } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'POST' && url.pathname === '/frame') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        try {
          await onFrame?.(Number(url.searchParams.get('i')), Buffer.concat(chunks), url.searchParams);
          res.writeHead(200).end('ok');
        } catch (e) {
          res.writeHead(500).end(String(e));
        }
        return;
      }
      if (req.method === 'POST' && url.pathname === '/log') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        onLog?.(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(200).end('ok');
        return;
      }
      let rel = decodeURIComponent(url.pathname);
      let base = path.join(root, 'dist');
      if (rel.startsWith('/fonts/')) { base = path.join(root, 'fonts'); rel = rel.slice(6); }
      else if (rel.startsWith('/data/')) { base = path.join(root, 'data'); rel = rel.slice(5); }
      else if (rel.startsWith('/assets/')) { base = path.join(root, 'assets'); rel = rel.slice(7); }
      let file = path.join(base, rel);
      if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8080);
  serve({ port }).then(() => console.log(`http://127.0.0.1:${port}/`));
}
