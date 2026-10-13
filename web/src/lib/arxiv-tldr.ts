import { Lexer, type Token } from "marked";

function isPendingSummary(text: string): boolean {
  return /^(?:summarizing paper|generating(?: AI)? summary|too many requests)|weekly free summary limit/i.test(text);
}

export function parseExtractedTldr(value: unknown, id: string): string | null {
  if (!value || typeof value !== "object" || !("status" in value) || value.status !== "success" ||
      !("statusCode" in value) || value.statusCode !== 200 || !("data" in value) ||
      !value.data || typeof value.data !== "object") throw new Error("TLDR extraction failed");
  const data = value.data;
  if (!("url" in data) || typeof data.url !== "string" ||
      data.url.replace(/\/$/, "") !== `https://arxivtldr.org/abs/${id}` ||
      !("tldr" in data) || !(data.tldr === null || typeof data.tldr === "string")) {
    throw new Error("Invalid TLDR source");
  }
  const text = data.tldr?.replace(/\s+/g, " ").trim();
  return text && !isPendingSummary(text) ? text : null;
}

// 只取明确 TLDR 标题下的首段，避免混入原始摘要和贡献列表。
export function parseArxivTldr(text: string): string | null {
  const marker = "Markdown Content:";
  const markdown = text.includes(marker) ? text.slice(text.indexOf(marker) + marker.length) : text;
  const tokens = Lexer.lex(markdown);
  const heading = tokens.findIndex((token) => token.type === "heading" && /^tl;?dr$/i.test(token.text.trim()));
  if (heading < 0) return null;
  const plainText = (token: Token): string => {
    if ("tokens" in token && token.tokens) return token.tokens.map(plainText).join("");
    return token.type === "html" ? "" : "text" in token ? token.text : "";
  };
  for (const token of tokens.slice(heading + 1)) {
    if (token.type === "heading") break;
    if (token.type !== "paragraph") continue;
    const summary = plainText(token).replace(/\s+/g, " ").trim();
    if (!summary || isPendingSummary(summary)) return null;
    return summary;
  }
  return null;
}

export type ArxivTldrSnapshot = { text: string; at: number };
type CacheListener = (snapshot: ArxivTldrSnapshot) => void;

const cache = new Map<string, ArxivTldrSnapshot>();
const pending = new Map<string, Promise<string | null>>();
const cacheListeners = new Map<string, Set<CacheListener>>();
const RATE_LIMIT_KEY = "arxivhub:tldr:extractor-retry-at";

// 空结果可能来自提取服务的旧缓存；刷新时要求重新读取原站。
async function fetchExtractedTldr(id: string, refresh = false): Promise<string | null> {
  let retryAt = 0;
  try { retryAt = Number(localStorage.getItem(RATE_LIMIT_KEY)); } catch { /* Optional storage. */ }
  if (retryAt > Date.now()) throw new Error("TLDR extractor rate limited");
  const url = new URL("https://api.microlink.io");
  url.searchParams.set("url", `https://arxivtldr.org/abs/${id}`);
  url.searchParams.set("data.tldr.selector", "#tldr-heading + p");
  url.searchParams.set("data.tldr.type", "text");
  if (refresh) url.searchParams.set("force", "true");
  const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
  if (response.status === 429) {
    const reset = Number(response.headers.get("x-rate-limit-reset")) * 1000;
    try { localStorage.setItem(RATE_LIMIT_KEY, String(reset > Date.now() ? reset : Date.now() + 300000)); } catch { /* Optional storage. */ }
  }
  if (!response.ok) throw new Error(`TLDR extractor ${response.status}`);
  return parseExtractedTldr(await response.json(), id);
}

function validSnapshot(value: unknown): value is ArxivTldrSnapshot {
  return Boolean(value && typeof value === "object" && "text" in value && "at" in value &&
    typeof value.text === "string" && value.text.trim() && !isPendingSummary(value.text.trim()) &&
    typeof value.at === "number" && Number.isFinite(value.at) && value.at > 0 && value.at <= Date.now());
}

export function readCachedArxivTldr(id: string): ArxivTldrSnapshot | undefined {
  let hit = cache.get(id);
  if (hit && !validSnapshot(hit)) { cache.delete(id); hit = undefined; }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(`arxivhub:tldr:v1:${id}`) ?? "null");
    if (validSnapshot(stored) && (!hit || stored.at > hit.at)) hit = stored;
  } catch { /* Memory cache works when storage is unavailable. */ }
  if (hit) cache.set(id, hit);
  return hit ? { ...hit } : undefined;
}

function saveCache(id: string, snapshot: ArxivTldrSnapshot): ArxivTldrSnapshot | undefined {
  if (!validSnapshot(snapshot)) return readCachedArxivTldr(id);
  const current = readCachedArxivTldr(id);
  if (current && current.at > snapshot.at) return current;
  cache.set(id, snapshot);
  try { localStorage.setItem(`arxivhub:tldr:v1:${id}`, JSON.stringify(snapshot)); } catch { /* Optional persistence. */ }
  return snapshot;
}

function readFromUserscript(id: string, onCached: CacheListener): Promise<ArxivTldrSnapshot | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const channel = "arxivhub:tldr:v1";
    let ready = false;
    const send = (type: string) => window.postMessage({ channel, requestId, type, id }, location.origin);
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(ping);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin ||
          data?.channel !== channel || data.requestId !== requestId) return;
      if (data.type === "ready" && !ready) {
        ready = true;
        clearInterval(ping);
        clearTimeout(timer);
        // The script has a 30-second direct/retry/Reader budget.
        timer = setTimeout(() => { cleanup(); reject(new Error("TLDR script timeout")); }, 32000);
        send("request");
      } else if (ready && data.type === "cache" && data.ok && validSnapshot(data)) {
        onCached({ text: data.text, at: data.at });
      } else if (ready && data.type === "result") {
        cleanup();
        if (data.ok && (data.text === null || typeof data.text === "string")) {
          const text = data.text?.replace(/\s+/g, " ").trim();
          const snapshot = { text: text || "", at: data.at ?? Date.now() };
          resolve(validSnapshot(snapshot) ? snapshot : null);
        } else reject(new Error("TLDR script request failed"));
      }
    };
    let timer = setTimeout(() => { cleanup(); resolve(null); }, 3000);
    const ping = setInterval(() => send("ping"), 100);
    window.addEventListener("message", onMessage);
    send("ping");
  });
}

export async function fetchArxivTldr(id: string, onCached?: CacheListener): Promise<string | null> {
  const hit = readCachedArxivTldr(id);
  if (hit) onCached?.(hit);
  let request = pending.get(id);
  if (!request) {
    const listeners = new Set<CacheListener>();
    cacheListeners.set(id, listeners);
    request = loadArxivTldr(id, (snapshot) => {
      const saved = saveCache(id, snapshot);
      if (saved) listeners.forEach((listener) => listener(saved));
    }).then((snapshot) => (snapshot ? saveCache(id, snapshot) : readCachedArxivTldr(id))?.text ?? null)
      .catch((error: unknown) => {
        const cached = readCachedArxivTldr(id);
        if (cached) return cached.text;
        throw error;
      }).finally(() => {
        pending.delete(id);
        cacheListeners.delete(id);
      });
    pending.set(id, request);
  }
  const listeners = cacheListeners.get(id)!;
  if (onCached) listeners.add(onCached);
  try { return await request; }
  finally { if (onCached) listeners.delete(onCached); }
}

// 任一来源的空结果都不代表原站没有摘要，继续刷新或读取备用来源。
async function loadArxivTldr(id: string, onCached: CacheListener): Promise<ArxivTldrSnapshot | null> {
  const bridge = await readFromUserscript(id, onCached).catch(() => null);
  if (bridge) return bridge;
  try {
    // Extract the explicit TLDR paragraph, never the site's generic meta description.
    const text = await fetchExtractedTldr(id) ?? await fetchExtractedTldr(id, true);
    if (text) return { text, at: Date.now() };
  } catch {
    // The public extraction API has a free quota; Reader remains a fallback.
  }
  // Reader 仅转发公开页面，提供 GitHub Pages 所需的跨域读取能力。
  const response = await fetch(`https://r.jina.ai/https://arxivtldr.org/abs/${encodeURIComponent(id)}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`ArXiv TLDR ${response.status}`);
  const text = parseArxivTldr(await response.text());
  return text ? { text, at: Date.now() } : null;
}
