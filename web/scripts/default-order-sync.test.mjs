import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { defaultOrderSync } from './dev-order-sync.ts';

test('only complete, valid order snapshots are saved', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arxivhub-order-test-'));
  try {
    const file = join(dir, 'orders.json');
    await writeFile(file, '{}\n');
    let receive;
    const plugin = defaultOrderSync(file, { all: ['a', 'b'], ai: ['a'], source: ['b'], favorites: ['a', 'b'] });
    plugin.configureServer({ ws: { on: (_event, handler) => { receive = handler; } }, config: { logger: { info: () => {} } } });
    const send = (orders) => new Promise((resolve) => receive({ requestId: 'test', orders }, { send: (_event, result) => resolve(result) }));
    const valid = { all: ['b', 'a'], ai: ['a'], source: ['b'], favorites: ['b'] };
    assert.equal((await send(valid)).ok, true);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), valid);
    for (const invalid of [
      { ...valid, all: ['a', 'a'] },
      { ...valid, ai: ['unknown'] },
      { ...valid, ai: ['b'] },
      { all: ['a', 'b'] },
      { ...valid, extra: [] },
    ]) {
      assert.equal((await send(invalid)).ok, false);
      assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), valid);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
