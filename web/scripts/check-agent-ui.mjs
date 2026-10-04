import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined, headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  assert.equal(await page.getByRole('button',{name:'全部',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('article').count(),Number(await page.locator('[data-category="all"] [data-category-count]').innerText()));
  await page.getByRole('button',{name:'Agent',exact:true}).click();
  const entries = [
    ['arxiv-txt','https://www.arxiv-txt.org/'], ['arxiv2md','https://www.arxiv2md.org/'],
    ['markxiv','https://markxiv.org/'], ['arxiv-mcp','https://github.com/blazickjp/arxiv-mcp-server'],
    ['alphaxiv-mcp','https://www.alphaxiv.org/docs/mcp'], ['deepxiv','https://data.rag.ac.cn/'],
  ];
  assert.equal(await page.locator('article').count(),6);
  for (const [id,url] of entries) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'),url);
  await page.getByRole('button',{name:'原文',exact:true}).click();
  assert.equal(await page.locator('article[data-tool-id="arxiv-txt"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="arxiv2md"]').count(),0);
  assert.equal(await page.locator('article').count(),6);
  assert.equal(await page.locator('article[data-tool-id="zotero-bib"] a').getAttribute('href'),'https://zbib.org/');
  await page.getByRole('button',{name:'AIChat',exact:true}).click();
  assert.equal(await page.locator('article').count(),19);
  assert.equal(await page.locator('article[data-tool-id="growbotics"] a').getAttribute('href'),'https://robotics.growbotics.ai/research/papers');
  assert.equal(await page.locator('article[data-tool-id="moonlight"] a').getAttribute('href'),'https://www.themoonlight.io/zh');
  assert.equal(await page.locator('article[data-tool-id="gist-science"] a').getAttribute('href'),'https://gist.science/');
  assert.equal(await page.locator('article[data-tool-id="emergent-mind"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="sciencecast"] a').getAttribute('href'),'https://www.sciencecast.org/');
  assert.equal(await page.locator('article[data-tool-id="chatpaper"] a').getAttribute('href'),'https://chatpaper.com/');
  assert.equal(await page.locator('article[data-tool-id="chatdoc"] a').getAttribute('href'),'https://chatdoc.com/');
  assert.equal(await page.locator('article[data-tool-id="pwc"] a').getAttribute('href'),'https://paperswithcode.co/');
  assert.equal(await page.locator('article[data-tool-id="alphaxiv-overview"], article[data-tool-id="academic-chatpaper"], article[data-tool-id="paperdigest"]').count(),0);
  await page.getByRole('button',{name:'发现',exact:true}).click();
  assert.equal(await page.locator('article[data-tool-id="emergent-mind"]').count(),1);
  assert.equal(await page.locator('article[data-tool-id="iarxiv"] a').getAttribute('href'),'https://iarxiv.org/');
  assert.equal(await page.locator('article[data-tool-id="elicit"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="arxiv-rss"] a').getAttribute('href'),'https://ronpay.github.io/arxiv-rss-feed-generator/');
  await page.route('https://api.microlink.io/**', route => route.abort());
  await page.route('https://r.jina.ai/**', route => route.fulfill({status:200,contentType:'text/plain',body:route.request().url().includes('arxivtldr.org')
    ? '## TLDR\nThis model $\\pi_{0.5}$ generalizes.\n### Key contributions\nHidden'
    : '# Title\n$\\pi_{0.5}$: A Vision-Language-Action Model\n# Authors\nPhysical Intelligence\n# Abstract\nA model $\\pi_0$.\n# Categories\ncs.LG\n# Publication Details\n- Published: April 22, 2025\n- arXiv ID: 2504.16054v1\n# BibTeX\n'}));
  await page.route('https://api.datacite.org/**',route=>route.fulfill({status:404,body:'not found'}));
  await page.goto(new URL('p/2504.16054',base).href);
  await page.locator('h1 .katex').waitFor();
  await page.getByTestId('paper-tldr').locator('.katex').waitFor();
  assert.equal(await page.locator('h1 .katex-error').count(),0);
  assert.equal(await page.getByTestId('paper-tldr').locator('.katex-error').count(),0);
  assert.equal(await page.locator('h1 a').getAttribute('href'),'https://arxiv.org/abs/2504.16054');
  assert.doesNotMatch(await page.locator('h1 .katex-html').innerText(), /\$|\\pi/);
  assert.equal(await page.getByTestId('paper-tools').getByRole('button',{name:'Agent',exact:true}).count(),0);
  assert.equal(await page.locator('#paper-tools-ai [data-tool-id="gist-science"] a').getAttribute('href'),'https://gist.science/zh/paper/2504.16054');
  assert.equal(await page.locator('#paper-tools-ai [data-tool-id="moonlight"] a').getAttribute('href'),'https://www.themoonlight.io/zh/review/05-a-vision-language-action-model');
  assert.equal(await page.locator('#paper-tools-ai [data-tool-id="growbotics"] a').getAttribute('href'), 'https://robotics.growbotics.ai/research/papers');
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: Agent/source categories; nineteen AIChat tools; Gist Science, Moonlight and Growbotics home/paper links; discovery includes Emergent Mind and IArxiv; removed entries absent; title/TLDR math; desktop/mobile.');
} finally {await browser.close()}
