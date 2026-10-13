import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.ARXIVHUB_URL || "http://127.0.0.1:8082/";
const live = process.env.LIVE_TLDR === "1";
const source = await readFile(new URL("../../ArXivHub.user.js", import.meta.url), "utf8");
const id = "2303.08774";
const summary = "GPT-4 is a large-scale multimodal Transformer model achieving human-level performance on professional and academic benchmarks through advanced training and alignment techniques.";
const fixture = `<h2>TLDR</h2><p>${summary}</p><h3>Key contributions</h3><p>DO NOT INCLUDE</p><h2>Original Abstract</h2><p>NOT THE SUMMARY</p>`;
const markdown = `TL;DR\n-----\n${summary}\n\nDO NOT INCLUDE a second paragraph.\n### Other section\nNOT THE SUMMARY`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, chromiumSandbox: true, args: ["--disable-dev-shm-usage"] });
const results = [];

async function scenario({ mode = "direct", delay = 0, webWorks = false, installed = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: "zh-CN" });
  const counts = { direct: 0, scriptReader: 0, web: 0 };
  const state = { webWorks };
  const events = [];
  const errors = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(base).origin) return route.continue();
    if (url.startsWith("https://api.microlink.io")) {
      counts.web++;
      events.push("web-extractor");
      if (!state.webWorks) return route.fulfill({ status: 400, json: { code: "EPROXYNEEDED" } });
      return route.fulfill({ json: { status: "success", statusCode: 200, data: { url: `https://arxivtldr.org/abs/${id}`, tldr: summary } } });
    }
    if (url.startsWith("https://r.jina.ai/https://arxivtldr.org/")) {
      counts.web++;
      events.push("web-reader");
      return route.fulfill({ status: 503, body: "Unavailable" });
    }
    if (live) return route.continue();
    if (url.startsWith("https://api.datacite.org/")) return route.fulfill({ json: { data: { attributes: {
      doi: `10.48550/arxiv.${id}`, titles: [{ title: "GPT-4 Technical Report" }],
      creators: [{ name: "OpenAI" }], descriptions: [{ descriptionType: "Abstract", description: "We report the development of GPT-4." }],
    } } } });
    return route.abort();
  });
  await context.exposeBinding("readPublicTldr", async (_context, options) => {
    const direct = options.url === `https://arxivtldr.org/abs/${id}`;
    assert.ok(direct || options.url === `https://r.jina.ai/https://arxivtldr.org/abs/${id}`, options.url);
    assert.equal(options.anonymous, true);
    counts[direct ? "direct" : "scriptReader"]++;
    events.push(direct ? "script-direct" : "script-reader");
    if (live) {
      const response = await context.request.get(options.url, { timeout: options.timeout, headers: options.headers });
      return { status: response.status(), responseText: await response.text() };
    }
    if (mode === "fail") return { status: 503, responseText: "Unavailable" };
    if (mode === "empty") return { status: 200, responseText: "<h2>Original Abstract</h2><p>NOT THE SUMMARY</p>" };
    if (["reader", "reader-inline-list"].includes(mode) && direct) return { status: 200, responseText: "<div id='app'>Loading</div>" };
    if (mode === "reader-inline-list") return { status: 200, responseText: `## TLDR\n${summary.replace("GPT-4", "`GPT-4`")}\n- DO NOT INCLUDE this contribution.\n### Next section\nNOT THE SUMMARY` };
    if (mode === "wrong-section") return { status: 200, responseText: direct
      ? "<h2>TLDR</h2><h3>Another section</h3><p>This paragraph is not a summary and must not be cached.</p>"
      : "## TLDR\n### Another section\nThis paragraph is not a summary and must not be cached." };
    if (mode === "quota") return { status: 200, responseText: direct
      ? "<h2>TLDR</h2><p>You have reached your weekly free summary limit. Please upgrade your plan.</p>"
      : "## TLDR\nYou have reached your weekly free summary limit. Please upgrade your plan." };
    if (mode === "pending" && direct && counts.direct === 1) return { status: 200, responseText: "<h2>TLDR</h2><p>Generating AI summary, please wait while we prepare this paper.</p>" };
    if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, direct ? 8000 : 9000));
    if (mode === "slow" && direct) return { status: 200, responseText: "<div>Loading</div>" };
    return { status: 200, responseText: direct ? fixture : markdown };
  });
  await context.addInitScript(() => {
    localStorage.setItem("arxivhub-language", "zh");
    window.GM_xmlhttpRequest = (options) => {
      let settled = false;
      const timer = setTimeout(() => { settled = true; options.ontimeout?.(); }, options.timeout);
      window.readPublicTldr({ url: options.url, headers: options.headers, timeout: options.timeout, anonymous: options.anonymous }).then(
        (response) => { if (!settled) { settled = true; clearTimeout(timer); options.onload(response); } },
        () => { if (!settled) { settled = true; clearTimeout(timer); options.onerror?.(); } },
      );
      return { abort: () => { settled = true; clearTimeout(timer); options.onabort?.(); } };
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL(`p/${id}`, base).href, { waitUntil: "domcontentloaded" });
  const panel = page.getByTestId("paper-tldr");
  await panel.waitFor();
  if (installed) {
    await page.waitForTimeout(delay);
    await page.addScriptTag({ content: source });
  }
  return { context, page, panel, counts, events, errors, state };
}

async function expectSummary(s) {
  await s.panel.getByText(summary, { exact: true }).waitFor({ timeout: 35000 });
  assert.doesNotMatch(await s.panel.innerText(), /DO NOT INCLUDE|NOT THE SUMMARY/);
  assert.deepEqual(s.errors, []);
}

try {
  // Inject after the React page exists, rather than unrealistically before navigation.
  const direct = await scenario({ delay: 1500 });
  await expectSummary(direct);
  assert.deepEqual(direct.counts, { direct: 1, scriptReader: 0, web: 0 });
  assert.equal(await direct.panel.getByTestId("tldr-source").count(), 0);
  assert.doesNotMatch(await direct.panel.innerText(), /脚本辅助读取/);
  assert.equal(await direct.page.locator("#arxivhub-bookmarks").count(), 0);
  await direct.page.evaluate(() => {
    window.postMessage({ channel: "arxivhub:tldr:v1", type: "request", requestId: "invalid", id: "https://example.com/" }, location.origin);
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: "https://example.com", data: { channel: "arxivhub:tldr:v1", type: "request", requestId: "foreign", id: "1706.03762" } }));
  });
  await direct.page.waitForTimeout(150);
  assert.equal(direct.counts.direct, 1);
  if (live || process.env.CAPTURE_PREVIEW === "1") {
    await mkdir(new URL("../../screenshots/", import.meta.url), { recursive: true });
    await direct.page.getByRole("heading", { name: "GPT-4 Technical Report", exact: true }).waitFor({ timeout: 30000 });
    const detail = direct.page.locator("header").filter({ has: direct.page.getByTestId("paper-quick-bar") });
    if (!live) await detail.evaluate((element) => {
      const label = document.createElement("p");
      label.textContent = "回归测试预览 · 模拟网络响应，非线上实拍";
      label.style.cssText = "padding:12px;border:1px solid #b31b1b;color:#b31b1b;font:14px sans-serif;background:#fff1ee";
      element.prepend(label);
    });
    const suffix = live ? "" : "-preview";
    await detail.screenshot({ path: new URL(`../../screenshots/tldr-script-first-desktop${suffix}.png`, import.meta.url).pathname });
    await direct.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await direct.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await detail.screenshot({ path: new URL(`../../screenshots/tldr-script-first-mobile${suffix}.png`, import.meta.url).pathname });
  }
  await direct.page.reload({ waitUntil: "domcontentloaded" });
  await expectSummary(direct);
  assert.equal(await direct.panel.getByTestId("tldr-source").count(), 0);
  await direct.page.addScriptTag({ content: source });
  await direct.page.waitForFunction(() => document.querySelector('[data-testid="paper-tldr"]')?.getAttribute("aria-busy") === "false");
  assert.deepEqual(direct.counts, { direct: 2, scriptReader: 0, web: 0 });
  results.push({ scenario: "delayed script, source, persistent cache, origin checks", ...direct.counts });
  await direct.context.close();

  if (!live) {
    for (const mode of ["reader", "reader-inline-list", "pending", "slow"]) {
      const s = await scenario({ mode });
      await expectSummary(s);
      assert.equal(s.counts.web, 0);
      assert.equal(s.counts.direct, mode === "pending" ? 2 : 1);
      assert.equal(s.counts.scriptReader, mode === "pending" ? 0 : 1);
      results.push({ scenario: mode, ...s.counts });
      await s.context.close();
    }
    for (const mode of ["empty", "fail", "wrong-section", "quota"]) {
      const s = await scenario({ mode, webWorks: true });
      await expectSummary(s);
      assert.deepEqual(s.events, ["script-direct", "script-reader", "web-extractor"]);
      results.push({ scenario: `${mode} then web fallback`, ...s.counts });
      await s.context.close();
    }
    const connectedFailure = await scenario({ mode: "fail" });
    await connectedFailure.panel.getByText("TLDR 获取失败", { exact: true }).waitFor();
    assert.equal(await connectedFailure.panel.getByTestId("tldr-failure-detail").count(), 0);
    assert.equal(await connectedFailure.panel.getByRole("button", { name: "安装 / 更新脚本", exact: true }).count(), 1);
    connectedFailure.state.webWorks = true;
    await connectedFailure.panel.getByRole("button", { name: "重试", exact: true }).click();
    await expectSummary(connectedFailure);
    assert.equal(connectedFailure.counts.direct, 2);
    results.push({ scenario: "connected failure and retry", ...connectedFailure.counts });
    await connectedFailure.context.close();

    const missing = await scenario({ installed: false });
    await missing.panel.getByText("TLDR 获取失败", { exact: true }).waitFor();
    assert.equal(await missing.panel.getByTestId("tldr-failure-detail").count(), 0);
    await missing.panel.getByRole("button", { name: "安装 / 更新脚本", exact: true }).click();
    await missing.page.getByRole("dialog").waitFor();
    await missing.page.getByRole("button", { name: "关闭安装教程", exact: true }).click();
    await missing.page.addScriptTag({ content: source });
    await missing.panel.getByRole("button", { name: "重试", exact: true }).click();
    await expectSummary(missing);
    assert.equal(missing.counts.direct, 1);
    assert.equal(missing.counts.web, 2);
    results.push({ scenario: "no script; install and retry", ...missing.counts });
    await missing.context.close();
  }
  console.log(JSON.stringify({ live, results, pageErrors: [] }, null, 2));
} finally {
  await browser.close();
}
