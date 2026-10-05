import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TOOLS, buildToolUrl } from '../src/lib/tools.ts';
const base = process.env.ARXIVHUB_URL || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined, headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://api.alphaxiv.org/**', route => route.fulfill({json:{universal_paper_id:'2504.16054',metrics:{public_total_votes:0}}}));
  await page.route('https://api.semanticscholar.org/**', route => route.fulfill({json:{paperId:'a'.repeat(40),citationCount:0,externalIds:{ArXiv:'2504.16054'}}}));
  await page.route('https://api.openalex.org/**', route => route.fulfill({json:{results:[]}}));
  await page.goto(base);
  assert.equal(await page.getByRole('button',{name:'全部',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('article').count(),Number(await page.locator('[data-category="all"] [data-category-count]').innerText()));
  const additions = [
    ['sciencestack','https://www.sciencestack.ai/','https://www.sciencestack.ai/paper/2504.16054'],
    ['summarizepaper','https://www.summarizepaper.com/','https://www.summarizepaper.com/en/arxiv-id/2504.16054'],
    ['arxivmax','https://www.arxivmax.com/','https://www.arxivmax.com/papers/2504.16054'],
    ['arxivlens','https://arxivlens.com/','https://arxivlens.com/search?query=&doiOrArxivId=2504.16054'],
    ['searchthearxiv','https://searchthearxiv.com/','https://searchthearxiv.com/?q=arXiv%3A2504.16054&tab=papers'],
    ['arxiv-py','https://github.com/lukasschwab/arxiv.py','https://github.com/lukasschwab/arxiv.py'],
  ];
  const latestAi = [
    ['weekinpapers','https://weekinpapers.com/','https://weekinpapers.com/paper/2504.16054'],
    ['the-latest-in-ai','https://thelatestinai.com/','https://thelatestinai.com/papers/2504.16054'],
    ['asxiv','https://asxiv.org/','https://asxiv.org/pdf/2504.16054'],
  ];
  const discovery = [
    ['scholarfeed','https://www.scholarfeed.org/','https://www.scholarfeed.org/paper/2504.16054'],
    ['aipapers','https://aipapers.ai/','https://aipapers.ai/search?search=2504.16054'],
    ['iarxiv','https://iarxiv.org/'],
    ['weekinpapers','https://weekinpapers.com/'],
    ['the-latest-in-ai','https://thelatestinai.com/'],
    ['benty-fields','https://www.benty-fields.com/seminars'],
    ['paperswipe','https://paperswipe.co/'],
    ['sota-papers','https://www.sotapapers.com/'],
    ['astro-arxiv-sanity','https://astro-arxiv-sanity.com/'],
    ['arxivtok','https://arxivtok.vercel.app/'],
    ['arxivdaily','https://www.arxivdaily.com/'],
    ['paperdance','https://paperdance.org/'],
    ['emergent-mind','https://www.emergentmind.com/'],
  ];
  const subscribe = [
    ['litdigest','https://litdigest.app/'], ['inveni','https://inveni.uk/'], ['uncited','https://uncited.org/'],
    ['arxivsub','https://arxivsub.comfyai.app/'], ['paperdigest','https://www.paperdigest.org/arxiv/'],
    ['scholar-inbox','https://www.scholar-inbox.com/'], ['arxiv-rss','https://ronpay.github.io/arxiv-rss-feed-generator/'],
    ['ggrxiv','https://www.ggrxiv.com/'],
  ];
  const catalogUpdates = [
    ['scry','https://scry.io/'],
    ['easyread','https://github.com/Edwardxlai/easyread'],
    ['pdf2zh','https://pdf2zh.com/'],
    ['zotero-arxiv-daily','https://github.com/TideDra/zotero-arxiv-daily'],
    ['latexml','https://latexml.rs/editor'],
    ['arcxiv','https://arcxiv.org/'],
  ];
  for (const [id, home, paper] of [...additions, ...latestAi, ...[...discovery, ...subscribe, ...catalogUpdates].map(([id, home, paper]) => [id, home, paper ?? home])]) {
    const tool = TOOLS.find((entry) => entry.id === id);
    if (tool.kind !== 'hub' && paper !== home) assert.equal(buildToolUrl(tool, {id:'2504.16054'}), paper);
    const card = page.locator(`article[data-tool-id="${id}"]`);
    assert.equal(await card.locator('a').getAttribute('href'), home);
    if (tool.icon) {
      const localIcon = card.locator(`img[src="${new URL(tool.icon, base).pathname}"]`);
      await localIcon.evaluate((img) => img.decode());
      assert.ok(await localIcon.evaluate((img) => img.naturalWidth > 0));
    } else {
      assert.ok(await card.locator('img, svg').count() > 0, `${id}: a card icon is rendered`);
    }
  }
  assert.equal(await page.locator('[data-tool-id="zotero-arxiv-reader"], [data-tool-id="zotarxiv"], [data-tool-id="zotero-convert-to-arxiv"], [data-tool-id="alphapulse"], [data-tool-id="discovery-daily"]').count(),0);
  const categories = [
    ['source', '原文', 6], ['ai-summary', 'AI解读', 14], ['ai-chat', 'AI问答', 7],
    ['search', '检索', 19], ['discussion', '讨论', 10], ['translate', '翻译', 4],
    ['discover', '发现', 13], ['subscribe', '订阅', 8], ['xiv', 'Xiv宇宙', 17],
    ['agent', 'Agent', 9], ['zotero', 'Zotero', 6], ['tool', 'Tool', 3],
  ];
  for (const [category, label, count] of categories) {
    const tab = page.locator(`button[data-category="${category}"]`);
    assert.equal(await tab.getAttribute('aria-label'), label);
    assert.equal(Number(await tab.locator('[data-category-count]').innerText()), count);
    await tab.click();
    assert.equal(await page.locator('article').count(), count);
    if (['agent', 'translate', 'zotero'].includes(category)) {
      for (const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.locator('[data-tool-grid]').screenshot({path:`../screenshots/catalog-${category}-updated-${name}.png`,animations:'disabled'});
      }
    }
  }
  await page.getByRole('button',{name:'Agent',exact:true}).click();
  const entries = [
    ['arxiv-txt','https://www.arxiv-txt.org/'], ['arxiv2md','https://www.arxiv2md.org/'],
    ['markxiv','https://markxiv.org/'], ['arxiv-mcp','https://github.com/blazickjp/arxiv-mcp-server'],
    ['alphaxiv-mcp','https://www.alphaxiv.org/docs/mcp'], ['deepxiv','https://data.rag.ac.cn/'],
    ['arxiv-py','https://github.com/lukasschwab/arxiv.py'], ['arcxiv','https://arcxiv.org/'],
    ['scry','https://scry.io/'],
  ];
  assert.equal(await page.locator('article').count(),9);
  for (const [id,url] of entries) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'),url);
  const toolTab = page.locator('button[data-category="tool"]');
  assert.equal(await page.locator('button[data-category]').last().getAttribute('data-category'),'tool');
  await toolTab.click();
  assert.equal(await toolTab.locator('[data-category-count]').innerText(),'3');
  assert.deepEqual(await page.locator('article').evaluateAll((cards) => cards.map((card) => card.dataset.toolId)),['latexml', 'easyread', 'zotero-bib']);
  for (const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
    await page.setViewportSize({width,height:900});
    await toolTab.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const tabBox = await toolTab.boundingBox();
    assert.ok(tabBox.x >= 0 && tabBox.x + tabBox.width <= width);
    await page.locator('[data-tool-grid]').locator('xpath=ancestor::section[1]').screenshot({path:`../screenshots/catalog-tool-category-${name}.png`,animations:'disabled'});
  }
  await page.getByRole('button',{name:'原文',exact:true}).click();
  assert.equal(await page.locator('article[data-tool-id="arxiv-txt"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="arxiv2md"]').count(),0);
  assert.equal(await page.locator('article').count(),6);
  await page.getByRole('button',{name:'AI解读',exact:true}).click();
  assert.equal(await page.locator('article').count(),14);
  for (const [id, home] of additions.slice(0, 4)) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'), home);
  assert.equal(await page.locator('article[data-tool-id="growbotics"] a').getAttribute('href'),'https://robotics.growbotics.ai/research/papers');
  assert.equal(await page.locator('article[data-tool-id="moonlight"] a').getAttribute('href'),'https://www.themoonlight.io/zh');
  assert.equal(await page.locator('article[data-tool-id="gist-science"] a').getAttribute('href'),'https://gist.science/');
  assert.equal(await page.locator('article[data-tool-id="emergent-mind"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="sciencecast"] a').getAttribute('href'),'https://www.sciencecast.org/');
  for (const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const clip = await page.evaluate(() => {
      const first = document.querySelector('article[data-tool-id="sciencestack"]').getBoundingClientRect();
      const last = document.querySelector('article[data-tool-id="arxivlens"]').getBoundingClientRect();
      const grid = document.querySelector('[data-tool-grid]').getBoundingClientRect();
      const top = Math.min(first.y, last.y);
      const bottom = Math.max(first.bottom, last.bottom);
      return {x:grid.x,y:top+scrollY,width:grid.width,height:bottom-top};
    });
    await page.screenshot({path:`../screenshots/ai-summary-new-sites-${name}.png`,animations:'disabled',fullPage:true,clip});
  }
  await page.getByRole('button',{name:'AI问答',exact:true}).click();
  assert.equal(await page.locator('article').count(),7);
  for (const [id, home] of latestAi.filter(([id]) => id === 'asxiv')) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'), home);
  assert.equal(await page.locator('article[data-tool-id="chatpaper"] a').getAttribute('href'),'https://chatpaper.com/');
  assert.equal(await page.locator('article[data-tool-id="chatdoc"] a').getAttribute('href'),'https://chatdoc.com/');
  assert.equal(await page.locator('article[data-tool-id="pwc"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="alphaxiv-overview"], article[data-tool-id="academic-chatpaper"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="paperdigest"]').count(),0, 'Paper Digest belongs to subscribe, not AI问答');
  for (const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const clip = await page.evaluate(() => {
      const first = document.querySelector('article[data-tool-id="chatpaper"]').getBoundingClientRect();
      const last = document.querySelector('article[data-tool-id="chatdoc"]').getBoundingClientRect();
      const grid = document.querySelector('[data-tool-grid]').getBoundingClientRect();
      const top = Math.min(first.y, last.y);
      const bottom = Math.max(first.bottom, last.bottom);
      return {x:grid.x,y:top+scrollY,width:grid.width,height:bottom-top};
    });
    await page.screenshot({path:`../screenshots/aichat-new-sites-${name}.png`,animations:'disabled',fullPage:true,clip});
  }
  await page.getByRole('button',{name:'发现',exact:true}).click();
  assert.equal(await page.locator('article').count(),13);
  for (const [id, home] of discovery) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'), home);
  assert.equal(await page.locator('article[data-tool-id="astro-arxiv-sanity"] a').getAttribute('href'),'https://astro-arxiv-sanity.com/');
  await page.setViewportSize({width:1280,height:900});
  await page.locator('article[data-tool-id="astro-arxiv-sanity"]').screenshot({path:'../screenshots/astro-arxiv-sanity-card.png',animations:'disabled'});
  await page.setViewportSize({width:1000,height:900});
  const latestDiscoveryClip = await page.evaluate(() => {
    const first = document.querySelector('article[data-tool-id="astro-arxiv-sanity"]').getBoundingClientRect();
    const last = document.querySelector('article[data-tool-id="arxivtok"]').getBoundingClientRect();
    const grid = document.querySelector('[data-tool-grid]').getBoundingClientRect();
    const top = Math.min(first.y, last.y);
    const bottom = Math.max(first.bottom, last.bottom);
    return {x:grid.x,y:top+scrollY,width:grid.width,height:bottom-top};
  });
  await page.screenshot({path:'../screenshots/discovery-tool-latest-additions.png',animations:'disabled',fullPage:true,clip:latestDiscoveryClip});
  assert.equal(await page.locator('article[data-tool-id="searchthearxiv"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="emergent-mind"]').count(),1);
  assert.equal(await page.locator('article[data-tool-id="iarxiv"] a').getAttribute('href'),'https://iarxiv.org/');
  assert.equal(await page.locator('article[data-tool-id="elicit"]').count(),0);
  assert.equal(await page.locator('article[data-tool-id="arxiv-rss"]').count(),0);
  for (const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const clip = await page.evaluate(() => {
      const first = document.querySelector('article[data-tool-id="benty-fields"]').getBoundingClientRect();
      const last = document.querySelector('article[data-tool-id="emergent-mind"]').getBoundingClientRect();
      const grid = document.querySelector('[data-tool-grid]').getBoundingClientRect();
      const top = Math.min(first.y, last.y);
      const bottom = Math.max(first.bottom, last.bottom);
      return {x:grid.x,y:top+scrollY,width:grid.width,height:bottom-top};
    });
    await page.screenshot({path:`../screenshots/discovery-additions-${name}.png`,animations:'disabled',fullPage:true,clip});
  }
  await page.locator('button[data-category="search"]').click();
  assert.equal(await page.locator('article').count(),19);
  assert.equal(await page.locator('article[data-tool-id="searchthearxiv"] a').getAttribute('href'),'https://searchthearxiv.com/');
  await page.getByRole('button',{name:'订阅',exact:true}).click();
  assert.equal(await page.locator('article').count(),8);
  for (const [id, home] of subscribe) assert.equal(await page.locator(`article[data-tool-id="${id}"] a`).getAttribute('href'), home);
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
  assert.equal(await page.getByTestId('paper-tools').getByRole('button',{name:'Tool',exact:true}).count(),0);
  assert.equal(await page.getByTestId('paper-tools').locator('[data-tool-id]').count(),54);
  assert.equal(await page.locator('#paper-tools-ai-summary [data-tool-id="gist-science"] a').getAttribute('href'),'https://gist.science/zh/paper/2504.16054');
  assert.equal(await page.locator('#paper-tools-ai-summary [data-tool-id="moonlight"] a').getAttribute('href'),'https://www.themoonlight.io/zh/review/05-a-vision-language-action-model');
  assert.equal(await page.locator('#paper-tools-ai-summary [data-tool-id="growbotics"] a').getAttribute('href'), 'https://robotics.growbotics.ai/research/papers');
  assert.equal(await page.locator('#paper-tools-translate [data-tool-id="pdf2zh"] a').getAttribute('href'), 'https://pdf2zh.com/');
  await page.locator('#paper-tools-translate [data-tool-id="pdf2zh"] img').last().evaluate((img) => img.decode());
  for (const [id, , paper] of [...additions.slice(0, 4)]) {
    const row = page.locator(`#paper-tools-ai-summary [data-tool-id="${id}"]`);
    assert.equal(await row.locator('a').getAttribute('href'), paper);
    await row.locator('img').last().evaluate((img) => img.decode());
  }
  const asxivRow = page.locator('#paper-tools-ai-chat [data-tool-id="asxiv"]');
  assert.equal(await asxivRow.locator('a').getAttribute('href'), 'https://asxiv.org/pdf/2504.16054');
  await asxivRow.locator('img').last().evaluate((img) => img.decode());
  for(const [width, name] of [[1280,'desktop'],[390,'mobile']]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const first = page.locator('#paper-tools-ai-summary [data-tool-id="sciencestack"]');
    const last = page.locator('#paper-tools-ai-summary [data-tool-id="arxivlens"]');
    await first.scrollIntoViewIfNeeded();
    const firstBox = await first.boundingBox();
    const lastBox = await last.boundingBox();
    const top = Math.min(firstBox.y, lastBox.y);
    const bottom = Math.max(firstBox.y + firstBox.height, lastBox.y + lastBox.height);
    await page.screenshot({path:`../screenshots/aichat-new-sites-paper-${name}.png`,animations:'disabled',clip:{x:firstBox.x,y:top,width:firstBox.width,height:bottom-top}});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: final category labels/counts, 9 Agent, 4 translation, 6 Zotero, 13 discovery, 8 subscribe and 3 Tool entries; exact added home/paper URL rules and local icons; 54 paper rows; preserved categories and title/TLDR math; desktop/mobile screenshots.');
} finally {await browser.close()}
