// Tiny static server for Playwright smoke tests.
// Mounts the repo root at http://localhost:<PORT>/sep-dashboard/ so that the
// PWA's absolute paths (manifest.json `start_url: /sep-dashboard/`, sw.js
// ASSETS list, etc.) resolve identically to the GitHub Pages deploy.
//
// Zero dependencies — uses only Node stdlib.
//
// The service worker requires a secure context; localhost satisfies that
// without needing HTTPS, so SW registration works in tests.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Strip any trailing separator so containment checks compose cleanly.
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]+$/, '');
const PREFIX = '/sep-dashboard/';
const PORT = Number(process.env.SEP_TEST_PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url ?? '/', `http://localhost:${PORT}`).pathname;
    if (urlPath === '/') {
      res.writeHead(302, { location: PREFIX });
      res.end();
      return;
    }
    if (!urlPath.startsWith(PREFIX)) {
      res.writeHead(404);
      res.end('not under /sep-dashboard/');
      return;
    }
    let rel = urlPath.slice(PREFIX.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const full = resolve(ROOT, rel);
    if (full !== ROOT && !full.startsWith(ROOT + sep)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const st = await stat(full).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(full)] ?? 'application/octet-stream',
      'service-worker-allowed': PREFIX,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[_serve] serving ${ROOT} at http://localhost:${PORT}${PREFIX}`);
});
