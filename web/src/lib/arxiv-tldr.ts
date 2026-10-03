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

const cache = new Map<string, { text: string; at: number }>();
const pending = new Map<string, Promise<string | null>>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
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

function readCache(id: string): string | null {
  try {
    const hit = cache.get(id) ?? JSON.parse(localStorage.getItem(`arxivhub:tldr:v1:${id}`) ?? "null");
    if (hit && typeof hit.text === "string" && hit.text.trim() && Number.isFinite(hit.at) &&
        hit.at <= Date.now() && Date.now() - hit.at < CACHE_TTL) return hit.text;
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

function readFromUserscript(id: string): Promise<{ available: boolean; text: string | null }> {
  if (typeof window === "undefined") return Promise.resolve({ available: false, text: null });
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
        timer = setTimeout(() => { cleanup(); reject(new Error("TLDR script timeout")); }, 16000);
        send("request");
      } else if (ready && data.type === "result") {
        cleanup();
        if (data.ok && (data.text === null || typeof data.text === "string")) {
          resolve({ available: true, text: data.text?.trim() || null });
        } else reject(new Error("TLDR script request failed"));
      }
    };
    let timer = setTimeout(() => { cleanup(); resolve({ available: false, text: null }); }, 800);
    const ping = setInterval(() => send("ping"), 100);
    window.addEventListener("message", onMessage);
    send("ping");
  });
}

export async function fetchArxivTldr(id: string): Promise<string | null> {
  const hit = readCache(id);
  if (hit) return hit;
  let request = pending.get(id);
  if (!request) {
    request = loadArxivTldr(id).then((text) => {
      if (text) {
        const entry = { text, at: Date.now() };
        cache.set(id, entry);
        try { localStorage.setItem(`arxivhub:tldr:v1:${id}`, JSON.stringify(entry)); } catch { /* Optional cache. */ }
      }
      return text;
    }).finally(() => pending.delete(id));
    pending.set(id, request);
  }
  return request;
}

// 任一来源的空结果都不代表原站没有摘要，继续刷新或读取备用来源。
async function loadArxivTldr(id: string): Promise<string | null> {
  const bridge = await readFromUserscript(id).catch(() => null);
  if (bridge?.text) return bridge.text;
  try {
    // Extract the explicit TLDR paragraph, never the site's generic meta description.
    const text = await fetchExtractedTldr(id) ?? await fetchExtractedTldr(id, true);
    if (text) return text;
  } catch {
    // The public extraction API has a free quota; Reader remains a fallback.
  }
  // Reader 仅转发公开页面，提供 GitHub Pages 所需的跨域读取能力。
  const response = await fetch(`https://r.jina.ai/https://arxivtldr.org/abs/${encodeURIComponent(id)}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`ArXiv TLDR ${response.status}`);
  return parseArxivTldr(await response.text());
}
