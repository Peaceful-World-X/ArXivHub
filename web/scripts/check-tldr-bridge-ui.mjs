import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import { chromium } from "playwright";

const base = process.env.ARXIVHUB_URL || "http://127.0.0.1:8082/";
const live = process.env.LIVE_TLDR === "1";
const source = await readFile(new URL("../../ArXivHub.user.js", import.meta.url), "utf8");
const exec = promisify(execFile);
const summary = "GPT-4 is a large-scale multimodal Transformer model achieving human-level performance on professional and academic benchmarks through advanced training and alignment techniques.";
const fixture = `<h2>TLDR</h2><p>${summary}</p><h3>Key contributions</h3><p>DO NOT INCLUDE</p><h2>Original Abstract</h2><p>NOT THE SUMMARY</p>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  let directRequests = 0;
  let readerRequests = 0;
  await context.exposeBinding("readPublicTldr", async (_context, url) => {
    assert.equal(url, "https://arxivtldr.org/abs/2303.08774");
    directRequests++;
    return live ? (await exec("curl", ["--fail", "-LsS", "--max-time", "20", url], { maxBuffer: 2 * 1024 * 1024 })).stdout : fixture;
  });
  // Emulate only the extension transport; run the actual userscript and page parser.
  await context.addInitScript({ content: `window.GM_xmlhttpRequest = (options) => {
    window.readPublicTldr(options.url).then(
      (responseText) => options.onload({status:200, responseText}),
      () => options.onerror(),
    );
  };\n${source}` });
  await context.route("https://r.jina.ai/**", (route) => { readerRequests++; return route.abort(); });
  if (!live) await context.route("https://api.datacite.org/**", (route) => route.fulfill({ json: { data: { attributes: {
    doi: "10.48550/arxiv.2303.08774", titles: [{ title: "GPT-4 Technical Report" }],
    descriptions: [{ descriptionType: "Abstract", description: "We report the development of GPT-4." }],
  } } } }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const start = Date.now();
  await page.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  const panel = page.getByTestId("paper-tldr");
  await panel.getByText(summary, { exact: true }).waitFor({ timeout: 25000 });
  const elapsed = Date.now() - start;
  assert.equal(directRequests, 1);
  assert.equal(readerRequests, 0);
  assert.doesNotMatch(await panel.innerText(), /DO NOT INCLUDE|NOT THE SUMMARY/);
  assert.equal(await page.locator("#arxivhub-bookmarks").count(), 0);
  // Reject arbitrary destinations and cross-origin message events.
  await page.evaluate(() => {
    window.postMessage({ channel: "arxivhub:tldr:v1", type: "request", requestId: "invalid", id: "https://example.com/" }, location.origin);
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: "https://example.com", data: { channel: "arxivhub:tldr:v1", type: "request", requestId: "foreign", id: "1706.03762" } }));
  });
  if (live) {
    await mkdir("../screenshots", { recursive: true });
    await page.getByRole("heading", { name: "GPT-4 Technical Report", exact: true }).waitFor();
    await page.locator("header").filter({ has: page.getByTestId("paper-quick-bar") }).screenshot({ path: "../screenshots/tldr-bridge-desktop.png" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (live) await page.locator("header").filter({ has: page.getByTestId("paper-quick-bar") }).screenshot({ path: "../screenshots/tldr-bridge-mobile.png" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await panel.getByText(summary, { exact: true }).waitFor();
  assert.equal(directRequests, 1);
  assert.equal(readerRequests, 0);
  assert.deepEqual(errors, []);
  await context.close();

  // A userscript can receive an unfinished page; its empty result must not stop fallback.
  const emptyBridge = await browser.newContext();
  await emptyBridge.addInitScript({ content: `window.GM_xmlhttpRequest = (options) => {
    options.onload({status:200, responseText:'<h2>Original Abstract</h2><p>NOT A TLDR</p>'});
  };\n${source}` });
  await emptyBridge.route("https://api.datacite.org/**", (route) => route.fulfill({ status: 404 }));
  await emptyBridge.route("https://r.jina.ai/**", (route) => route.abort());
  let emptyBridgeFallbacks = 0;
  await emptyBridge.route("https://api.microlink.io/**", (route) => {
    emptyBridgeFallbacks++;
    return route.fulfill({ json: { status: "success", statusCode: 200, data: {
      url: "https://arxivtldr.org/abs/2303.08774", tldr: summary,
    } } });
  });
  const emptyBridgePage = await emptyBridge.newPage();
  await emptyBridgePage.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  await emptyBridgePage.getByTestId("paper-tldr").getByText(summary, { exact: true }).waitFor();
  assert.equal(emptyBridgeFallbacks, 1);
  await emptyBridge.close();

  const fallback = await browser.newContext();
  await fallback.route("https://api.microlink.io/**", (route) => route.abort());
  let readerFails = true;
  await fallback.route("https://api.datacite.org/**", (route) => route.fulfill({ status: 404 }));
  await fallback.route("https://r.jina.ai/**", (route) => readerFails
    ? route.abort()
    : route.fulfill({ contentType: "text/plain", body: `## TLDR\n${summary}` }));
  const retryPage = await fallback.newPage();
  await retryPage.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  const retryPanel = retryPage.getByTestId("paper-tldr");
  await retryPanel.getByText("TLDR 获取失败", { exact: true }).waitFor();
  await retryPanel.getByRole("button", { name: "安装 / 更新脚本", exact: true }).click();
  await retryPage.getByRole("dialog").waitFor();
  await retryPage.getByRole("button", { name: "关闭安装教程", exact: true }).click();
  readerFails = false;
  await retryPanel.getByRole("button", { name: "重试", exact: true }).click();
  await retryPanel.getByText(summary, { exact: true }).waitFor();
  assert.equal(await retryPanel.getByRole("button", { name: "重试", exact: true }).count(), 0);
  await fallback.close();
  console.log(JSON.stringify({ live, elapsed, directRequests, readerRequests, persistentCache: "passed", emptyBridgeFallback: "passed", retry: "passed" }));
} finally {
  await browser.close();
}
