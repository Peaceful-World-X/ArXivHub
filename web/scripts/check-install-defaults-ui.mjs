import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const defaults = JSON.parse(readFileSync(new URL('../src/lib/default-tool-orders.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  const ids = () => page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
  assert.ok(defaults.all?.length > 0, 'A real browser order snapshot must be captured before release');
  assert.deepEqual(await ids(), defaults.all);
  for (const [category, name] of [['ai', 'AIChat'], ['search', '检索'], ['discussion', '讨论'], ['zotero', 'Zotero']]) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.deepEqual(await ids(), defaults[category]);
  }
  const trigger = page.locator('header').getByRole('button', { name: '安装浏览器插件', exact: true });
  assert.equal(await trigger.evaluate((el) => el === el.parentElement.lastElementChild), true);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '安装浏览器插件' });
    await dialog.waitFor();
    assert.deepEqual(await dialog.locator('a').evaluateAll((links) => links.map((link) => link.href)), [
      'https://www.tampermonkey.net/',
      'https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js',
    ]);
    assert.equal(await dialog.locator('a svg.lucide-arrow-up-right').count(), 2);
    assert.ok(await dialog.locator('a').evaluateAll((links) => links.every((link) => getComputedStyle(link).borderWidth === '0px')));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width !== 320) await dialog.screenshot({ path: `../screenshots/install-guide-${width}.png` });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
  }
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await page.getByRole('button', { name: 'Install browser extension' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Install script' }).waitFor();
  await page.getByRole('button', { name: 'Close installation guide' }).click();
  await page.getByRole('button', { name: 'Toggle language' }).click();
  const custom = [...defaults.all].reverse();
  await page.evaluate((custom) => {
    const saved = JSON.parse(localStorage.getItem('arxiv-hub'));
    saved.state.toolOrders.all = custom;
    localStorage.setItem('arxiv-hub', JSON.stringify(saved));
  }, custom);
  await page.reload();
  assert.deepEqual(await ids(), custom);
  await page.getByRole('button', { name: '调整顺序', exact: true }).click();
  if (!process.env.ARXIVHUB_PRODUCTION) assert.equal(await page.getByRole('button', { name: '保存为发布默认顺序', exact: true }).count(), 1);
  else assert.equal(await page.getByRole('button', { name: '保存为发布默认顺序', exact: true }).count(), 0);
  await page.getByRole('button', { name: '恢复默认顺序', exact: true }).click();
  assert.deepEqual(await ids(), defaults.all);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../src/lib/default-tool-orders.json', import.meta.url), 'utf8')), defaults, 'Browser test fixtures must not overwrite captured defaults');
  assert.deepEqual(errors, []);
  console.log('PASS: captured defaults on fresh browser, personal overrides/reset, installer links/style, desktop/mobile modal focus and bilingual guide.');
} finally { await browser.close(); }
