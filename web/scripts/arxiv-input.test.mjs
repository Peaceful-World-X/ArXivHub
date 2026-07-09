import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeArxivId, isLikelyArxivInput } from '../src/lib/arxiv.ts';

test('malformed URL encodings are rejected without throwing', () => {
  for (const input of [
    'https://arxiv.org/abs/1706.03762%',
    'https://arxiv.org/abs/%',
    'https://arxiv.org/abs/%ZZ',
    'https://arxiv.org/abs/%E0%A4%A',
    'https://arxiv.org/pdf/1706.03762%ED%A0%80.pdf',
    'https://www.alphaxiv.org/abs/1706.03762%',
    'https://papers.cool/arxiv/1706.03762%',
    'https://doi.org/10.48550/arXiv.1706.03762%',
  ]) {
    assert.equal(normalizeArxivId(input), null, input);
    assert.equal(isLikelyArxivInput(input), false, input);
  }
});

test('valid encoded URLs, legacy IDs and versions still normalize', () => {
  for (const [input, id] of [
    ['1706.03762', '1706.03762'],
    ['arXiv:1706.03762v7', '1706.03762'],
    ['https://arxiv.org/abs/1706%2E03762v7', '1706.03762'],
    ['https://arxiv.org/pdf/1706.03762v7.pdf?download=1', '1706.03762'],
    ['https://arxiv.org/abs/hep-th%2F9901001v2', 'hep-th/9901001'],
    ['https://arxiv.org/abs/1706.03762?note=%', '1706.03762'],
    ['See https://www.alphaxiv.org/abs/2504.16054', '2504.16054'],
  ]) {
    assert.equal(normalizeArxivId(input), id, input);
    assert.equal(isLikelyArxivInput(input), true, input);
  }
});

test('empty and unrelated inputs remain invalid', () => {
  for (const input of ['', '   ', 'not a paper', 'https://example.com/']) {
    assert.equal(normalizeArxivId(input), null, input);
  }
});
