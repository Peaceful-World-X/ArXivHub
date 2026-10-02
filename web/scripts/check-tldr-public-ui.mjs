import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.ARXIVHUB_URL || "http://127.0.0.1:8083/";
const live = process.env.LIVE_TLDR === "1";
const papers = [
  ["2303.08774", /GPT-4/i],
  ["1706.03762", /Transformer|attention/i],
  ["2504.16054", /robot|vision|language/i],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  let readerRequests = 0;
  const apiRequests = [];
  const errors = [];
  await context.route("https://r.jina.ai/**", (route) => {
    if (route.request().url().includes("arxivtldr.org")) readerRequests++;
    return route.abort();
  });
  if (!live) {
    await context.route("https://api.datacite.org/**", (route) => route.fulfill({ status: 404 }));
    await context.route("https://api.microlink.io/**", (route) => {
      const url = new URL(route.request().url()).searchParams.get("url");
      return route.fulfill({ json: { status: "success", statusCode: 200, data: { url, tldr: "GPT-4, Transformer attention, and robot vision language research summary." } } });
    });
  }
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().startsWith("https://api.microlink.io/")) apiRequests.push(request.url());
  });
  const results = [];
  for (const [id, expected] of papers) {
    const start = Date.now();
    await page.goto(new URL(`p/${id}`, base).href, { waitUntil: "domcontentloaded" });
    assert.equal(await page.evaluate(() => typeof window.GM_xmlhttpRequest), "undefined");
    const panel = page.getByTestId("paper-tldr");
    await page.waitForFunction(() => document.querySelector('[data-testid="paper-tldr"]')?.getAttribute("aria-busy") === "false", null, { timeout: 35000 });
    const text = await panel.locator(".paper-math").innerText();
    assert.match(text, expected);
    assert.ok(text.length > 40);
    assert.doesNotMatch(text, /获取失败|暂无可用|正在读取/);
    results.push({ id, ms: Date.now() - start, text });
    if (live && id === "2303.08774") {
      await page.getByRole("heading", { name: "GPT-4 Technical Report", exact: true }).waitFor();
      await mkdir("../screenshots", { recursive: true });
      const detail = page.locator("header").filter({ has: page.getByTestId("paper-quick-bar") });
      await detail.screenshot({ path: "../screenshots/tldr-public-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await detail.screenshot({ path: "../screenshots/tldr-public-mobile.png" });
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
  }
  assert.equal(apiRequests.length, papers.length);
  assert.equal(readerRequests, 0);
  await context.route("https://api.microlink.io/**", (route) => route.abort());
  await page.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  await page.getByTestId("paper-tldr").getByText(results[0].text, { exact: true }).waitFor();
  assert.equal(apiRequests.length, papers.length);
  assert.equal(readerRequests, 0);
  assert.deepEqual(errors, []);
  await context.close();

  // Missing summaries must not be replaced with the metadata description.
  const missing = await browser.newContext();
  await missing.route("https://api.datacite.org/**", (route) => route.fulfill({ status: 404 }));
  await missing.route("https://r.jina.ai/**", (route) => route.abort());
  await missing.route("https://api.microlink.io/**", (route) => route.fulfill({ json: {
    status: "success", statusCode: 200,
    data: { url: "https://arxivtldr.org/abs/2303.08774", tldr: null, description: "NOT A TLDR" },
  } }));
  const missingPage = await missing.newPage();
  await missingPage.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  await missingPage.getByTestId("paper-tldr").getByText("暂无可用 TLDR", { exact: true }).waitFor();
  assert.doesNotMatch(await missingPage.getByTestId("paper-tldr").innerText(), /NOT A TLDR/);
  await missing.close();

  const limited = await browser.newContext();
  let limitedRequests = 0;
  await limited.route("https://api.datacite.org/**", (route) => route.fulfill({ status: 404 }));
  await limited.route("https://api.microlink.io/**", (route) => {
    limitedRequests++;
    return route.fulfill({ status: 429, headers: { "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 3600) } });
  });
  let readerWorks = false;
  await limited.route("https://r.jina.ai/**", (route) => readerWorks
    ? route.fulfill({ contentType: "text/plain", body: "## TLDR\nFallback source is working." })
    : route.abort());
  const limitedPage = await limited.newPage();
  await limitedPage.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  const limitedPanel = limitedPage.getByTestId("paper-tldr");
  await limitedPanel.getByText("TLDR 获取失败", { exact: true }).waitFor();
  readerWorks = true;
  await limitedPanel.getByRole("button", { name: "重试", exact: true }).click();
  await limitedPanel.getByText("Fallback source is working.", { exact: true }).waitFor();
  assert.equal(limitedRequests, 1);
  await limited.close();
  console.log(JSON.stringify({ live, noUserscript: true, readerRequests, results, persistentCache: "passed", missingSummary: "passed", rateLimitFallback: "passed" }));
} finally {
  await browser.close();
}
