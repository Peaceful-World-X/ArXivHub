import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArxivTldr, parseExtractedTldr, fetchArxivTldr } from "../src/lib/arxiv-tldr.ts";

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
  assert.equal(requests, 1);
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
test("recognize setext headings and formatted text without executing HTML", () => {
  assert.equal(parseArxivTldr("TL;DR\n-----\nThe **model** [learns](https://example.org/).\n\nSecond paragraph.\n### Why it matters\nNot shown"), "The model learns.");
});
test("never use original abstract or unrelated metadata as TLDR", () => {
  for (const text of ["", "Title: TLDR: Paper\n## Original Abstract\nThe model learns.", "## TLDR\n### Key contributions\nMore tasks", "## TLDR\nSummarizing paper..."]) {
    assert.equal(parseArxivTldr(text), null);
  }
});
