import { createPaperMetricCache, type MetricSnapshot } from "./paper-metric-cache.ts";

export type OpenAlexCitations = { citationCount: number; url: string };
type LookupContext = { id: string; title?: string; doi?: string };

function normalizeId(raw: string): string {
  const id = raw.trim().replace(/v\d+$/i, "").toLowerCase();
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/.test(id)) {
    throw new Error("Invalid arXiv ID");
  }
  return id;
}

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function validCitations(value: unknown): value is OpenAlexCitations {
  return Boolean(value && typeof value === "object" && "citationCount" in value &&
    typeof value.citationCount === "number" && Number.isSafeInteger(value.citationCount) && value.citationCount >= 0 &&
    "url" in value && typeof value.url === "string" && /^https:\/\/openalex\.org\/W\d+$/.test(value.url));
}

function matchesArxivUrl(value: unknown, id: string): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const path = decodeURIComponent(url.pathname);
    let candidate: string | undefined;
    if (/^(?:(?:www|export)\.)?arxiv\.org$/.test(url.hostname)) {
      candidate = path.match(/^\/(?:abs|pdf|html)\/(.+?)\/?$/)?.[1].replace(/\.pdf$/i, "");
    } else if (/^(?:dx\.)?doi\.org$/.test(url.hostname)) {
      candidate = path.match(/^\/10\.48550\/arxiv\.(.+?)\/?$/i)?.[1];
    }
    return candidate !== undefined && normalizeId(candidate) === id;
  } catch { return false; }
}

export function parseOpenAlexWork(value: unknown, ctx: LookupContext): OpenAlexCitations | null {
  const id = normalizeId(ctx.id);
  if (!value || typeof value !== "object" || !("title" in value) || typeof value.title !== "string" ||
      (ctx.title && normalizeTitle(value.title) !== normalizeTitle(ctx.title)) ||
      !("locations" in value) || !Array.isArray(value.locations) || !value.locations.some((location: unknown) =>
        location && typeof location === "object" &&
        (("landing_page_url" in location && matchesArxivUrl(location.landing_page_url, id)) ||
          ("pdf_url" in location && matchesArxivUrl(location.pdf_url, id))))) return null;
  const result = { citationCount: "cited_by_count" in value ? value.cited_by_count : undefined,
    url: "id" in value ? value.id : undefined };
  if (!validCitations(result)) throw new Error("Invalid OpenAlex citation count or work URL");
  return result;
}

export function parseOpenAlexCitations(value: unknown, ctx: LookupContext): OpenAlexCitations | null {
  const id = normalizeId(ctx.id);
  const title = normalizeTitle(ctx.title ?? "");
  if (!value || typeof value !== "object" || !("results" in value) || !Array.isArray(value.results)) {
    throw new Error("Invalid OpenAlex search response");
  }
  if (!title) return null;
  for (const item of value.results) {
    const result = parseOpenAlexWork(item, { ...ctx, id });
    if (result) return result;
  }
  return null;
}

const DAY = 24 * 60 * 60 * 1000;
const RETRY_KEY = "arxivhub:openalex-citations:retry-at";
const BUDGET_KEY = "arxivhub:openalex-citations:budget-retry-at";
const ID_PREFIX = "arxivhub:openalex-work-id:v1:";
let retryAt = 0;
let budgetRetryAt = 0;
const identities = new Map<string, { workId: string; at: number }>();
const cache = createPaperMetricCache<OpenAlexCitations>({
  namespace: "openalex-citations:v1", ttl: DAY, maxAge: 7 * DAY, missingTtl: 5 * 60 * 1000,
  valid: validCitations,
});

export function readCachedOpenAlexCitations(rawId: string): MetricSnapshot<OpenAlexCitations> | undefined {
  try { return cache.peek(normalizeId(rawId)); } catch { return undefined; }
}

function rememberWork(id: string, value: OpenAlexCitations) {
  const entry = { workId: value.url.split("/").at(-1)!, at: Date.now() };
  identities.set(id, entry);
  try { localStorage.setItem(ID_PREFIX + id, JSON.stringify(entry)); } catch { /* Optional persistence. */ }
}

export function readCachedOpenAlexWorkId(rawId: string): string | undefined {
  const id = normalizeId(rawId);
  const cited = cache.peek(id)?.value;
  if (cited) return cited.url.split("/").at(-1);
  let entry = identities.get(id);
  try {
    const stored = JSON.parse(localStorage.getItem(ID_PREFIX + id) ?? "null");
    if (stored && typeof stored.workId === "string" && /^W\d+$/.test(stored.workId) &&
        Number.isFinite(stored.at) && (!entry || stored.at > entry.at)) entry = stored;
  } catch { /* Optional persistence. */ }
  return entry && entry.at <= Date.now() && Date.now() - entry.at < 180 * DAY ? entry.workId : undefined;
}

function forgetWork(id: string) {
  identities.delete(id);
  try { localStorage.removeItem(ID_PREFIX + id); } catch { /* Optional persistence. */ }
}

// Missing search results must not replace a successful cache entry or suppress a later title lookup.
class MissingCitations extends Error {}

function checkCooldown(search = false) {
  try {
    const stored = Number(localStorage.getItem(RETRY_KEY));
    if (Number.isFinite(stored)) retryAt = Math.max(retryAt, stored);
    const budget = Number(localStorage.getItem(BUDGET_KEY));
    if (Number.isFinite(budget)) budgetRetryAt = Math.max(budgetRetryAt, budget);
  } catch { /* The in-memory cooldown still works when storage is unavailable. */ }
  if (retryAt > Date.now()) throw new Error("OpenAlex 429");
  if (search && budgetRetryAt > Date.now()) throw new Error("OpenAlex daily budget exhausted");
}

function rateLimited(retryAfter: string | null, dailyBudget = false): never {
  const now = Date.now();
  const header = retryAfter?.trim() ?? "";
  const deadline = /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header);
  const midnightUtc = (Math.floor(now / DAY) + 1) * DAY;
  const fallback = dailyBudget ? midnightUtc : now + 5 * 60 * 1000;
  const until = Math.max(dailyBudget ? midnightUtc : 0, Number.isFinite(deadline) && deadline > now ? deadline : fallback);
  if (dailyBudget) budgetRetryAt = Math.max(budgetRetryAt, until);
  else retryAt = Math.max(retryAt, until);
  try { localStorage.setItem(dailyBudget ? BUDGET_KEY : RETRY_KEY, String(dailyBudget ? budgetRetryAt : retryAt)); } catch { /* Optional persistence. */ }
  throw new Error(dailyBudget ? "OpenAlex daily budget exhausted" : "OpenAlex 429");
}

async function requestWork(url: URL, search = false): Promise<unknown | null> {
  checkCooldown(search);
  const response = await fetch(url.href, { credentials: "omit", signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const text = await readErrorText(response);
    const dailyBudget = /insufficient\s+budget|\bdaily\s+(?:budget|quota|credits?(?:\s+limit)?)(?:\s+(?:is|has|been|already|fully)){0,4}\s+(?:exhausted|exceeded|depleted)\b/i.test(text);
    if (dailyBudget || response.status === 429) rateLimited(response.headers.get("retry-after"), dailyBudget);
    if (response.status === 404) return null;
    throw new Error(`OpenAlex ${response.status}`);
  }
  return response.json();
}

async function readErrorText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let remaining = 4096;
  let text = "";
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, remaining);
      text += decoder.decode(chunk, { stream: true });
      remaining -= chunk.byteLength;
    }
    return text + decoder.decode();
  } catch { return text; }
  finally { await reader.cancel().catch(() => undefined); }
}

export async function fetchOpenAlexCitations(ctx: LookupContext): Promise<OpenAlexCitations | null> {
  const id = normalizeId(ctx.id);
  const title = ctx.title?.trim();
  const doi = ctx.doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  const validDoi = doi && /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : undefined;
  if (!title && !validDoi && !readCachedOpenAlexWorkId(id)) return cache.peek(id)?.value ?? null;
  try {
    return await cache.get(id, async () => {
      // Fresh cached values remain usable even while the provider has paused requests.
      const workId = readCachedOpenAlexWorkId(id);
      const context = { id, title };
      // Single-entity lookups are free; keep Work IDs longer than citation counts.
      // A merged ID may redirect, so recheck the paper identity before remembering its new ID.
      const identifiers = [workId, validDoi ? `doi:${validDoi}` : undefined].filter((value): value is string => Boolean(value));
      for (const identifier of identifiers) {
        const url = new URL(`https://api.openalex.org/works/${encodeURIComponent(identifier)}`);
        url.searchParams.set("select", "id,title,cited_by_count,locations");
        const value = await requestWork(url);
        const result = value === null ? null : parseOpenAlexWork(value, context);
        if (result) { rememberWork(id, result); return result; }
        if (identifier === workId) forgetWork(id);
      }
      if (!title || !normalizeTitle(title)) throw new MissingCitations();
      const url = new URL("https://api.openalex.org/works");
      url.searchParams.set("search", title);
      url.searchParams.set("per-page", "5");
      url.searchParams.set("select", "id,title,cited_by_count,locations");
      const value = await requestWork(url, true);
      const result = value === null ? null : parseOpenAlexCitations(value, { id, title });
      if (result === null) throw new MissingCitations();
      rememberWork(id, result);
      return result;
    });
  } catch (error) {
    if (error instanceof MissingCitations) return null;
    throw error;
  }
}
