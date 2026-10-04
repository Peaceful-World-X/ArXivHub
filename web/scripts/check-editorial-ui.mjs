import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  const tab = (name) => page.getByRole('button', { name, exact: true });
  assert.match(await page.getByTestId('home-stats').innerText(), /74 个网址\s*·\s*15 个工具/);
  assert.deepEqual(await page.locator('button[data-category]').evaluateAll(items=>items.map(el=>el.dataset.category)), ['all','favorites','source','ai','discussion','search','translate','discover','xiv','agent','zotero']);
  assert.equal(await page.locator('article').count(), 89);
  assert.equal(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontSize), '64px');
  assert.equal(await page.locator('h1').evaluate((el) => getComputedStyle(el).letterSpacing), 'normal');
  assert.match(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily), /Noto Serif/);
  assert.equal(await page.locator('#arxiv-query').evaluate((el) => el.getBoundingClientRect().height), 58);
  assert.equal(await page.getByRole('button', { name: '打开论文', exact: true }).evaluate((el) => el.getBoundingClientRect().height), 58);
  assert.equal(await page.locator('.example-links a').count(), 5);
  assert.ok(await page.locator('.example-links a').evaluateAll((links) => links.every((el) => getComputedStyle(el).borderTopWidth === '0px' && getComputedStyle(el).borderRadius === '0px')));
  assert.equal(await tab('全部').evaluate((el) => getComputedStyle(el, '::after').backgroundColor), 'rgb(179, 27, 27)');
  assert.equal(await tab('Agent').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('article').first().evaluate((el) => getComputedStyle(el).borderRadius), '8px');
  await tab('Agent').click();
  assert.equal(await page.locator('article').count(), 6);
  await page.getByPlaceholder('筛选工具').fill('arxiv-mcp');
  assert.equal(await page.locator('article').count(), 1);
  await page.getByPlaceholder('筛选工具').fill('');
  await tab('全部').click();
  for (const [width, height] of [[1440, 1080], [1280, 900], [768, 1024], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok((await page.locator('article').first().boundingBox()).y < height - 20);
    const about = await page.locator('header').getByRole('link', { name: '关于', exact: true }).boundingBox();
    assert.ok(about.height <= 40);
    assert.ok(await page.locator('article').evaluateAll((cards) => cards.every((el) => el.scrollWidth <= el.clientWidth)));
    if (width !== 768) await page.screenshot({ path: `../screenshots/editorial-home-${width}.png`, animations: 'disabled' });
  }
  await tab('Toggle language').click();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.match(await page.getByTestId('home-stats').innerText(), /74 websites\s*·\s*15 tools/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '../screenshots/editorial-home-english-mobile.png', animations: 'disabled' });
  await tab('Toggle language').click();
  await page.locator('#arxiv-query').fill('not a paper');
  await page.getByRole('button', { name: '打开论文', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.locator('#arxiv-query').fill('https://arxiv.org/abs/1706.03762');
  await page.getByRole('button', { name: '打开论文', exact: true }).click();
  await page.waitForURL('**/p/1706.03762');
  assert.deepEqual(errors, []);
  console.log('PASS: serif/sans hierarchy, 58px search controls, accurate counts, text examples, underline filters, 8px cards, visible first-row content, bilingual navigation, search submission and 320-1440px layouts.');
} finally { await browser.close(); }
