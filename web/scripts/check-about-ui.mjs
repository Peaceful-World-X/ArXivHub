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
  assert.equal(await page.getByTestId('inclusion-policy').innerText(), '收录原则：不收录仅付费才能使用的网站。');
  await page.screenshot({ path: '../screenshots/about-inclusion-policy.png', animations: 'disabled' });
  const rows = page.locator('[data-directory-tool]');
  assert.equal(await rows.count(), tools.length);
  assert.equal(await page.locator('[data-directory-tool="zotero-arxiv-reader"], [data-directory-tool="zotarxiv"], [data-directory-tool="zotero-convert-to-arxiv"], [data-directory-tool="alphapulse"], [data-directory-tool="discovery-daily"]').count(),0);
  assert.equal(new Set(await rows.evaluateAll((items) => items.map((item) => item.dataset.directoryTool))).size, tools.length);
  assert.deepEqual(await rows.locator('td:first-child').allTextContents(), tools.map((_, index) => String(index + 1)));
  for (const tool of tools) {
    const row = page.locator(`[data-directory-tool="${tool.id}"]`);
    assert.equal(await row.locator('td').nth(1).innerText(), tool.name);
    assert.equal(await row.locator('td').nth(2).innerText(), tool.url);
    assert.equal(await row.locator('td').nth(2).locator('a').getAttribute('href'), tool.url);
    const description = await row.locator('td').nth(3).innerText();
    assert.ok(description.length > 0);
  }
  assert.deepEqual(await page.locator('table').first().locator('th').allTextContents(), ['序号', '名称', '网址', '简单介绍']);
  // The directory is generated from the same category membership as the home tabs.
  for (const section of await page.locator('[data-directory-category]').all()) {
    const category = await section.getAttribute('data-directory-category');
    const headingCount = Number(await section.locator('div.mb-3 > span').innerText());
    assert.equal(await section.locator('[data-directory-tool]').count(), headingCount, `${category}: directory count matches its heading`);
  }
  assert.equal(await page.locator('#directory-discover [data-directory-tool="emergent-mind"]').count(), 1);
  assert.equal(await page.locator('#directory-discover [data-directory-tool="iarxiv"]').count(), 1);
  assert.equal(await page.locator('#directory-ai-summary [data-directory-tool="emergent-mind"]').count(), 0);
  assert.equal(await page.locator('#directory-discover [data-directory-tool="astro-arxiv-sanity"]').count(),1);
  for (const id of ['arxivsub','paperdigest','arxivtok']) assert.equal(await page.locator(`[data-directory-tool="${id}"]`).count(),1);
  assert.equal(await page.locator('#directory-subscribe [data-directory-tool="paperdigest"]').count(),1);
  assert.equal(await page.locator('[data-directory-category]').last().getAttribute('data-directory-category'),'tool');
  assert.equal(await page.locator('#directory-tool [data-directory-tool="latexml"] td').nth(2).locator('a').getAttribute('href'),'https://latexml.rs/editor');
  const toolGroupLink = page.getByRole('navigation', {name:'分类',exact:true}).locator('a').last();
  assert.equal(await toolGroupLink.getAttribute('href'),'#directory-tool');
  assert.equal(Number((await toolGroupLink.innerText()).match(/\d+$/)?.[0]), await page.locator('#directory-tool [data-directory-tool]').count());
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
  assert.equal(await page.getByTestId('inclusion-policy').innerText(), 'Inclusion policy: Sites that require payment to use are not included.');
  assert.deepEqual(await page.locator('table').first().locator('th').allTextContents(), ['No.', 'Name', 'Website', 'Description']);
  assert.equal(await rows.count(), tools.length);
  assert.equal(await page.locator('[data-directory-category]').last().locator('h3').innerText(),'Tool');
  assert.deepEqual(errors, []);
  console.log(`PASS: all ${tools.length} directory entries, unique numbering, category grouping, working links, bilingual labels and inclusion policy, 320/390/768/1280px layouts and screenshots.`);
} finally { await browser.close(); }
