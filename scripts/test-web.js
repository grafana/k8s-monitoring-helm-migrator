const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

function createStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const sanitizedPath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.(\/|\\|$))+/, '');
      const relativePath = sanitizedPath === '/' ? 'index.html' : sanitizedPath.replace(/^\/+/, '');
      const resolvedPath = path.join(rootDir, relativePath);

      if (!resolvedPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(resolvedPath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(resolvedPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function runBrowser(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(`${url}/index.html`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors detected:\n', consoleErrors.join('\n'));
    throw new Error('Console errors detected when loading the site.');
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const { server, url } = await createStaticServer(rootDir);
  try {
    await runBrowser(url);
    console.log('Web UI loaded without console errors.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
