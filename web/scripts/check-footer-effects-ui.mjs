import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/');
  assert.equal(await page.locator('header img[alt="访客数"]').count(),0);
  assert.equal(await page.locator('footer img[alt="访客数"]').count(),1);
  const starLink = page.locator('header').getByRole('link',{name:'Star',exact:true});
  assert.equal(await starLink.locator('svg.lucide-star').count(),1);
  assert.equal(await starLink.getAttribute('href'),'https://github.com/Peaceful-World-X/ArXivHub');
  assert.equal(await starLink.locator('svg').evaluate(el=>getComputedStyle(el).fill),'none');
  assert.doesNotMatch(await starLink.innerText(),/⭐/);
  const favorites = () => page.getByRole('button', { name: '收藏', exact: true }).click();
  const colors = () => page.locator('article').evaluateAll((cards) => Object.fromEntries(cards.map((card) => [card.dataset.toolId, getComputedStyle(card).backgroundColor])));
  await favorites();
  const initial = await colors();
  assert.equal(new Set(Object.values(initial)).size, 6);
  await page.reload();
  await favorites();
  assert.deepEqual(await colors(), initial);
  await page.screenshot({ path: '../screenshots/favorites-unique-colors.png', fullPage: true });

  // A larger collection must not cycle through the same six colors.
  await page.getByRole('button', { name: '全部', exact: true }).click();
  const pinButtons = page.locator('article').getByRole('button', { name: '收藏网站', exact: true });
  while (await pinButtons.count()) await pinButtons.first().click();
  await favorites();
  await page.waitForFunction(() => document.querySelectorAll('article').length === JSON.parse(localStorage.getItem('arxiv-hub')).state.pinned.length);
  const allColors = Object.values(await colors());
  assert.equal(new Set(allColors).size, allColors.length);
  await page.reload();
  await favorites();
  assert.equal(new Set(Object.values(await colors())).size, allColors.length);

  // Upgrading v2 retains the user's favorites, category order, and history.
  await page.evaluate(() => localStorage.setItem('arxiv-hub', JSON.stringify({ version: 2, state: {
    lang: 'zh', pinned: ['zotmeta', 'alphaxiv'], toolOrders: { favorites: ['alphaxiv', 'zotmeta'] }, history: [{ id: '1706.03762', title: 'Saved', at: 123 }],
  } })));
  await page.reload();
  await favorites();
  assert.deepEqual(await page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId)), ['alphaxiv', 'zotmeta']);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('arxiv-hub')));
  assert.equal(saved.version, 3);
  assert.equal(saved.state.history[0].title, 'Saved');
  assert.equal(new Set(Object.values(saved.state.favoriteHues)).size, 2);
  assert.doesNotMatch(await page.locator('footer').innerText(), /独立聚合|无隶属关系/);

  const trigger = page.getByRole('button', { name: '© 2026 耗不尽的先生 | Peaceful-World-X', exact: true });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('footer').scrollIntoViewIfNeeded();
    const actions = await page.getByTestId('footer-actions').boundingBox();
    const last = await page.getByTestId('footer-actions').locator('a').last().boundingBox();
    assert.ok(Math.abs(actions.x + actions.width - last.x - last.width) < 2);
    await page.locator('footer').screenshot({ path: `../screenshots/footer-right-${width}.png` });
    await trigger.click();
    const canvas = page.getByTestId('celebration-canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="celebration-canvas"]');
      if (!canvas) return false;
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 200 && data[i + 3] > 50) bright++;
      return bright > 600;
    });
    const box = await canvas.boundingBox();
    assert.equal(box.width, width);
    assert.equal(box.height, 900);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    const pixels = () => canvas.evaluate((canvas) => canvas.toDataURL());
    const before = await pixels();
    await page.waitForTimeout(350);
    assert.notEqual(await pixels(), before);
    await page.screenshot({ path: `../screenshots/realistic-confetti-${width}.png` });
    await page.waitForTimeout(1400);
    assert.equal(await canvas.count(),1);
    const later = await pixels();
    await page.waitForTimeout(150);
    assert.notEqual(await pixels(),later);
    // A second click restarts immediately while keeping exactly one overlay.
    await trigger.click();
    assert.equal(await canvas.count(), 1);
    await canvas.waitFor({ state: 'detached', timeout: 7000 });
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', {name:'收藏本页',exact:true}).click();
    await canvas.waitFor();
    assert.equal(await canvas.getAttribute('data-effect'),'stars');
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-effect="stars"]');
      if (!canvas) return false;
      return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index % 4 === 3 && value > 50);
    });
    await page.waitForTimeout(120);
    await page.screenshot({path:`../screenshots/bookmark-stars-${width}.png`});
    await page.waitForTimeout(1100);
    assert.equal(await canvas.count(),1);
    await canvas.waitFor({state:'detached',timeout:6000});
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await page.getByTestId('celebration-canvas').waitFor();
  await page.getByTestId('celebration-canvas').waitFor({ state: 'detached', timeout: 1500 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await trigger.click();
  await page.keyboard.press('Escape');
  await page.getByTestId('celebration-canvas').waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS: unique persisted colors, v2 migration, footer alignment, Star icon, desktop/mobile full confetti lifetime, replay, natural completion, Escape, reduced motion.');
} finally { await browser.close(); }
