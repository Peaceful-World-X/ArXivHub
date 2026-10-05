import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = await readFile(new URL('../../ArXivHub.user.js', import.meta.url), 'utf8');
const hjfyIcon = await readFile(new URL('../../public/icons/hjfy.svg', import.meta.url), 'utf8');
const hubIcon = await readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const fixture = (sidebar = true) => `<!doctype html><html><head><meta name="citation_title" content="Attention Is All You Need"><meta name="citation_author" content="Ashish Vaswani"><meta name="citation_date" content="2017-06-12"><style>
body{margin:0;font:16px Arial;background:white;color:#222}main{max-width:1120px;margin:32px auto;display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:32px;padding:0 20px}.extra-services{min-width:0}h1{font-size:28px}.full-text,.native-links{padding:12px;border-bottom:1px solid #ddd}h2{font-size:18px}a{color:#b31b1b}@media(max-width:640px){main{display:block}.extra-services{margin-top:24px}}
</style></head><body><main><article id="native-paper"><h1 class="title"><span class="descriptor">Title:</span>Attention Is All You Need</h1><p>Ashish Vaswani et al.</p><h2>Abstract</h2><p>The Transformer is based solely on attention mechanisms.</p></article>${sidebar ? '<aside class="extra-services"><section class="full-text" id="native-access"><h2>Access Paper</h2><a href="https://arxiv.org/pdf/1706.03762">View PDF</a><a href="https://arxiv.org/html/1706.03762v7">HTML</a><a href="/src/1706.03762">TeX Source</a></section><section class="native-links" id="native-links">References and citations</section></aside>' : ''}</main></body></html>`;

async function prepare(context, mode = 'ready') {
  const persisted = new Map();
  await context.route('**/*', (route) => route.fulfill({ status: 404, body: 'Unmocked browser request blocked by fixture' }));
  await context.exposeBinding('__gmStorage', (_source, operation, key, value) => {
    if (operation === 'snapshot') return [...persisted];
    if (operation === 'set') persisted.set(key, value);
    if (operation === 'delete') persisted.delete(key);
  });
  await context.addInitScript(({ mode, hjfyIcon }) => {
    const values = new Map();
    window.__gmMode = mode;
    window.__gmRequests = [];
    window.__gmHtmlRequests = 0;
    window.__unexpectedRequests = [];
    window.__gmWrites = [];
    window.__gmReady = window.__gmStorage('snapshot').then((entries) => entries.forEach(([key, value]) => values.set(key, value)));
    window.GM_getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
    window.GM_setValue = (key, value) => { values.set(key, value); window.__gmWrites.push(window.__gmStorage('set', key, value)); };
    window.GM_deleteValue = (key) => { values.delete(key); window.__gmWrites.push(window.__gmStorage('delete', key)); };
    window.GM_setClipboard = (value) => { window.__clipboard = value; };
    window.GM_xmlhttpRequest = (options) => {
      window.__gmRequests.push(options.url);
      const responseFormat = Object.entries(options.headers || {}).find(([name]) => name.toLowerCase() === 'x-return-format')?.[1];
      if (responseFormat === 'html') window.__gmHtmlRequests++;
      const id = decodeURIComponent(location.pathname.replace(/^\/abs\//, '')).replace(/v\d+$/i, '');
      const title = document.querySelector('meta[name="citation_title"]')?.content || 'Paper title';
      const hashes = { '1706.03762': '204e3073870fae3d05bcbc2f6a8e263d9b72e776', '2303.08774': '163b4d6a79a5b19af88b8585456363340d9efd04', '2608.05594': 'a5641fd9bbe87d5da393ea06817a9bd325acd07b' };
      const hash = hashes[id] || 'd'.repeat(40), paperUrl = `https://www.semanticscholar.org/paper/${hash}`;
      const count = window.__gmMode === 'zero' ? 0 : 1234;
      const url = new URL(options.url);
      let status = 200, responseText;
      if (url.hostname === 'api.semanticscholar.org') {
        const isTldr = (url.searchParams.get('fields') || '').includes('tldr');
        if (isTldr && window.__gmMode === 'rate_limit') status = 429;
        if (!isTldr && window.__gmMode === 'missing') status = 404;
        responseText = JSON.stringify({ paperId: hash, title, externalIds: { ArXiv: id }, citationCount: count,
          url: paperUrl, tldr: { text: 'A verified summary fixture describing the paper and its key ideas.', model: 'test' } });
      } else if (url.hostname === 'api.alphaxiv.org') {
        if (window.__gmMode === 'missing') status = 404;
        responseText = JSON.stringify({ universal_paper_id: id, title, metrics: { public_total_votes: window.__gmMode === 'zero' ? 0 : 90 } });
      } else if (options.url.startsWith('https://r.jina.ai/https://www.semanticscholar.org/')) {
        if (window.__gmMode === 'missing') status = 404;
        const sourceUrl = options.url.slice('https://r.jina.ai/'.length);
        if (responseFormat === 'html') {
          const data = [{ actionType: 'API_REQUEST_COMPLETE', requestType: 'PAPER_DETAIL', responseStatus: 200,
            pathParams: { paperId: hash }, resultData: { paper: { id: hash, title: { text: title },
              primaryPaperLink: { url: `https://arxiv.org/pdf/${id}.pdf` }, citationStats: { numCitations: count, numReferences: 999 } } } }];
          responseText = `<script>var DATA = '${btoa(encodeURIComponent(JSON.stringify(data)))}';</script>`;
        } else if (sourceUrl.includes('/search?')) {
          responseText = `URL Source: ${sourceUrl}\nMarkdown Content:\n[](${paperUrl})`;
        } else {
          const total = count === 0 ? '' : `${count.toLocaleString('en-US')} Citations`;
          responseText = `URL Source: ${sourceUrl}\nMarkdown Content:\n# ${title}\n[PDF](https://arxiv.org/pdf/${id}.pdf)\n\n${total}\n\n## Related Papers\n99 Citations`;
        }
      } else if (url.hostname === 'api.openalex.org') {
        responseText = '{"results":[]}';
      } else if (url.hostname === 'cdn.hjfy.top') {
        responseText = hjfyIcon;
      } else if (options.url.includes('arxivtldr.org')) {
        responseText = '<html><body><h2>TLDR</h2><p>A concise research summary fixture with enough content for the existing parser. A second sentence should not be displayed.</p><h2>Key contributions</h2><ul><li>The paper presents a new approach to sequence modeling.</li></ul><h2>Why it matters</h2><p>This approach improves research and practical applications.</p></body></html>';
      } else if (url.hostname === 'arxiv.org' && url.pathname.startsWith('/bibtex/')) {
        responseText = `@article{arxiv${id.replaceAll('.', '')},\n title={${title}},\n author={Ashish Vaswani},\n eprint={${id}},\n archivePrefix={arXiv}\n}`;
      } else {
        window.__unexpectedRequests.push(options.url); status = 503; responseText = 'Unmocked GM request';
      }
      const timer = setTimeout(() => {
        options.onload?.({ status, responseText, response: options.responseType === 'json' ? JSON.parse(responseText) : responseText,
          finalUrl: options.url, responseHeaders: status === 429 ? 'Retry-After: 60' : 'Content-Type: text/plain' });
      }, 10);
      return { abort: () => clearTimeout(timer) };
    };
  }, { mode, hjfyIcon });
}

async function inject(page) {
  await page.evaluate(() => window.__gmReady);
  await page.addScriptTag({ content: source });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await prepare(context);
  await context.route('https://arxiv.org/abs/**', (route) => route.fulfill({ contentType: 'text/html', body: fixture() }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('https://arxiv.org/abs/1706.03762v7');
  const native = await page.locator('#native-paper').innerHTML();
  const nativeAccess = await page.locator('#native-access').innerHTML();
  await inject(page);
  const nav = page.locator('#arxivhub-bookmarks');
  const documents = page.locator('#arxivhub-document-links');
  assert.deepEqual(await documents.locator('[data-document-format]').evaluateAll((links)=>links.map(link=>link.dataset.documentFormat)),['pdf','html','md','src','tb','bibtex']);
  assert.deepEqual(await documents.locator('[data-document-format]').allTextContents(), ['PDF','HTML','MD','TeX','TB','BibTex']);
  assert.equal(await documents.locator('[data-document-format="doi"]').count(), 0);
  for (const [format,href] of [['pdf','https://arxiv.org/pdf/1706.03762'],['html','https://arxiv.org/html/1706.03762v7'],['md','https://www.arxiv2md.org/api/markdown?url=1706.03762v7'],['src','https://arxiv.org/src/1706.03762'],['tb','https://arxiv.org/tb/1706.03762']]) {
    const link=documents.locator(`[data-document-format="${format}"]`);
    assert.equal(await link.getAttribute('href'),href);
    assert.ok(await link.getAttribute('title'));
  }
  await documents.locator('button[data-document-format="bibtex"]').click();
  await page.waitForFunction(async () => {
    try { return /@(?:article|misc|inproceedings)\s*\{/i.test(window.__clipboard || await navigator.clipboard.readText()); }
    catch { return false; }
  });
  const copied = await page.evaluate(async () => window.__clipboard || await navigator.clipboard.readText());
  assert.match(copied, /@(?:article|misc|inproceedings)\s*\{/i);
  assert.match(copied, /Attention Is All You Need/); assert.match(copied, /1706\.03762/);
  assert.equal(await page.locator('#native-access').innerHTML(), nativeAccess);
  assert.equal(await nav.locator('[data-bookmark="hub"] img').getAttribute('src'),`data:image/svg+xml;base64,${Buffer.from(hubIcon).toString('base64')}`);
  assert.deepEqual(await nav.locator(':scope > a').evaluateAll((links) => links.map((link) => link.dataset.bookmark)), ['hub']);
  assert.deepEqual(await nav.locator('.ab-sites > .ab-bookmark').evaluateAll((links) => links.map((link) => link.dataset.bookmark)), ['alphaxiv','paperlayer','hjfy','papers-cool','pith','pwc','gist-science','arxivmax','openreview','emergent-mind']);
  assert.equal(await nav.locator('[data-bookmark="arxivtldr"]').count(), 0);
  assert.deepEqual(await nav.locator('.ab-social a[data-bookmark]').evaluateAll((links) => links.map((link) => link.dataset.bookmark)), ['xiaohongshu', 'x-search', 'reddit-search', 'zhihu-search', 'hf-papers','google-scholar']);
  assert.equal(await nav.locator('.ab-social-defaults > :first-child').getAttribute('aria-label'), '添加自定义网站');
  const expected = {
    hub: 'https://arxivhub.github.io/p/1706.03762',
    alphaxiv: 'https://www.alphaxiv.org/abs/1706.03762',
    paperlayer: 'https://paperlayer.ai/abs/1706.03762/zh',
    hjfy: 'https://hjfy.top/arxiv/1706.03762',
    'papers-cool': 'https://papers.cool/arxiv/1706.03762',
    'emergent-mind': 'https://www.emergentmind.com/papers/1706.03762',
    pith: 'https://pith.science/paper/1706.03762',
    pwc: 'https://paperswithcode.co/paper/1706.03762',
    'gist-science': 'https://gist.science/zh/paper/1706.03762',
    arxivmax: 'https://www.arxivmax.com/papers/1706.03762',
    openreview: 'https://openreview.net/search?term=Attention%20Is%20All%20You%20Need',
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
  assert.equal(new Set(await nav.locator('.ab-sites > a').evaluateAll((links) => links.map((link) => getComputedStyle(link).backgroundColor))).size, 10);
  assert.ok(await nav.locator('.ab-sites > a').evaluateAll((links) => links.every((link) => link.getBoundingClientRect().height === 36)));
  assert.equal(await page.locator('#native-paper').innerHTML(), native);
  assert.deepEqual(await page.locator('.extra-services > *').evaluateAll((nodes) => nodes.map((node) => node.id)), ['arxivhub-document-links', 'arxivhub-paper-metrics', 'arxivtldr-sidebar-card', 'zotero-style-tldr-sidebar-card', 'arxivhub-bookmarks', 'native-access', 'native-links']);
  const metrics = page.locator('#arxivhub-paper-metrics');
  await page.waitForFunction(() => document.querySelector('[data-metric="citations"]')?.dataset.count === '1234' && document.querySelector('[data-metric="likes"]')?.dataset.count === '90');
  assert.match(await metrics.locator('[data-metric="citations"]').getAttribute('title'), /Semantic Scholar/);
  assert.equal(await metrics.locator('[data-metric="citations"]').getAttribute('href'), 'https://www.semanticscholar.org/paper/204e3073870fae3d05bcbc2f6a8e263d9b72e776');
  assert.doesNotMatch(await metrics.innerText(), /Semantic Scholar|OpenAlex/);
  await metrics.screenshot({ path: '../screenshots/userscript-metrics.png' });
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
  await page.waitForFunction(() => document.querySelector('[data-document-format="bibtex"]')?.dataset.copied !== 'true');
  const steadyRequests = await page.evaluate(() => window.__gmRequests.length);
  await page.evaluate(() => {
    window.__mutationCount = 0;
    new MutationObserver((records) => { window.__mutationCount += records.length; }).observe(document.querySelector('.extra-services'), { childList: true, subtree: true });
    for (let i = 0; i < 10; i++) document.body.appendChild(document.createElement('span'));
  });
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__mutationCount), 0);
  assert.equal(await page.evaluate(() => window.__gmRequests.length), steadyRequests);
  assert.equal(await nav.count(), 1);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await nav.locator('.ab-bookmark > span').evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth)));
    const boxes=await documents.locator('[data-document-format]').evaluateAll(links=>links.map(link=>{const rect=link.getBoundingClientRect();return {y:rect.y,width:rect.width};}));
    assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0].y)<1));
    assert.ok(boxes.slice(0, 5).every(box=>Math.abs(box.width-boxes[0].width)<1));
    assert.ok(boxes[5].width >= boxes[0].width);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await documents.screenshot({ path: '../screenshots/userscript-document-md.png' });
  await nav.screenshot({ path: '../screenshots/userscript-bookmarks.png' });
  const addCustom = nav.getByRole('button', { name: '添加自定义网站', exact: true });
  await addCustom.click();
  const dialog = page.getByRole('dialog', { name: '自定义跳转网站', exact: true });
  await dialog.getByLabel('名称', { exact: true }).fill('Unsafe URL');
  await dialog.getByLabel('网址模板', { exact: true }).fill('javascript:window.__customInjected=1');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await nav.locator('[data-custom-site]').count(), 0);
  await dialog.getByLabel('网址模板', { exact: true }).fill('https://example.org/{unknown}');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  assert.equal(await nav.locator('[data-custom-site]').count(), 0);
  assert.ok(await dialog.getByRole('alert').innerText());
  const literalName = '<img src=x onerror="evil=1">';
  await dialog.getByLabel('名称', { exact: true }).fill(literalName);
  await dialog.getByLabel('网址模板', { exact: true }).fill('https://example.com/p/{id}?title={title}&url={url}&doi={doi}');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const custom = nav.locator('[data-custom-site]');
  assert.equal(await custom.count(), 1);
  assert.ok((await custom.getAttribute('title')).includes(literalName));
  assert.equal(await nav.locator('img[src="x"]').count(), 0);
  assert.equal(await page.evaluate(() => window.evil), undefined);
  await addCustom.click();
  await dialog.getByRole('button', { name: `编辑 ${literalName}`, exact: true }).click();
  await dialog.getByLabel('名称', { exact: true }).fill('我的检索');
  await dialog.getByLabel('网址模板', { exact: true }).fill('https://example.org/search?id={id}&q={title}&source={url}&doi={doi}');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const customUrl = new URL(await custom.getAttribute('href'));
  assert.equal(customUrl.searchParams.get('id'), '1706.03762');
  assert.equal(customUrl.searchParams.get('q'), 'Attention Is All You Need');
  assert.match(customUrl.searchParams.get('source'), /^https:\/\/arxiv\.org\/abs\/1706\.03762(?:v7)?$/);
  assert.match(customUrl.searchParams.get('doi'), /^10\.48550\/arxiv\.1706\.03762$/i);
  assert.equal(await nav.locator('.ab-social-defaults > :first-child').getAttribute('aria-label'), '添加自定义网站');
  assert.equal(await custom.evaluate((node) => node.parentElement.classList.contains('ab-social-custom')), true);
  await page.locator('.extra-services').screenshot({ path: '../screenshots/userscript-updated-desktop.png' });
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.extra-services').screenshot({ path: '../screenshots/userscript-updated-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#native-access a').nth(1).evaluate(link=>link.setAttribute('href','https://arxiv.org/html/1706.03762v6'));
  await page.waitForFunction(()=>document.querySelector('[data-document-format="html"]').href.endsWith('1706.03762v6'));
  const title = 'Vision & "Action" <Control>';
  await page.evaluate((title) => document.querySelector('meta[name="citation_title"]').setAttribute('content', title), title);
  await page.waitForFunction((title) => document.querySelector('[data-bookmark="openreview"]').href.endsWith(encodeURIComponent(title)), title);
  await page.waitForFunction((title) => new URL(document.querySelector('[data-custom-site]').href).searchParams.get('q') === title, title);
  assert.equal(await page.locator('control').count(), 0);
  assert.equal(await semantic.getByRole('button').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => { history.pushState({}, '', '/abs/hep-th/9901001v2'); window.dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await nav.locator('[data-bookmark="hub"]').getAttribute('href'), 'https://arxivhub.github.io/p/hep-th~9901001');
  assert.equal(await semantic.getAttribute('data-arxiv-id'), 'hep-th/9901001v2');
  assert.equal(await documents.locator('[data-document-format="src"]').getAttribute('href'),'https://arxiv.org/src/hep-th/9901001v2');
  assert.equal(await documents.locator('[data-document-format="md"]').getAttribute('href'),'https://www.arxiv2md.org/api/markdown?url=hep-th%2F9901001v2');
  assert.equal(await documents.locator('[data-document-format="tb"]').getAttribute('href'),'https://arxiv.org/tb/hep-th/9901001');
  assert.equal(new URL(await custom.getAttribute('href')).searchParams.get('id'), 'hep-th/9901001');
  await page.evaluate(() => { history.pushState({}, '', '/search'); window.dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await nav.count(), 0);
  assert.equal(await documents.count(), 0);
  assert.equal(await metrics.count(), 0);
  assert.equal(await page.locator('#native-access').count(), 1);
  await page.evaluate(() => Promise.all(window.__gmWrites));
  await page.goto('https://arxiv.org/abs/1706.03762v7');
  await inject(page);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__gmRequests.length), 0);
  assert.equal(await page.locator('#arxivhub-bookmarks').count(), 1);
  assert.equal(await custom.count(), 1);
  assert.equal(new URL(await custom.getAttribute('href')).searchParams.get('id'), '1706.03762');
  assert.equal(await metrics.locator('[data-metric="citations"]').getAttribute('data-count'), '1234');
  await addCustom.click();
  await dialog.getByRole('button', { name: '删除 我的检索', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await custom.count(), 0);
  await page.evaluate(() => Promise.all(window.__gmWrites));
  await page.reload(); await inject(page);
  assert.equal(await custom.count(), 0);
  assert.deepEqual(await page.evaluate(() => window.__unexpectedRequests), []);
  assert.deepEqual(errors, []);
  await context.close();

  const zero = await browser.newContext();
  await prepare(zero, 'zero');
  await zero.route('https://arxiv.org/abs/**', (route) => route.fulfill({ contentType: 'text/html', body: fixture() }));
  const zeroPage = await zero.newPage();
  await zeroPage.goto('https://arxiv.org/abs/2608.05594');
  await zeroPage.evaluate(() => document.querySelector('meta[name="citation_title"]').content = 'JTA: Joint Testability Architecture for Scenario-Based Validation of Safety-Critical Software');
  await inject(zeroPage);
  await zeroPage.waitForFunction(() => document.querySelector('[data-metric="citations"]')?.dataset.count === '0' && document.querySelector('[data-metric="likes"]')?.dataset.count === '0');
  assert.equal(await zeroPage.evaluate(() => window.__gmHtmlRequests), 1);
  await zeroPage.evaluate(() => { window.__gmMode = 'missing'; history.pushState({}, '', '/abs/2601.00001'); dispatchEvent(new PopStateEvent('popstate')); });
  await zeroPage.waitForFunction(() => window.__gmRequests.some((url) => url.includes('api.openalex.org')));
  await zeroPage.waitForTimeout(100);
  assert.deepEqual(await zeroPage.locator('#arxivhub-paper-metrics [data-metric]').evaluateAll(nodes => nodes.map(node => node.dataset.count)), ['-', '-']);
  assert.deepEqual(await zeroPage.evaluate(() => window.__unexpectedRequests), []);
  await zero.close();

  const late = await browser.newContext();
  await prepare(late, 'rate_limit');
  await late.route('https://www.arxiv.org/abs/**', (route) => route.fulfill({ contentType: 'text/html', body: fixture(false) }));
  const latePage = await late.newPage();
  await latePage.goto('https://www.arxiv.org/abs/2504.16054');
  await inject(latePage);
  await latePage.evaluate(() => { const aside = document.createElement('aside'); aside.className = 'extra-services'; aside.innerHTML = '<section id="late-native">Access Paper</section>'; document.querySelector('main').append(aside); });
  await latePage.locator('#arxivhub-bookmarks').waitFor();
  await latePage.locator('#zotero-style-tldr-sidebar-card').getByRole('button', { name: '展开', exact: true }).click();
  await latePage.getByRole('button', { name: '设置 API Key', exact: true }).waitFor();
  assert.equal(await latePage.locator('#late-native').count(), 1);
  await latePage.waitForTimeout(600);
  assert.equal(await latePage.evaluate(() => window.__gmRequests.filter((url) => url.includes('api.semanticscholar.org') && url.includes('tldr')).length), 1);
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
  await inject(dynamic);
  assert.equal(await dynamic.locator('#papers-cool-nav-link').getAttribute('href'), 'https://papers.cool/arxiv/1706.03762');
  await dynamic.evaluate(() => { history.pushState({}, '', '/abs/2504.16054'); dispatchEvent(new PopStateEvent('popstate')); });
  assert.equal(await dynamic.locator('#hjfy-nav-link').getAttribute('href'), 'https://hjfy.top/arxiv/2504.16054');
  await dynamic.goto('https://www.arxivisual.org/abs/1706.03762');
  await inject(dynamic);
  const badge = dynamic.locator('#arxivisual-status-badge');
  assert.equal(await badge.getAttribute('data-state'), 'unavailable');
  await dynamic.evaluate(() => { document.querySelector('main').textContent = 'Interactive scrollytelling'; });
  await dynamic.waitForFunction(() => document.querySelector('#arxivisual-status-badge')?.dataset.state === 'available');
  await dynamic.evaluate(() => { document.querySelector('main').textContent = 'Loading'; });
  await badge.waitFor({ state: 'detached' });
  await spa.close();
  console.log('PASS: 6 document actions/BibTex copy with DOI hidden, cached citations/likes including SSR zero and missing values, Hub plus 10 sites and 6 social links, safe persistent custom links, embedded icons, native content, navigation/mutations, TLDR toggles/rate limits, alphaXiv/arXivisual support.');
} finally { await browser.close(); }
