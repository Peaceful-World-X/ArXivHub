import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
const favorites = ['alphaxiv', 'paperlayer', 'hjfy', 'papers-cool', 'arxivdaily', 'paperdance', 'arxivtldr', 'arxiv-rss', 'pith'];
  const removed = ['zotero-arxiv-reader', 'zotarxiv', 'zotero-convert-to-arxiv', 'alphapulse', 'discovery-daily'];
const partition = (ids, pinned) => [...ids.filter((id) => pinned.includes(id)), ...ids.filter((id) => !pinned.includes(id))];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Sorting tests do not need live citation/search quotas or external metadata.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === 'api.datacite.org') return route.fulfill({ json: { data: { attributes: {
      doi: '10.48550/arxiv.2608.15875', titles: [{ title: 'Paper ordering fixture' }], creators: [{ name: 'Example Author' }],
      descriptions: [{ descriptionType: 'Abstract', description: 'A paper used to verify navigation ordering.' }],
      subjects: [{ subject: 'cs.RO', subjectScheme: 'arXiv' }], version: '1', dates: [{ date: '2026-08-16', dateType: 'Submitted' }],
    } } } });
    if (url.hostname === 'api.alphaxiv.org') return route.fulfill({ json: { universal_paper_id: '2608.15875', metrics: { public_total_votes: 0 } } });
    if (url.hostname === 'api.semanticscholar.org') return route.fulfill({ json: { paperId: 'a'.repeat(40), citationCount: 0, externalIds: { ArXiv: '2608.15875' } } });
    if (url.hostname === 'api.openalex.org') return route.fulfill({ json: { results: [] } });
    return route.fulfill({ status: 404, body: 'External request disabled in ordering fixture' });
  });
  await page.goto(base);
  const homeCategories = ['all', 'favorites', 'source', 'ai-summary', 'ai-chat', 'search', 'discussion', 'translate', 'discover', 'subscribe', 'xiv', 'agent', 'zotero', 'tool'];
  const categories = [['discussion', '讨论'], ['ai-summary', 'AI解读'], ['ai-chat', 'AI问答'], ['search', '检索'], ['translate', '翻译']];
  const ids = () => page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('arxiv-hub')).state);
  async function readHome(pinned, expected) {
    const result = new Map();
    for (const category of homeCategories) {
      const tab = page.locator(`button[data-category="${category}"]`);
      await tab.click();
      const order = await ids();
      assert.equal(order.length, Number(await tab.locator('[data-category-count]').innerText()));
      assert.equal(order.some((id) => removed.includes(id)), false, `${category}: removed entries stay absent`);
      assert.deepEqual(order, partition(order, pinned), `${category}: favorites are first`);
      if (expected) {
        const categoryOrder = expected[category] ?? [];
        const favoriteOrder = expected.favorites ?? [];
        const expectedOrder = category === 'favorites'
          ? categoryOrder
          : [...favoriteOrder.filter((id) => categoryOrder.includes(id)), ...categoryOrder.filter((id) => !favoriteOrder.includes(id))];
        assert.deepEqual(order, partition(expectedOrder, pinned), `${category}: personal order is retained inside each group`);
      }
      result.set(category, order);
    }
    return result;
  }
  async function comparePaper(home, pinned) {
    await page.goto(new URL('p/2608.15875', base).href);
    const tools = page.getByTestId('paper-tools');
    await tools.waitFor();
    for (const [id, label] of categories) {
      const order = await tools.locator(`#paper-tools-${id} [data-tool-id]`).evaluateAll((cards) => cards.map((card) => card.dataset.toolId));
      assert.deepEqual(order, home.get(id), `${label}: home and paper match`);
      assert.deepEqual(order, partition(order, pinned));
      assert.equal(Number(await tools.getByRole('button', { name: label, exact: true }).locator('[data-category-count]').innerText()), order.length);
    }
    return tools;
  }
  assert.deepEqual((await saved()).pinned, favorites);
  const home = await readHome(favorites);
  assert.deepEqual(home.get('tool'),['latexml', 'easyread', 'zotero-bib']);
  assert.deepEqual([...home.get('all').slice(0, favorites.length)].sort(), [...favorites].sort());
  assert.deepEqual(home.get('favorites'), favorites);
  assert.deepEqual(await page.locator('button[data-category]').evaluateAll((tabs) => tabs.map((tab) => tab.dataset.category)), homeCategories);
  await page.locator('[data-category="favorites"]').click();
  for (const [width, name] of [[1280, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-tool-grid]').locator('xpath=ancestor::section[1]').screenshot({ path: `../screenshots/favorites-defaults-${name}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  const tools = await comparePaper(home, favorites);
  for (const [width, name] of [[1280, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await tools.getByRole('navigation').screenshot({ path: `../screenshots/paper-matching-counts-${width}.png` });
    await tools.locator('#paper-tools-ai-summary').screenshot({ path: `../screenshots/favorites-paper-${name}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await tools.locator('#paper-tools-ai-summary').screenshot({ path: '../screenshots/paper-ai-summary-complete.png' });
  await tools.locator('#paper-tools-translate').screenshot({ path: '../screenshots/paper-translation-complete.png' });
  // Simulate existing preferences: reverse every list and keep a smaller personal favorite set.
  const previousPins = ['zotmeta', 'openreview', 'papers-cool'];
  const personal = Object.fromEntries([...home].map(([category, order]) => [category, category === 'favorites' ? [...previousPins].reverse() : [...order].reverse()]));
  await page.evaluate(({ pinned, toolOrders }) => {
    const data = JSON.parse(localStorage.getItem('arxiv-hub'));
    Object.assign(data.state, { pinned, toolOrders }); localStorage.setItem('arxiv-hub', JSON.stringify(data));
  }, { pinned: previousPins, toolOrders: personal });
  await page.goto(base);
  assert.deepEqual((await saved()).pinned, previousPins);
  assert.deepEqual((await saved()).toolOrders, personal);
  await readHome(previousPins, personal);
  const expectedPinned = (pins) => [
    ...pins.filter((id) => !personal.favorites.includes(id)),
    ...personal.favorites.filter((id) => pins.includes(id)),
  ];
  await page.locator('[data-category="all"]').click();
  await page.locator('article[data-tool-id="chatdoc"]').getByRole('button', { name: '收藏网站', exact: true }).click();
  const added = (await saved()).pinned;
  assert.deepEqual((await ids()).slice(0, added.length), expectedPinned(added), 'new favorite moves into the first group immediately');
  await page.locator('article[data-tool-id="openreview"]').getByRole('button', { name: '取消收藏', exact: true }).click();
  const changed = (await saved()).pinned;
  assert.deepEqual((await ids()).slice(0, changed.length), expectedPinned(changed), 'unfavorited item returns to the second group immediately');
  await page.reload();
  assert.deepEqual((await saved()).pinned, changed); assert.deepEqual((await saved()).toolOrders, personal);
  assert.deepEqual((await ids()).slice(0, changed.length), expectedPinned(changed));
  const updatedHome = await readHome(changed);
  await comparePaper(updatedHome, changed);
  const paperIds = () => page.locator('#paper-tools-ai-chat [data-tool-id]').evaluateAll((rows) => rows.map((row) => row.dataset.toolId));
  for (const [id, action] of [['explainpaper', '收藏网站'], ['chatdoc', '取消收藏']]) {
    await page.locator(`#paper-tools-ai-chat [data-tool-id="${id}"]`).getByRole('button', { name: action, exact: true }).click();
    assert.deepEqual(await paperIds(), partition(personal['ai-chat'], (await saved()).pinned), 'paper favorites move immediately');
  }
  const paperPins = (await saved()).pinned;
  await page.reload();
  await page.getByTestId('paper-tools').waitFor();
  assert.deepEqual(await paperIds(), partition(personal['ai-chat'], paperPins), 'paper favorites remain first after reload');
  assert.deepEqual((await saved()).toolOrders, personal);
  // 验证旧收藏与排序中残留的删除 ID 不会重新显示目录卡片。
  await page.evaluate((deleted) => {
    const data = JSON.parse(localStorage.getItem('arxiv-hub'));
    data.state.pinned = [...deleted, ...data.state.pinned];
    data.state.toolOrders = Object.fromEntries(Object.entries(data.state.toolOrders).map(([category, order]) => [category, [...deleted, ...order]]));
    delete data.state.toolOrders.tool;
    data.state.toolOrders.all = data.state.toolOrders.all.filter((id) => id !== 'latexml' && id !== 'astro-arxiv-sanity');
    localStorage.setItem('arxiv-hub', JSON.stringify(data));
  }, removed);
  await page.goto(base);
  const legacyPins = (await saved()).pinned;
  const legacyHome = await readHome(legacyPins);
  assert.equal((await saved()).toolOrders.tool,undefined);
  assert.deepEqual(legacyHome.get('tool'),['latexml', 'easyread', 'zotero-bib']);
  assert.ok(legacyHome.get('all').includes('latexml') && legacyHome.get('all').includes('astro-arxiv-sanity'));
  await comparePaper(legacyHome, legacyPins);
  await page.locator('header').getByRole('link', {name:'关于',exact:true}).click();
  await page.getByRole('heading', {name:'关于 ArXiv Hub · 论桥',exact:true}).waitFor();
  for (const id of removed) assert.equal(await page.locator(`[data-directory-tool="${id}"]`).count(),0);
  await page.goto(base);
  await page.getByRole('button', {name:'Tool',exact:true}).click();
  await page.locator('article[data-tool-id="latexml"]').getByRole('button', {name:'收藏网站',exact:true}).click();
  await page.getByRole('button', {name:'收藏',exact:true}).click();
  const beforeMove = await ids();
  const latexIndex = beforeMove.indexOf('latexml');
  assert.ok(latexIndex > 0);
  await page.getByRole('button', {name:'调整顺序',exact:true}).click();
  await page.locator('article[data-tool-id="latexml"]').getByRole('button', {name:'前移',exact:true}).click();
  const reordered = await ids();
  assert.equal(reordered.indexOf('latexml'),latexIndex-1);
  assert.deepEqual((await saved()).toolOrders.favorites,reordered);
  await page.reload();
  await page.getByRole('button', {name:'收藏',exact:true}).click();
  assert.deepEqual(await ids(),reordered);
  await page.getByRole('button', {name:'Tool',exact:true}).click();
  assert.equal(await page.locator('article[data-tool-id="latexml"]').getByRole('button', {name:'取消收藏',exact:true}).count(),1);
  assert.deepEqual(errors, []);
  console.log('PASS: favorites first and stable personal order, immediate pin/unpin and reload persistence, matching home/paper categories, deleted entries absent with legacy preferences, missing Tool preferences fall back and new Tool favorites/reordering persist; desktop/mobile screenshots.');
} finally { await browser.close(); }
