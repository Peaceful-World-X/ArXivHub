import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.ARXIVHUB_URL || "http://127.0.0.1:8080/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  await context.route("https://api.microlink.io/**", (route) => route.abort());
  let historyUnavailable = false;
  await context.route('https://api.datacite.org/**', async (route) => {
    if (historyUnavailable) return route.fulfill({status:503, body:'Unavailable'});
    const attention = route.request().url().includes('1706.03762');
    const id = attention ? '1706.03762' : '2608.15875';
    const dates = [{date:attention ? '2017-06-12T17:57:34Z' : '2026-08-16T17:54:15Z', dateType:'Submitted', dateInformation:'v1'}];
    if (attention) dates.push({date:'2023-08-02T00:41:18Z', dateType:'Submitted', dateInformation:'v7'});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{attributes:{doi:`10.48550/arxiv.${id}`,version:attention?'7':'1',dates}}})});
  });
  // 固定外部响应，验证界面行为而不依赖第三方限流或网络状态。
  await context.route("https://r.jina.ai/**", async (route) => {
    const url = route.request().url();
    if (historyUnavailable && url.includes('/https://arxiv.org/abs/')) return route.fulfill({status:403,body:'Unavailable'});
    const text = url.includes("/https://arxiv.org/abs/")
      ? url.endsWith("1706.03762")
        ? '## Submission history\n**[[v1]](https://arxiv.org/abs/1706.03762v1)** Mon, 12 Jun 2017 17:57:34 UTC (100 KB)\n**[v2]** Wed, 2 Aug 2023 00:41:18 UTC (100 KB)'
        : '## Submission history\n**[v1]** Sun, 16 Aug 2026 17:54:15 UTC (100 KB)'
      : url.includes("arxiv-txt")
      ? `# Title\nExample Paper\n# Authors\nFirst Author, Second Author\n# Abstract\nComparison with $\\pi_{0.5}$ and $x^2$.\n# Categories\ncs.RO\n# Publication Details\n- Published: August 16, 2026\n- arXiv ID: ${url.includes('1706.03762') ? '1706.03762v7' : '2608.15875v1'}\n# BibTeX\n`
      : 'Markdown Content:\n## TLDR\nThe model generalizes across robots.\n### Key contributions\nSECRET CONTRIBUTIONS\n### Why it matters\nSECRET IMPORTANCE\n## Original Abstract\nSECRET ABSTRACT';
    await route.fulfill({ status: 200, contentType: "text/plain", body: text });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  assert.equal(await page.locator('header a[href$="/catalog"]').count(), 0);
  const defaults = [
    ['paperdance', 'https://paperdance.org/'], ['arxivdaily', 'https://www.arxivdaily.com/'],
    ['alphaxiv', 'https://www.alphaxiv.org/'], ['hjfy', 'https://hjfy.top/arxiv/2608.15875'],
    ['papers-cool', 'https://papers.cool/arxiv/2608.15875'], ['arxivtldr', 'https://arxivtldr.org/abs/2608.15875'],
  ];
  assert.equal(await page.getByRole('button', {name:'全部',exact:true}).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.locator('button[data-category]').evaluateAll(items=>items.slice(0,2).map(el=>el.dataset.category)), ['all','favorites']);
  assert.equal(await page.locator('article').count(),Number(await page.locator('[data-category="all"] [data-category-count]').innerText()));
  await page.getByRole('button', {name:'收藏',exact:true}).click();
  const publishedOrder = JSON.parse(readFileSync(new URL('../src/lib/default-tool-orders.json', import.meta.url),'utf8')).favorites ?? [];
  const rank = (id) => publishedOrder.includes(id) ? publishedOrder.indexOf(id) : publishedOrder.length;
  assert.deepEqual(await page.locator('article').evaluateAll(es=>es.map(e=>e.dataset.toolId)), defaults.map(([id])=>id).sort((a,b)=>rank(a)-rank(b)));
  for (const [id,url] of defaults) {
    const card=page.locator(`article[data-tool-id="${id}"]`);
    assert.equal(await card.locator('a').getAttribute('href'),url);
    await card.getByRole('button',{name:'取消收藏',exact:true}).click();
    assert.equal(await page.locator('article').count(),Number(await page.locator('[data-category="favorites"] [data-category-count]').innerText()));
  }
  await page.getByRole("status").filter({ hasText: "暂无收藏" }).waitFor();
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.locator('[data-tool-id="alphaxiv"]').getByRole("button", { name: "收藏网站", exact: true }).click();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  assert.deepEqual(await page.locator("article").evaluateAll((items) => items.map((el) => el.dataset.toolId)), ["alphaxiv"]);
  await page.reload();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  assert.equal(await page.locator("article").count(), 1);
  await page.getByPlaceholder("筛选工具").fill("not-a-tool");
  await page.getByRole("status").waitFor();
  assert.equal(await page.locator("article").count(), 0);
  await page.getByPlaceholder("筛选工具").fill("");

  await page.goto(new URL("p/2608.15875", base).href);
  await page.getByTestId("paper-authors").waitFor();
  assert.equal(await page.getByTestId("paper-authors").innerText(), "First Author · 等");
  const list = page.getByTestId("paper-tools");
  const tldr = page.getByTestId("paper-tldr");
  await tldr.getByText("The model generalizes across robots.", { exact: true }).waitFor();
  assert.equal(await tldr.locator("a").count(), 0);
  assert.doesNotMatch(await tldr.innerText(), /arxivtldr\.org/);
  assert.doesNotMatch(await tldr.innerText(), /SECRET|主要贡献|为什么这很重要|Semantic Scholar|Zotero/);
  assert.deepEqual(await list.locator("h3").allTextContents(), ["讨论", "AIChat", "检索", "翻译"]);
  assert.equal(await list.getByRole('button', {name:'原文',exact:true}).count(),0);
  assert.equal(await list.getByRole('button', {name:'讨论',exact:true}).getAttribute('aria-pressed'),'true');
  const expectedGroups = [['discussion','讨论',11],['ai','AIChat',17],['search','检索',9],['translate','翻译',3]];
  for(const [id,label,count] of expectedGroups) {
    assert.equal(Number(await list.getByRole('button',{name:label,exact:true}).locator('[data-category-count]').innerText()),count);
    assert.equal(await list.locator(`#paper-tools-${id} [data-tool-id]`).count(),count);
  }
  assert.equal(await list.locator('[data-tool-id="openreview"] a').getAttribute('href'),'https://openreview.net/search?term=Example%20Paper');
  assert.equal(await list.locator('[data-tool-id="pubpeer"] a').getAttribute('href'),'https://www.pubpeer.com/search?q=2608.15875');
  assert.equal(await list.locator('[data-tool-id="prereview"] a').getAttribute('href'),'https://prereview.org/preprints/doi-10.48550-arxiv.2608.15875/write-a-prereview');
  assert.equal(await list.locator('[data-tool-id="gotit"] a').getAttribute('href'),'https://gotit.pub/view/2608.15875');
  assert.equal(await page.getByTestId('paper-document-actions').getByRole('link',{name:'arXiv 外部引用（Trackbacks）',exact:true}).getAttribute('href'),'https://arxiv.org/tb/2608.15875');
  assert.equal(await list.locator('#paper-tools-discussion [data-tool-id="hf-papers"] a').getAttribute('href'),'https://huggingface.co/papers/2608.15875');
  assert.equal(await list.locator('[data-tool-id="researchhub"]').count(),0);
  assert.equal(await list.locator('[data-tool-id="openalex"] a').getAttribute('href'),'https://openalex.org/works?filter=default.search:Example%20Paper');
  assert.equal(await list.locator('#paper-tools-ai [data-tool-id="pwc"] a').getAttribute('href'), 'https://paperswithcode.co/paper/2608.15875');
  assert.equal(await list.locator("article, input").count(), 0);
  const rows = list.locator("[data-tool-id]");
  assert.equal(await rows.count(), 40);
  for(const [id,url] of [
    ['chatpaper','https://chatpaper.com/'], ['chatdoc','https://chatdoc.com/'],
    ['explainpaper','https://www.explainpaper.com/'], ['sciencecast','https://www.sciencecast.org/'],
    ['arxiv-bshk','https://arxiv.bshk.app/'], ['litmaps','https://app.litmaps.com/preview'],
    ['chinarxiv','https://chinarxiv.chatpaper.top/'], ['immersive-translate','https://app.immersivetranslate.com/babel-doc/'],
  ]) assert.equal(await list.locator(`[data-tool-id="${id}"] a`).getAttribute('href'),url);
  assert.equal(await list.getByText(/发现|Zotero|ArXiv Daily|PaperDance/).count(), 0);
  assert.equal(await list.locator('[data-tool-id="arxiv-txt"], [data-tool-id="alphaxiv-overview"], [data-tool-id="paperdigest"]').count(), 0);
  assert.equal(await list.locator('[data-tool-id="hjfy"] img').last().getAttribute("src"), new URL("icons/hjfy.svg", base).pathname);
  assert.equal(await page.getByRole("heading", { name: "Abstract", exact: true }).count(), 1);
  assert.equal(await page.locator('[aria-controls="paper-abstract"]').count(), 0);
  assert.ok(await page.locator('#paper-abstract .paper-math').evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
  assert.equal(await page.locator("h1 a").getAttribute("href"), "https://arxiv.org/abs/2608.15875");
  assert.equal((await page.getByTestId("paper-submitted").innerText()).replace(/\s+/g, " "), "首次提交 2026-08-16");
  assert.equal(await page.getByTestId("paper-updated").count(), 0);
  assert.equal(await page.getByTestId("paper-version").innerText(), 'v1');
  const quick = page.getByTestId("paper-quick-bar");
  for (const [id, href] of [
    ["alphaxiv", "https://www.alphaxiv.org/abs/2608.15875"],
    ["hjfy", "https://hjfy.top/arxiv/2608.15875"],
    ["papers-cool", "https://papers.cool/arxiv/2608.15875"],
    ["arxivtldr", "https://arxivtldr.org/abs/2608.15875"],
    ["google-scholar", "https://scholar.google.com/scholar_lookup?arxiv_id=2608.15875"],
    ["emergent-mind", "https://www.emergentmind.com/papers/2608.15875"],
    ["arxivxplorer", "https://arxivxplorer.com/?q=2608.15875"],
    ["openreview", "https://openreview.net/search?term=Example%20Paper"],
    ["connected-papers", "https://www.connectedpapers.com/api/redirect/arxiv/2608.15875"],
    ["semantic-scholar", "https://www.semanticscholar.org/search?q=Example%20Paper"],
  ]) {
    assert.equal(await quick.locator(`[data-quick-tool="${id}"]`).getAttribute("href"), href);
  }
  assert.deepEqual(await quick.locator("[data-quick-tool]").evaluateAll((items) => items.map((el) => el.dataset.quickTool)), [
    "alphaxiv", "hjfy", "papers-cool", "arxivtldr",
    "emergent-mind", "arxivxplorer", "openreview", "connected-papers",
    "semantic-scholar", "google-scholar",
  ]);
  assert.equal(await quick.locator('[data-quick-tool="talk2arxiv"], [data-quick-tool="arxivisual"]').count(),0);
  assert.equal(await quick.locator('[data-quick-tool="github"]').count(),0);
  assert.ok((await quick.boundingBox()).y < (await page.locator("h1").boundingBox()).y);
  assert.equal(await quick.locator("button").count(), 1);
  assert.equal(await quick.locator('[data-quick-tool="arxiv-abs"]').count(), 0);
  assert.equal(await quick.getByRole("button", { name: "打开已核验深链", exact: true }).count(), 0);
  assert.equal(await quick.getByRole("button", { name: "复制 ID", exact: true }).count(), 0);
  assert.ok(await quick.locator('a[href="https://arxiv.org/abs/2608.15875"]').evaluate((el) => Number(getComputedStyle(el).fontWeight) >= 700));
  const metaBlocks = page.getByTestId("paper-metadata").locator(":scope > *");
  assert.equal(await metaBlocks.count(), 4);
  assert.ok(await metaBlocks.evaluateAll((items) => items.every((el) => getComputedStyle(el).borderTopWidth === "1px" && el.getBoundingClientRect().height === 36)));
  await page.locator(".paper-math .katex").first().waitFor();
  assert.equal(await page.locator(".paper-math .katex").count(), 2);
  assert.equal(await page.locator(".katex-error").count(), 0);
  assert.equal(await page.locator("#paper-abstract").isVisible(), true);
  await page.getByRole("button", { name: "复制 BibTeX", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^@article\{/);
  assert.match(copied, /title=\{Example Paper\}/);
  assert.match(copied, /eprint=\{2608\.15875\}/);

  const aiSection = page.getByTestId("paper-ai-links");
  assert.equal(await aiSection.locator('details, summary, textarea, button').count(), 0);
  const bottom = page.getByTestId("paper-bottom-actions");
  assert.equal(await page.locator('header [data-testid="paper-bottom-actions"]').count(), 1);
  assert.equal(await quick.locator('[data-quick-tool="xiaohongshu"], [data-quick-tool="x-search"]').count(), 0);
  assert.equal(await bottom.locator('[data-social-tool="xiaohongshu"]').getAttribute('href'), 'https://www.xiaohongshu.com/search_result?keyword=Example%20Paper');
  assert.equal(await bottom.locator('[data-social-tool="x-search"]').getAttribute('href'), 'https://x.com/search?q=Example%20Paper');
  assert.deepEqual(await bottom.locator('[data-social-tool]').evaluateAll(items=>items.map(el=>el.dataset.socialTool)),['xiaohongshu','x-search','reddit-search','zhihu-search','hf-papers']);
  assert.equal(await bottom.locator('[data-social-tool="hf-papers"]').getAttribute('href'),'https://huggingface.co/papers/2608.15875');
  for(const [id,url] of [['reddit-search','https://www.reddit.com/search/?q=Example%20Paper'],['zhihu-search','https://www.zhihu.com/search?type=content&q=Example%20Paper']]) {
    assert.equal(await bottom.locator(`[data-social-tool="${id}"]`).getAttribute('href'),url);
    assert.equal(await list.locator(`[data-tool-id="${id}"] a`).getAttribute('href'),url);
    await bottom.locator(`[data-social-tool="${id}"] img`).last().evaluate(img=>img.decode());
  }
  assert.ok((await bottom.boundingBox()).y >= (await page.locator('#paper-abstract').boundingBox()).y + (await page.locator('#paper-abstract').boundingBox()).height);
  const assistants = [
    ["ChatGPT", "https://chatgpt.com/"], ["Claude", "https://claude.ai/new"],
    ["Kimi", "https://www.kimi.com/"], ["Gemini", "https://gemini.google.com/app"], ["Grok", "https://grok.com/"],
  ];
  assert.equal(await aiSection.locator("a").count(), assistants.length);
  for (const [name, url] of assistants) {
    await context.route(url, (route) => route.fulfill({ status: 200, body: 'AI destination test', contentType: 'text/html' }));
    const link = aiSection.getByRole("link", { name, exact: true });
    assert.equal(await link.getAttribute("href"), url);
    assert.equal((await link.innerText()).trim(), '');
    assert.ok(await link.getAttribute('title'));
    await link.locator("img").evaluate((img) => img.decode());
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.equal(popup.url(), url);
    await popup.close();
    await page.bringToFront();
    await aiSection.getByRole("status").filter({ hasText: "提问已复制" }).waitFor();
    const question = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(question, /Example Paper/);
    assert.match(question, /https:\/\/arxiv.org\/abs\/2608.15875/);
    assert.match(question, /The model generalizes across robots/);
    assert.doesNotMatch(question, /Comparison with|\n\s*\n/);
    assert.equal(question.split('\n').length, 4);
    assert.ok(question.startsWith('请分析'));
  }
  await page.getByRole('button', { name: 'Toggle language' }).click();
  assert.equal(await page.getByRole('heading', { name: 'Abstract', exact: true }).count(), 1);
  assert.equal(await aiSection.getByText('Question', { exact: true }).count(), 0);
  const englishPopupPromise = page.waitForEvent('popup');
  await aiSection.getByRole('link', { name: 'ChatGPT', exact: true }).click();
  await (await englishPopupPromise).close();
  await page.bringToFront();
  await aiSection.getByRole('status').filter({ hasText: 'Question copied' }).waitFor();
  assert.ok((await page.evaluate(() => navigator.clipboard.readText())).startsWith('Analyze this paper'));
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new Error('denied')) });
  });
  const failedCopyPopupPromise = page.waitForEvent('popup');
  await aiSection.getByRole('link', { name: 'ChatGPT', exact: true }).click();
  await (await failedCopyPopupPromise).close();
  await aiSection.getByRole("status").filter({ hasText: "复制失败" }).waitFor();
  assert.equal(await aiSection.locator('details, summary, textarea').count(), 0);

  await page.goto(new URL("p/1706.03762", base).href);
  await page.getByTestId("paper-updated").waitFor();
  assert.equal((await page.getByTestId("paper-submitted").innerText()).replace(/\s+/g, " "), "首次提交 2017-06-12");
  assert.equal((await page.getByTestId("paper-updated").innerText()).replace(/\s+/g, " "), "最近更新 2023-08-02");
  assert.equal(await page.getByTestId("paper-version").innerText(), 'v7');
  historyUnavailable = true;
  await page.reload();
  await page.getByTestId('paper-version').waitFor();
  assert.equal(await page.getByTestId('paper-version').innerText(), 'v7');
  assert.match(await page.getByTestId('paper-updated').innerText(), /暂未获取/);
  historyUnavailable = false;

  await list.locator('[data-tool-id="alphaxiv"]').getByRole("button", { name: "取消收藏", exact: true }).click();
  await list.locator('[data-tool-id="hjfy"]').getByRole("button", { name: "收藏网站", exact: true }).click();
  await page.goto(base);
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  assert.deepEqual(await page.locator("article").evaluateAll((items) => items.map((el) => el.dataset.toolId)), ["hjfy"]);
  await page.getByRole("button", { name: "取消收藏", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "暂无收藏" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  assert.equal(await page.locator("article").count(), 0);

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(new URL("p/2608.15875", base).href);
    await page.getByTestId("paper-authors").waitFor();
    const toolbar = page.getByTestId("paper-quick-bar");
    const thirdPartyBox = await toolbar.getByRole("navigation").boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    const iconPositions = await toolbar.locator("[data-quick-tool]").evaluateAll((items) => items.map((el) => {
      const box = el.getBoundingClientRect(); return { x: box.x, y: box.y };
    }));
    assert.ok(iconPositions.every((pos, i) => pos.y === iconPositions[0].y && (!i || pos.x > iconPositions[i - 1].x)));
    await toolbar.locator('[data-quick-tool="google-scholar"]').scrollIntoViewIfNeeded();
    assert.equal(await toolbar.locator('[data-quick-tool="google-scholar"]').isVisible(), true);
    assert.ok(Math.abs(thirdPartyBox.x + thirdPartyBox.width - toolbarBox.x - toolbarBox.width) < 2);
    if (width > 640) {
      const localBox = await page.getByTestId("paper-document-actions").boundingBox();
      assert.ok(localBox.x + localBox.width < thirdPartyBox.x);
    }
    const bottomBox = await bottom.boundingBox();
    const aiBox = await aiSection.boundingBox();
    const socialBox = await bottom.getByRole('navigation').boundingBox();
    assert.ok(Math.abs(aiBox.x - bottomBox.x) < 2);
    assert.ok(Math.abs(socialBox.x + socialBox.width - bottomBox.x - bottomBox.width) < 2);
    if (width > 640) assert.ok(aiBox.x + aiBox.width < socialBox.x);
    const metaY = await page.getByTestId("paper-metadata").locator(":scope > *").evaluateAll((elements) => elements.map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.y + rect.height / 2;
    }));
    assert.ok(Math.max(...metaY) - Math.min(...metaY) < 2);
    const nav = list.getByRole("navigation");
    const navBox = await nav.boundingBox();
    const firstRowBox = await rows.first().boundingBox();
    assert.ok(navBox.x + navBox.width < firstRowBox.x);
    const navButtons = await nav.locator("button").evaluateAll((items) => items.map((el) => el.getBoundingClientRect().y));
    assert.ok(navButtons.every((y, i) => !i || y > navButtons[i - 1]));
    await nav.getByRole("button", { name: "AIChat", exact: true }).click();
    assert.equal(await nav.getByRole("button", { name: "AIChat", exact: true }).getAttribute("aria-pressed"), "true");
    assert.ok(Math.abs((await page.locator("#paper-tools-ai").boundingBox()).y - 24) < 3);
    const boxes = await rows.evaluateAll((items) => items.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, bottom: r.bottom, height: r.height };
    }));
    assert.ok(boxes.every((r) => r.height === 56));
    assert.ok(boxes.every((r, i) => !i || (r.x === boxes[0].x && r.y >= boxes[i - 1].bottom)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  }
  assert.deepEqual(errors, []);
  const legacyContext = await browser.newContext();
  const legacy = await legacyContext.newPage();
  await legacy.goto(base);
  await legacy.evaluate(() => localStorage.setItem('arxiv-hub', JSON.stringify({version:0,state:{lang:'zh',pinned:['zotmeta'],history:[{id:'1706.03762',title:'Saved title',at:123}]}})));
  await legacy.reload();
  await legacy.getByRole('button',{name:'收藏',exact:true}).click();
  assert.equal(await legacy.locator('article').count(),7);
  assert.equal(await legacy.locator('article[data-tool-id="zotmeta"]').count(),1);
  await legacy.locator('article[data-tool-id="paperdance"]').getByRole('button',{name:'取消收藏',exact:true}).click();
  await legacy.reload();
  await legacy.getByRole('button',{name:'收藏',exact:true}).click();
  assert.equal(await legacy.locator('article').count(),6);
  assert.equal(await legacy.locator('article[data-tool-id="paperdance"]').count(),0);
  assert.equal(await legacy.evaluate(()=>JSON.parse(localStorage.getItem('arxiv-hub')).state.history[0].title),'Saved title');
  await legacyContext.close();
  console.log("PASS: fixed Abstract (ZH/EN), enlarged full text, no question editor, compact prompt clipboard/popup/failure, Scholar last, toolbar, dates, favorites, desktop/mobile.");
} finally {
  await browser.close();
}
