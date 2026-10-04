import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchArxivPaper, parseAlphaXivPaper, parseDataCitePaper } from "../src/lib/arxiv.ts";
import { fetchAlphaXivLikes, fetchAlphaXivPreview, parseAlphaXivLikes } from "../src/lib/alphaxiv.ts";

const id = "2303.08774";
const attrs = {
  doi: `10.48550/arxiv.${id}`,
  titles: [{ title: "GPT-4 Technical Report" }],
  creators: [{ name: "OpenAI" }, { name: "Achiam, Josh", givenName: "Josh", familyName: "Achiam" }],
  descriptions: [{ descriptionType: "Abstract", description: "We report the development of GPT-4." }],
  subjects: [
    { subjectScheme: "arXiv", subject: "Computation and Language (cs.CL)" },
    { subjectScheme: "arXiv", subject: "Artificial Intelligence (cs.AI)" },
    { subjectScheme: "FOS", subject: "Computer science" },
  ],
  version: "6",
  updated: "2026-09-27",
  dates: [
    { date: "2023-03-15T17:15:04Z", dateType: "Submitted", dateInformation: "v1" },
    { date: "2024-03-04T06:01:33Z", dateType: "Submitted", dateInformation: "v6" },
  ],
};
const record = { data: { attributes: attrs } };

test("DataCite supplies complete paper metadata and actual version dates", () => {
  const paper = parseDataCitePaper(record, id);
  assert.equal(paper.title, "GPT-4 Technical Report");
  assert.equal(paper.versionId, `${id}v6`);
  assert.deepEqual(paper.authors, [{ name: "OpenAI" }, { name: "Josh Achiam" }]);
  assert.deepEqual(paper.categories, ["cs.CL", "cs.AI"]);
  assert.equal(paper.summary, attrs.descriptions[0].description);
  assert.equal(paper.published, "2023-03-15T17:15:04.000Z");
  assert.equal(paper.updated, "2024-03-04T06:01:33.000Z");
  assert.equal(paper.absUrl, `https://arxiv.org/abs/${id}`);
  assert.equal(parseDataCitePaper(record, "1706.03762"), null);
  for (const invalid of [null, {}, { data: null }, { data: { attributes: { ...attrs, titles: [] } } },
    { data: { attributes: { ...attrs, descriptions: [] } } }]) {
    assert.equal(parseDataCitePaper(invalid, id), null);
  }
});

test("complete DataCite metadata returns without contacting the TXT proxy", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    assert.ok(url.includes("api.datacite.org"));
    return Response.json(record);
  });
  const paper = await fetchArxivPaper(id);
  assert.equal(paper.title, "GPT-4 Technical Report");
  assert.equal(paper.updated, "2024-03-04T06:01:33.000Z");
  assert.equal(requests.length, 1);
});

test("failed or incomplete DataCite metadata falls back to TXT", async (t) => {
  for (const mode of ["http-error", "timeout", "invalid-json", "missing-title", "missing-abstract"]) {
    await t.test(mode, async (t) => {
      let doiRequests = 0;
      t.mock.method(globalThis, "fetch", async (url) => {
        if (url.includes("api.datacite.org")) {
          doiRequests++;
          if (mode === "timeout") throw new DOMException("Timed out", "TimeoutError");
          if (mode === "http-error") return new Response("Unavailable", { status: 503 });
          if (mode === "invalid-json") return new Response("Invalid JSON");
          return Response.json({ data: { attributes: {
            ...attrs, ...(mode === "missing-title" ? { titles: [] } : { descriptions: [] }),
          } } });
        }
        if (url.includes("api.alphaxiv.org")) return new Response("Unavailable", { status: 503 });
        if (url.includes("/https://arxiv.org/abs/")) return new Response("## Submission history\n**[v1]** Wed, 15 Mar 2023 17:15:04 UTC\n**[v6]** Mon, 4 Mar 2024 06:01:33 UTC");
        assert.ok(url.includes("arxiv-txt.org"));
        return new Response(`# Title\nTXT title\n# Authors\nOpenAI\n# Abstract\nTXT abstract\n# Categories\ncs.CL\n# Publication Details\n- arXiv ID: ${id}v6\n# BibTeX\n`);
      });
      const paper = await fetchArxivPaper(id);
      assert.equal(paper.title, "TXT title");
      assert.equal(paper.versionId, `${id}v6`);
      assert.equal(paper.updated, "2024-03-04T06:01:33.000Z");
      assert.equal(doiRequests, 1);
    });
  }
});

test("total upstream failure still rejects instead of inventing metadata", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(fetchArxivPaper(id), /arXiv TXT 503/);
});

const alphaRecord = {
  universal_paper_id: "2608.05594", canonical_id: "2608.05594v2",
  title: "JTA: Joint Testability Architecture for Scenario-Based Validation of Safety-Critical Software",
  abstract: "A framework for joint testability and scenario-based validation.",
  authors: ["First Author", "Second Author"], topics: ["Computer Science", "cs.SE", "cs.AI"],
  first_publication_date: "2026-08-06T12:00:00.000Z", publication_date: "2026-08-20T12:00:00.000Z",
  updated_at: "2026-10-04T12:00:00.000Z", metrics: { public_total_votes: 0 },
};

test("alphaXiv metadata requires the matching paper and uses actual publication fields, never platform updated_at", () => {
  const paper = parseAlphaXivPaper(alphaRecord, "2608.05594");
  assert.equal(paper.title, alphaRecord.title);
  assert.equal(paper.summary, alphaRecord.abstract);
  assert.equal(paper.versionId, "2608.05594v2");
  assert.deepEqual(paper.authors, [{ name: "First Author" }, { name: "Second Author" }]);
  assert.deepEqual(paper.categories, ["cs.SE", "cs.AI"]);
  assert.equal(paper.primaryCategory, "cs.SE");
  assert.equal(paper.published, alphaRecord.first_publication_date);
  assert.equal(paper.updated, alphaRecord.publication_date);
  assert.equal(parseAlphaXivPaper({ ...alphaRecord, canonical_id: "2608.05594v1" }, "2608.05594").updated, "");
  const undated = parseAlphaXivPaper({ ...alphaRecord, first_publication_date: null, publication_date: null }, "2608.05594");
  assert.equal(undated.published, "");
  assert.equal(undated.updated, "");
  for (const value of [null, {}, { ...alphaRecord, universal_paper_id: "2303.08774" },
    { ...alphaRecord, canonical_id: "2303.08774v2" }, { ...alphaRecord, title: "" }, { ...alphaRecord, abstract: "" }]) {
    assert.equal(parseAlphaXivPaper(value, "2608.05594"), null);
  }
});

test("failed DataCite metadata uses the public alphaXiv preview before any TXT request", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    if (url.includes("api.datacite.org")) return new Response("Unavailable", { status: 503 });
    assert.equal(url, "https://api.alphaxiv.org/papers/v3/2608.05594/preview");
    return Response.json(alphaRecord);
  });
  const paper = await fetchArxivPaper("2608.05594");
  assert.equal(paper.title, alphaRecord.title);
  assert.equal(paper.versionId, "2608.05594v2");
  assert.equal(requests.length, 2);
});

test("an unrelated alphaXiv response is rejected and the existing TXT fallback remains available", async (t) => {
  const requestedId = "2401.12345";
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.includes("api.datacite.org") || url.includes("/https://arxiv.org/abs/")) return new Response("Unavailable", { status: 503 });
    if (url.includes("api.alphaxiv.org")) return Response.json(alphaRecord);
    assert.ok(url.includes("arxiv-txt.org"));
    return new Response(`# Title\nCorrect TXT Paper\n# Authors\nCorrect Author\n# Abstract\nCorrect abstract\n# Categories\ncs.SE\n# Publication Details\n- arXiv ID: ${requestedId}v1\n# BibTeX\n`);
  });
  assert.equal((await fetchArxivPaper(requestedId)).title, "Correct TXT Paper");
});

test("alphaXiv likes use public_total_votes, including zero, and reject net votes, visits or another paper", () => {
  const value = { ...alphaRecord, metrics: { public_total_votes: 0, total_votes: 26, visits_count: { all: 939 } } };
  assert.equal(parseAlphaXivLikes(value, "2608.05594v2"), 0);
  assert.equal(parseAlphaXivLikes(null, "2608.05594"), null);
  for (const invalid of [{ ...value, universal_paper_id: "2303.08774" }, { ...value, metrics: { total_votes: 26 } },
    ...[null, -1, 0.5, "0", NaN].map((count) => ({ ...value, metrics: { public_total_votes: count } }))]) {
    assert.throws(() => parseAlphaXivLikes(invalid, "2608.05594"));
  }
});

test("metadata and likes share a public preview request across versions and refresh after fifteen minutes", async (t) => {
  let now = Date.now(), calls = 0;
  t.mock.method(Date, "now", () => now);
  const previewId = "2401.99099";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.equal(url, `https://api.alphaxiv.org/papers/v3/${previewId}/preview`);
    assert.equal(options.credentials, "omit");
    return Response.json({ ...alphaRecord, universal_paper_id: previewId, canonical_id: `${previewId}v2`,
      metrics: { public_total_votes: calls - 1 } });
  });
  const [preview, likes] = await Promise.all([fetchAlphaXivPreview(`${previewId}v1`), fetchAlphaXivLikes(`${previewId}v2`)]);
  assert.equal(parseAlphaXivPaper(preview, previewId).title, alphaRecord.title);
  assert.equal(likes, 0); assert.equal(calls, 1);
  now += 15 * 60 * 1000 + 1;
  assert.equal(await fetchAlphaXivLikes(previewId), 1);
  assert.equal((await fetchAlphaXivPreview(previewId)).metrics.public_total_votes, 1);
  assert.equal(calls, 2);
});
