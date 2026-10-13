import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import * as s2 from "../src/lib/semantic-scholar.ts";
import * as pages from "../src/lib/semantic-scholar-page.ts";
import * as oa from "../src/lib/openalex-citations.ts";

const JTA = { id: "2608.05594", title: "JTA: Joint Testability Architecture for Scenario-Based Validation of Safety-Critical Software" };
const HASH = "a5641fd9bbe87d5da393ea06817a9bd325acd07b";
const DAY = 86400000;
function paperUrl(hash = HASH) { return `https://www.semanticscholar.org/paper/${hash}`; }
function graph(ctx, count = 0, hash = HASH) { return { paperId: hash, citationCount: count, externalIds: { ArXiv: ctx.id } }; }
function openalex(ctx, count = 0) {
  return { results: [{ id: "https://openalex.org/W12345", title: ctx.title, cited_by_count: count,
    locations: [{ landing_page_url: `https://arxiv.org/abs/${ctx.id}` }] }] };
}
function markdown(ctx = JTA, hash = HASH, count = 1234) {
  const total = count === null ? "" : `${count.toLocaleString("en-US")} Citations`;
  return `URL Source: ${paperUrl(hash)}\nMarkdown Content:\n# ${ctx.title}\n[PDF](https://arxiv.org/pdf/${ctx.id}.pdf)\n\n${total}\n\n` +
    `41 References\n\n${total ? `## ${total}\n` : ""}## Related Papers\n### Another paper\n99 Citations\n`;
}
function detail(ctx = JTA, count = 0, hash = HASH) {
  return { actionType: "API_REQUEST_COMPLETE", requestType: "PAPER_DETAIL", responseStatus: 200,
    pathParams: { paperId: hash }, resultData: { paper: { id: hash, title: { text: ctx.title },
      primaryPaperLink: { url: `https://arxiv.org/pdf/${ctx.id}.pdf` },
      citationStats: { numCitations: count, numReferences: 57, estNumCitations: 19 } } } };
}
function html(records = [detail()]) { return `<script>var DATA = '${btoa(encodeURIComponent(JSON.stringify(records)))}';</script>`; }
function search(url, hashes = [HASH]) {
  return `URL Source: ${url.slice("https://r.jina.ai/".length)}\nMarkdown Content:\n${hashes.map((hash) => `[](${paperUrl(hash)})`).join("\n")}`;
}

// Each stateful scenario gets fresh module caches, clocks and cooldowns. A query
// string on an orchestrator import alone would leave its dependencies shared.
function isolated(scenario) {
  const modules = { s2: "semantic-scholar", pages: "semantic-scholar-page", oa: "openalex-citations",
    citations: "paper-citations", metric: "paper-metric-cache", alpha: "alphaxiv" };
  const imports = Object.entries(modules).map(([name, file]) =>
    `import * as ${name} from ${JSON.stringify(new URL(`../src/lib/${file}.ts`, import.meta.url).href)};`).join("\n");
  const fixtures = [paperUrl, graph, openalex, markdown, detail, html, search].map(String).join("\n");
  try { execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    ${imports}
    const JTA = ${JSON.stringify(JTA)}, HASH = ${JSON.stringify(HASH)}, DAY = ${DAY};
    ${fixtures}
    let now = Date.UTC(2026, 9, 4, 12);
    Date.now = () => now;
    const storage = new Map(), requests = [];
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    const mockFetch = handler => { globalThis.fetch = async (url, options) => {
      now += 3001; requests.push(String(url)); return handler(String(url), options);
    }; };
    await (${scenario.toString()})();
  `], { cwd: fileURLToPath(new URL("..", import.meta.url)), timeout: 20000, stdio: "pipe" });
  } catch (error) { throw new Error(error.stderr?.toString().trim() || error.message); }
}

test("official API and OpenAlex counts require matching identifiers and safe integers, including zero", () => {
  assert.equal(s2.parseSemanticScholarCitations(graph(JTA), `${JTA.id}v2`).citationCount, 0);
  assert.equal(s2.parseSemanticScholarCitations({ paperId: HASH, citationCount: 0 }, HASH).citationCount, 0);
  assert.throws(() => s2.parseSemanticScholarCitations(graph({ id: "1706.03762" }), JTA.id));
  assert.throws(() => s2.parseSemanticScholarCitations(graph(JTA), "b".repeat(40)));
  const absent = `Markdown Content:\n${JSON.stringify({ error: `Paper with id ARXIV:${JTA.id} not found` })}`;
  assert.equal(s2.parseSemanticScholarReader(absent, JTA.id), null);
  assert.throws(() => s2.parseSemanticScholarReader(absent, "1706.03762"));
  for (const count of [null, undefined, -1, 0.5, "0", NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => s2.parseSemanticScholarCitations({ ...graph(JTA), citationCount: count }, JTA.id));
    const body = openalex(JTA); body.results[0].cited_by_count = count;
    assert.throws(() => oa.parseOpenAlexCitations(body, JTA));
  }
  for (const location of [{ pdf_url: `https://arxiv.org/pdf/${JTA.id}v2.pdf` },
    { landing_page_url: `https://doi.org/10.48550/arXiv.${JTA.id}` }]) {
    const body = openalex(JTA); body.results[0].locations = [location];
    assert.equal(oa.parseOpenAlexCitations(body, JTA).citationCount, 0);
  }
  for (const patch of [{ title: `${JTA.title}: A Review` }, { locations: [] },
    { locations: [{ landing_page_url: `https://arxiv.org.evil.example/abs/${JTA.id}` }] }]) {
    const body = openalex(JTA); Object.assign(body.results[0], patch);
    assert.equal(oa.parseOpenAlexCitations(body, JTA), null);
  }
  const wrongWork = openalex(JTA); wrongWork.results[0].id = "https://openalex.org/A123";
  assert.throws(() => oa.parseOpenAlexCitations(wrongWork, JTA));
});

test("web totals exclude references and neighboring papers; unverified identities cannot supply counts", () => {
  assert.equal(pages.parseSemanticScholarPage(markdown(), JTA, HASH).citationCount, 1234);
  for (const body of [markdown().replace("## 1,234 Citations", "## 1,235 Citations"),
    markdown().replace(`URL Source: ${paperUrl()}`, `URL Source: ${paperUrl("b".repeat(40))}`),
    markdown().replace("# JTA:", "# Unrelated JTA:"), markdown().replace(JTA.id + ".pdf", "1706.03762.pdf"),
    markdown().replaceAll("1,234 Citations", "1,23 Citations"), markdown(JTA, HASH, null)]) {
    assert.throws(() => pages.parseSemanticScholarPage(body, JTA, HASH));
  }
  const unknown = { id: "2401.99001", title: "Unverified Paper" };
  const noId = markdown(unknown).replace(/\[PDF\].*\n/, "");
  assert.throws(() => pages.parseSemanticScholarPage(noId + `\n[PDF](https://arxiv.org/abs/${unknown.id})`, unknown, HASH));
  assert.equal(pages.parseSemanticScholarPage(noId, { ...unknown, paperId: HASH }, HASH).citationCount, 1234);
  const doi = markdown(unknown).replace(`https://arxiv.org/pdf/${unknown.id}.pdf`, `https://doi.org/10.48550/arxiv.${unknown.id}`);
  assert.equal(pages.parseSemanticScholarPage(doi, unknown, HASH).citationCount, 1234);
});

test("JTA HTML explicitly supplies zero; wrong, ambiguous, missing and nonnumeric data are rejected without executing scripts", () => {
  assert.deepEqual(pages.parseSemanticScholarHtml(html(), JTA, HASH), { paperId: HASH, citationCount: 0 });
  for (const count of [null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => pages.parseSemanticScholarHtml(html([detail(JTA, count)]), JTA, HASH));
  }
  const invalid = [detail(), detail(), detail(), detail(), detail()];
  invalid[0].pathParams.paperId = "b".repeat(40);
  invalid[1].resultData.paper.id = "b".repeat(40);
  invalid[2].resultData.paper.title.text = "Another Paper";
  invalid[3].resultData.paper.primaryPaperLink.url = "https://arxiv.org/pdf/1706.03762.pdf";
  delete invalid[4].resultData.paper.citationStats.numCitations;
  for (const row of invalid) assert.throws(() => pages.parseSemanticScholarHtml(html([row]), JTA, HASH));
  for (const body of [html([detail(), detail()]), html([{ ...detail(), responseStatus: 500 }]),
    html([{ ...detail(), requestType: "SEARCH_REFERENCES" }]), "<script>var DATA = 'invalid';</script>",
    html().replace(";</script>", ";globalThis.executedCitationScript = true;</script>")]) {
    assert.throws(() => pages.parseSemanticScholarHtml(body, JTA, HASH));
  }
  assert.equal(globalThis.executedCitationScript, undefined);
});

test("JTA works without title metadata, verifies HTML zero once, and reuses persisted data after reload", () => isolated(async () => {
  mockFetch((url, options) => {
    assert.equal(url, `https://r.jina.ai/${paperUrl()}`);
    return new Response(options.headers["X-Return-Format"] === "html" ? html() : markdown(JTA, HASH, null));
  });
  const values = await Promise.all([citations.fetchPaperCitations({ id: JTA.id }), citations.fetchPaperCitations({ id: JTA.id + "v2" })]);
  assert.equal(values[0].citationCount, 0); assert.equal(values[0].source, "Semantic Scholar");
  assert.deepEqual(values[0], values[1]); assert.equal(requests.length, 2);
  const reloaded = await import("./src/lib/semantic-scholar-page.ts?reload-zero");
  assert.equal((await reloaded.fetchSemanticScholarPage({ id: JTA.id })).citationCount, 0);
  assert.equal(requests.length, 2); assert.equal(citations.citationPageUrl({ id: JTA.id }), paperUrl());
}));

test("unknown papers wait for a title, reject a wrong first result without HTML, and deduplicate versioned lookups", () => isolated(async () => {
  const ctx = { id: "2401.99002", title: "Exact Paper Title" }, good = "c".repeat(40), bad = "d".repeat(40);
  mockFetch((url, options) => {
    assert.equal(options.headers["X-Return-Format"], undefined);
    if (url.includes("/search?")) return new Response(search(url, [bad, good]));
    return new Response(url.endsWith(bad) ? markdown({ ...ctx, id: "2401.00999" }, bad, null) : markdown(ctx, good, 8));
  });
  assert.equal(await pages.fetchSemanticScholarPage({ id: ctx.id }), null); assert.equal(requests.length, 0);
  assert.equal(new URL(citations.citationPageUrl(ctx)).searchParams.get("q"), ctx.title);
  assert.equal(citations.citationPageUrl({ id: ctx.id }), "https://www.semanticscholar.org/");
  const values = await Promise.all([citations.fetchPaperCitations(ctx), citations.fetchPaperCitations({ ...ctx, id: ctx.id + "v3" })]);
  assert.deepEqual(values.map((value) => value.citationCount), [8, 8]); assert.equal(requests.length, 3);
  assert.equal(citations.citationPageUrl(ctx), paperUrl(good));
}));

test("a new DOI context retries a miss rather than leaving a later metadata lookup suppressed", () => isolated(async () => {
  const ctx = { id: "2401.99003", title: "Late DOI" };
  mockFetch((url) => new Response(url.includes("/search?") ? search(url) :
    markdown(ctx).replace(`https://arxiv.org/pdf/${ctx.id}.pdf`, "https://doi.org/10.1234/late")));
  assert.equal(await pages.fetchSemanticScholarPage(ctx), null);
  assert.equal(await pages.fetchSemanticScholarPage(ctx), null); assert.equal(requests.length, 2);
  assert.equal((await pages.fetchSemanticScholarPage({ ...ctx, doi: "10.1234/late" })).citationCount, 1234);
  assert.equal(requests.length, 4);
}));

test("Graph follows failed pages, preserves zero, and CORS/DOI fallback reads the same verified API record", () => isolated(async () => {
  const ctx = { id: "2401.99004", title: "API Fallback" };
  mockFetch((url) => url.startsWith("https://api.semanticscholar.org/") ? Response.json(graph(ctx)) : new Response("Unavailable", { status: 404 }));
  const value = await citations.fetchPaperCitations(ctx);
  assert.equal(value.citationCount, 0); assert.equal(value.source, "Semantic Scholar");
  assert.ok(requests[0].includes("/search?")); assert.ok(requests[1].startsWith("https://api.semanticscholar.org/"));
  assert.equal(requests.length, 2); requests.length = 0;
  mockFetch((url) => {
    if (url.includes("ARXIV:")) return new Response("Not found", { status: 404 });
    if (url.startsWith("https://api.semanticscholar.org/")) throw new TypeError("CORS");
    assert.ok(url.startsWith("https://r.jina.ai/https://api.semanticscholar.org/"));
    return new Response(`Markdown Content:\n${JSON.stringify({ paperId: HASH, citationCount: 7, externalIds: { DOI: "10.1234/late" } })}`);
  });
  assert.equal((await s2.fetchSemanticScholarCitations("2401.99005", "https://doi.org/10.1234/late")).citationCount, 7);
  assert.equal(requests.length, 3);
  assert.equal(s2.normalizePublishedDoi("10.48550/arxiv.2401.99005"), null);
}));

test("OpenAlex is last; its cache cannot block S2 recovery, and outages retain even an older S2 value", () => isolated(async () => {
  const ctx = { id: "2401.99006", title: "Source Preference" }, hash = "e".repeat(40);
  mockFetch((url) => url.includes("api.openalex.org") ? Response.json(openalex(ctx)) : new Response("Unavailable", { status: 503 }));
  const fallback = await citations.fetchPaperCitations(ctx);
  assert.equal(fallback.source, "OpenAlex"); assert.equal(fallback.citationCount, 0);
  assert.ok(requests[0].includes("/search?")); assert.ok(requests.at(-1).includes("api.openalex.org"));
  requests.length = 0;
  mockFetch(() => new Response("Unavailable", { status: 503 }));
  assert.deepEqual(await citations.fetchPaperCitations(ctx), fallback);
  assert.ok(!requests.some((url) => url.includes("api.openalex.org")));
  requests.length = 0;
  mockFetch((url) => new Response(url.includes("/search?") ? search(url, [hash]) : markdown(ctx, hash, 8)));
  assert.equal((await citations.fetchPaperCitations(ctx)).source, "Semantic Scholar"); assert.equal(requests.length, 2);
  now += 25 * DAY / 24;
  storage.set(`arxivhub:openalex-citations:v1:${ctx.id}`, JSON.stringify({ at: now, value: { citationCount: 99, url: "https://openalex.org/W12345" } }));
  requests.length = 0; mockFetch(() => new Response("Unavailable", { status: 503 }));
  await assert.rejects(citations.fetchPaperCitations(ctx));
  assert.equal(citations.readCachedPaperCitations(ctx).value.source, "Semantic Scholar");
  assert.equal(citations.readCachedPaperCitations(ctx).value.citationCount, 8);
  assert.ok(!requests.some((url) => url.includes("api.openalex.org")));
}));

test("the shared cache retains zero and stale data, expires misses, and never stores failures as counts", () => isolated(async () => {
  const options = { namespace: "isolated-cache", ttl: 1000, missingTtl: 500,
    valid: value => Number.isSafeInteger(value) && value >= 0 };
  const cache = metric.createPaperMetricCache(options); let calls = 0;
  const load = async () => { calls++; return 0; };
  assert.deepEqual(await Promise.all([cache.get("p", load), cache.get("p", load)]), [0, 0]);
  assert.equal(await metric.createPaperMetricCache(options).get("p", load), 0); assert.equal(calls, 1);
  now += 1001;
  await assert.rejects(cache.get("p", async () => { throw new Error("offline"); }));
  assert.equal(cache.peek("p").value, 0); assert.equal(cache.peek("p").stale, true);
  assert.equal(await cache.get("p", async () => 7), 7); now += 400 * DAY;
  assert.equal(cache.peek("p").value, 7); assert.equal(cache.peek("p").stale, true);
  await cache.get("missing", async () => null); now += 501; assert.equal(cache.peek("missing"), undefined);
  await assert.rejects(cache.get("bad", async () => -1)); assert.equal(cache.peek("bad"), undefined);
}));

test("successful metric snapshots survive months, nulls and failures without changing their retrieval time", () => isolated(async () => {
  const options = { namespace: "persistent-cache", ttl: 1000, missingTtl: 500,
    valid: value => Number.isSafeInteger(value) && value >= 0 };
  const cache = metric.createPaperMetricCache(options);
  assert.equal(await cache.get("p", async () => 0), 0);
  const original = cache.peek("p");
  const stored = storage.get("arxivhub:persistent-cache:p");
  now += 400 * DAY;
  const reloaded = metric.createPaperMetricCache(options);
  assert.deepEqual(reloaded.peek("p"), { ...original, stale: true });
  assert.equal(await reloaded.get("p", async () => null, true), null);
  await assert.rejects(reloaded.get("p", async () => { throw new Error("offline"); }, true));
  await assert.rejects(reloaded.get("p", async () => -1, true));
  assert.deepEqual(reloaded.peek("p"), { ...original, stale: true });
  assert.equal(storage.get("arxivhub:persistent-cache:p"), stored);
  // An older client/tab's negative write cannot hide the in-memory success.
  storage.set("arxivhub:persistent-cache:p", JSON.stringify({ at: now, value: null }));
  assert.deepEqual(reloaded.peek("p"), { ...original, stale: true });
  for (const at of [null, "123", now + 1, Infinity]) {
    storage.set("arxivhub:persistent-cache:invalid", JSON.stringify({ at, value: 5 }));
    assert.equal(reloaded.peek("invalid"), undefined);
  }
}));

test("force refresh bypasses both fresh counts and misses while concurrent refreshes share one loader", () => isolated(async () => {
  const cache = metric.createPaperMetricCache({ namespace: "forced-cache", ttl: DAY, missingTtl: 500,
    valid: value => Number.isSafeInteger(value) && value >= 0 });
  await cache.get("p", async () => 8);
  let calls = 0;
  const load = async () => { calls++; return 0; };
  assert.equal(await cache.get("p", load), 8); assert.equal(calls, 0);
  now++;
  assert.deepEqual(await Promise.all([cache.get("p", load, true), cache.get("p", load, true)]), [0, 0]);
  assert.equal(calls, 1); assert.equal(cache.peek("p").at, now);
  await cache.get("missing", async () => null);
  assert.equal(await cache.get("missing", load), null); assert.equal(calls, 1);
  assert.equal(await cache.get("missing", load, true), 0); assert.equal(calls, 2);
}));

test("every metric source reads months-old persisted successes, including zero, before any request", () => isolated(async () => {
  const at = now - 400 * DAY;
  storage.set(`arxivhub:semantic-scholar:v1:ARXIV:${JTA.id}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 0 } }));
  storage.set(`arxivhub:semantic-scholar-page:v1:${JTA.id}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 0 } }));
  storage.set(`arxivhub:openalex-citations:v1:${JTA.id}`, JSON.stringify({ at: now, value: { citationCount: 99, url: "https://openalex.org/W12345" } }));
  storage.set(`arxivhub:alphaxiv-likes:v1:${JTA.id}`, JSON.stringify({ at, value: 0 }));
  assert.equal(s2.readCachedCitations(JTA.id).at, at);
  assert.equal(pages.readCachedSemanticScholarPage(JTA.id).at, at);
  assert.deepEqual(alpha.readCachedAlphaXivLikes(JTA.id), { at, value: 0, stale: true });
  const cited = citations.readCachedPaperCitations(JTA);
  assert.equal(cited.value.source, "Semantic Scholar"); assert.equal(cited.value.citationCount, 0);
  assert.equal(cited.at, at); assert.equal(cited.stale, true); assert.equal(requests.length, 0);
  const other = "2401.99800";
  storage.set(`arxivhub:openalex-citations:v1:${other}`, JSON.stringify({ at, value: { citationCount: 0, url: "https://openalex.org/W12345" } }));
  assert.equal(oa.readCachedOpenAlexCitations(other).at, at);
  assert.equal(citations.readCachedPaperCitations({ id: other }).value.source, "OpenAlex");
  assert.equal(citations.readCachedPaperCitations({ id: "2401.99801" }), undefined);
  assert.equal(alpha.readCachedAlphaXivLikes("2401.99801"), undefined);
}));

test("forced page revisits refresh fresh Semantic Scholar totals, persist the new total and deduplicate requests", () => isolated(async () => {
  let count = 8;
  mockFetch(() => new Response(markdown(JTA, HASH, count)));
  assert.equal((await citations.fetchPaperCitations(JTA)).citationCount, 8);
  const first = citations.readCachedPaperCitations(JTA);
  count = 0;
  assert.equal((await citations.fetchPaperCitations(JTA)).citationCount, 8); assert.equal(requests.length, 1);
  assert.deepEqual((await Promise.all([
    citations.fetchPaperCitations(JTA, true), citations.fetchPaperCitations({ ...JTA, id: JTA.id + "v2" }, true),
  ])).map(value => value.citationCount), [0, 0]);
  assert.equal(requests.length, 2);
  assert.equal(citations.readCachedPaperCitations(JTA).value.citationCount, 0);
  assert.ok(citations.readCachedPaperCitations(JTA).at > first.at);
  count = 9;
  assert.equal((await citations.fetchPaperCitations(JTA, true)).citationCount, 9); assert.equal(requests.length, 3);
  assert.equal((await citations.fetchPaperCitations(JTA)).citationCount, 9); assert.equal(requests.length, 3);
}));

test("forced Semantic Scholar refreshes retry fresh misses and keep cached totals/timestamps on 404 or error", () => isolated(async () => {
  const at = now - 400 * DAY;
  storage.set(`arxivhub:semantic-scholar-page:v1:${JTA.id}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 12 } }));
  storage.set(`arxivhub:semantic-scholar:v1:${HASH}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 12 } }));
  storage.set(`arxivhub:openalex-citations:v1:${JTA.id}`, JSON.stringify({ at: now, value: { citationCount: 900, url: "https://openalex.org/W12345" } }));
  for (const status of [404, 503]) {
    mockFetch(url => {
      assert.ok(!url.includes("api.openalex.org"));
      return new Response("Unavailable", { status });
    });
    await assert.rejects(citations.fetchPaperCitations(JTA, true));
    assert.equal(citations.readCachedPaperCitations(JTA).value.citationCount, 12);
    assert.equal(citations.readCachedPaperCitations(JTA).value.source, "Semantic Scholar");
    assert.equal(citations.readCachedPaperCitations(JTA).at, at);
    assert.equal(pages.readCachedSemanticScholarPage(JTA.id).at, at);
    assert.equal(s2.readCachedCitations(JTA.id, undefined, HASH).at, at);
  }
  const ctx = { id: "2401.99802", title: "Retry a missed page", paperId: "f".repeat(40) };
  mockFetch(() => new Response("Missing", { status: 404 }));
  assert.equal(await pages.fetchSemanticScholarPage(ctx), null);
  const missed = requests.length;
  mockFetch(() => new Response(markdown(ctx, ctx.paperId, 0)));
  assert.equal(await pages.fetchSemanticScholarPage(ctx), null); assert.equal(requests.length, missed);
  assert.equal((await pages.fetchSemanticScholarPage(ctx, true)).citationCount, 0);
  assert.equal(requests.length, missed + 1);
}));

test("forced Graph refresh bypasses fresh canonical, arXiv and DOI caches, including cached misses", () => isolated(async () => {
  const ctx = { id: "2401.99803" };
  let count = 1;
  mockFetch(() => Response.json(graph(ctx, count)));
  assert.equal((await s2.fetchSemanticScholarCitations(ctx.id)).citationCount, 1);
  count = 0;
  assert.equal((await s2.fetchSemanticScholarCitations(ctx.id)).citationCount, 1);
  assert.deepEqual((await Promise.all([
    s2.fetchSemanticScholarCitations(ctx.id, undefined, undefined, true),
    s2.fetchSemanticScholarCitations(ctx.id + "v2", undefined, undefined, true),
  ])).map(value => value.citationCount), [0, 0]);
  assert.equal(requests.length, 2);
  assert.equal((await s2.fetchSemanticScholarCitations(ctx.id, undefined, HASH, true)).citationCount, 0);
  count = 3;
  assert.equal((await s2.fetchSemanticScholarCitations(ctx.id, undefined, HASH, true)).citationCount, 3);
  const saved = s2.readCachedCitations(ctx.id, undefined, HASH);
  mockFetch(() => new Response("Missing", { status: 404 }));
  assert.equal(await s2.fetchSemanticScholarCitations(ctx.id, undefined, HASH, true), null);
  assert.deepEqual(s2.readCachedCitations(ctx.id, undefined, HASH), saved);
  const other = "2401.99804", doi = "10.1234/refresh";
  assert.equal(await s2.fetchSemanticScholarCitations(other, doi), null);
  const missed = requests.length;
  mockFetch(url => url.includes("ARXIV:") ? new Response("Missing", { status: 404 }) :
    Response.json({ paperId: HASH, citationCount: 4, externalIds: { DOI: doi } }));
  assert.equal(await s2.fetchSemanticScholarCitations(other, doi), null); assert.equal(requests.length, missed);
  assert.equal((await s2.fetchSemanticScholarCitations(other, doi, undefined, true)).citationCount, 4);
  assert.equal(requests.length, missed + 2);
}));

test("a canonical Graph refresh remains visible through the paper's cached arXiv identity", () => isolated(async () => {
  const ctx = { id: "2401.99809", title: "Graph-only paper" };
  storage.set(`arxivhub:semantic-scholar:v1:ARXIV:${ctx.id}`, JSON.stringify({ at: now - DAY, value: { paperId: HASH, citationCount: 8 } }));
  mockFetch(url => url.startsWith("https://api.semanticscholar.org/") ? Response.json({ paperId: HASH, citationCount: 0 }) :
    new Response("Unavailable", { status: 404 }));
  assert.equal((await citations.fetchPaperCitations(ctx, true)).citationCount, 0);
  const snapshot = citations.readCachedPaperCitations(ctx);
  assert.equal(snapshot.value.citationCount, 0); assert.equal(snapshot.value.source, "Semantic Scholar");
  assert.equal(snapshot.at, now); assert.equal(requests.length, 2);
  mockFetch(() => new Response("Unavailable", { status: 404 }));
  await assert.rejects(citations.fetchPaperCitations(ctx, true));
  assert.deepEqual(citations.readCachedPaperCitations(ctx), snapshot);
}));

test("forced OpenAlex fallback refreshes fresh counts, but misses/errors never erase old successes", () => isolated(async () => {
  const ctx = { id: "2401.99805", title: "Fallback refresh" };
  let count = 2;
  mockFetch(url => url.includes("api.openalex.org") ? Response.json(new URL(url).pathname === "/works" ? openalex(ctx, count) : openalex(ctx, count).results[0]) : new Response("Unavailable", { status: 404 }));
  assert.equal((await citations.fetchPaperCitations(ctx)).citationCount, 2);
  count = 0;
  assert.equal((await citations.fetchPaperCitations(ctx)).citationCount, 2);
  const calls = requests.filter(url => url.includes("api.openalex.org")).length;
  assert.equal((await citations.fetchPaperCitations(ctx, true)).citationCount, 0);
  assert.equal(requests.filter(url => url.includes("api.openalex.org")).length, calls + 1);
  const saved = citations.readCachedPaperCitations(ctx);
  for (const status of [404, 503]) {
    mockFetch(() => new Response("Unavailable", { status }));
    await assert.rejects(citations.fetchPaperCitations(ctx, true));
    assert.deepEqual(citations.readCachedPaperCitations(ctx), saved);
  }
}));

test("likes revisits bypass the fresh preview cache, share in-flight work and preserve success on missing/invalid data", () => isolated(async () => {
  const id = "2401.99806";
  let count = 2;
  mockFetch(() => Response.json({ universal_paper_id: id, metrics: { public_total_votes: count } }));
  // Metadata may already have filled the fifteen-minute preview cache.
  await alpha.fetchAlphaXivPreview(id);
  assert.equal(await alpha.fetchAlphaXivLikes(id), 2); assert.equal(requests.length, 1);
  count = 0;
  assert.equal(await alpha.fetchAlphaXivLikes(id), 2); assert.equal(requests.length, 1);
  assert.deepEqual(await Promise.all([alpha.fetchAlphaXivLikes(id, true), alpha.fetchAlphaXivLikes(id + "v2", true)]), [0, 0]);
  assert.equal(requests.length, 2);
  const saved = alpha.readCachedAlphaXivLikes(id);
  for (const status of [404, 503]) {
    mockFetch(() => new Response("Unavailable", { status }));
    if (status === 404) assert.equal(await alpha.fetchAlphaXivLikes(id, true), null);
    else await assert.rejects(alpha.fetchAlphaXivLikes(id, true));
    assert.deepEqual(alpha.readCachedAlphaXivLikes(id), saved);
  }
  mockFetch(() => Response.json({ universal_paper_id: id, metrics: {} }));
  await assert.rejects(alpha.fetchAlphaXivLikes(id, true)); assert.deepEqual(alpha.readCachedAlphaXivLikes(id), saved);
  count = 4;
  mockFetch(() => Response.json({ universal_paper_id: id, metrics: { public_total_votes: count } }));
  assert.equal(await alpha.fetchAlphaXivLikes(id, true), 4);
  assert.ok(alpha.readCachedAlphaXivLikes(id).at > saved.at);
  const absent = "2401.99807";
  mockFetch(() => new Response("Unavailable", { status: 404 }));
  assert.equal(await alpha.fetchAlphaXivLikes(absent), null);
  const missed = requests.length;
  mockFetch(() => Response.json({ universal_paper_id: absent, metrics: { public_total_votes: 0 } }));
  assert.equal(await alpha.fetchAlphaXivLikes(absent), null); assert.equal(requests.length, missed);
  assert.equal(await alpha.fetchAlphaXivLikes(absent, true), 0); assert.equal(requests.length, missed + 1);
}));

test("missing sources without a known success remain missing rather than becoming zero", () => isolated(async () => {
  const ctx = { id: "2401.99810", title: "Not indexed" };
  mockFetch(() => new Response("Not found", { status: 404 }));
  assert.equal(await citations.fetchPaperCitations(ctx, true), null);
  assert.equal(citations.readCachedPaperCitations(ctx), undefined);
  assert.equal(await alpha.fetchAlphaXivLikes(ctx.id, true), null);
  assert.equal(alpha.readCachedAlphaXivLikes(ctx.id).value, null);
}));

test("forced refreshes honor Semantic Scholar, OpenAlex and alphaXiv cooldowns without advancing timestamps", () => isolated(async () => {
  const ctx = { id: "2401.99808", title: "Cooldown Paper" };
  const at = now;
  storage.set(`arxivhub:semantic-scholar:v1:ARXIV:${ctx.id}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 0 } }));
  storage.set(`arxivhub:semantic-scholar-page:v1:${ctx.id}`, JSON.stringify({ at, value: { paperId: HASH, citationCount: 0 } }));
  storage.set(`arxivhub:openalex-citations:v1:${ctx.id}`, JSON.stringify({ at, value: { citationCount: 0, url: "https://openalex.org/W12345" } }));
  storage.set(`arxivhub:alphaxiv-likes:v1:${ctx.id}`, JSON.stringify({ at, value: 0 }));
  mockFetch(() => new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "120" } }));
  const loads = [() => s2.fetchSemanticScholarCitations(ctx.id, undefined, undefined, true),
    () => pages.fetchSemanticScholarPage(ctx, true), () => oa.fetchOpenAlexCitations(ctx, true), () => alpha.fetchAlphaXivLikes(ctx.id, true)];
  for (const load of loads) {
    const before = requests.length;
    await assert.rejects(load()); assert.equal(requests.length, before + 1);
    await assert.rejects(load()); assert.equal(requests.length, before + 1);
  }
  assert.equal(s2.readCachedCitations(ctx.id).at, at);
  assert.equal(pages.readCachedSemanticScholarPage(ctx.id).at, at);
  assert.equal(oa.readCachedOpenAlexCitations(ctx.id).at, at);
  assert.equal(alpha.readCachedAlphaXivLikes(ctx.id).at, at);
  const reloaded = await import("./src/lib/alphaxiv.ts?cooldown-reload");
  await assert.rejects(reloaded.fetchAlphaXivLikes(ctx.id, true), /rate limited/); assert.equal(requests.length, 4);
  now += 120001;
  mockFetch(() => Response.json({ universal_paper_id: ctx.id, metrics: { public_total_votes: 1 } }));
  assert.equal(await reloaded.fetchAlphaXivLikes(ctx.id, true), 1); assert.equal(requests.length, 5);
}));

test("S2 API and Reader cooldowns stop all subsequent requests until Retry-After has passed", () => isolated(async () => {
  mockFetch(() => new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "120" } }));
  await assert.rejects(s2.fetchSemanticScholarCitations("2401.99007", "10.1234/unused"), /rate limited/);
  await assert.rejects(s2.fetchSemanticScholarCitations("2401.99008"), /rate limited/); assert.equal(requests.length, 1);
  now += 120001; mockFetch(() => Response.json(graph({ id: "2401.99007" })));
  assert.equal((await s2.fetchSemanticScholarCitations("2401.99007")).citationCount, 0);
  requests.length = 0;
  mockFetch(() => new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "120" } }));
  await assert.rejects(pages.fetchSemanticScholarPage({ id: JTA.id }), /rate limited/);
  const reloaded = await import("./src/lib/semantic-scholar-page.ts?cooldown-reload");
  await assert.rejects(reloaded.fetchSemanticScholarPage({ id: "2401.99009", title: "Another Paper" }), /rate limited/);
  assert.equal(requests.length, 1);
}));

test("OpenAlex daily budgets persist until UTC midnight or a later deadline, while successful caches remain usable", () => isolated(async () => {
  const start = Date.UTC(2026, 9, 4, 23, 58), midnight = Date.UTC(2026, 9, 5);
  const cases = [
    [429, "Too Many Requests", "120", null],
    [429, "Insufficient budget to complete this request. Resets at midnight UTC.", null, midnight],
    [403, "Daily budget has been exhausted.", "60", midnight],
    [429, "Daily budget exhausted.", new Date(midnight + 3600000).toUTCString(), midnight + 3600000],
  ];
  for (const [index, [status, body, header, reset]] of cases.entries()) {
    now = start; storage.clear(); requests.length = 0;
    const module = await import(`./src/lib/openalex-citations.ts?quota=${index}`);
    const cached = { id: "2401.99010", title: "Cached Work" }, limited = { id: "2401.99011", title: "Limited Work" };
    let recovered = false;
    mockFetch((url) => {
      if (new URL(url).searchParams.get("search") === cached.title) return Response.json(openalex(cached));
      return recovered ? Response.json(openalex(limited, 8)) : new Response(body, { status, headers: header ? { "Retry-After": header } : {} });
    });
    assert.equal((await module.fetchOpenAlexCitations(cached)).citationCount, 0);
    await assert.rejects(module.fetchOpenAlexCitations(limited), /OpenAlex/);
    const deadline = reset ?? now + 120000;
    assert.equal(Number(storage.get(`arxivhub:openalex-citations:${reset === null ? "retry-at" : "budget-retry-at"}`)), deadline);
    now = deadline - 1;
    const reloaded = await import(`./src/lib/openalex-citations.ts?quota-reload=${index}`);
    await assert.rejects(reloaded.fetchOpenAlexCitations(limited), /OpenAlex/);
    assert.equal((await reloaded.fetchOpenAlexCitations(cached)).citationCount, 0); assert.equal(requests.length, 2);
    now = deadline + 1; recovered = true;
    assert.equal((await module.fetchOpenAlexCitations(limited)).citationCount, 8); assert.equal(requests.length, 3);
  }
  storage.clear();
  const ordinary = await import("./src/lib/openalex-citations.ts?ordinary-error");
  const ctx = { id: "2401.99012", title: "Ordinary Error" };
  mockFetch(() => new Response("Your daily budget has not been exhausted.", { status: 403 }));
  await assert.rejects(ordinary.fetchOpenAlexCitations(ctx), /OpenAlex 403/);
  mockFetch(() => Response.json(openalex(ctx, 4)));
  assert.equal((await ordinary.fetchOpenAlexCitations(ctx)).citationCount, 4);
}));

test("an exhausted search budget still permits verified single-work lookups without accepting an unrelated cached ID", () => isolated(async () => {
  const ctx = { id: "2401.99013", title: "Remembered Work" };
  storage.set("arxivhub:openalex-citations:budget-retry-at", String(now + DAY));
  storage.set(`arxivhub:openalex-work-id:v1:${ctx.id}`, JSON.stringify({ workId: "W12345", at: now }));
  mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/works/W12345");
    return Response.json(openalex(ctx).results[0]);
  });
  assert.equal((await oa.fetchOpenAlexCitations(ctx)).citationCount, 0); assert.equal(requests.length, 1);
  const other = { id: "2401.99014", title: ctx.title };
  storage.set(`arxivhub:openalex-work-id:v1:${other.id}`, JSON.stringify({ workId: "W12345", at: now }));
  await assert.rejects(oa.fetchOpenAlexCitations(other), /budget exhausted/);
  assert.equal(oa.readCachedOpenAlexCitations(other.id), undefined);
  assert.equal(oa.readCachedOpenAlexWorkId(other.id), undefined); assert.equal(requests.length, 2);
}));
