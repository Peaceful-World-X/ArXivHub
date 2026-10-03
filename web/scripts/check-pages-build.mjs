import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = process.env.ARXIVHUB_DIST ? resolve(process.env.ARXIVHUB_DIST) : fileURLToPath(new URL('../dist/', import.meta.url));
const base = process.env.VITE_BASE || '/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
assert.equal(await readFile(resolve(root, 'index.html'), 'utf8'), await readFile(resolve(root, '404.html'), 'utf8'));
assert.equal((await stat(resolve(root, '.nojekyll'))).isFile(), true);

// Match GitHub Pages: missing route files use 404.html while keeping HTTP 404.
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
    const file = resolve(root, pathname.slice(base.length) || 'index.html');
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html' }).end(await readFile(resolve(root, '404.html')));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  await page.route('https://api.microlink.io/**', (route) => route.abort());
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(url) && /\/(assets|icons)\/|\/favicon\.svg/.test(response.url()) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.route('https://r.jina.ai/**', (route) => route.fulfill({ contentType: 'text/plain', body: route.request().url().includes('arxivtldr.org')
    ? '## TLDR\nThe Transformer uses attention for sequence modeling.'
    : '# Title\nAttention Is All You Need\n# Authors\nAshish Vaswani\n# Abstract\nThe Transformer uses attention for sequence modeling.\n# Categories\ncs.CL\n# Publication Details\n- Published: June 12, 2017\n- arXiv ID: 1706.03762v1\n# BibTeX\n' }));
  await page.route('https://api.datacite.org/**', (route) => route.fulfill({ status: 404, body: 'Unavailable' }));
  assert.equal((await page.goto(url)).status(), 200);
  await page.locator('article').first().waitFor();
  for (const image of await page.locator(`img[src^="${base}"]`).all()) await image.evaluate((img) => img.decode());
  assert.equal((await page.request.get(new URL('favicon.svg', url).href)).status(), 200);
  assert.equal((await page.request.get(new URL('icons/hjfy.svg', url).href)).status(), 200);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `../screenshots/web-folder-pages-${width}.png` });
  }
  assert.equal((await page.goto(new URL('about', url).href)).status(), 404);
  await page.locator('[data-directory-tool]').first().waitFor();
  assert.equal((await page.goto(new URL('p/1706.03762', url).href)).status(), 404);
  await page.getByRole('heading', { name: 'Attention Is All You Need', exact: true }).waitFor();
  await page.getByTestId('paper-tools').waitFor();
  assert.equal(await page.locator('a[href="https://arxiv.org/pdf/1706.03762"]').count(), 1);
  assert.ok(await page.locator(`a[href="${base}"]`).count() > 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '../screenshots/short-domain-paper-1280.png' });
  assert.deepEqual(errors, []);
  console.log(`PASS: ${base} production build, static icons, direct about/paper routes through 404.html, desktop/mobile rendering.`);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
