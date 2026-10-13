import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArxivTldr, parseExtractedTldr, fetchArxivTldr, readCachedArxivTldr } from "../src/lib/arxiv-tldr.ts";

test("extract only TLDR, stopping before contributions and importance", () => {
  assert.equal(parseArxivTldr("Title: Other\nMarkdown Content:\n## TLDR\nThe robot learns.\n### Key contributions\n- More tasks\n### Why it matters\nBetter robots\n## Original Abstract\nLong text"), "The robot learns.");
});

test("accept only the extracted TLDR from the requested paper", () => {
  const data = { url: "https://arxivtldr.org/abs/2303.08774", tldr: "A verified paper summary.", description: "Do not use metadata." };
  const response = { status: "success", statusCode: 200, data };
  assert.equal(parseExtractedTldr(response, "2303.08774"), data.tldr);
  for (const tldr of [null, "", "Generating AI summary..."]) {
    assert.equal(parseExtractedTldr({ ...response, data: { ...data, tldr } }, "2303.08774"), null);
  }
  for (const invalid of [null, { ...response, status: "fail" }, { ...response, statusCode: 404 },
    { ...response, data: { ...data, url: "https://arxivtldr.org/abs/1706.03762" } },
    { ...response, data: { url: data.url, description: "Original abstract" } }]) {
    assert.throws(() => parseExtractedTldr(invalid, "2303.08774"));
  }
});

test("public extraction requests are shared and successful TLDRs are cached", async (t) => {
  let requests = 0;
  const id = "2504.16054";
  t.mock.method(globalThis, "fetch", async (input) => {
    requests++;
    const url = new URL(input);
    assert.equal(url.origin, "https://api.microlink.io");
    assert.equal(url.searchParams.get("url"), `https://arxivtldr.org/abs/${id}`);
    assert.equal(url.searchParams.get("data.tldr.selector"), "#tldr-heading + p");
    return Response.json({ status: "success", statusCode: 200, data: { url: url.searchParams.get("url"), tldr: "A real TLDR." } });
  });
  assert.deepEqual(await Promise.all([fetchArxivTldr(id), fetchArxivTldr(id)]), ["A real TLDR.", "A real TLDR."]);
  assert.equal(await fetchArxivTldr(id), "A real TLDR.");
  assert.equal(requests, 2);
});

test("extraction failures fall back to Reader without using generic descriptions", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input);
    requests.push(url);
    return url.startsWith("https://api.microlink.io")
      ? new Response("Rate limited", { status: 429 })
      : new Response("## TLDR\nThe original paper summary.");
  });
  assert.equal(await fetchArxivTldr("1706.03762"), "The original paper summary.");
  assert.equal(requests.length, 2);
});

test("refresh a cached empty extraction before giving up on RT-2", async (t) => {
  const id = "2307.15818";
  const summary = "RT-2 introduces Vision-Language-Action models that transfer web knowledge to robotic control, enabling emergent semantic reasoning and generalization.";
  const refreshes = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.microlink.io");
    const refresh = url.searchParams.get("force");
    refreshes.push(refresh);
    return Response.json({ status: "success", statusCode: 200, data: {
      url: `https://arxivtldr.org/abs/${id}`, tldr: refresh ? summary : null,
      description: "Original abstract, not a TLDR.",
    } });
  });
  assert.equal(await fetchArxivTldr(id), summary);
  assert.equal(await fetchArxivTldr(id), summary);
  assert.deepEqual(refreshes, [null, "true", null, "true"]);
});

test("empty extractions still fall back to Reader", async (t) => {
  const id = "2303.04137";
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    requests.push(url.origin);
    return url.origin === "https://api.microlink.io"
      ? Response.json({ status: "success", statusCode: 200, data: { url: `https://arxivtldr.org/abs/${id}`, tldr: null } })
      : new Response("## TLDR\nDiffusion Policy learns robot actions through diffusion.");
  });
  assert.equal(await fetchArxivTldr(id), "Diffusion Policy learns robot actions through diffusion.");
  assert.deepEqual(requests, ["https://api.microlink.io", "https://api.microlink.io", "https://r.jina.ai"]);
});

test("do not cache missing summaries or confuse a failed fallback with absence", async (t) => {
  const id = "2410.24164";
  let readerFails = true;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    requests++;
    return String(input).startsWith("https://api.microlink.io")
      ? Response.json({ status: "success", statusCode: 200, data: { url: `https://arxivtldr.org/abs/${id}`, tldr: null } })
      : readerFails ? new Response("Unavailable", { status: 503 }) : new Response("## Original Abstract\nNot a TLDR.");
  });
  await assert.rejects(fetchArxivTldr(id), /ArXiv TLDR 503/);
  readerFails = false;
  assert.equal(await fetchArxivTldr(id), null);
  assert.equal(await fetchArxivTldr(id), null);
  assert.equal(requests, 9);
});
test("recognize setext headings and formatted text without executing HTML", () => {
  assert.equal(parseArxivTldr("TL;DR\n-----\nThe **model** [learns](https://example.org/).\n\nSecond paragraph.\n### Why it matters\nNot shown"), "The model learns.");
});
test("successful TLDR persists indefinitely while every visit refreshes without erasing failures", async (t) => {
  const id = "2610.09001";
  const old = { text: "Previously retrieved useful research summary.", at: Date.now() - 3 * 365 * 86400000 };
  const storage = new Map([[`arxivhub:tldr:v1:${id}`, JSON.stringify(old)]]);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, "localStorage", descriptor) : delete globalThis.localStorage);
  let mode = "error", requests = 0;
  let release;
  let blocked = new Promise((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async (input) => {
    requests++;
    await blocked;
    if (mode === "error") throw new Error("Offline");
    const url = new URL(input);
    return url.origin === "https://api.microlink.io"
      ? Response.json({ status: "success", statusCode: 200, data: { url: `https://arxivtldr.org/abs/${id}`, tldr: mode === "success" ? "Freshly retrieved paper summary." : null } })
      : new Response("## Original Abstract\nNot the summary.");
  });
  assert.deepEqual(readCachedArxivTldr(id), old);
  const snapshots = [];
  const result = fetchArxivTldr(id, (snapshot) => snapshots.push(snapshot));
  const joined = fetchArxivTldr(id);
  assert.deepEqual(snapshots, [old]);
  release();
  assert.deepEqual(await Promise.all([result, joined]), [old.text, old.text]);
  assert.equal(requests, 2);
  assert.deepEqual(JSON.parse(storage.get(`arxivhub:tldr:v1:${id}`)), old);
  mode = "empty";
  blocked = Promise.resolve();
  assert.equal(await fetchArxivTldr(id), old.text);
  assert.equal(requests, 5);
  assert.deepEqual(readCachedArxivTldr(id), old);
  mode = "success";
  assert.equal(await fetchArxivTldr(id), "Freshly retrieved paper summary.");
  assert.equal(requests, 6);
  assert.ok(readCachedArxivTldr(id).at > old.at);
  const fresh = readCachedArxivTldr(id);
  mode = "error";
  assert.equal(await fetchArxivTldr(id), fresh.text);
  assert.equal(requests, 8);
  assert.deepEqual(readCachedArxivTldr(id), fresh);
});

test("invalid cached placeholders and timestamps are never reused", (t) => {
  const storage = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => storage.get(key) ?? null } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, "localStorage", descriptor) : delete globalThis.localStorage);
  for (const [index, entry] of [
    { text: "Generating AI summary, please wait while we prepare this paper.", at: Date.now() },
    { text: "A valid summary.", at: Date.now() + 60000 },
    { text: "", at: Date.now() },
  ].entries()) {
    const id = `2610.0910${index}`;
    storage.set(`arxivhub:tldr:v1:${id}`, JSON.stringify(entry));
    assert.equal(readCachedArxivTldr(id), undefined);
  }
});

test("never use original abstract or unrelated metadata as TLDR", () => {
  for (const text of ["", "Title: TLDR: Paper\n## Original Abstract\nThe model learns.", "## TLDR\n### Key contributions\nMore tasks", "## TLDR\nSummarizing paper..."]) {
    assert.equal(parseArxivTldr(text), null);
  }
});
