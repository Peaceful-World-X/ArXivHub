import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchArxivPaper, parseDataCitePaper } from "../src/lib/arxiv.ts";

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
