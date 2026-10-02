import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = await readFile(new URL('../../ArXivHub.user.js', import.meta.url), 'utf8');
const hjfyIcon = await readFile(new URL('../../public/icons/hjfy.svg', import.meta.url), 'utf8');
const hubIcon = await readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const fixture = (sidebar = true) => `<!doctype html><html><head><meta name="citation_title" content="Attention Is All You Need"><style>
body{margin:0;font:16px Arial;background:white;color:#222}main{max-width:1120px;margin:32px auto;display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:32px;padding:0 20px}.extra-services{min-width:0}h1{font-size:28px}.full-text,.native-links{padding:12px;border-bottom:1px solid #ddd}h2{font-size:18px}a{color:#b31b1b}@media(max-width:640px){main{display:block}.extra-services{margin-top:24px}}
</style></head><body><main><article id="native-paper"><h1 class="title"><span class="descriptor">Title:</span>Attention Is All You Need</h1><p>Ashish Vaswani et al.</p><h2>Abstract</h2><p>The Transformer is based solely on attention mechanisms.</p></article>${sidebar ? '<aside class="extra-services"><section class="full-text" id="native-access"><h2>Access Paper</h2><a href="https://arxiv.org/pdf/1706.03762">View PDF</a><a href="https://arxiv.org/html/1706.03762v7">HTML</a><a href="/src/1706.03762">TeX Source</a></section><section class="native-links" id="native-links">References and citations</section></aside>' : ''}</main></body></html>`;

async function prepare(context, mode = 'ready') {
  await context.addInitScript(({ mode, hjfyIcon }) => {
    const values = new Map();
    window.__gmMode = mode;
    window.__gmRequests = [];
    window.GM_getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
    window.GM_setValue = (key, value) => values.set(key, value);
    window.GM_deleteValue = (key) => values.delete(key);
    window.GM_xmlhttpRequest = (options) => {
      window.__gmRequests.push(options.url);
      setTimeout(() => {
        const semantic = options.url.includes('api.semanticscholar.org');
        const status = semantic && window.__gmMode === 'rate_limit' ? 429 : 200;
        const responseText = semantic
          ? JSON.stringify({ url: 'https://www.semanticscholar.org/paper/example', tldr: { text: 'A verified summary fixture describing the paper and its key ideas.', model: 'test' } })
          : options.url.includes('cdn.hjfy.top') ? hjfyIcon
          : '<html><body><h2>TLDR</h2><p>A concise research summary fixture with enough content for the existing parser. A second sentence should not be displayed.</p><h2>Key contributions</h2><ul><li>The paper presents a new approach to sequence modeling.</li></ul><h2>Why it matters</h2><p>This approach improves research and practical applications.</p></body></html>';
        options.onload({ status, responseText, responseHeaders: status === 429 ? 'Retry-After: 60' : '' });
      }, 10);
    };
  }, { mode, hjfyIcon });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await prepare(context);
  await context.route('https://arxiv.org/abs/**', (route) => route.fulfill({ contentType: 'text/html', body: fixture() }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('https://arxiv.org/abs/1706.03762v7');
  const native = await page.locator('#native-paper').innerHTML();
  await page.addScriptTag({ content: source });
  const nav = page.locator('#arxivhub-bookmarks');
  const documents = page.locator('#arxivhub-document-links');
  assert.deepEqual(await documents.locator('a').evaluateAll((links)=>links.map(link=>link.dataset.documentFormat)),['pdf','html','md','src']);
  for (const [format,href] of [['pdf','https://arxiv.org/pdf/1706.03762'],['html','https://arxiv.org/html/1706.03762v7'],['md','https://www.arxiv2md.org/api/markdown?url=1706.03762v7'],['src','https://arxiv.org/src/1706.03762']]) {
    const link=documents.locator(`[data-document-format="${format}"]`);
    assert.equal(await link.getAttribute('href'),href);
    assert.ok(await link.getAttribute('title'));
    if (format === 'md') assert.equal(await link.innerText(), 'MD');
    else await link.locator('img').evaluate(img=>img.decode());
  }
  assert.equal(await nav.locator('[data-bookmark="hub"] img').getAttribute('src'),`data:image/svg+xml;base64,${Buffer.from(hubIcon).toString('base64')}`);
  assert.deepEqual(await nav.locator(':scope > a').evaluateAll((links) => links.map((link) => link.dataset.bookmark)), ['hub', 'alphaxiv', 'hjfy', 'papers-cool', 'emergent-mind', 'arxivxplorer', 'openreview', 'connected-papers', 'semantic-scholar', 'google-scholar']);
  assert.equal(await nav.locator('[data-bookmark="arxivtldr"]').count(), 0);
  assert.deepEqual(await nav.locator('.ab-social a').evaluateAll((links) => links.map((link) => link.dataset.bookmark)), ['xiaohongshu', 'x-search', 'reddit-search', 'zhihu-search', 'hf-papers']);
  const expected = {
    hub: 'https://arxivhub.github.io/p/1706.03762',
    alphaxiv: 'https://www.alphaxiv.org/abs/1706.03762',
    hjfy: 'https://hjfy.top/arxiv/1706.03762',
    'papers-cool': 'https://papers.cool/arxiv/1706.03762',
    'emergent-mind': 'https://www.emergentmind.com/papers/1706.03762',
    arxivxplorer: 'https://arxivxplorer.com/?q=1706.03762',
    openreview: 'https://openreview.net/search?term=Attention%20Is%20All%20You%20Need',
    'connected-papers': 'https://www.connectedpapers.com/api/redirect/arxiv/1706.03762',
    'semantic-scholar': 'https://www.semanticscholar.org/search?q=Attention%20Is%20All%20You%20Need',
    'google-scholar': 'https://scholar.google.com/scholar_lookup?arxiv_id=1706.03762',
    xiaohongshu: 'https://www.xiaohongshu.com/search_result?keyword=Attention%20Is%20All%20You%20Need',
    'x-search': 'https://x.com/search?q=Attention%20Is%20All%20You%20Need',
    'reddit-search': 'https://www.reddit.com/search/?q=Attention%20Is%20All%20You%20Need',
    'zhihu-search': 'https://www.zhihu.com/search?type=content&q=Attention%20Is%20All%20You%20Need',
    'hf-papers': 'https://huggingface.co/papers/1706.03762',
  };
  for (const [id, href] of Object.entries(expected)) {
    const link = nav.locator(`[data-bookmark="${id}"]`);
    assert.equal(await link.getAttribute('href'), href);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('rel'), /noopener/);
    await link.locator('img').evaluate((img) => img.decode());
    assert.ok(await link.locator('img').evaluate((img) => img.naturalWidth > 0 && img.src.startsWith('data:')));
  }
  assert.equal(new Set(await nav.locator(':scope > a').evaluateAll((links) => links.map((link) => getComputedStyle(link).backgroundColor))).size, 10);
  assert.ok(await nav.locator(':scope > a:not(.ab-hub)').evaluateAll((links) => links.every((link) => link.getBoundingClientRect().height === 36)));
  assert.equal(await page.locator('#native-paper').innerHTML(), native);
  assert.deepEqual(await page.locator('.extra-services > *').evaluateAll((nodes) => nodes.map((node) => node.id)), ['arxivhub-document-links', 'arxivtldr-sidebar-card', 'zotero-style-tldr-sidebar-card', 'arxivhub-bookmarks', 'native-access', 'native-links']);
  const semantic = page.locator('#zotero-style-tldr-sidebar-card');
  assert.equal(await semantic.getByRole('button').getAttribute('aria-expanded'), 'false');
  assert.equal(await semantic.locator('[data-semantic-tldr-body]').isVisible(), false);
  await semantic.getByRole('button').click();
  await semantic.getByText('A verified summary fixture describing the paper and its key ideas.', { exact: true }).waitFor();
  const tldr = page.locator('#arxivtldr-sidebar-card');
  assert.equal(await tldr.getByRole('button').getAttribute('aria-expanded'), 'true');
  await tldr.getByText('A concise research summary fixture with enough content for the existing parser.', { exact: true }).waitFor();
  assert.doesNotMatch(await tldr.innerText(), /second sentence|Key contributions|Why it matters/);
  await tldr.getByRole('button').click();
  await semantic.getByRole('button').click();
  assert.equal(await semantic.getByRole('button').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => {
    window.__mutationCount = 0;
    new MutationObserver((records) => { window.__mutationCount += records.length; }).observe(document.querySelector('.extra-services'), { childList: true, subtree: true });
    for (let i = 0; i < 10; i++) document.body.appendChild(document.createElement('span'));
  });
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__mutationCount), 0);
  assert.equal(await page.evaluate(() => window.__gmRequests.length), 2);
  assert.equal(await nav.count(), 1);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await nav.locator(':scope > a > span').evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth)));
    const boxes=await documents.locator('a').evaluateAll(links=>links.map(link=>{const rect=link.getBoundingClientRect();return {y:rect.y,width:rect.width};}));
    assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0].y)<1&&Math.abs(box.width-boxes[0].width)<1));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await documents.screenshot({ path: '../screenshots/userscript-document-md.png' });
  await nav.screenshot({ path: '../screenshots/userscript-bookmarks.png' });
  await page.locator('#native-access a').nth(1).evaluate(link=>link.setAttribute('href','https://arxiv.org/html/1706.03762v6'));
  await page.waitForFunction(()=>document.querySelector('[data-document-format="html"]').href.endsWith('1706.03762v6'));
  const title = 'Vision & "Action" <Control>';
  await page.evaluate((title) => document.querySelector('meta[name="citation_title"]').setAttribute('content', title), title);
  await page.waitForFunction((title) => document.querySelector('[data-bookmark="openreview"]').href.endsWith(encodeURIComponent(title)), title);
  assert.equal(await page.locator('control').count(), 0);
  assert.equal(await semantic.getByRole('button').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => { history.pushState({}, '', '/abs/hep-th/9901001v2'); window.dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await nav.locator('[data-bookmark="hub"]').getAttribute('href'), 'https://arxivhub.github.io/p/hep-th~9901001');
  assert.equal(await semantic.getAttribute('data-arxiv-id'), 'hep-th/9901001v2');
  assert.equal(await documents.locator('[data-document-format="src"]').getAttribute('href'),'https://arxiv.org/src/hep-th/9901001v2');
  assert.equal(await documents.locator('[data-document-format="md"]').getAttribute('href'),'https://www.arxiv2md.org/api/markdown?url=hep-th%2F9901001v2');
  await page.evaluate(() => { history.pushState({}, '', '/search'); window.dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await nav.count(), 0);
  assert.equal(await documents.count(), 0);
  assert.equal(await page.locator('#native-access').count(), 1);
  await page.goto('https://arxiv.org/abs/1706.03762v7');
  await page.addScriptTag({ content: source });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__gmRequests.length), 0);
  assert.equal(await page.locator('#arxivhub-bookmarks').count(), 1);
  assert.deepEqual(errors, []);
  await context.close();

  const late = await browser.newContext();
  await prepare(late, 'rate_limit');
  await late.route('https://www.arxiv.org/abs/**', (route) => route.fulfill({ contentType: 'text/html', body: fixture(false) }));
  const latePage = await late.newPage();
  await latePage.goto('https://www.arxiv.org/abs/2504.16054');
  await latePage.addScriptTag({ content: source });
  await latePage.evaluate(() => { const aside = document.createElement('aside'); aside.className = 'extra-services'; aside.innerHTML = '<section id="late-native">Access Paper</section>'; document.querySelector('main').append(aside); });
  await latePage.locator('#arxivhub-bookmarks').waitFor();
  await latePage.locator('#zotero-style-tldr-sidebar-card').getByRole('button', { name: '展开', exact: true }).click();
  await latePage.getByRole('button', { name: '设置 API Key', exact: true }).waitFor();
  assert.equal(await latePage.locator('#late-native').count(), 1);
  await latePage.waitForTimeout(600);
  assert.equal(await latePage.evaluate(() => window.__gmRequests.filter((url) => url.includes('api.semanticscholar.org')).length), 1);
  await latePage.evaluate(() => { window.__gmMode = 'ready'; });
  await latePage.getByRole('button', { name: '强制重试', exact: true }).click();
  await latePage.getByText('A verified summary fixture describing the paper and its key ideas.', { exact: true }).waitFor();
  await late.close();

  const spa = await browser.newContext();
  await prepare(spa);
  await spa.route('https://www.alphaxiv.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><nav><a>Audio</a><a>Notes</a></nav><h1>Paper title</h1></body></html>' }));
  await spa.route('https://www.arxivisual.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><main>Paper not yet processed</main></body></html>' }));
  const dynamic = await spa.newPage();
  await dynamic.goto('https://www.alphaxiv.org/abs/1706.03762');
  await dynamic.addScriptTag({ content: source });
  assert.equal(await dynamic.locator('#papers-cool-nav-link').getAttribute('href'), 'https://papers.cool/arxiv/1706.03762');
  await dynamic.evaluate(() => { history.pushState({}, '', '/abs/2504.16054'); dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await dynamic.locator('#hjfy-nav-link').getAttribute('href'), 'https://hjfy.top/arxiv/2504.16054');
  await dynamic.goto('https://www.arxivisual.org/abs/1706.03762');
  await dynamic.addScriptTag({ content: source });
  const badge = dynamic.locator('#arxivisual-status-badge');
  assert.equal(await badge.getAttribute('data-state'), 'unavailable');
  await dynamic.evaluate(() => { document.querySelector('main').textContent = 'Interactive scrollytelling'; });
  await dynamic.waitForFunction(() => document.querySelector('#arxivisual-status-badge')?.dataset.state === 'available');
  await dynamic.evaluate(() => { document.querySelector('main').textContent = 'Loading'; });
  await badge.waitFor({ state: 'detached' });
  await spa.close();
  console.log('PASS: adjacent ArXiv/Zotero TLDR cards, no duplicate TLDR bookmark, 10 colored bookmarks, 5 circular links, embedded icons, native content, dynamic navigation, TLDR caching/toggles/rate limits, alphaXiv/arXivisual support.');
} finally { await browser.close(); }
