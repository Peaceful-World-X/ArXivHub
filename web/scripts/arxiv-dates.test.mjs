import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArxivTxt, parseSubmissionHistory, parseDataCiteHistory, formatDate } from "../src/lib/arxiv.ts";

test("TXT keeps complete published date separate from arXiv version", () => {
  const paper = parseArxivTxt('# Title\nExample\n# Authors\nA, B\n# Abstract\nText\n# Categories\ncs.RO\n# Publication Details\n- Published: August 16, 2026\n- arXiv ID: 2608.15875v1\n# BibTeX\n', '2608.15875');
  assert.equal(paper.published, '2026-08-16');
  assert.equal(paper.versionId, '2608.15875v1');
  assert.equal(paper.updated, '');
});
test("v1 has no update; version numbers determine earliest and latest", () => {
  const v1 = '**[[v1]](https://arxiv.org/abs/1706.03762v1)** Mon, 12 Jun 2017 17:57:34 UTC (100 KB)';
  const v7 = '**[v7]** Wed, 2 Aug 2023 00:41:18 UTC (100 KB)';
  assert.deepEqual(parseSubmissionHistory(`## Submission history\n${v1}`), { published: '2017-06-12T17:57:34.000Z', updated: '', version: 1 });
  assert.deepEqual(parseSubmissionHistory(`## Submission history\n${v7}\n${v1}`), { published: '2017-06-12T17:57:34.000Z', updated: '2023-08-02T00:41:18.000Z', version: 7 });
  assert.equal(parseSubmissionHistory(`## Submission history\n${v7}`), null);
  assert.equal(parseSubmissionHistory('## Summary\nNo history'), null);
});
test("DataCite version submissions, not DOI metadata update dates", () => {
  const attrs = { doi: '10.48550/arxiv.1706.03762', version: '7', updated: '2026-09-27', dates: [
    { date: '2023-08-03T00:07:25Z', dateType: 'Updated', dateInformation: 'v7' },
    { date: '2023-08-02T00:41:18Z', dateType: 'Submitted', dateInformation: 'v7' },
    { date: '2017-06-12T17:57:34Z', dateType: 'Submitted', dateInformation: 'v1' },
  ] };
  assert.deepEqual(parseDataCiteHistory({data:{attributes:attrs}}, '1706.03762'), {
    published: '2017-06-12T17:57:34.000Z', updated: '2023-08-02T00:41:18.000Z', version: 7,
  });
  assert.equal(parseDataCiteHistory({data:{attributes:attrs}}, '2608.15875'), null);
  assert.equal(parseDataCiteHistory({data:{attributes:{...attrs, dates:attrs.dates.slice(-1)}}}, '1706.03762'), null);
  assert.equal(parseDataCiteHistory({data:{attributes:{...attrs, dates:[]}}}, '1706.03762'), null);
  assert.equal(parseDataCiteHistory(null, '1706.03762'), null);
});
test("dates have an explicit year and are stable across local timezones", () => {
  process.env.TZ = 'Asia/Shanghai';
  assert.equal(formatDate('August 16, 2026'), '2026-08-16');
  assert.equal(formatDate('2023-08-02T00:41:18Z'), '2023-08-02');
  assert.equal(formatDate('not a date'), '');
});
