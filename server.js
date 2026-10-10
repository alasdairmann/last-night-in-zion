// Tiny static server: `npm start` serves this folder on http://localhost:4174
import http from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 4174;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const LOGS = join(ROOT, 'logs');

http.createServer(async (req, res) => {
  // v1.2 run logging: the game POSTs JSON lines here; each run is one file in logs/
  if (req.method === 'POST' && req.url.startsWith('/log')) {
    const run = (new URL(req.url, 'http://x').searchParams.get('run') || 'unknown').replace(/[^\w.-]/g, '');
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 8e6) break; }
    try { await mkdir(LOGS, { recursive: true }); await appendFile(join(LOGS, `${run}.jsonl`), body.endsWith('\n') ? body : body + '\n'); res.writeHead(204); }
    catch { res.writeHead(500); }
    return res.end();
  }
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`Last Night in Zion on http://localhost:${PORT}`));
