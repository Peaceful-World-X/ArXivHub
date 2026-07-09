import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base);
  const categories = [['discussion', '讨论'], ['ai', 'AIChat'], ['search', '检索'], ['translate', '翻译']];
  const home = new Map();
  for (const [id, label] of categories) {
    const tab = page.getByRole('button', { name: label, exact: true });
    await tab.click();
    const ids = await page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
    assert.equal(ids.length, Number(await tab.locator('[data-category-count]').innerText()));
    home.set(id, ids);
  }
  await page.goto(new URL('p/2608.15875', base).href);
  const tools = page.getByTestId('paper-tools');
  await tools.waitFor();
  for (const [id, label] of categories) {
    const ids = await tools.locator(`#paper-tools-${id} [data-tool-id]`).evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
    assert.deepEqual(ids, home.get(id), `${label}: the same items in the same order`);
    assert.equal(Number(await tools.getByRole('button', { name: label, exact: true }).locator('[data-category-count]').innerText()), ids.length);
  }
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await tools.getByRole('navigation').screenshot({ path: `../screenshots/paper-matching-counts-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await tools.locator('#paper-tools-ai').screenshot({ path: '../screenshots/paper-aichat-complete.png' });
  await tools.locator('#paper-tools-translate').screenshot({ path: '../screenshots/paper-translation-complete.png' });
  console.log('PASS: paper and home categories have identical counts, members, and ordering; desktop/mobile screenshots.');
} finally { await browser.close(); }
