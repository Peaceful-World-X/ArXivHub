import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArxivTldr } from "../src/lib/arxiv-tldr.ts";

test("extract only TLDR, stopping before contributions and importance", () => {
  assert.equal(parseArxivTldr("Title: Other\nMarkdown Content:\n## TLDR\nThe robot learns.\n### Key contributions\n- More tasks\n### Why it matters\nBetter robots\n## Original Abstract\nLong text"), "The robot learns.");
});
test("recognize setext headings and formatted text without executing HTML", () => {
  assert.equal(parseArxivTldr("TL;DR\n-----\nThe **model** [learns](https://example.org/).\n\nSecond paragraph.\n### Why it matters\nNot shown"), "The model learns.");
});
test("never use original abstract or unrelated metadata as TLDR", () => {
  for (const text of ["", "Title: TLDR: Paper\n## Original Abstract\nThe model learns.", "## TLDR\n### Key contributions\nMore tasks", "## TLDR\nSummarizing paper..."]) {
    assert.equal(parseArxivTldr(text), null);
  }
});
