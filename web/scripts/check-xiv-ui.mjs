import assert from "node:assert/strict";
import { chromium } from "playwright";

const expected = [
  ["chinaxiv", "ChinaXiv", "中国科学院", "https://chinaxiv.org/"],
  ["biorxiv", "bioRxiv", "生物", "https://www.biorxiv.org/"],
  ["medrxiv", "medRxiv", "医学", "https://www.medrxiv.org/"],
  ["chemrxiv", "ChemRxiv", "化学", "https://chemrxiv.org/"],
  ["techrxiv", "TechRxiv", "IEEE", "https://www.techrxiv.org/"],
  ["engrxiv", "engrXiv", "工程学", "https://engrxiv.org/"],
  ["eartharxiv", "EarthArXiv", "地球科学", "https://eartharxiv.org/"],
  ["agrirxiv", "AgriRxiv", "农业", "https://www.cabidigitallibrary.org/journal/agrirxiv"],
  ["ecoevorxiv", "EcoEvoRxiv", "生态", "https://ecoevorxiv.org/"],
  ["psyarxiv", "PsyArXiv", "心理学", "https://osf.io/preprints/psyarxiv"],
  ["socarxiv", "SocArXiv", "社会科学", "https://osf.io/preprints/socarxiv"],
  ["ssrn", "SSRN", "经济学", "https://www.ssrn.com/"],
  ["preprints", "Preprints.org", "自然科学", "https://www.preprints.org/"],
  ["ecsarxiv", "ECSarXiv", "电化学", "https://osf.io/preprints/ecsarxiv/"],
  ["sportrxiv", "SportRxiv", "体育科学", "https://sportrxiv.org/"],
  ["edarxiv", "EdArXiv", "教育学", "https://osf.io/preprints/edarxiv"],
  ["philarchive", "PhilArchive", "哲学", "https://philarchive.org/"],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.ARXIVHUB_URL || "http://127.0.0.1:8080/");
  await page.getByRole("button", { name: "Xiv宇宙", exact: true }).click();
  assert.equal(await page.locator("article").count(), expected.length);
  for (const [id, name, , url] of expected) {
    const card = page.locator(`article[data-tool-id="${id}"]`);
    assert.equal(await card.locator("h3").innerText(), name);
    const blurb = await card.locator("p").first().innerText();
    assert.ok(blurb.length > 0);
    assert.equal(await card.locator("a").getAttribute("href"), url);
    const icon = card.locator('img[src*="icons/xiv/"]');
    await icon.evaluate((img) => img.decode());
    assert.ok(await icon.evaluate((img) => img.naturalWidth > 0));
    assert.equal(await icon.evaluate((img) => img.getBoundingClientRect().width), 28);
  }
  await page.getByTestId("catalog-search-toggle").click();
  await page.getByPlaceholder("检索").fill("心理学");
  assert.equal(await page.locator("article").count(), 1);
  await page.getByRole("button", { name: "收藏网站", exact: true }).click();
  await page.getByPlaceholder("检索").fill("");
  await page.reload();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  assert.equal(await page.locator('article[data-tool-id="psyarxiv"] h3').innerText(), "PsyArXiv");
  await page.locator('article[data-tool-id="psyarxiv"]').getByRole("button", { name: "取消收藏", exact: true }).click();
  await page.getByRole("button", { name: "Xiv宇宙", exact: true }).click();
  await page.locator("body").screenshot({ path: "../screenshots/xiv-platforms-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('article[data-tool-id="chinaxiv"]').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "../screenshots/xiv-platforms-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: 17 names, descriptions, URLs and local icons; category/search/favorites persistence; desktop/mobile.");
} finally {
  await browser.close();
}
