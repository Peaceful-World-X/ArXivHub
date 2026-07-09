import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
try {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  const tab = (name) => page.getByRole('button', { name, exact: true });
  const ids = () => page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('arxiv-hub')).state);
  await tab('收藏').click();
  const original = await ids();
  const colors = await page.locator('article').evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundColor));
  assert.equal(new Set(colors).size, colors.length);
  await tab('调整顺序').click();
  await page.locator('article').first().getByRole('button', { name: '后移', exact: true }).click();
  const moved = [original[1], original[0], ...original.slice(2)];
  assert.deepEqual(await ids(), moved);
  await tab('AIChat').click();
  const aiOriginal = await ids();
  await page.locator('article').first().getByRole('button', { name: '后移', exact: true }).click();
  const aiMoved = await ids();
  assert.notDeepEqual(aiMoved, aiOriginal);
  assert.deepEqual((await saved()).toolOrders.favorites, moved);
  await page.reload();
  await tab('收藏').click();
  assert.deepEqual(await ids(), moved);
  const reloadedColors = await page.locator('article').evaluateAll((cards) => Object.fromEntries(cards.map((card) => [card.dataset.toolId, getComputedStyle(card).backgroundColor])));
  original.forEach((id, index) => assert.equal(reloadedColors[id], colors[index]));
  await tab('AIChat').click();
  assert.deepEqual(await ids(), aiMoved);

  // Reordering search results must leave nonmatching cards in their slots.
  await tab('原文').click();
  const sources = await ids();
  await tab('调整顺序').click();
  await page.getByPlaceholder('筛选工具').fill('arxiv');
  const matches = await ids();
  await page.locator('article').first().getByRole('button', { name: '后移', exact: true }).click();
  await page.getByPlaceholder('筛选工具').fill('');
  const afterSearch = await ids();
  for (let i = 0; i < sources.length; i++) if (!matches.includes(sources[i])) assert.equal(afterSearch[i], sources[i]);
  await tab('恢复默认顺序').click();
  assert.deepEqual(await ids(), sources);
  assert.deepEqual((await saved()).toolOrders.ai, aiMoved);

  // Actual pointer drag and keyboard sorting both persist.
  const first = page.locator('article').first().getByRole('button', { name: '拖动排序', exact: true });
  const second = page.locator('article').nth(1).getByRole('button', { name: '拖动排序', exact: true });
  const a = await first.boundingBox(), b = await second.boundingBox();
  await page.mouse.move(a.x + 22, a.y + 22);
  await page.mouse.down();
  await page.mouse.move(a.x + 34, a.y + 22, { steps: 3 });
  await page.mouse.move(b.x + 22, b.y + 22, { steps: 12 });
  await page.mouse.up();
  assert.deepEqual((await ids()).slice(0, 2), [sources[1], sources[0]]);
  await page.waitForTimeout(250);
  await page.locator('article').first().getByRole('button', { name: '拖动排序', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('button[aria-label="拖动排序"][aria-pressed="true"]'));
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  assert.deepEqual(await ids(), sources);
  await tab('完成排序').click();

  const card = page.locator('article').first();
  const copy = card.getByRole('button', { name: '复制链接', exact: true });
  const height = await card.evaluate((el) => el.getBoundingClientRect().height);
  await copy.click();
  await card.locator('button[data-copied="true"]').waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await card.locator('a').getAttribute('href'));
  assert.ok(Math.abs(await card.evaluate((el) => el.getBoundingClientRect().height) - height) < 0.1);
  assert.equal(await card.locator('button[data-copied="true"] .lucide-check').count(), 1);
  assert.equal(await card.locator('.copy-coin').evaluate((el) => getComputedStyle(el).animationName), 'copy-coin-spin');
  assert.equal(await card.locator('.lucide-check').getAttribute('stroke-width'), '3.25');
  assert.equal(await card.locator('.copy-coin').evaluate((el) => getComputedStyle(el).color), 'rgb(0, 138, 60)');
  await card.locator('.copy-coin').evaluate((el) => el.dataset.previous = 'true');
  await card.getByRole('button', { name: '已复制', exact: true }).click();
  await card.locator('.copy-coin[data-previous]').waitFor({ state: 'detached' });
  assert.equal(await card.locator('.copy-coin[data-previous]').count(), 0);
  assert.equal(await card.locator('p').count(), 1);
  await page.waitForFunction(() => !document.querySelector('button[data-copied="true"]'), undefined, { timeout: 1000 });
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
  await copy.click();
  await card.getByRole('button', { name: '复制失败，请重试', exact: true }).waitFor();
  assert.equal(await card.locator('button[data-copied="true"]').count(), 0);

  // Version 1 preferences must survive without reintroducing deleted favorites.
  await page.evaluate(() => localStorage.setItem('arxiv-hub', JSON.stringify({ version: 1, state: { lang: 'en', pinned: ['zotmeta'], history: [{ id: '1706.03762', title: 'Keep history', at: 123 }] } })));
  await page.reload();
  assert.deepEqual((await saved()).pinned, ['zotmeta']);
  assert.equal((await saved()).lang, 'en');
  assert.equal((await saved()).history[0].title, 'Keep history');
  assert.deepEqual((await saved()).toolOrders, {});
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await tab('收藏').click();
  await page.locator('article').getByRole('button', { name: '取消收藏', exact: true }).click();
  await page.reload();
  await tab('收藏').click();
  assert.equal(await page.locator('article').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: per-list persisted order, filtered reorder, pointer/keyboard controls, reset isolation, stable colors, clipboard success/failure without resizing, v1 migration.');
} finally { await browser.close(); }
