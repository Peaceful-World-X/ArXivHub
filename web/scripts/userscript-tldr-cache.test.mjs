import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../ArXivHub.user.js', import.meta.url), 'utf8');
const id = '2504.16054';
const arxivKey = `arxivtldr-cache-v3:${id}`;
const semanticKey = `semantic-scholar-tldr-cache-v2:${id}`;
const oldText = 'The cached summary explains the original paper clearly.';
const newText = 'The refreshed summary explains the updated paper clearly.';
const oldAt = 1_600_000_000_000;
const now = 1_800_000_000_000;
const record = (data, savedAt = oldAt) => ({ savedAt, data });
const flush = async () => { for (let index = 0; index < 25; index++) await Promise.resolve(); };

function harness({ gm = new Map(), local = new Map(), blockedLocal = false, blockedGM = false } = {}) {
  let clock = now;
  const requests = [];
  const messages = [];
  const listeners = new Map();
  const storage = {
    getItem(key) { if (blockedLocal) throw new Error('Blocked'); return local.get(key) ?? null; },
    setItem(key, value) { if (blockedLocal) throw new Error('Blocked'); local.set(key, value); },
    removeItem(key) { if (blockedLocal) throw new Error('Blocked'); local.delete(key); },
    get length() { if (blockedLocal) throw new Error('Blocked'); return local.size; },
    key(index) { return [...local.keys()][index]; },
  };
  const location = { hostname: 'arxivhub.github.io', origin: 'https://arxivhub.github.io', pathname: `/abs/${id}v2` };
  const window = {
    setTimeout: (callback, ms) => { clock += ms; queueMicrotask(callback); },
    addEventListener: (name, callback) => listeners.set(name, callback),
    postMessage: (data, origin) => messages.push({ ...data, origin }),
    prompt: () => 'replacement-key',
  };
  const context = vm.createContext({
    console, URL, location, window, localStorage: storage,
    Date: class extends Date { static now() { return clock; } },
    setTimeout: (callback, ms) => {
      if (ms === 2200) { clock += ms; queueMicrotask(callback); }
      return 1;
    },
    clearTimeout: () => {},
    GM_getValue: (key, fallback) => { if (blockedGM) throw new Error('Blocked'); return gm.get(key) ?? fallback; },
    GM_setValue: (key, value) => { if (blockedGM) throw new Error('Blocked'); gm.set(key, structuredClone(value)); },
    GM_deleteValue: (key) => gm.delete(key),
    GM_xmlhttpRequest: (options) => { requests.push(options); return { abort() {} }; },
  });
  const names = [
    'loadTldrCache', 'saveTldrCache', 'readArxivTldrData', 'loadSemanticTldrCache',
    'saveSemanticTldrCache', 'readSemanticTldrData', 'setSemanticScholarApiKey', 'installHubTldrBridge',
  ];  // Keep all production fetch/cache/card code. Stub only the HTML parser: parser
  // correctness and browser DOM/layout are covered by the separate UI checks.
  const instrumented = source.replace('    const hubHost =', `
    parseArxivTldrHtml = (text) => JSON.parse(text);
    globalThis.api = { ${names.join(', ')} };
    return;
    const hubHost =`);
  assert.notEqual(instrumented, source);
  vm.runInContext(instrumented, context);
  return {
    ...context.api, gm, local, requests, messages,
    get time() { return clock; },
    advance(ms) { clock += ms; },
    respond(index, body, status = 200) {
      requests[index].onload({ status, responseText: typeof body === 'string' ? body : JSON.stringify(body) });
    },
    send(data, overrides = {}) {
      listeners.get('message')?.({ source: window, origin: location.origin, data: {
        channel: 'arxivhub:tldr:v1', requestId: 'request-1', type: 'request', id, ...data,
      }, ...overrides });
    },
  };
}

function seedLocal(data, key = arxivKey) { return new Map([[key, JSON.stringify(record(data))]]); }
async function settleArxivEmpty(h, requestIndex, fail = false) {
  h.respond(requestIndex, { tldr: '', pending: false });
  await flush();
  h.respond(requestIndex + 1, fail ? 'Unavailable' : '## Original Abstract\nNot a summary.', fail ? 503 : 200);
  await flush();
}

test('migrate indefinitely old versioned local summaries to canonical cross-origin GM storage', () => {
  const gm = new Map();
  const h = harness({ gm, local: seedLocal({ tldr: oldText }, `${arxivKey}v9`) });
  assert.equal(h.loadTldrCache(`${id}v2`).tldr, oldText);
  assert.equal(h.loadTldrCache(id).savedAt, oldAt);
  assert.equal(gm.get(arxivKey).savedAt, oldAt);
  assert.equal(harness({ gm }).loadTldrCache(id).tldr, oldText);
  const semantic = harness({ gm, local: seedLocal({ text: oldText }, `${semanticKey}v3`) });
  assert.equal(semantic.loadSemanticTldrCache(id).savedAt, oldAt);
  assert.equal(harness({ gm }).loadSemanticTldrCache(`${id}v7`).text, oldText);
});

test('prefer the newest success over newer negative records, with corrupt or blocked local storage', () => {
  const gm = new Map([[arxivKey, record({ tldr: oldText })], [semanticKey, record({ text: oldText })]]);
  const local = new Map([[arxivKey, '{broken'], [semanticKey, JSON.stringify(record({ text: '' }, now))]]);
  const h = harness({ gm, local });
  assert.equal(h.loadTldrCache(id).tldr, oldText);
  assert.equal(h.loadSemanticTldrCache(id).text, oldText);
  local.set(`${arxivKey}v4`, JSON.stringify(record({ tldr: newText }, now - 1000)));
  assert.equal(h.loadTldrCache(id).tldr, newText);
  assert.equal(gm.get(arxivKey).savedAt, now - 1000);
  assert.equal(harness({ gm, blockedLocal: true }).loadTldrCache(id).tldr, newText);
});

test('future-dated legacy summaries cannot replace a freshly retrieved success', async () => {
  for (const provider of ['arxiv', 'semantic']) {
    const key = provider === 'arxiv' ? arxivKey : semanticKey;
    const field = provider === 'arxiv' ? 'tldr' : 'text';
    const h = harness({ local: new Map([
      [`${key}v9`, JSON.stringify(record({ [field]: oldText }, now + 86400000))],
    ]) });
    const load = provider === 'arxiv' ? h.loadTldrCache : h.loadSemanticTldrCache;
    assert.equal(load(id), null);
    const request = provider === 'arxiv' ? h.readArxivTldrData(id) : h.readSemanticTldrData(id);
    await flush();
    h.respond(0, provider === 'arxiv' ? { tldr: newText } : { tldr: { text: newText } });
    await request;
    assert.equal(load(id)[field], newText);
    assert.equal(load(id).savedAt, now);
    assert.equal(h.gm.get(key).data[field], newText);
    assert.equal(harness({ gm: h.gm, local: h.local }).loadTldrCache(id)?.tldr ??
      harness({ gm: h.gm, local: h.local }).loadSemanticTldrCache(id)?.text, newText);
  }
});

test('an overlapping success does not clear an active Semantic Scholar cooldown', async () => {
  const h = harness();
  const limited = h.readSemanticTldrData(id);
  const rejected = assert.rejects(limited, error => error.code === 'RATE_LIMIT');
  await flush();
  const succeeding = h.readSemanticTldrData('1706.03762');
  await flush();
  assert.equal(h.requests.length, 2);
  h.respond(0, '', 429);
  await rejected;
  const cooldown = h.gm.get('arxiv-bridge-semantic-scholar-cooldown-until');
  h.respond(1, { tldr: { text: newText } });
  await succeeding;
  assert.equal(h.gm.get('arxiv-bridge-semantic-scholar-cooldown-until'), cooldown);
  await assert.rejects(h.readSemanticTldrData('2303.08774'), error => error.code === 'RATE_LIMIT_COOLDOWN');
  assert.equal(h.requests.length, 2);
  assert.equal(h.loadSemanticTldrCache('1706.03762').text, newText);
});

test('retain successful text and timestamps when both persistent stores are unavailable', () => {
  const h = harness({ blockedGM: true, blockedLocal: true });
  h.saveTldrCache(id, { tldr: oldText });
  h.saveSemanticTldrCache(id, { text: oldText });
  h.advance(1000);
  h.saveTldrCache(id, null);
  h.saveSemanticTldrCache(id, { text: '' });
  assert.equal(h.loadTldrCache(id).savedAt, now);
  assert.equal(h.loadSemanticTldrCache(id).savedAt, now);
});

test('Semantic Scholar rechecks cooldown after awaiting the shared request slot', async () => {
  const h = harness();
  const request = h.readSemanticTldrData(id);
  h.gm.set('arxiv-bridge-semantic-scholar-cooldown-until', now + 60_000);
  await assert.rejects(request, (error) => error.code === 'RATE_LIMIT_COOLDOWN');
  assert.equal(h.requests.length, 0);
});

test('only empty Semantic Scholar cache cools for 12 hours; success is never expired', async () => {
  const h = harness();
  h.saveSemanticTldrCache(id, { text: '' });
  await h.readSemanticTldrData(id);
  assert.equal(h.requests.length, 0);
  h.advance(12 * 60 * 60 * 1000 + 1);
  const retry = h.readSemanticTldrData(id);
  await flush();
  assert.equal(h.requests.length, 1);
  h.respond(0, { tldr: { text: newText } });
  await retry;
  const at = h.loadSemanticTldrCache(id).savedAt;
  h.advance(100 * 365 * 24 * 60 * 60 * 1000);
  assert.equal(h.loadSemanticTldrCache(id).savedAt, at);
});

test('API-key changes preserve successful cached summaries', () => {
  const h = harness({ local: seedLocal({ text: oldText }, semanticKey) });
  h.setSemanticScholarApiKey('replacement-key');
  assert.equal(h.loadSemanticTldrCache(id).text, oldText);
  assert.equal(h.loadSemanticTldrCache(id).savedAt, oldAt);
});

test('bridge emits old cache immediately and one fresh result with the saved timestamp', async () => {
  const h = harness({ local: seedLocal({ tldr: oldText }, `${arxivKey}v2`) });
  h.installHubTldrBridge();
  h.send({ id: `${id}v3` });
  assert.equal(h.messages.length, 1);
  assert.deepEqual({ ...h.messages[0] }, { channel: 'arxivhub:tldr:v1', requestId: 'request-1',
    type: 'cache', ok: true, text: oldText, at: oldAt, origin: 'https://arxivhub.github.io' });
  h.send({ id: `${id}v9`, requestId: 'request-2' });
  assert.equal(h.requests.length, 1);
  h.advance(1000);
  h.respond(0, { tldr: newText });
  await flush();
  const results = h.messages.filter((message) => message.type === 'result');
  assert.equal(results.length, 2);
  assert.ok(results.every((message) => message.ok && message.text === newText && message.at === now + 1000));
  assert.equal(h.gm.get(arxivKey).savedAt, results[0].at);
});

test('bridge reports refresh failure/absence honestly after cache and never renews old success', async () => {
  for (const fail of [true, false]) {
    const h = harness({ local: seedLocal({ tldr: oldText }) });
    h.installHubTldrBridge();
    h.send({});
    await settleArxivEmpty(h, 0, fail);
    assert.equal(h.messages.length, 2);
    assert.equal(h.messages[0].type, 'cache');
    assert.equal(h.messages[1].type, 'result');
    assert.equal(h.messages[1].ok, !fail);
    assert.equal(h.messages[1].text, fail ? undefined : null);
    assert.equal(h.messages[1].at, fail ? undefined : null);
    assert.equal(h.loadTldrCache(id).savedAt, oldAt);
  }
});

test('bridge keeps source, origin, requestId and paper-ID guards and ready handshake', () => {
  const h = harness();
  h.installHubTldrBridge();
  h.send({}, { source: {} });
  h.send({}, { origin: 'https://evil.example' });
  h.send({ requestId: 'x'.repeat(81) });
  h.send({ id: 'https://evil.example' });
  h.send({ channel: 'wrong-channel' });
  assert.equal(h.messages.length, 0);
  assert.equal(h.requests.length, 0);
  h.send({ type: 'ping' });
  assert.equal(h.messages[0].type, 'ready');
});
