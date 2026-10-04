import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.ARXIVHUB_URL || "http://127.0.0.1:8080/";
const live = process.env.LIVE_METADATA === "1";
const output = process.env.SCREENSHOT_DIR || "/tmp/arxivhub-metadata";
const icons = {
  "hf-papers": "hf-papers.ico",
  chatdoc: "chatdoc.ico",
  papermatch: "papermatch.ico",
  "google-scholar": "google-scholar.ico",
  "x-search": "x-search.png",
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  if (!live) {
    await context.route("https://api.microlink.io/**", (route) => route.abort());
    await context.route("https://r.jina.ai/**", (route) => route.abort());
    await context.route("https://api.semanticscholar.org/**", (route) => route.abort());
    await context.route("https://api.openalex.org/**", (route) => route.abort());
    await context.route("https://api.alphaxiv.org/**", (route) => route.abort());
    await context.route("https://api.datacite.org/**", (route) => route.fulfill({
      json: { data: { attributes: {
        doi: "10.48550/arxiv.2303.08774",
        titles: [{ title: "GPT-4 Technical Report" }],
        creators: [{ name: "OpenAI" }, { name: "Josh Achiam" }],
        descriptions: [{ descriptionType: "Abstract", description: "We report the development of GPT-4." }],
        subjects: [{ subjectScheme: "arXiv", subject: "Computation and Language (cs.CL)" }],
        version: "6",
        dates: [
          { date: "2023-03-15T17:15:04Z", dateType: "Submitted", dateInformation: "v1" },
          { date: "2024-03-04T06:01:33Z", dateType: "Submitted", dateInformation: "v6" },
        ],
      } } },
    }));
  }
  // Block external images to verify the requested icons work independently.
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!live && request.resourceType() === "image" && new URL(request.url()).origin !== new URL(base).origin) {
      return route.abort();
    }
    return route.fallback();
  });
  const page = await context.newPage();
  const errors = [];
  const metadataRequests = [];
  page.on("request", (request) => {
    if (/api\.datacite\.org|arxiv-txt\.org/.test(request.url())) metadataRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  if (live) {
    page.on("requestfailed", (request) => {
      if (/jina|datacite/.test(request.url())) console.log("Request failed:", request.url(), request.failure());
    });
    page.on("response", (response) => {
      if (/jina|datacite/.test(response.url())) console.log("Response:", response.status(), response.url());
    });
  }
  const started = Date.now();
  await page.goto(new URL("p/2303.08774", base).href, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "GPT-4 Technical Report", exact: true }).waitFor({ timeout: 25000 });
  const metadataMs = Date.now() - started;
  assert.equal(metadataRequests.some((url) => url.includes("arxiv-txt.org")), false);
  assert.match(await page.locator("#paper-abstract").innerText(), /development of GPT-4/);
  assert.match(await page.getByTestId("paper-submitted").innerText(), /2023-03-15/);
  assert.match(await page.getByTestId("paper-updated").innerText(), /2024-03-04/);
  assert.equal(await page.getByTestId("paper-version").innerText(), "v6");
  const documents = page.getByTestId("paper-document-actions");
  assert.deepEqual(await documents.locator("div > a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), [
    "https://arxiv.org/pdf/2303.08774",
    "https://arxiv.org/html/2303.08774",
    "https://www.arxiv2md.org/api/markdown?url=2303.08774",
    "https://arxiv.org/src/2303.08774",
    "https://arxiv.org/tb/2303.08774",
  ]);
  assert.deepEqual(await documents.locator(":scope > div > a, :scope > div > button").allTextContents(), ["PDF", "HTML", "MD", "TeX", "TB", "BibTex"]);
  assert.equal(await documents.getByRole("link", { name: "Markdown 全文", exact: true }).innerText(), "MD");
  await page.waitForFunction(() => document.querySelector('[data-testid="paper-tldr"]')?.getAttribute("aria-busy") === "false");
  if (live) {
    await page.screenshot({ path: `${output}/paper-desktop.png`, fullPage: true });
    await page.locator("header").filter({ has: page.getByTestId("paper-quick-bar") }).screenshot({ path: `${output}/paper-detail.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (live) await page.screenshot({ path: `${output}/paper-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(base);
  for (const [id, file] of Object.entries(icons)) {
    const img = page.locator(`article[data-tool-id="${id}"] img`).last();
    await img.waitFor();
    await page.waitForFunction((src) => [...document.images].some((img) => img.src === src && img.complete && img.naturalWidth > 0), new URL(`icons/${file}`, base).href);
    assert.equal(await img.getAttribute("src"), new URL(`icons/${file}`, base).pathname);
  }
  if (live) await page.screenshot({ path: `${output}/home-desktop.png` });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ mode: live ? "live" : "mocked", metadataMs, metadataRequests, icons: Object.keys(icons), screenshots: live ? output : undefined }));
} finally {
  await browser.close();
}
