import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/');
  const tools = await page.locator('article').evaluateAll((cards) => cards.map((card) => ({
    id: card.dataset.toolId, name: card.querySelector('h3').textContent,
    url: card.querySelector('a').getAttribute('href'), description: card.querySelector('p').textContent,
  })));
  await page.locator('header').getByRole('link', { name: '关于', exact: true }).click();
  await page.getByRole('heading', { name: '关于 ArXiv Hub · 论桥', exact: true }).waitFor();
  const rows = page.locator('[data-directory-tool]');
  assert.equal(await rows.count(), tools.length);
  assert.equal(new Set(await rows.evaluateAll((items) => items.map((item) => item.dataset.directoryTool))).size, tools.length);
  assert.deepEqual(await rows.locator('td:first-child').allTextContents(), tools.map((_, index) => String(index + 1)));
  for (const tool of tools) {
    const row = page.locator(`[data-directory-tool="${tool.id}"]`);
    assert.equal(await row.locator('td').nth(1).innerText(), tool.name);
    assert.equal(await row.locator('td').nth(2).innerText(), tool.url);
    assert.equal(await row.locator('td').nth(2).locator('a').getAttribute('href'), tool.url);
    const description = await row.locator('td').nth(3).innerText();
    assert.ok(description.length > 0 && description.length <= 24);
  }
  assert.deepEqual(await page.locator('table').first().locator('th').allTextContents(), ['序号', '名称', '网址', '简单介绍']);
  assert.equal(await page.locator('[data-directory-tool="sciencecast"] td').nth(3).innerText(),'科研论文视频讲解');
  assert.equal(await page.locator('#directory-discover [data-directory-tool="emergent-mind"]').count(), 1);
  assert.equal(await page.locator('#directory-discover [data-directory-tool="iarxiv"]').count(), 1);
  assert.equal(await page.locator('#directory-ai [data-directory-tool="emergent-mind"]').count(), 0);
  assert.equal(await page.getByRole('columnheader', { name: '核验', exact: true }).count(), 0);
  for (const link of await page.getByRole('navigation', { name: '分类', exact: true }).locator('a').all()) {
    const href = await link.getAttribute('href');
    assert.equal(await page.locator(href).count(), 1);
  }
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await rows.evaluateAll((items) => items.every((row) => row.scrollWidth <= row.clientWidth)));
    if (width === 1280 || width === 390) await page.screenshot({ path: `../screenshots/about-directory-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('navigation', { name: '分类', exact: true }).getByRole('link', { name: /^发现/ }).click();
  assert.ok(Math.abs((await page.locator('#directory-discover').boundingBox()).y - 24) < 2);
  await page.locator('#directory-discover').screenshot({ path: '../screenshots/about-discovery-group.png' });
  await page.getByRole('button', { name: 'Toggle language', exact: true }).click();
  await page.getByRole('heading', { name: 'About ArXiv Hub · 论桥', exact: true }).waitFor();
  assert.deepEqual(await page.locator('table').first().locator('th').allTextContents(), ['No.', 'Name', 'Website', 'Description']);
  assert.equal(await rows.count(), tools.length);
  assert.deepEqual(errors, []);
  console.log(`PASS: all ${tools.length} directory entries, unique numbering, category grouping, working links, bilingual labels, 320/390/768/1280px layouts and screenshots.`);
} finally { await browser.close(); }
